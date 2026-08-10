# syntax=docker/dockerfile:1
FROM python:3.12-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY proto/ ./proto/
COPY scripts/ ./scripts/
COPY src/ ./src/
COPY data/ ./data/

# Стабы gRPC генерируются на сборке: артефакты кодогенерации в репозитории
# не хранятся, чтобы не расходиться с proto.
RUN bash scripts/gen_proto.sh

# Непривилегированный пользователь: требование к образам в контуре КИИ.
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin appuser \
 && chown -R appuser:appuser /app
USER appuser

EXPOSE 8081 50061

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8081/healthz', timeout=3).status==200 else 1)"

CMD ["python", "-m", "sim_engine.main", "--mode", "all"]
