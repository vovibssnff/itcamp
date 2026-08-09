.PHONY: pull up down ps logs smoke config reset-data build build-frontend help

COMPOSE := docker compose --env-file .env -f compose.yaml

help:
	@echo "Targets: pull | build | build-frontend | up | down | ps | logs | smoke | config | reset-data"

pull:
	$(COMPOSE) pull

build:
	$(COMPOSE) build

build-frontend:
	$(COMPOSE) build frontend

up:
	$(COMPOSE) up -d --build frontend
	@$(COMPOSE) ps

down:
	$(COMPOSE) down

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=100

config:
	$(COMPOSE) config

smoke:
	@./scripts/smoke.sh

reset-data:
	$(COMPOSE) down -v
