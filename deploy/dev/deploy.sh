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

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Companeon DEV Deployment${NC}"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo ""

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 > /dev/null 2>&1; then
    echo -e "${RED}Error: Not authenticated with gcloud. Run 'gcloud auth login'${NC}"
    exit 1
fi

# Set project
gcloud config set project ${PROJECT_ID}

SERVICE=$1

deploy_service() {
    local service=$1
    local context=$2
    local image="gcr.io/${PROJECT_ID}/companeon-${service}:${ENV}-latest"

    echo -e "${YELLOW}Building ${service}...${NC}"
    docker build --platform linux/amd64 -t ${image} ${context}

    echo -e "${YELLOW}Pushing ${service}...${NC}"
    docker push ${image}

    echo -e "${YELLOW}Deploying ${service}...${NC}"
    gcloud run deploy companeon-${service}-${ENV} \
        --image ${image} \
        --region ${REGION} \
        --platform managed \
        --quiet

    echo -e "${GREEN}${service} deployed!${NC}"
}

if [ -z "$SERVICE" ]; then
    # Deploy all services
    echo "Deploying all services..."
    deploy_service "agent" "./backend"
    deploy_service "api" "./services/api"
    deploy_service "worker" "./services/worker"
else
    # Deploy single service
    case $SERVICE in
        agent)
            deploy_service "agent" "./backend"
            ;;
        api)
            deploy_service "api" "./services/api"
            ;;
        worker)
            deploy_service "worker" "./services/worker"
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
gcloud run services list --region=${REGION} --filter="metadata.name~companeon.*-${ENV}" --format="table(metadata.name,status.url)"
