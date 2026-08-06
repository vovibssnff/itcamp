#!/usr/bin/env bash
# Генерация Python gRPC-стабов из .proto в libs/py-common/ktk_contracts.
# Использует grpcio-tools (см. libs/py-common/pyproject.toml). Buf-вариант — см. buf.gen.yaml.
#
# Запуск:  ./proto/gen.sh   (или make proto из корня репозитория)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROTO_DIR="${SCRIPT_DIR}"
OUT_DIR="${REPO_ROOT}/libs/py-common/ktk_contracts"

mkdir -p "${OUT_DIR}"

# Выбор python: активный venv, если есть, иначе python3
PYTHON="${PYTHON:-python3}"
if [ -x "${REPO_ROOT}/.venv/bin/python" ]; then
  PYTHON="${REPO_ROOT}/.venv/bin/python"
fi

echo ">> Генерация стабов из ${PROTO_DIR} -> ${OUT_DIR}"
"${PYTHON}" -m grpc_tools.protoc \
  -I "${PROTO_DIR}" \
  --python_out="${OUT_DIR}" \
  --grpc_python_out="${OUT_DIR}" \
  "${PROTO_DIR}/model_api.proto" \
  "${PROTO_DIR}/ai_api.proto"

# Сгенерированные *_pb2_grpc.py используют абсолютный импорт `import model_api_pb2`.
# Патчим на пакетный импорт, чтобы стабы работали как ktk_contracts.<...>.
for f in "${OUT_DIR}"/*_pb2_grpc.py; do
  sed -i -E 's/^import (model_api_pb2|ai_api_pb2) as /from ktk_contracts import \1 as /' "${f}"
done

touch "${OUT_DIR}/__init__.py"
echo ">> Готово. Проверка импорта:"
cd "${REPO_ROOT}/libs/py-common"
"${PYTHON}" -c "from ktk_contracts import model_api_pb2, model_api_pb2_grpc, ai_api_pb2, ai_api_pb2_grpc; print('ktk_contracts import OK')"
