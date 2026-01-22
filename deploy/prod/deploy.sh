#!/bin/bash
# Companeon PROD Deployment Script
# Usage: ./deploy/prod/deploy.sh [service]
# Example: ./deploy/prod/deploy.sh agent  (deploy only agent)
#          ./deploy/prod/deploy.sh        (deploy all)

set -e

# Configuration (override with environment variables)
PROJECT_ID="${GCP_PROJECT:-companeon}"
REGION="${GCP_REGION:-us-central1}"
ENV="prod"
SUFFIX=""  # No suffix for prod (companeon-agent, companeon-api, etc.)
TAG=$(date +%Y%m%d-%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Companeon PRODUCTION Deployment${NC}"
echo -e "${RED}WARNING: This deploys to PRODUCTION${NC}"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Environment: ${ENV}"
echo "Tag: ${TAG}"
echo ""

# Confirmation prompt
read -p "Are you sure you want to deploy to PRODUCTION? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

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
    local image="gcr.io/${PROJECT_ID}/companeon-${service}"

    echo -e "${YELLOW}Building ${service}...${NC}"
    docker build --platform linux/amd64 -t ${image}:${TAG} -t ${image}:latest ${context}

    echo -e "${YELLOW}Pushing ${service}...${NC}"
    docker push ${image}:${TAG}
    docker push ${image}:latest

    echo -e "${YELLOW}Deploying ${service} to PROD...${NC}"

    # Service-specific configurations
    case $service in
        agent)
            gcloud run deploy companeon-${service} \
                --image ${image}:${TAG} \
                --region ${REGION} \
                --platform managed \
                --allow-unauthenticated \
                --memory 2Gi \
                --cpu 2 \
                --timeout 300 \
                --min-instances 1 \
                --max-instances 10 \
                --set-env-vars="NODE_ENV=production,SERVICE_NAME=companeon-${service}" \
                --quiet
            ;;
        api)
            gcloud run deploy companeon-${service} \
                --image ${image}:${TAG} \
                --region ${REGION} \
                --platform managed \
                --allow-unauthenticated \
                --memory 1Gi \
                --cpu 1 \
                --timeout 60 \
                --min-instances 1 \
                --max-instances 20 \
                --set-env-vars="NODE_ENV=production,SERVICE_NAME=companeon-${service}" \
                --quiet
            ;;
        worker)
            gcloud run deploy companeon-${service} \
                --image ${image}:${TAG} \
                --region ${REGION} \
                --platform managed \
                --no-allow-unauthenticated \
                --memory 1Gi \
                --cpu 1 \
                --min-instances 1 \
                --max-instances 5 \
                --set-env-vars="NODE_ENV=production,SERVICE_NAME=companeon-${service}" \
                --quiet
            ;;
    esac

    echo -e "${GREEN}${service} deployed!${NC}"
}

if [ -z "$SERVICE" ]; then
    # Deploy all services
    echo "Deploying all services to PRODUCTION..."
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
echo -e "${GREEN}PRODUCTION Deployment complete!${NC}"
echo "Tag: ${TAG}"
echo ""
echo "Service URLs:"
gcloud run services list --region=${REGION} --filter="metadata.name~companeon-(agent|api|worker)$" --format="table(metadata.name,status.url)"
