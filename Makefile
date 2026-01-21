# Companeon Makefile
# Usage: make [target]

.PHONY: help dev up down build deploy-dev deploy-prod setup-gcp secrets logs

# Default target
help:
	@echo "Companeon Platform Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start all services locally with docker-compose"
	@echo "  make up           - Start services in background"
	@echo "  make down         - Stop all services"
	@echo "  make build        - Build all Docker images"
	@echo "  make logs         - View logs from all services"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy-dev   - Deploy to dev environment"
	@echo "  make deploy-prod  - Deploy to production"
	@echo ""
	@echo "Setup:"
	@echo "  make setup-gcp    - Set up GCP project (APIs, IAM, etc.)"
	@echo "  make secrets      - Interactive secret setup"
	@echo ""
	@echo "Individual Services:"
	@echo "  make agent        - Start agent service only"
	@echo "  make api          - Start API service only"
	@echo "  make worker       - Start worker service only"

# Development
dev:
	docker-compose up

up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build

logs:
	docker-compose logs -f

# Individual services
agent:
	cd backend && npm run dev

api:
	cd services/api && npm run dev

worker:
	cd services/worker && npm run dev

# Install dependencies for all services
install:
	cd backend && npm install
	cd services/api && npm install
	cd services/worker && npm install

# Deployment
deploy-dev:
	chmod +x deploy/dev/deploy.sh
	./deploy/dev/deploy.sh

deploy-prod:
	chmod +x deploy/prod/deploy.sh
	./deploy/prod/deploy.sh

deploy-agent-dev:
	./deploy/dev/deploy.sh agent

deploy-api-dev:
	./deploy/dev/deploy.sh api

deploy-worker-dev:
	./deploy/dev/deploy.sh worker

# GCP Setup
setup-gcp:
	chmod +x scripts/setup-gcp.sh
	./scripts/setup-gcp.sh

secrets:
	chmod +x scripts/manage-secrets.sh
	./scripts/manage-secrets.sh setup

secrets-list:
	./scripts/manage-secrets.sh list

# Docker cleanup
clean:
	docker-compose down -v
	docker system prune -f

# View service URLs (after deployment)
urls:
	@echo "Service URLs:"
	@gcloud run services list --region=us-central1 --filter="metadata.name~companeon" --format="table(metadata.name,status.url)"
