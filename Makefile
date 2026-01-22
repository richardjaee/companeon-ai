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
	@echo "Quick Deploy DEV (Cloud Build - fastest):"
	@echo "  make deploy-agent-dev  - Deploy agent to DEV"
	@echo "  make deploy-api-dev    - Deploy API to DEV"
	@echo "  make deploy-worker-dev - Deploy worker to DEV"
	@echo ""
	@echo "Quick Deploy PROD (Cloud Build):"
	@echo "  make deploy-agent  - Deploy agent to PROD"
	@echo "  make deploy-api    - Deploy API to PROD"
	@echo "  make deploy-worker - Deploy worker to PROD"
	@echo ""
	@echo "Full Deployment:"
	@echo "  make deploy-dev   - Deploy all to dev environment"
	@echo "  make deploy-prod  - Deploy all to production"
	@echo ""
	@echo "Setup:"
	@echo "  make setup-gcp    - Set up GCP project (APIs, IAM, etc.)"
	@echo "  make secrets      - Interactive secret setup"
	@echo ""
	@echo "Individual Services (local):"
	@echo "  make agent        - Start agent service locally"
	@echo "  make api          - Start API service locally"
	@echo "  make worker       - Start worker service locally"

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

# Individual services (local)
agent:
	cd agent && npm run dev

api:
	cd services/api && npm run dev

worker:
	cd services/worker && npm run dev

# Install dependencies for all services
install:
	cd agent && npm install
	cd services/api && npm install
	cd services/worker && npm install

# Quick Deploy DEV - uses Cloud Build (no local docker push, faster)
deploy-agent-dev:
	@echo "Deploying agent-dev via Cloud Build..."
	gcloud run deploy companeon-agent-dev --source ./agent --region us-central1 --allow-unauthenticated --set-env-vars="NODE_ENV=development" --quiet

deploy-api-dev:
	@echo "Deploying api-dev via Cloud Build..."
	gcloud run deploy companeon-api-dev --source ./services/api --region us-central1 --allow-unauthenticated --set-env-vars="NODE_ENV=development" --quiet

deploy-worker-dev:
	@echo "Deploying worker-dev via Cloud Build..."
	gcloud run deploy companeon-worker-dev --source ./services/worker --region us-central1 --set-env-vars="NODE_ENV=development" --quiet

# Quick Deploy PROD - uses Cloud Build
deploy-agent:
	@echo "Deploying agent (PROD) via Cloud Build..."
	gcloud run deploy companeon-agent --source ./agent --region us-central1 --allow-unauthenticated --quiet

deploy-api:
	@echo "Deploying API (PROD) via Cloud Build..."
	gcloud run deploy companeon-api --source ./services/api --region us-central1 --allow-unauthenticated --quiet

deploy-worker:
	@echo "Deploying worker (PROD) via Cloud Build..."
	gcloud run deploy companeon-worker --source ./services/worker --region us-central1 --quiet

# Full Deployment
deploy-dev:
	chmod +x deploy/dev/deploy.sh
	./deploy/dev/deploy.sh

deploy-prod:
	chmod +x deploy/prod/deploy.sh
	./deploy/prod/deploy.sh

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
	@gcloud run services list --region=us-central1 --filter="metadata.name~companeon" --format="table(metadata.name,status.url)"
