#!/bin/bash
set -e

# Seed Azure Key Vault with secrets for Ginraidee microservices
# This script reads secrets from environment variables or prompts for input
# and uploads them to Azure Key Vault

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Azure Key Vault Secrets Seeding Script          ║${NC}"
echo -e "${BLUE}║  Ginraidee Microservices Platform                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI not found. Please install it first.${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq not found. Please install it first.${NC}"
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Azure. Running 'az login'...${NC}"
    az login
fi

# Get Key Vault name
echo ""
echo -e "${YELLOW}📦 Enter Azure Key Vault name:${NC}"
read -p "Key Vault name (e.g., ginraidee-dev-sea-kv): " KEY_VAULT_NAME

if [ -z "$KEY_VAULT_NAME" ]; then
    echo -e "${RED}❌ Key Vault name is required${NC}"
    exit 1
fi

# Verify Key Vault exists
echo -e "${BLUE}🔍 Verifying Key Vault exists...${NC}"
if ! az keyvault show --name "$KEY_VAULT_NAME" &> /dev/null; then
    echo -e "${RED}❌ Key Vault '$KEY_VAULT_NAME' not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Key Vault found${NC}"

# Function to set secret
set_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3

    if [ -z "$secret_value" ]; then
        echo -e "${YELLOW}⚠️  Skipping $secret_name (empty value)${NC}"
        return
    fi

    echo -e "${BLUE}  Setting: $secret_name${NC}"
    if az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "$secret_name" \
        --value "$secret_value" \
        --description "$description" \
        --output none; then
        echo -e "${GREEN}  ✓ $secret_name set successfully${NC}"
    else
        echo -e "${RED}  ❌ Failed to set $secret_name${NC}"
    fi
}

# Function to prompt for secret if not in environment
prompt_secret() {
    local var_name=$1
    local prompt_text=$2
    local is_sensitive=${3:-true}

    if [ -n "${!var_name}" ]; then
        echo "${!var_name}"
    else
        echo -e "${YELLOW}$prompt_text${NC}" >&2
        if [ "$is_sensitive" = true ]; then
            read -s -p "Enter value (hidden): " value >&2
            echo "" >&2
        else
            read -p "Enter value: " value >&2
        fi
        echo "$value"
    fi
}

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Collecting Secrets${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"

# Shared JWT Secret (used by all services for service-to-service auth)
echo -e "\n${YELLOW}🔐 JWT Secret (shared across all services)${NC}"
JWT_SECRET=$(prompt_secret "JWT_SECRET" "Enter JWT secret for service authentication")

# Database Connection String
echo -e "\n${YELLOW}🗄️  Database Configuration${NC}"
DB_HOST=$(prompt_secret "DB_HOST" "Enter PostgreSQL host (e.g., ginraidee-dev-sea-pgsql.postgres.database.azure.com)" false)
DB_PORT=$(prompt_secret "DB_PORT" "Enter PostgreSQL port (default: 5432)" false)
DB_PORT=${DB_PORT:-5432}
DB_NAME=$(prompt_secret "DB_NAME" "Enter database name (default: ginraidee)" false)
DB_NAME=${DB_NAME:-ginraidee}
DB_USER=$(prompt_secret "DB_USER" "Enter database username" false)
DB_PASSWORD=$(prompt_secret "DB_PASSWORD" "Enter database password")

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Auth Service Secrets
echo -e "\n${YELLOW}🔑 Auth Service - EntraID (Microsoft Azure AD)${NC}"
ENTRAID_CLIENT_ID=$(prompt_secret "ENTRAID_CLIENT_ID" "Enter EntraID Client ID" false)
ENTRAID_TENANT_ID=$(prompt_secret "ENTRAID_TENANT_ID" "Enter EntraID Tenant ID (or 'common')" false)
ENTRAID_TENANT_ID=${ENTRAID_TENANT_ID:-common}
ENTRAID_AUTHORITY="https://login.microsoftonline.com/${ENTRAID_TENANT_ID}"

# Recipe Service Secrets - Azure OpenAI (from Terraform outputs)
echo -e "\n${YELLOW}🤖 Recipe Service - Azure OpenAI${NC}"
if [ -f ../terraform/outputs.json ]; then
    echo -e "${BLUE}📖 Reading OpenAI credentials from Terraform outputs...${NC}"
    AZURE_OPENAI_ENDPOINT=$(cat ../terraform/outputs.json | jq -r '.openai_endpoint.value')
    AZURE_OPENAI_API_KEY=$(cd ../terraform && terraform output -raw openai_primary_key)
    AZURE_OPENAI_DEPLOYMENT=$(cat ../terraform/outputs.json | jq -r '.gpt4_deployment_name.value')
    echo -e "${GREEN}✓ OpenAI endpoint: $AZURE_OPENAI_ENDPOINT${NC}"
    echo -e "${GREEN}✓ OpenAI deployment: $AZURE_OPENAI_DEPLOYMENT${NC}"
else
    echo -e "${YELLOW}⚠️  Terraform outputs not found, prompting manually...${NC}"
    AZURE_OPENAI_API_KEY=$(prompt_secret "AZURE_OPENAI_API_KEY" "Enter Azure OpenAI API Key")
    AZURE_OPENAI_ENDPOINT=$(prompt_secret "AZURE_OPENAI_ENDPOINT" "Enter Azure OpenAI Endpoint" false)
    AZURE_OPENAI_DEPLOYMENT=$(prompt_secret "AZURE_OPENAI_DEPLOYMENT_NAME" "Enter deployment name (default: gpt-4)" false)
    AZURE_OPENAI_DEPLOYMENT=${AZURE_OPENAI_DEPLOYMENT:-gpt-4}
fi

# OCR Service Secrets - Azure Document Intelligence
echo -e "\n${YELLOW}📄 OCR Service - Azure Document Intelligence${NC}"
if [ -f ../terraform/outputs.json ]; then
    echo -e "${BLUE}📖 Reading Document Intelligence credentials from Terraform outputs...${NC}"
    AZURE_DOC_INTEL_ENDPOINT=$(cat ../terraform/outputs.json | jq -r '.document_intelligence_endpoint.value')
    AZURE_DOC_INTEL_KEY=$(cd ../terraform && terraform output -raw document_intelligence_primary_key)
    echo -e "${GREEN}✓ Document Intelligence endpoint: $AZURE_DOC_INTEL_ENDPOINT${NC}"
else
    echo -e "${YELLOW}⚠️  Terraform outputs not found, prompting manually...${NC}"
    AZURE_DOC_INTEL_ENDPOINT=$(prompt_secret "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT" "Enter Azure Document Intelligence Endpoint" false)
    AZURE_DOC_INTEL_KEY=$(prompt_secret "AZURE_DOCUMENT_INTELLIGENCE_KEY" "Enter Azure Document Intelligence Key")
fi

# Observability - SigNoz
echo -e "\n${YELLOW}📊 Observability - SigNoz${NC}"
SIGNOZ_ACCESS_TOKEN=$(prompt_secret "SIGNOZ_ACCESS_TOKEN" "Enter SigNoz access token (optional, press Enter to skip)")

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Uploading Secrets to Azure Key Vault${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"

# Database secrets
echo -e "\n${GREEN}📦 Database Secrets${NC}"
set_secret "database-connection-string" "$DATABASE_URL" "PostgreSQL connection string"

# Shared secrets
echo -e "\n${GREEN}🔑 Shared Secrets${NC}"
set_secret "auth-service-jwt-secret" "$JWT_SECRET" "JWT secret for auth service"
set_secret "inventory-service-jwt-secret" "$JWT_SECRET" "JWT secret for inventory service"
set_secret "ocr-service-jwt-secret" "$JWT_SECRET" "JWT secret for ocr service"
set_secret "recipe-service-jwt-secret" "$JWT_SECRET" "JWT secret for recipe service"

# Auth service secrets
echo -e "\n${GREEN}🔐 Auth Service Secrets${NC}"
set_secret "auth-service-entraid-client-id" "$ENTRAID_CLIENT_ID" "EntraID Client ID"
set_secret "auth-service-entraid-tenant-id" "$ENTRAID_TENANT_ID" "EntraID Tenant ID"
set_secret "auth-service-entraid-authority" "$ENTRAID_AUTHORITY" "EntraID Authority URL"

# Recipe service secrets
echo -e "\n${GREEN}🤖 Recipe Service Secrets${NC}"
set_secret "recipe-service-azure-openai-api-key" "$AZURE_OPENAI_API_KEY" "Azure OpenAI API Key"
set_secret "recipe-service-azure-openai-endpoint" "$AZURE_OPENAI_ENDPOINT" "Azure OpenAI Endpoint"
set_secret "recipe-service-azure-openai-deployment-name" "$AZURE_OPENAI_DEPLOYMENT" "Azure OpenAI Deployment"

# OCR service secrets
echo -e "\n${GREEN}📄 OCR Service Secrets${NC}"
set_secret "ocr-service-azure-document-intelligence-endpoint" "$AZURE_DOC_INTEL_ENDPOINT" "Azure Document Intelligence Endpoint"
set_secret "ocr-service-azure-document-intelligence-key" "$AZURE_DOC_INTEL_KEY" "Azure Document Intelligence Key"

# Observability secrets
if [ -n "$SIGNOZ_ACCESS_TOKEN" ]; then
    echo -e "\n${GREEN}📊 Observability Secrets${NC}"
    set_secret "signoz-access-token" "$SIGNOZ_ACCESS_TOKEN" "SigNoz access token"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Verification${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"

echo -e "\n${BLUE}📋 Listing all secrets in Key Vault...${NC}"
SECRET_COUNT=$(az keyvault secret list --vault-name "$KEY_VAULT_NAME" --query "length(@)" -o tsv)
echo -e "${GREEN}✓ Total secrets: $SECRET_COUNT${NC}"

echo ""
az keyvault secret list --vault-name "$KEY_VAULT_NAME" --query "[].{Name:name, Enabled:attributes.enabled, Created:attributes.created}" -o table

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Secrets seeded successfully!                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"

echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo -e "  1. Verify secrets in Azure Portal: Key Vault → Secrets"
echo -e "  2. Setup GitHub runner: ./scripts/setup-github-runner.sh"
echo -e "  3. Deploy services to AKS"
echo ""
echo -e "${BLUE}Key Vault: https://portal.azure.com/#@/resource/$(az keyvault show --name $KEY_VAULT_NAME --query id -o tsv)${NC}"
