.PHONY: help check venv install up down logs db-shell migrate verify clean api dashboard app alerts test lint

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

check:            ## Verify the toolchain is installed (run this first)
	@bash scripts/check-toolchain.sh

venv:             ## Create the Python 3.11 virtualenv
	python3.11 -m venv .venv
	./.venv/bin/python -m pip install --upgrade pip

install: venv     ## Install all Python dependencies
	./.venv/bin/pip install -e ".[dev]"

up:               ## Start Postgres, Redis, MinIO, TiTiler
	docker compose up -d
	@echo "waiting for database..."
	@until docker compose exec -T db pg_isready -U landslide >/dev/null 2>&1; do sleep 2; done
	@echo "database ready"

down:             ## Stop all services
	docker compose down

logs:             ## Tail service logs
	docker compose logs -f

db-shell:         ## Open a psql shell
	docker compose exec db psql -U landslide -d landslide

verify:           ## Confirm PostGIS + TimescaleDB are live
	@docker compose exec -T db psql -U landslide -d landslide -c \
	  "SELECT postgis_version() AS postgis, \
	          (SELECT extversion FROM pg_extension WHERE extname='timescaledb') AS timescale;"

migrate:          ## Apply database migrations
	./.venv/bin/alembic upgrade head

api:              ## Run the API (no database needed; serves the pipeline outputs)
	# Binds 0.0.0.0, not the default 127.0.0.1: a phone running the citizen app
	# cannot reach a loopback-only server even on the same wifi.
	./.venv/bin/uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

dashboard:        ## Run the officials' dashboard (needs `make api` in another shell)
	cd dashboard && npm install && npm run dev

test:             ## Run the test suite
	./.venv/bin/python -m pytest -q

lint:             ## Lint the codebase
	./.venv/bin/ruff check .

app:              ## Run the citizen app (web preview; needs `make api`)
	cd citizen-app && npm install && npx expo start --web

alerts:           ## Report whether the alerting layer could warn anyone
	./.venv/bin/python -m alerting.readiness

clean:            ## Remove containers and volumes (DESTROYS DATA)
	docker compose down -v
