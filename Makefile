# TheraVillage Development Makefile

.PHONY: help up down build logs clean db-reset test api-logs postgres-logs all-changes

# Load environment variables
include env.local
export

# Default target
help:
	@echo "TheraVillage Development Commands:"
	@echo ""
	@echo "  make up          - Start all services"
	@echo "  make down        - Stop all services"
	@echo "  make close       - Stop services and kill common dev ports"
	@echo "  make build       - Build/rebuild all services"

	@echo "  make logs        - Show logs from all services"
	@echo "  make api-logs    - Show API service logs"
	@echo "  make scraper-logs - Show scraper service logs"
	@echo "  make postgres-logs - Show database logs"
	@echo "  make clean       - Remove all containers and volumes"
	@echo "  make db-reset    - Reset database (removes all data)"
	@echo "  make test        - Run API tests"
	@echo "  make migrate     - Run database migrations (local)"
	@echo "  make migrate-prod - Run database migrations (production)"
	@echo "  make cleanup-jobs - Clean up stale scraper jobs (local)"
	@echo "  make all-changes - Apply all configuration changes for local dev"
	@echo ""

# Apply all configuration changes for local development
all-changes:
	@echo "🚀 Applying all configuration changes for local development..."
	@echo ""
	@echo "✅ Firebase configuration centralized in src/config/firebase.js"
	@echo "✅ Environment files cleaned up (no more duplication)"
	@echo "✅ Frontend configured to use local backend (localhost:8083)"
	@echo "✅ Backend configured for local development"
	@echo ""
	@echo "📋 Next steps:"
	@echo "   1. Run 'make up' to start backend services"
	@echo "   2. Run 'cd apps/web && pnpm dev' to start frontend"
	@echo "   3. Open http://localhost:5173 in your browser"
	@echo ""
	@echo "🔧 Available commands:"
	@echo "   - make up          # Start backend (database + API)"
	@echo "   - make down        # Stop backend services"
	@echo "   - make status      # Check service status"
	@echo "   - make logs        # View all logs"
	@echo "   - make api-logs    # View API logs only"
	@echo ""

# Start all services
up:
	docker-compose --env-file env.local up -d

# Start services and show logs
up-logs:
	docker-compose --env-file env.local up

# Stop all services
down:
	docker-compose --env-file env.local down

# Close local dev: stop containers and kill common dev ports
close:
	@echo "🛑 Closing local dev services and ports..."
	- docker-compose --env-file env.local down -v --remove-orphans
	@echo "🔪 Killing processes on ports 5173 (Vite), 8083 (API), 8001 (AI) if any..."
	- @for port in 5173 8083 8001; do \
		if lsof -ti :$$port >/dev/null 2>&1; then \
			kill -9 `lsof -ti :$$port`; \
			echo "Killed process on port $$port"; \
		fi; \
	done
	@echo "✅ Local environment closed."

# Build/rebuild all services
build:
	docker-compose --env-file env.local build --no-cache

# Build AI service only
build-ai:
	docker-compose --env-file env.local build --no-cache tv-ai

# Build API service only
build-api:
	docker-compose --env-file env.local build --no-cache tv-api

# Build API service for production (AMD64 platform)
build-api-prod:
	docker build --platform linux/amd64 -t us-central1-docker.pkg.dev/theravillage-edb89/tv/api:latest ./services/api

# Show logs from all services
logs:
	docker-compose --env-file env.local logs -f

# Show API service logs
api-logs:
	docker-compose --env-file env.local logs -f tv-api

# Show scraper service logs
scraper-logs:
	docker-compose --env-file env.local logs -f tv-scraper

# Show database logs
postgres-logs:
	docker-compose --env-file env.local logs -f tv-postgres

# Clean up everything
clean:
	docker-compose --env-file env.local down -v --remove-orphans
	docker system prune -f

# Reset database (removes all data)
db-reset:
	docker-compose --env-file env.local down -v
	docker volume rm theravillage_postgres_data || true
	docker-compose --env-file env.local up -d tv-postgres

# Run API tests
test:
	docker-compose --env-file env.local exec tv-api poetry run pytest

# Database migrations
migrate:
	docker-compose --env-file env.local exec tv-api poetry run python migrate_db.py migrate

migrate-rollback:
	docker-compose --env-file env.local exec tv-api poetry run python migrate_db.py rollback $(migration_name)

# Production migrations (Cloud Run)
migrate-prod:
	gcloud run jobs create migrate-db-$$(date +%Y%m%d-%H%M%S) \
		--image us-central1-docker.pkg.dev/theravillage-edb89/tv/api:latest \
		--command="python,migrate_db.py,migrate" \
		--region=us-central1 \
		--set-env-vars="ENVIRONMENT=production" \
		--max-retries=3 \
		--task-timeout=300s

# Production rollback (Cloud Run)
migrate-rollback-prod:
	@if [ -z "$(migration_name)" ]; then \
		echo "❌ Error: migration_name is required"; \
		echo "Usage: make migrate-rollback-prod migration_name=20250102_120000_treatment_scraping_system"; \
		exit 1; \
	fi
	gcloud run jobs create migrate-rollback-$$(date +%Y%m%d-%H%M%S) \
		--image us-central1-docker.pkg.dev/theravillage-edb89/tv/api:latest \
		--command="python,migrate_db.py,rollback,$(migration_name)" \
		--region=us-central1 \
		--set-env-vars="ENVIRONMENT=production" \
		--max-retries=1 \
		--task-timeout=300s

# Create new migration file
migration-create:
	@read -p "Enter migration name: " name; \
	cd services/api/migrations && \
	echo "-- Migration: $$name" > "$$(date +%Y%m%d_%H%M%S)_$$name.sql" && \
	echo "-- Date: $$(date +%Y-%m-%d)" >> "$$(date +%Y%m%d_%H%M%S)_$$name.sql" && \
	echo "-- Description: " >> "$$(date +%Y%m%d_%H%M%S)_$$name.sql" && \
	echo "" >> "$$(date +%Y%m%d_%H%M%S)_$$name.sql" && \
	echo "✅ Created migration: $$(date +%Y%m%d_%H%M%S)_$$name.sql"

# Access database shell
db-shell:
	docker-compose --env-file env.local exec tv-postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}

# Access API shell
api-shell:
	docker-compose --env-file env.local exec tv-api bash

# Check service status
status:
	docker-compose --env-file env.local ps

# Restart API service
restart-api:
	docker-compose --env-file env.local restart tv-api

# View API health
health:
	curl -s http://localhost:${API_PORT}/health

# View database info
db-info:
	docker-compose --env-file env.local exec tv-postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c "\l"

# Clean up stale scraper jobs (local)
cleanup-jobs:
	docker-compose --env-file env.local exec tv-scraper poetry run python -m app.cleanup_job

# Clean up stale scraper jobs with dry run (see what would be cleaned)
cleanup-jobs-dry:
	docker-compose --env-file env.local exec -e DRY_RUN=true tv-scraper poetry run python -m app.cleanup_job

# Manual cleanup via API endpoint (local development)
cleanup-jobs-api:
	curl -X POST "http://localhost:8002/jobs/cleanup"

# Adhoc production cleanup (run cleanup immediately in production)
cleanup-jobs-prod:
	curl -X POST "https://tv-scraper-326430627435.us-central1.run.app/jobs/cleanup"

# Trigger Cloud Scheduler manually (don't wait for 12-hour schedule)
cleanup-jobs-trigger:
	gcloud scheduler jobs run scraper-cleanup-schedule --location=us-central1 --project=theravillage-edb89

# Note: Production cleanup also runs automatically every 12 hours via Cloud Scheduler
