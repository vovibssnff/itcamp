.PHONY: help test lint run index proto docker

help:
	@echo "make test    — прогон тестов (без внешних зависимостей)"
	@echo "make run     — запуск REST-сервиса на :8080"
	@echo "make index   — переиндексация справочных материалов"
	@echo "make proto   — генерация gRPC-стабов"
	@echo "make docker  — сборка образа"

test:
	cd tests && python3 -m unittest discover -s . -p 'test_*.py' -v

lint:
	ruff check src tests
	mypy src/ai_service --ignore-missing-imports

run:
	PYTHONPATH=src python3 -m ai_service.main --mode rest

grpc:
	PYTHONPATH=src python3 -m ai_service.main --mode grpc

index:
	PYTHONPATH=src python3 scripts/index_docs.py data/regulation data/index.jsonl

proto:
	bash scripts/gen_proto.sh

docker:
	docker build -t ktk/ai-service:1.0.0 .
