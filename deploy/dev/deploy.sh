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

# Deploy using --source (Cloud Build) - faster than local docker push
deploy_service() {
    local service=$1
    local context=$2
    local service_name="companeon-${service}${SUFFIX}"

    echo -e "${YELLOW}Deploying ${service_name} (Cloud Build)...${NC}"
    gcloud run deploy ${service_name} \
        --source ${context} \
        --region ${REGION} \
        --platform managed \
        --allow-unauthenticated \
        --set-env-vars="NODE_ENV=development,SERVICE_ENV=dev" \
        --quiet

    echo -e "${GREEN}${service_name} deployed!${NC}"
}

if [ -z "$SERVICE" ]; then
    # Deploy all services
    echo "Deploying all DEV services..."
    deploy_service "agent" "./agent"
    deploy_service "api" "./services/api"
    deploy_service "worker" "./services/worker"
else
    # Deploy single service
    case $SERVICE in
        agent)
            deploy_service "agent" "./agent"
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
gcloud run services list --region=${REGION} --filter="metadata.name~companeon-(agent|api|worker)-dev$" --format="table(metadata.name,status.url)"
