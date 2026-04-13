#!/bin/bash
set -e

# Setup GitHub Secrets from Terraform Outputs
# This script automatically sets all required GitHub repository secrets

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  GitHub Secrets Setup from Terraform              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) not found${NC}"
    echo -e "${YELLOW}Install it with: brew install gh${NC}"
    echo -e "${YELLOW}Or visit: https://cli.github.com/${NC}"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}🔐 Not authenticated with GitHub${NC}"
    echo -e "${YELLOW}Running: gh auth login${NC}"
    gh auth login
fi

echo -e "${GREEN}✓ GitHub CLI authenticated${NC}"
echo ""

# Check if terraform outputs exist
if [ ! -f terraform/outputs.json ]; then
    echo -e "${YELLOW}📊 Terraform outputs not found, generating...${NC}"
    cd terraform
    terraform output -json > outputs.json
    cd ..
    echo -e "${GREEN}✓ Terraform outputs generated${NC}"
fi

# Read Terraform outputs
echo -e "${BLUE}📖 Reading Terraform outputs...${NC}"
AKS_CLUSTER_NAME=$(cat terraform/outputs.json | jq -r '.aks_cluster_name.value')
RESOURCE_GROUP=$(cat terraform/outputs.json | jq -r '.resource_group_name.value')
KEY_VAULT_NAME=$(cat terraform/outputs.json | jq -r '.key_vault_name.value')
ACR_NAME=$(cat terraform/outputs.json | jq -r '.acr_name.value')
ACR_LOGIN_SERVER=$(cat terraform/outputs.json | jq -r '.acr_login_server.value')
WORKLOAD_IDENTITY_CLIENT_ID=$(cat terraform/outputs.json | jq -r '.workload_identity_client_id.value')

echo -e "${GREEN}✓ Values loaded${NC}"
echo ""

# Display values
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Values to be set:${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo "AKS_CLUSTER_NAME: $AKS_CLUSTER_NAME"
echo "AZURE_RESOURCE_GROUP: $RESOURCE_GROUP"
echo "KEY_VAULT_NAME: $KEY_VAULT_NAME"
echo "ACR_NAME: $ACR_NAME"
echo "ACR_LOGIN_SERVER: $ACR_LOGIN_SERVER"
echo "WORKLOAD_IDENTITY_CLIENT_ID: $WORKLOAD_IDENTITY_CLIENT_ID"
echo ""

# Confirm
read -p "Set these secrets to GitHub repository? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}🔐 Setting GitHub secrets...${NC}"

# Set secrets
gh secret set AKS_CLUSTER_NAME --body "$AKS_CLUSTER_NAME"
echo -e "${GREEN}  ✓ AKS_CLUSTER_NAME${NC}"

gh secret set AZURE_RESOURCE_GROUP --body "$RESOURCE_GROUP"
echo -e "${GREEN}  ✓ AZURE_RESOURCE_GROUP${NC}"

gh secret set KEY_VAULT_NAME --body "$KEY_VAULT_NAME"
echo -e "${GREEN}  ✓ KEY_VAULT_NAME${NC}"

gh secret set ACR_NAME --body "$ACR_NAME"
echo -e "${GREEN}  ✓ ACR_NAME${NC}"

gh secret set ACR_LOGIN_SERVER --body "$ACR_LOGIN_SERVER"
echo -e "${GREEN}  ✓ ACR_LOGIN_SERVER${NC}"

gh secret set WORKLOAD_IDENTITY_CLIENT_ID --body "$WORKLOAD_IDENTITY_CLIENT_ID"
echo -e "${GREEN}  ✓ WORKLOAD_IDENTITY_CLIENT_ID${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ All GitHub secrets set successfully!           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📋 Verify secrets:${NC}"
echo -e "   gh secret list"
echo ""
echo -e "${BLUE}💡 Next steps:${NC}"
echo -e "   1. Trigger 'Setup AKS Infrastructure' workflow"
echo -e "   2. Trigger 'Build and Push Docker Images' workflow"
echo -e "   3. Trigger 'Deploy to AKS' workflow"
