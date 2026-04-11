#!/bin/bash
set -e

# Setup GitHub Self-Hosted Runner on Azure VM
# Run this script on the runner VM after it's provisioned

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  GitHub Self-Hosted Runner Setup                  ║${NC}"
echo -e "${BLUE}║  Ginraidee - AKS Deployment Runner                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running on the VM
if [ ! -d "/home/azureuser/actions-runner" ]; then
    echo -e "${RED}❌ actions-runner directory not found${NC}"
    echo -e "${YELLOW}This script should be run on the runner VM${NC}"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker not found. Waiting for cloud-init to complete...${NC}"
    sleep 10
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker still not installed. Check cloud-init logs: sudo cat /var/log/cloud-init-output.log${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Docker installed${NC}"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${YELLOW}⚠️  Azure CLI not found. Installing...${NC}"
    curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
fi

echo -e "${GREEN}✓ Azure CLI installed${NC}"

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${YELLOW}⚠️  kubectl not found. Installing...${NC}"
    sudo az aks install-cli
fi

echo -e "${GREEN}✓ kubectl installed${NC}"

# Check if Helm is installed
if ! command -v helm &> /dev/null; then
    echo -e "${YELLOW}⚠️  Helm not found. Installing...${NC}"
    curl -fsSL -o /tmp/get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
    chmod 700 /tmp/get_helm.sh
    sudo /tmp/get_helm.sh
fi

echo -e "${GREEN}✓ Helm installed${NC}"

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  GitHub Runner Configuration${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"

echo ""
echo -e "${YELLOW}📦 GitHub Repository Information${NC}"
echo ""
read -p "Enter GitHub repository URL (e.g., https://github.com/YourOrg/ginraidee): " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo -e "${RED}❌ Repository URL is required${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔑 GitHub Runner Token${NC}"
echo ""
echo "To get a runner token:"
echo "1. Go to: $REPO_URL/settings/actions/runners/new"
echo "2. Select 'Linux' and copy the token"
echo ""
read -s -p "Enter runner token: " RUNNER_TOKEN
echo ""

if [ -z "$RUNNER_TOKEN" ]; then
    echo -e "${RED}❌ Runner token is required${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔧 Configuring GitHub Runner...${NC}"

cd /home/azureuser/actions-runner

# Configure the runner
./config.sh \
    --url "$REPO_URL" \
    --token "$RUNNER_TOKEN" \
    --name "ginraidee-aks-runner" \
    --labels "self-hosted,linux,azure,aks-deploy" \
    --work "_work" \
    --unattended

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Runner configured successfully${NC}"
else
    echo -e "${RED}❌ Runner configuration failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🚀 Installing runner as a service...${NC}"

# Install the service
sudo ./svc.sh install azureuser

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Service installed${NC}"
else
    echo -e "${RED}❌ Service installation failed${NC}"
    exit 1
fi

# Start the service
sudo ./svc.sh start

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Service started${NC}"
else
    echo -e "${RED}❌ Service start failed${NC}"
    exit 1
fi

# Check service status
echo ""
echo -e "${BLUE}📊 Runner Status:${NC}"
sudo ./svc.sh status

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Azure Integration Test${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"

echo ""
echo -e "${BLUE}🔍 Testing Azure managed identity...${NC}"

# Test Azure login with managed identity
if az login --identity &> /dev/null; then
    echo -e "${GREEN}✓ Managed identity working${NC}"

    # Show current subscription
    echo ""
    echo -e "${BLUE}Current Azure subscription:${NC}"
    az account show --query "{Name:name, SubscriptionId:id, TenantId:tenantId}" -o table
else
    echo -e "${YELLOW}⚠️  Managed identity not working yet (may take a few minutes after VM creation)${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ GitHub Runner Setup Complete!                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"

echo ""
echo -e "${YELLOW}📝 Verification:${NC}"
echo -e "  1. Go to: $REPO_URL/settings/actions/runners"
echo -e "  2. You should see 'ginraidee-aks-runner' with status 'Idle'"
echo ""
echo -e "${YELLOW}🛠️  Useful commands:${NC}"
echo -e "  Check status:  sudo ./svc.sh status"
echo -e "  Stop runner:   sudo ./svc.sh stop"
echo -e "  Start runner:  sudo ./svc.sh start"
echo -e "  View logs:     journalctl -u actions.runner.* -f"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Verify runner appears in GitHub"
echo -e "  2. Test AKS access: az aks get-credentials ..."
echo -e "  3. Run deployment workflows"
