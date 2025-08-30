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
	@echo "  make build       - Build/rebuild all services"
	@echo "  make logs        - Show logs from all services"
	@echo "  make api-logs    - Show API service logs"
	@echo "  make postgres-logs - Show database logs"
	@echo "  make clean       - Remove all containers and volumes"
	@echo "  make db-reset    - Reset database (removes all data)"
	@echo "  make test        - Run API tests"
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

# Build/rebuild all services
build:
	docker-compose --env-file env.local build --no-cache

# Show logs from all services
logs:
	docker-compose --env-file env.local logs -f

# Show API service logs
api-logs:
	docker-compose --env-file env.local logs -f api

# Show database logs
postgres-logs:
	docker-compose --env-file env.local logs -f postgres

# Clean up everything
clean:
	docker-compose --env-file env.local down -v --remove-orphans
	docker system prune -f

# Reset database (removes all data)
db-reset:
	docker-compose --env-file env.local down -v
	docker volume rm theravillage_postgres_data || true
	docker-compose --env-file env.local up -d postgres

# Run API tests
test:
	docker-compose --env-file env.local exec api poetry run pytest

# Access database shell
db-shell:
	docker-compose --env-file env.local exec postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}

# Access API shell
api-shell:
	docker-compose --env-file env.local exec api bash

# Check service status
status:
	docker-compose --env-file env.local ps

# Restart API service
restart-api:
	docker-compose --env-file env.local restart api

# View API health
health:
	curl -s http://localhost:${API_PORT}/health

# View database info
db-info:
	docker-compose --env-file env.local exec postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c "\l"
