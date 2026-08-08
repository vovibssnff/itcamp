.PHONY: pull up down ps logs smoke config reset-data help

COMPOSE := docker compose --env-file .env -f compose.yaml

help:
	@echo "Targets: pull | up | down | ps | logs | smoke | config | reset-data"

pull:
	$(COMPOSE) pull

up:
	$(COMPOSE) up -d
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
