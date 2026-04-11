#!/bin/bash
set -e

# Test Helm charts locally with dry-run and template rendering
# This validates the charts without actually deploying to Kubernetes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Helm Charts Local Testing & Validation          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if helm is installed
if ! command -v helm &> /dev/null; then
    echo -e "${RED}❌ Helm not found${NC}"
    echo -e "${YELLOW}Installing Helm...${NC}"
    curl -fsSL -o /tmp/get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
    chmod 700 /tmp/get_helm.sh
    /tmp/get_helm.sh
fi

echo -e "${GREEN}✓ Helm installed: $(helm version --short)${NC}"
echo ""

# Mock values for testing
ACR_NAME="ginraideeprodacr"
WORKLOAD_IDENTITY_CLIENT_ID="00000000-0000-0000-0000-000000000000"
KEY_VAULT_NAME="ginraidee-prod-sea-kv"
TENANT_ID="00000000-0000-0000-0000-000000000000"

SERVICES=("auth-service" "inventory-service" "ocr-service" "recipe-service")
FAILED_SERVICES=()

echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Testing Helm Charts${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo ""

for SERVICE in "${SERVICES[@]}"; do
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}📦 Testing: $SERVICE${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # 1. Lint the chart
    echo -e "\n${BLUE}1️⃣  Linting chart...${NC}"
    if helm lint helm/$SERVICE \
        --set image.repository=$ACR_NAME.azurecr.io/$SERVICE \
        --set serviceAccount.annotations."azure\.workload\.identity/client-id"=$WORKLOAD_IDENTITY_CLIENT_ID \
        --set keyVault.name=$KEY_VAULT_NAME \
        --set keyVault.tenantId=$TENANT_ID; then
        echo -e "${GREEN}✓ Lint passed${NC}"
    else
        echo -e "${RED}❌ Lint failed${NC}"
        FAILED_SERVICES+=("$SERVICE (lint)")
        continue
    fi

    # 2. Template rendering (dev)
    echo -e "\n${BLUE}2️⃣  Rendering templates (dev environment)...${NC}"
    if helm template $SERVICE helm/$SERVICE \
        --namespace ginraidee \
        --values helm/$SERVICE/values-dev.yaml \
        --set image.repository=$ACR_NAME.azurecr.io/$SERVICE \
        --set image.tag=latest \
        --set serviceAccount.annotations."azure\.workload\.identity/client-id"=$WORKLOAD_IDENTITY_CLIENT_ID \
        --set keyVault.name=$KEY_VAULT_NAME \
        --set keyVault.tenantId=$TENANT_ID \
        > /tmp/test-${SERVICE}-dev.yaml; then

        LINE_COUNT=$(wc -l < /tmp/test-${SERVICE}-dev.yaml)
        echo -e "${GREEN}✓ Template rendered successfully ($LINE_COUNT lines)${NC}"

        # Show resource count
        RESOURCE_COUNT=$(grep -c "^kind:" /tmp/test-${SERVICE}-dev.yaml || true)
        echo -e "${BLUE}  Generated $RESOURCE_COUNT Kubernetes resources${NC}"
    else
        echo -e "${RED}❌ Template rendering failed (dev)${NC}"
        FAILED_SERVICES+=("$SERVICE (template-dev)")
        continue
    fi

    # 3. Template rendering (prod)
    echo -e "\n${BLUE}3️⃣  Rendering templates (prod environment)...${NC}"
    if helm template $SERVICE helm/$SERVICE \
        --namespace ginraidee \
        --values helm/$SERVICE/values-prod.yaml \
        --set image.repository=$ACR_NAME.azurecr.io/$SERVICE \
        --set image.tag=v1.0.0 \
        --set serviceAccount.annotations."azure\.workload\.identity/client-id"=$WORKLOAD_IDENTITY_CLIENT_ID \
        --set keyVault.name=$KEY_VAULT_NAME \
        --set keyVault.tenantId=$TENANT_ID \
        > /tmp/test-${SERVICE}-prod.yaml; then

        LINE_COUNT=$(wc -l < /tmp/test-${SERVICE}-prod.yaml)
        echo -e "${GREEN}✓ Template rendered successfully ($LINE_COUNT lines)${NC}"

        # Show resource count
        RESOURCE_COUNT=$(grep -c "^kind:" /tmp/test-${SERVICE}-prod.yaml || true)
        echo -e "${BLUE}  Generated $RESOURCE_COUNT Kubernetes resources${NC}"
    else
        echo -e "${RED}❌ Template rendering failed (prod)${NC}"
        FAILED_SERVICES+=("$SERVICE (template-prod)")
        continue
    fi

    # 4. Check for required resources
    echo -e "\n${BLUE}4️⃣  Verifying required resources...${NC}"
    REQUIRED_RESOURCES=("Deployment" "Service" "ServiceAccount" "SecretProviderClass")
    MISSING_RESOURCES=()

    for RESOURCE in "${REQUIRED_RESOURCES[@]}"; do
        if grep -q "^kind: $RESOURCE" /tmp/test-${SERVICE}-dev.yaml; then
            echo -e "${GREEN}  ✓ $RESOURCE${NC}"
        else
            echo -e "${RED}  ❌ $RESOURCE missing${NC}"
            MISSING_RESOURCES+=("$RESOURCE")
        fi
    done

    if [ ${#MISSING_RESOURCES[@]} -gt 0 ]; then
        FAILED_SERVICES+=("$SERVICE (missing resources)")
    fi

    # 5. Check for secrets in values
    echo -e "\n${BLUE}5️⃣  Security check (no secrets in values)...${NC}"
    if grep -iE "password|secret.*:.*[a-zA-Z0-9]{10,}|key.*:.*[a-zA-Z0-9]{20,}" helm/$SERVICE/values*.yaml | grep -v "REPLACE_WITH" | grep -v "secretName" | grep -v "secretProviderClass"; then
        echo -e "${RED}  ⚠️  Potential secrets found in values files${NC}"
        FAILED_SERVICES+=("$SERVICE (security)")
    else
        echo -e "${GREEN}  ✓ No secrets in values files${NC}"
    fi

    echo -e "\n${GREEN}✅ $SERVICE passed all tests${NC}"
    echo ""
done

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo ""

if [ ${#FAILED_SERVICES[@]} -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ All services passed validation!               ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}📁 Generated manifests:${NC}"
    ls -lh /tmp/test-*-*.yaml
    echo ""
    echo -e "${YELLOW}💡 To inspect a manifest:${NC}"
    echo -e "   cat /tmp/test-auth-service-dev.yaml"
    echo ""
    echo -e "${YELLOW}💡 To deploy to AKS (after terraform apply):${NC}"
    echo -e "   kubectl apply -f /tmp/test-auth-service-dev.yaml"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ❌ Some services failed validation                ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}Failed services:${NC}"
    for FAILED in "${FAILED_SERVICES[@]}"; do
        echo -e "  ${RED}• $FAILED${NC}"
    done
    exit 1
fi
