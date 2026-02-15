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
	@echo "  make sync-secrets        - Sync dev secrets from agent/.env to Secret Manager"
	@echo "  make grant-secrets       - Grant Cloud Run access to dev secrets"
	@echo "  make sync-secrets-prod   - Sync prod secrets from agent/.env.prod to Secret Manager"
	@echo "  make grant-secrets-prod  - Grant Cloud Run access to prod secrets"
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

# Secrets management - Dev (companeon project)
sync-secrets:
	@echo "Syncing secrets from agent/.env to Secret Manager (dev)..."
	@chmod +x scripts/manage-secrets.sh
	@./scripts/manage-secrets.sh sync agent/.env

grant-secrets:
	@echo "Granting Cloud Run service account access to secrets (dev)..."
	@SA="$$(gcloud projects describe companeon --format='value(projectNumber)')-compute@developer.gserviceaccount.com"; \
	for secret in google-genai-api-key google-ai-studio-key backend-delegation-key agent-private-key gas-sponsor-key backend-subdelegation-key cmc-api-key pplx-api-key envio-api-key zerox-api-key gateway-api-key internal-api-key alchemy-rpc-url eth-mainnet-rpc-url sepolia-rpc-url treasury-address; do \
		if gcloud secrets describe $$secret >/dev/null 2>&1; then \
			gcloud secrets add-iam-policy-binding $$secret --member="serviceAccount:$$SA" --role="roles/secretmanager.secretAccessor" --quiet 2>/dev/null || true; \
			echo "Granted access to $$secret"; \
		fi; \
	done
	@echo "Done!"

# Secrets management - Prod (companeon-prod project)
sync-secrets-prod:
	@echo "Syncing secrets from agent/.env.prod to Secret Manager (prod)..."
	@chmod +x scripts/manage-secrets.sh
	@GCP_PROJECT=companeon-prod ./scripts/manage-secrets.sh sync agent/.env.prod

grant-secrets-prod:
	@echo "Granting Cloud Run service account access to secrets (prod)..."
	@SA="$$(gcloud projects describe companeon-prod --format='value(projectNumber)')-compute@developer.gserviceaccount.com"; \
	for secret in google-genai-api-key google-ai-studio-key backend-delegation-key agent-private-key gas-sponsor-key backend-subdelegation-key cmc-api-key pplx-api-key envio-api-key zerox-api-key gateway-api-key internal-api-key alchemy-rpc-url eth-mainnet-rpc-url treasury-address; do \
		if gcloud secrets describe $$secret --project=companeon-prod >/dev/null 2>&1; then \
			gcloud secrets add-iam-policy-binding $$secret --project=companeon-prod --member="serviceAccount:$$SA" --role="roles/secretmanager.secretAccessor" --quiet 2>/dev/null || true; \
			echo "Granted access to $$secret"; \
		fi; \
	done
	@echo "Done!"

# Container registry
REGISTRY=us-central1-docker.pkg.dev/companeon/cloud-run-source-deploy

# Agent secrets (referenced from Secret Manager)
AGENT_SECRETS=GOOGLE_GENAI_API_KEY=google-genai-api-key:latest,GOOGLE_AI_STUDIO_KEY=google-ai-studio-key:latest,BACKEND_DELEGATION_KEY=backend-delegation-key:latest,PRIVATE_KEY=agent-private-key:latest,GAS_SPONSOR_KEY=gas-sponsor-key:latest,BACKEND_SUBDELEGATION_KEY=backend-subdelegation-key:latest,CMC_API_KEY=cmc-api-key:latest,PPLX_API_KEY=pplx-api-key:latest,ENVIO_API_KEY=envio-api-key:latest,ZEROX_API_KEY=zerox-api-key:latest,GATEWAY_API_KEY=gateway-api-key:latest,INTERNAL_API_KEY=internal-api-key:latest,ALCHEMY_RPC_URL=alchemy-rpc-url:latest,ETH_MAINNET_RPC_URL=eth-mainnet-rpc-url:latest

# API secrets (referenced from Secret Manager)
API_SECRETS=TREASURY_ADDRESS=treasury-address:latest,INTERNAL_API_KEY=internal-api-key:latest,ALCHEMY_RPC_URL=alchemy-rpc-url:latest,ETH_MAINNET_RPC_URL=eth-mainnet-rpc-url:latest,CMC_API_KEY=cmc-api-key:latest

# Worker secrets (referenced from Secret Manager)
WORKER_SECRETS=BACKEND_SUBDELEGATION_KEY=backend-subdelegation-key:latest,CMC_API_KEY=cmc-api-key:latest,ZEROX_API_KEY=zerox-api-key:latest,SEPOLIA_RPC_URL=sepolia-rpc-url:latest,ALCHEMY_RPC_URL=alchemy-rpc-url:latest

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
		--update-secrets="$(API_SECRETS)" \
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

# Prod secrets (referenced from Secret Manager in companeon-prod project)
AGENT_SECRETS_PROD=GOOGLE_GENAI_API_KEY=google-genai-api-key:latest,GOOGLE_AI_STUDIO_KEY=google-ai-studio-key:latest,BACKEND_DELEGATION_KEY=backend-delegation-key:latest,PRIVATE_KEY=agent-private-key:latest,GAS_SPONSOR_KEY=gas-sponsor-key:latest,BACKEND_SUBDELEGATION_KEY=backend-subdelegation-key:latest,CMC_API_KEY=cmc-api-key:latest,PPLX_API_KEY=pplx-api-key:latest,ENVIO_API_KEY=envio-api-key:latest,ZEROX_API_KEY=zerox-api-key:latest,GATEWAY_API_KEY=gateway-api-key:latest,INTERNAL_API_KEY=internal-api-key:latest,ALCHEMY_RPC_URL=alchemy-rpc-url:latest,ETH_MAINNET_RPC_URL=eth-mainnet-rpc-url:latest,TREASURY_ADDRESS=treasury-address:latest

WORKER_SECRETS_PROD=BACKEND_SUBDELEGATION_KEY=backend-subdelegation-key:latest,CMC_API_KEY=cmc-api-key:latest,ZEROX_API_KEY=zerox-api-key:latest,ALCHEMY_RPC_URL=alchemy-rpc-url:latest

PROD_PROJECT=companeon-prod
PROD_REGION=us-central1
PROD_REGISTRY=us-central1-docker.pkg.dev/companeon-prod/cloud-run-source-deploy

# Quick Deploy PROD
deploy-agent:
	@echo "Building agent for PROD..."
	@docker build --platform linux/amd64 -t $(PROD_REGISTRY)/agent:latest ./agent
	@echo "Pushing to Artifact Registry..."
	@docker push $(PROD_REGISTRY)/agent:latest
	@echo "Deploying to Cloud Run (PROD)..."
	@gcloud run deploy companeon-agent \
		--project $(PROD_PROJECT) \
		--image $(PROD_REGISTRY)/agent:latest \
		--region $(PROD_REGION) \
		--allow-unauthenticated \
		--update-secrets="$(AGENT_SECRETS_PROD)" \
		--update-env-vars="SIGNER_MODE=DELEGATION,LOG_LEVEL=info,GOOGLE_CLOUD_PROJECT=$(PROD_PROJECT),CHAIN_ID=1" \
		--quiet
	@echo "Done! Agent deployed to PROD"

deploy-api:
	@echo "Building API for PROD..."
	@docker build --platform linux/amd64 -t $(PROD_REGISTRY)/api:latest ./services/api
	@echo "Pushing to Artifact Registry..."
	@docker push $(PROD_REGISTRY)/api:latest
	@echo "Deploying to Cloud Run (PROD)..."
	@gcloud run deploy companeon-api \
		--project $(PROD_PROJECT) \
		--image $(PROD_REGISTRY)/api:latest \
		--region $(PROD_REGION) \
		--allow-unauthenticated \
		--update-secrets="$(API_SECRETS)" \
		--update-env-vars="NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$(PROD_PROJECT)" \
		--quiet

deploy-worker:
	@echo "Building worker for PROD..."
	@docker build --platform linux/amd64 -t $(PROD_REGISTRY)/worker:latest ./services/worker
	@echo "Pushing to Artifact Registry..."
	@docker push $(PROD_REGISTRY)/worker:latest
	@echo "Deploying to Cloud Run (PROD)..."
	@gcloud run deploy companeon-worker \
		--project $(PROD_PROJECT) \
		--image $(PROD_REGISTRY)/worker:latest \
		--region $(PROD_REGION) \
		--update-secrets="$(WORKER_SECRETS_PROD)" \
		--update-env-vars="NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$(PROD_PROJECT)" \
		--quiet

# Frontend deploy DEV
deploy-frontend-dev:
	@echo "Building frontend for DEV..."
	@docker build --platform linux/amd64 \
		--build-arg NEXT_PUBLIC_BACKEND_DELEGATION_ADDRESS=0x9DF3E1A96a36BF64fD81a9CC37a2ae9107bE690D \
		--build-arg NEXT_PUBLIC_TREASURY_ADDRESS=0x9DF3E1A96a36BF64fD81a9CC37a2ae9107bE690D \
		-t $(REGISTRY)/frontend:dev ./frontend
	@echo "Pushing to Artifact Registry..."
	@docker push $(REGISTRY)/frontend:dev
	@echo "Deploying to Cloud Run..."
	@gcloud run deploy companeon-frontend-dev \
		--image $(REGISTRY)/frontend:dev \
		--region us-central1 \
		--allow-unauthenticated \
		--port 3000 \
		--memory 2Gi \
		--cpu 2 \
		--update-env-vars="NODE_ENV=production,NEXT_TELEMETRY_DISABLED=1" \
		--quiet
	@echo "Done! Frontend deployed to DEV"

# Frontend deploy PROD
deploy-frontend:
	@echo "Building frontend for PROD..."
	@docker build --platform linux/amd64 \
		--build-arg NEXT_PUBLIC_BACKEND_DELEGATION_ADDRESS=0x1F46E38D67507a845aD3FF1321297640E35D88b4 \
		--build-arg NEXT_PUBLIC_TREASURY_ADDRESS=0x768E174c570bDb5d5E86201c393A1805fa2C2C02 \
		-t $(PROD_REGISTRY)/frontend:latest ./frontend
	@echo "Pushing to Artifact Registry..."
	@docker push $(PROD_REGISTRY)/frontend:latest
	@echo "Deploying to Cloud Run (PROD)..."
	@gcloud run deploy companeon-frontend \
		--project $(PROD_PROJECT) \
		--image $(PROD_REGISTRY)/frontend:latest \
		--region $(PROD_REGION) \
		--allow-unauthenticated \
		--port 3000 \
		--memory 4Gi \
		--cpu 2 \
		--update-env-vars="NODE_ENV=production,NEXT_TELEMETRY_DISABLED=1" \
		--quiet
	@echo "Done! Frontend deployed to PROD"

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
