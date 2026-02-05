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
	@echo "Secrets (run once, then on secret changes):"
	@echo "  make sync-secrets   - Sync secrets from agent/.env to Secret Manager"
	@echo "  make grant-secrets  - Grant Cloud Run access to secrets"
	@echo ""
	@echo "Quick Deploy DEV (Cloud Build - uses Secret Manager):"
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

# Secrets management
sync-secrets:
	@echo "Syncing secrets from agent/.env to Secret Manager..."
	@chmod +x scripts/manage-secrets.sh
	@./scripts/manage-secrets.sh sync agent/.env

grant-secrets:
	@echo "Granting Cloud Run service account access to secrets..."
	@SA="$$(gcloud projects describe companeon --format='value(projectNumber)')-compute@developer.gserviceaccount.com"; \
	for secret in google-genai-api-key backend-delegation-key agent-private-key agent-private-key-eth gas-sponsor-key transfer-agent-private-key dca-agent-private-key cmc-api-key pplx-api-key envio-api-key zerox-api-key gateway-api-key internal-api-key alchemy-rpc-url sepolia-rpc-url; do \
		if gcloud secrets describe $$secret >/dev/null 2>&1; then \
			gcloud secrets add-iam-policy-binding $$secret --member="serviceAccount:$$SA" --role="roles/secretmanager.secretAccessor" --quiet 2>/dev/null || true; \
			echo "Granted access to $$secret"; \
		fi; \
	done
	@echo "Done!"

# Container registry
REGISTRY=us-central1-docker.pkg.dev/companeon/cloud-run-source-deploy

# Agent secrets (referenced from Secret Manager)
AGENT_SECRETS=GOOGLE_GENAI_API_KEY=google-genai-api-key:latest,GOOGLE_AI_STUDIO_KEY=google-ai-studio-key:latest,BACKEND_DELEGATION_KEY=backend-delegation-key:latest,PRIVATE_KEY=agent-private-key:latest,TRANSFER_AGENT_PRIVATE_KEY=transfer-agent-private-key:latest,DCA_AGENT_PRIVATE_KEY=dca-agent-private-key:latest,CMC_API_KEY=cmc-api-key:latest,PPLX_API_KEY=pplx-api-key:latest,ENVIO_API_KEY=envio-api-key:latest,ZEROX_API_KEY=zerox-api-key:latest,GATEWAY_API_KEY=gateway-api-key:latest,INTERNAL_API_KEY=internal-api-key:latest,ALCHEMY_RPC_URL=alchemy-rpc-url:latest,ETH_MAINNET_RPC_URL=eth-mainnet-rpc-url:latest

# Worker secrets (referenced from Secret Manager)
WORKER_SECRETS=TRANSFER_AGENT_PRIVATE_KEY=transfer-agent-private-key:latest,DCA_AGENT_PRIVATE_KEY=dca-agent-private-key:latest,CMC_API_KEY=cmc-api-key:latest,SEPOLIA_RPC_URL=sepolia-rpc-url:latest,ALCHEMY_RPC_URL=alchemy-rpc-url:latest

# Quick Deploy DEV - local build + push (fast, uses Docker cache)
deploy-agent-dev:
	@echo "Building agent locally..."
	@docker build --platform linux/amd64 -t $(REGISTRY)/agent:dev ./agent
	@echo "Pushing to Artifact Registry..."
	@docker push $(REGISTRY)/agent:dev
	@echo "Deploying to Cloud Run..."
	@gcloud run deploy companeon-agent-dev \
		--image $(REGISTRY)/agent:dev \
		--region us-central1 \
		--allow-unauthenticated \
		--update-secrets="$(AGENT_SECRETS)" \
		--update-env-vars="SIGNER_MODE=DELEGATION,LOG_LEVEL=info,GOOGLE_CLOUD_PROJECT=companeon,PUBLIC_URL=https://companeon-agent-dev-440170696844.us-central1.run.app" \
		--quiet
	@echo "Done! https://companeon-agent-dev-440170696844.us-central1.run.app"

deploy-api-dev:
	@echo "Building api locally..."
	@docker build --platform linux/amd64 -t $(REGISTRY)/api:dev ./services/api
	@echo "Pushing to Artifact Registry..."
	@docker push $(REGISTRY)/api:dev
	@echo "Deploying to Cloud Run..."
	@gcloud run deploy companeon-api-dev \
		--image $(REGISTRY)/api:dev \
		--region us-central1 \
		--allow-unauthenticated \
		--update-env-vars="NODE_ENV=development,GOOGLE_CLOUD_PROJECT=companeon" \
		--quiet

deploy-worker-dev:
	@echo "Building worker locally..."
	@docker build --platform linux/amd64 -t $(REGISTRY)/worker:dev ./services/worker
	@echo "Pushing to Artifact Registry..."
	@docker push $(REGISTRY)/worker:dev
	@echo "Deploying to Cloud Run..."
	@gcloud run deploy companeon-worker-dev \
		--image $(REGISTRY)/worker:dev \
		--region us-central1 \
		--update-secrets="$(WORKER_SECRETS)" \
		--update-env-vars="NODE_ENV=development,GOOGLE_CLOUD_PROJECT=companeon,ENABLE_TRANSFER_AGENT=true" \
		--quiet

# Quick Deploy PROD - uses Cloud Build
deploy-agent:
	@echo "Deploying agent (PROD) via Cloud Build (preserving env vars)..."
	gcloud run deploy companeon-agent --source ./agent --region us-central1 --allow-unauthenticated --quiet

deploy-api:
	@echo "Deploying API (PROD) via Cloud Build (preserving env vars)..."
	gcloud run deploy companeon-api --source ./services/api --region us-central1 --allow-unauthenticated --quiet

deploy-worker:
	@echo "Deploying worker (PROD) via Cloud Build (preserving env vars)..."
	gcloud run deploy companeon-worker --source ./services/worker --region us-central1 --quiet

# Update env vars without redeploying code
update-env-agent-dev:
	@echo "Updating agent-dev env vars..."
	gcloud run services update companeon-agent-dev --region us-central1 --update-env-vars="$(VARS)"

update-env-api-dev:
	@echo "Updating api-dev env vars..."
	gcloud run services update companeon-api-dev --region us-central1 --update-env-vars="$(VARS)"

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
