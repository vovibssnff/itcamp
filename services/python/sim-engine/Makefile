.PHONY: help test lint run grpc demo proto docker venv

ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
# Предпочитаем локальный .venv, если он есть.
PYTHON ?= $(shell if [ -x "$(ROOT).venv/bin/python" ]; then echo "$(ROOT).venv/bin/python"; else echo python3; fi)

help:
	@echo "make venv    — создать .venv и поставить зависимости"
	@echo "make test    — прогон тестов (физика, интерлоки, неисправности, детерминизм)"
	@echo "make run     — запуск sim-worker (REST Model API) на :8081"
	@echo "make grpc    — запуск sim-worker (gRPC Model API) на :50061"
	@echo "make demo    — headless-прогон одного сценария неисправности"
	@echo "make proto   — генерация gRPC-стабов"
	@echo "make docker  — сборка образа"

venv:
	python3 -m venv "$(ROOT).venv"
	"$(ROOT).venv/bin/pip" install -r requirements-dev.txt

test:
	cd "$(ROOT)tests" && PYTHONPATH="$(ROOT)src" $(PYTHON) -m unittest discover -s . -p 'test_*.py' -v

lint:
	$(PYTHON) -m ruff check src tests
	$(PYTHON) -m mypy src/sim_engine --ignore-missing-imports

run:
	PYTHONPATH="$(ROOT)src" $(PYTHON) -m sim_engine.main --mode rest

grpc:
	PYTHONPATH="$(ROOT)src" $(PYTHON) -m sim_engine.main --mode grpc

demo:
	PYTHONPATH="$(ROOT)src" $(PYTHON) "$(ROOT)scripts/demo.py"

proto:
	bash "$(ROOT)scripts/gen_proto.sh"

docker:
	docker build -t ktk/sim-worker:1.0.0 "$(ROOT)"
