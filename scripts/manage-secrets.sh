#!/bin/bash
# Companeon Secret Management Script
# Usage: ./scripts/manage-secrets.sh [command] [secret-name] [value]
#
# Commands:
#   list        - List all secrets
#   get NAME    - Get a secret value
#   set NAME    - Set a secret value (prompts for input)
#   create NAME VALUE - Create a new secret with value
#   delete NAME - Delete a secret
#   rotate NAME - Rotate a secret (create new version)

set -e

# Configuration (override with environment variable)
PROJECT_ID="${GCP_PROJECT:-companeon}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check gcloud auth
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -n1 > /dev/null; then
    echo -e "${RED}Error: Not authenticated. Run 'gcloud auth login'${NC}"
    exit 1
fi

gcloud config set project ${PROJECT_ID} --quiet

case "$1" in
    list)
        echo -e "${BLUE}Secrets in project ${PROJECT_ID}:${NC}"
        gcloud secrets list --format="table(name,createTime,replication.automatic)"
        ;;

    get)
        if [ -z "$2" ]; then
            echo -e "${RED}Usage: $0 get SECRET_NAME${NC}"
            exit 1
        fi
        echo -e "${YELLOW}Getting secret: $2${NC}"
        gcloud secrets versions access latest --secret="$2"
        echo ""
        ;;

    set)
        if [ -z "$2" ]; then
            echo -e "${RED}Usage: $0 set SECRET_NAME${NC}"
            exit 1
        fi
        echo -e "${YELLOW}Setting secret: $2${NC}"
        echo -n "Enter secret value: "
        read -s value
        echo ""

        if gcloud secrets describe "$2" >/dev/null 2>&1; then
            echo -n "$value" | gcloud secrets versions add "$2" --data-file=-
            echo -e "${GREEN}Secret $2 updated (new version created)${NC}"
        else
            echo -n "$value" | gcloud secrets create "$2" --data-file=-
            echo -e "${GREEN}Secret $2 created${NC}"
        fi
        ;;

    create)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo -e "${RED}Usage: $0 create SECRET_NAME SECRET_VALUE${NC}"
            exit 1
        fi
        if gcloud secrets describe "$2" >/dev/null 2>&1; then
            echo -e "${YELLOW}Secret $2 already exists, adding new version...${NC}"
            echo -n "$3" | gcloud secrets versions add "$2" --data-file=-
        else
            echo -n "$3" | gcloud secrets create "$2" --data-file=-
        fi
        echo -e "${GREEN}Secret $2 created/updated${NC}"
        ;;

    delete)
        if [ -z "$2" ]; then
            echo -e "${RED}Usage: $0 delete SECRET_NAME${NC}"
            exit 1
        fi
        echo -e "${YELLOW}Deleting secret: $2${NC}"
        read -p "Are you sure? (yes/no): " confirm
        if [ "$confirm" == "yes" ]; then
            gcloud secrets delete "$2" --quiet
            echo -e "${GREEN}Secret $2 deleted${NC}"
        else
            echo "Cancelled"
        fi
        ;;

    rotate)
        if [ -z "$2" ]; then
            echo -e "${RED}Usage: $0 rotate SECRET_NAME${NC}"
            exit 1
        fi
        echo -e "${YELLOW}Rotating secret: $2${NC}"
        echo -n "Enter new secret value: "
        read -s value
        echo ""
        echo -n "$value" | gcloud secrets versions add "$2" --data-file=-
        echo -e "${GREEN}Secret $2 rotated (new version created)${NC}"
        echo ""
        echo "Active versions:"
        gcloud secrets versions list "$2" --limit=3
        ;;

    setup)
        echo -e "${BLUE}Setting up required secrets...${NC}"
        echo ""
        echo "This will prompt you to enter values for each required secret."
        echo "Press Enter to skip any secret you don't have yet."
        echo ""

        secrets=(
            "google-genai-api-key:Google AI/Gemini API Key"
            "backend-delegation-key:Backend delegation private key (hex)"
            "pplx-api-key:Perplexity API Key"
            "cmc-api-key:CoinMarketCap API Key"
            "envio-api-key:Envio API Key"
            "stripe-secret-key:Stripe Secret Key"
            "stripe-webhook-secret:Stripe Webhook Secret"
            "internal-api-key:Internal API Key for service-to-service auth"
        )

        for secret_pair in "${secrets[@]}"; do
            IFS=':' read -r secret_name secret_desc <<< "$secret_pair"

            if gcloud secrets describe "$secret_name" >/dev/null 2>&1; then
                echo -e "${GREEN}✓${NC} $secret_name already exists"
            else
                echo -e "${YELLOW}$secret_desc ($secret_name):${NC}"
                echo -n "  Enter value (or press Enter to skip): "
                read -s value
                echo ""

                if [ -n "$value" ]; then
                    echo -n "$value" | gcloud secrets create "$secret_name" --data-file=- --quiet
                    echo -e "  ${GREEN}Created!${NC}"
                else
                    echo -e "  ${YELLOW}Skipped${NC}"
                fi
            fi
        done

        echo ""
        echo -e "${GREEN}Setup complete!${NC}"
        ;;

    sync)
        # Sync secrets from .env file to Secret Manager
        ENV_FILE="${2:-agent/.env}"
        if [ ! -f "$ENV_FILE" ]; then
            echo -e "${RED}Error: $ENV_FILE not found${NC}"
            exit 1
        fi

        echo -e "${BLUE}Syncing secrets from $ENV_FILE to Secret Manager...${NC}"
        echo ""

        # Define which env vars are sensitive and should be secrets
        # Format: ENV_VAR_NAME:secret-name-in-gcp
        SECRET_PAIRS="
            GOOGLE_GENAI_API_KEY:google-genai-api-key
            BACKEND_DELEGATION_KEY:backend-delegation-key
            PRIVATE_KEY:agent-private-key
            PRIVATE_KEY_ETH:agent-private-key-eth
            GAS_SPONSOR_KEY:gas-sponsor-key
            CMC_API_KEY:cmc-api-key
            PPLX_API_KEY:pplx-api-key
            ENVIO_API_KEY:envio-api-key
            ZEROX_API_KEY:zerox-api-key
            GATEWAY_API_KEY:gateway-api-key
            INTERNAL_API_KEY:internal-api-key
            ALCHEMY_RPC_URL:alchemy-rpc-url
            SEPOLIA_RPC_URL:sepolia-rpc-url
        "

        for pair in $SECRET_PAIRS; do
            env_var=$(echo "$pair" | cut -d':' -f1)
            secret_name=$(echo "$pair" | cut -d':' -f2)
            value=$(grep "^${env_var}=" "$ENV_FILE" | cut -d'=' -f2-)

            if [ -n "$value" ]; then
                if gcloud secrets describe "$secret_name" >/dev/null 2>&1; then
                    # Check if value changed
                    current=$(gcloud secrets versions access latest --secret="$secret_name" 2>/dev/null || echo "")
                    if [ "$current" != "$value" ]; then
                        echo -n "$value" | gcloud secrets versions add "$secret_name" --data-file=- --quiet
                        echo -e "${GREEN}Updated${NC} $secret_name"
                    else
                        echo -e "${BLUE}Unchanged${NC} $secret_name"
                    fi
                else
                    echo -n "$value" | gcloud secrets create "$secret_name" --data-file=- --quiet
                    echo -e "${GREEN}Created${NC} $secret_name"
                fi
            fi
        done

        echo ""
        echo -e "${GREEN}Sync complete!${NC}"
        echo ""
        echo "Grant Cloud Run service account access to secrets:"
        echo -e "${YELLOW}  make grant-secrets${NC}"
        ;;

    *)
        echo "Companeon Secret Manager"
        echo ""
        echo "Usage: $0 [command] [args]"
        echo ""
        echo "Commands:"
        echo "  list              List all secrets"
        echo "  get NAME          Get a secret value"
        echo "  set NAME          Set a secret (interactive)"
        echo "  create NAME VALUE Create a secret"
        echo "  delete NAME       Delete a secret"
        echo "  rotate NAME       Rotate a secret"
        echo "  setup             Interactive setup of required secrets"
        echo ""
        echo "Examples:"
        echo "  $0 list"
        echo "  $0 get google-genai-api-key"
        echo "  $0 set stripe-secret-key"
        echo "  $0 setup"
        ;;
esac
