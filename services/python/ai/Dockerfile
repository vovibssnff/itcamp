# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY proto/ ./proto/
COPY scripts/ ./scripts/
COPY src/ ./src/
COPY data/ ./data/

# Стабы gRPC генерируются на сборке: артефакты кодогенерации в репозитории
# не хранятся, чтобы не расходиться с proto.
RUN bash scripts/gen_proto.sh

# Индекс справочного корпуса собирается заранее — под не тратит время на
# разбор регламента при старте и не требует pdfplumber в рантайме.
RUN python scripts/index_docs.py data/regulation data/index.jsonl || \
    echo "Каталог регламента пуст — индекс будет собран при старте"

# Непривилегированный пользователь: требование к образам в контуре КИИ.
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin appuser \
 && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080 50051

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/healthz', timeout=3).status==200 else 1)"

CMD ["python", "-m", "ai_service.main", "--mode", "rest"]
