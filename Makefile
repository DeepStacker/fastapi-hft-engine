.PHONY: up down build logs init-db test clean migrate-up migrate-down migrate-create migrate-history migrate-current

up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build

logs:
	docker-compose logs -f

init-db:
	docker-compose exec timescaledb psql -U stockify -d stockify_db -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
	docker-compose exec gateway alembic upgrade head

test:
	docker-compose exec gateway pytest tests/ -v

clean:
	docker-compose down -v
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

# Alembic migration commands
migrate-create:
	docker-compose exec gateway alembic revision --autogenerate -m "$(message)"

migrate-up:
	docker-compose exec gateway alembic upgrade head

migrate-down:
	docker-compose exec gateway alembic downgrade -1

migrate-history:
	docker-compose exec gateway alembic history

migrate-current:
	docker-compose exec gateway alembic current
