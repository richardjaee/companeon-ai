#!/bin/bash
# Companeon GCP Project Setup Script
# Usage: ./scripts/setup-gcp.sh
#
# This script sets up all required GCP services for the Companeon platform.
# Run this once when setting up a new environment.

set -e

# Configuration (override with environment variables)
PROJECT_ID="${GCP_PROJECT:-companeon}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_ACCOUNT_NAME="companeon-backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Companeon GCP Project Setup            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "Project ID: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo ""

# Check if gcloud is authenticated
echo -e "${YELLOW}Checking authentication...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 > /dev/null 2>&1; then
    echo -e "${RED}Error: Not authenticated with gcloud.${NC}"
    echo "Run: gcloud auth login"
    exit 1
fi
echo -e "${GREEN}✓ Authenticated${NC}"

# Set project
echo -e "${YELLOW}Setting project...${NC}"
gcloud config set project ${PROJECT_ID}
echo -e "${GREEN}✓ Project set to ${PROJECT_ID}${NC}"

# ========================================
# Enable APIs
# ========================================
echo ""
echo -e "${YELLOW}Enabling APIs...${NC}"

apis=(
    "firestore.googleapis.com"
    "cloudkms.googleapis.com"
    "secretmanager.googleapis.com"
    "run.googleapis.com"
    "cloudbuild.googleapis.com"
    "containerregistry.googleapis.com"
    "aiplatform.googleapis.com"
)

for api in "${apis[@]}"; do
    echo "  Enabling ${api}..."
    gcloud services enable ${api} --quiet 2>/dev/null || true
done
echo -e "${GREEN}✓ APIs enabled${NC}"

# ========================================
# Create Service Account
# ========================================
echo ""
echo -e "${YELLOW}Setting up service account...${NC}"

SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Check if service account exists
if gcloud iam service-accounts describe ${SERVICE_ACCOUNT_EMAIL} >/dev/null 2>&1; then
    echo "  Service account already exists"
else
    echo "  Creating service account..."
    gcloud iam service-accounts create ${SERVICE_ACCOUNT_NAME} \
        --display-name="Companeon Backend Service Account"
fi

# Grant roles
echo "  Granting IAM roles..."
roles=(
    "roles/datastore.user"
    "roles/cloudkms.cryptoKeyEncrypterDecrypter"
    "roles/secretmanager.secretAccessor"
    "roles/aiplatform.user"
    "roles/logging.logWriter"
)

for role in "${roles[@]}"; do
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="${role}" \
        --quiet 2>/dev/null || true
done
echo -e "${GREEN}✓ Service account configured: ${SERVICE_ACCOUNT_EMAIL}${NC}"

# ========================================
# Setup Firestore
# ========================================
echo ""
echo -e "${YELLOW}Setting up Firestore...${NC}"

# Check if Firestore already initialized
if gcloud firestore databases describe --database="(default)" >/dev/null 2>&1; then
    echo "  Firestore already initialized"
else
    echo "  Creating Firestore database..."
    gcloud firestore databases create --region=${REGION} --type=firestore-native 2>/dev/null || true
fi
echo -e "${GREEN}✓ Firestore ready${NC}"

# ========================================
# Setup Cloud KMS
# ========================================
echo ""
echo -e "${YELLOW}Setting up Cloud KMS...${NC}"

KEYRING_NAME="companeon-keyring"

# Check if keyring exists
if gcloud kms keyrings describe ${KEYRING_NAME} --location=${REGION} >/dev/null 2>&1; then
    echo "  Keyring already exists"
else
    echo "  Creating keyring..."
    gcloud kms keyrings create ${KEYRING_NAME} --location=${REGION}
fi

# Create encryption keys
keys=(
    "backend-key-encryption"
    "totp-encryption"
    "delegation-encryption"
)

for key in "${keys[@]}"; do
    if gcloud kms keys describe ${key} --keyring=${KEYRING_NAME} --location=${REGION} >/dev/null 2>&1; then
        echo "  Key ${key} already exists"
    else
        echo "  Creating key ${key}..."
        gcloud kms keys create ${key} \
            --keyring=${KEYRING_NAME} \
            --location=${REGION} \
            --purpose=encryption
    fi
done
echo -e "${GREEN}✓ Cloud KMS configured${NC}"

# ========================================
# Setup Secret Manager
# ========================================
echo ""
echo -e "${YELLOW}Setting up Secret Manager...${NC}"

# List of required secrets (will be created as placeholders)
secrets=(
    "google-genai-api-key"
    "backend-delegation-key"
    "pplx-api-key"
    "cmc-api-key"
    "envio-api-key"
    "stripe-secret-key"
    "stripe-webhook-secret"
    "internal-api-key"
    "dca-agent-private-key"
)

echo "  Required secrets (create manually with actual values):"
for secret in "${secrets[@]}"; do
    if gcloud secrets describe ${secret} >/dev/null 2>&1; then
        echo -e "    ${GREEN}✓${NC} ${secret} (exists)"
    else
        echo -e "    ${YELLOW}○${NC} ${secret} (needs to be created)"
        # Create empty placeholder
        # echo -n "PLACEHOLDER" | gcloud secrets create ${secret} --data-file=- 2>/dev/null || true
    fi
done

echo ""
echo "  To create a secret, run:"
echo -e "    ${BLUE}echo -n 'your-secret-value' | gcloud secrets create SECRET_NAME --data-file=-${NC}"
echo -e "${GREEN}✓ Secret Manager ready${NC}"

# ========================================
# Summary
# ========================================
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Setup Complete!                        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service Account: ${SERVICE_ACCOUNT_EMAIL}"
echo ""
echo "Next steps:"
echo "  1. Create secrets with actual values (see list above)"
echo "  2. Copy .env.example files and fill in values"
echo "  3. Run: docker-compose up (for local development)"
echo "  4. Run: ./deploy/dev/deploy.sh (for dev deployment)"
echo ""
echo -e "${GREEN}Happy building!${NC}"
