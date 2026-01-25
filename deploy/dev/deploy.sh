#!/bin/bash
# Companeon DEV Deployment Script
# Usage: ./deploy/dev/deploy.sh [service]
# Example: ./deploy/dev/deploy.sh agent  (deploy only agent)
#          ./deploy/dev/deploy.sh        (deploy all)

set -e

# Configuration (override with environment variables)
PROJECT_ID="${GCP_PROJECT:-companeon}"
REGION="${GCP_REGION:-us-central1}"
ENV="dev"
SUFFIX="-dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Companeon DEV Deployment${NC}"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Environment: ${ENV}"
echo ""

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 > /dev/null 2>&1; then
    echo -e "${RED}Error: Not authenticated with gcloud. Run 'gcloud auth login'${NC}"
    exit 1
fi

# Set project
gcloud config set project ${PROJECT_ID}

SERVICE=$1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Agent secrets from Secret Manager
AGENT_SECRETS="GOOGLE_GENAI_API_KEY=google-genai-api-key:latest"
AGENT_SECRETS="${AGENT_SECRETS},BACKEND_DELEGATION_KEY=backend-delegation-key:latest"
AGENT_SECRETS="${AGENT_SECRETS},PRIVATE_KEY=agent-private-key:latest"
AGENT_SECRETS="${AGENT_SECRETS},CMC_API_KEY=cmc-api-key:latest"
AGENT_SECRETS="${AGENT_SECRETS},PPLX_API_KEY=pplx-api-key:latest"
AGENT_SECRETS="${AGENT_SECRETS},ENVIO_API_KEY=envio-api-key:latest"
AGENT_SECRETS="${AGENT_SECRETS},GATEWAY_API_KEY=gateway-api-key:latest"
AGENT_SECRETS="${AGENT_SECRETS},INTERNAL_API_KEY=internal-api-key:latest"
AGENT_SECRETS="${AGENT_SECRETS},ALCHEMY_RPC_URL=alchemy-rpc-url:latest"

# Non-sensitive env vars (PORT is set automatically by Cloud Run)
AGENT_ENV="SIGNER_MODE=DELEGATION,LOG_LEVEL=info,GOOGLE_CLOUD_PROJECT=companeon"
API_ENV="NODE_ENV=development,GOOGLE_CLOUD_PROJECT=companeon"
WORKER_ENV="NODE_ENV=development,GOOGLE_CLOUD_PROJECT=companeon"

# Deploy agent with secrets from Secret Manager
deploy_agent() {
    local service_name="companeon-agent${SUFFIX}"
    echo -e "${YELLOW}Deploying ${service_name} (with Secret Manager)...${NC}"

    gcloud run deploy ${service_name} \
        --source ./agent \
        --region ${REGION} \
        --platform managed \
        --allow-unauthenticated \
        --update-secrets="${AGENT_SECRETS}" \
        --update-env-vars="${AGENT_ENV}" \
        --quiet

    echo -e "${GREEN}${service_name} deployed!${NC}"
}

# Deploy API service
deploy_api() {
    local service_name="companeon-api${SUFFIX}"
    echo -e "${YELLOW}Deploying ${service_name}...${NC}"

    gcloud run deploy ${service_name} \
        --source ./services/api \
        --region ${REGION} \
        --platform managed \
        --allow-unauthenticated \
        --update-env-vars="${API_ENV}" \
        --quiet

    echo -e "${GREEN}${service_name} deployed!${NC}"
}

# Deploy worker service
deploy_worker() {
    local service_name="companeon-worker${SUFFIX}"
    echo -e "${YELLOW}Deploying ${service_name}...${NC}"

    gcloud run deploy ${service_name} \
        --source ./services/worker \
        --region ${REGION} \
        --platform managed \
        --update-env-vars="${WORKER_ENV}" \
        --quiet

    echo -e "${GREEN}${service_name} deployed!${NC}"
}

if [ -z "$SERVICE" ]; then
    # Deploy all services
    echo "Deploying all DEV services..."
    deploy_agent
    deploy_api
    deploy_worker
else
    # Deploy single service
    case $SERVICE in
        agent)
            deploy_agent
            ;;
        api)
            deploy_api
            ;;
        worker)
            deploy_worker
            ;;
        *)
            echo -e "${RED}Unknown service: $SERVICE${NC}"
            echo "Valid services: agent, api, worker"
            exit 1
            ;;
    esac
fi

echo ""
echo -e "${GREEN}DEV Deployment complete!${NC}"
echo ""
echo "Service URLs:"
gcloud run services list --region=${REGION} --filter="metadata.name~companeon-(agent|api|worker)-dev$" --format="table(metadata.name,status.url)"
