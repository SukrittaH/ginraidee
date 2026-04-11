# Terraform Infrastructure for Ginraidee

This Terraform configuration provisions the complete Azure infrastructure for the Ginraidee microservices platform.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Azure Resource Group (ginraidee-{env}-{location}-rg)      │
│                                                              │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐│
│  │  AKS Cluster   │  │  Key Vault      │  │  ACR         ││
│  │  - Workload ID │  │  - RBAC enabled │  │  - Private   ││
│  │  - OIDC issuer │  │  - Soft delete  │  │  registry    ││
│  └────────────────┘  └─────────────────┘  └──────────────┘│
│                                                              │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐│
│  │  PostgreSQL    │  │  Runner VM      │  │  Identities  ││
│  │  - Private EP  │  │  - Managed ID   │  │  - Workload  ││
│  │  - Flex Server │  │  - GitHub       │  │  - Runner    ││
│  └────────────────┘  └─────────────────┘  └──────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Files

- `providers.tf` - Azure provider configuration
- `variables.tf` - Input variables
- `main.tf` - Core resources (VNet, Subnets, AKS, PostgreSQL)
- `key-vault.tf` - Azure Key Vault for secrets management
- `acr.tf` - Azure Container Registry for Docker images
- `identities.tf` - Managed identities + federated credentials
- `runner.tf` - GitHub self-hosted runner VM
- `outputs.tf` - Output values

## Prerequisites

1. **Azure CLI** installed and authenticated
   ```bash
   az login
   az account set --subscription <subscription-id>
   ```

2. **Terraform** v1.0+ installed
   ```bash
   terraform version
   ```

3. **Variables file** - Create `terraform.tfvars`:
   ```hcl
   subscription_id = "your-subscription-id"
   tenant_id       = "your-tenant-id"
   environment     = "dev"  # or "prod"
   
   # AKS configuration
   vm_size         = "Standard_D2s_v3"
   os_disk_size_gb = "128"
   service_cidr    = "10.0.0.0/16"
   dns_service_ip  = "10.0.0.10"
   pod_cidr        = "10.244.0.0/16"
   
   # PostgreSQL configuration
   postgresql_admin_username = "pgadmin"
   postgresql_admin_password = "your-secure-password"  # Use Azure Key Vault for production
   postgresql_size           = "B_Standard_B1ms"
   
   # OpenAI configuration
   openai_location              = "eastus2"
   openai_location_abbreviation = "eus2"
   ```

## Deployment

### 1. Initialize Terraform
```bash
cd terraform
terraform init
```

### 2. Plan Infrastructure
```bash
terraform plan -out=tfplan
```

**Review the plan carefully!** This will create:
- AKS cluster with 2 node pools
- Azure Key Vault
- Azure Container Registry
- PostgreSQL Flexible Server
- GitHub runner VM
- Managed identities
- Networking (VNet, Subnets, NSGs)

### 3. Apply Infrastructure
```bash
terraform apply tfplan
```

This will take **15-20 minutes** to complete.

### 4. Save Outputs
```bash
# Save all outputs to a file
terraform output -json > outputs.json

# Get specific outputs
terraform output key_vault_name
terraform output acr_login_server
terraform output workload_identity_client_id
terraform output runner_public_ip
```

### 5. Save SSH Key for Runner VM
```bash
# Save the private key to access the runner VM
terraform output -raw runner_ssh_private_key > runner-ssh-key.pem
chmod 600 runner-ssh-key.pem

# Test SSH access
ssh -i runner-ssh-key.pem azureuser@$(terraform output -raw runner_public_ip)
```

## Post-Deployment Steps

### 1. Configure kubectl
```bash
az aks get-credentials \
  --name $(terraform output -raw aks_cluster_name) \
  --resource-group $(terraform output -raw resource_group_name)

# Verify AKS access
kubectl get nodes
```

### 2. Verify Key Vault Access
```bash
az keyvault list --resource-group $(terraform output -raw resource_group_name)
```

### 3. Setup GitHub Runner
SSH to the runner VM and configure GitHub Actions:
```bash
cd /home/azureuser/actions-runner
./config.sh --url https://github.com/YOUR_ORG/ginraidee --token YOUR_TOKEN
sudo ./svc.sh install
sudo ./svc.sh start
```

## Outputs Reference

| Output | Description | Usage |
|--------|-------------|-------|
| `aks_cluster_name` | AKS cluster name | For `az aks get-credentials` |
| `key_vault_name` | Key Vault name | For seeding secrets |
| `key_vault_url` | Key Vault URL | For Helm values |
| `acr_login_server` | ACR URL | For Docker image repository |
| `workload_identity_client_id` | Workload identity ID | For Helm service account annotation |
| `postgresql_fqdn` | PostgreSQL FQDN | For database connection string |
| `runner_public_ip` | Runner VM IP | For SSH access |

## Key Features

### Workload Identity
- Pods authenticate to Azure Key Vault using workload identity (no secrets needed)
- Federated identity credentials created for each microservice
- OIDC issuer enabled on AKS

### Security
- Key Vault uses RBAC (not access policies)
- ACR uses managed identity (no admin credentials)
- PostgreSQL uses private endpoint (no public access)
- Runner VM has managed identity for Azure access
- Network rules restrict Key Vault access

### Networking
- Private AKS cluster (optional - currently public for easier debugging)
- PostgreSQL in delegated subnet with private DNS
- Private DNS zone linked to AKS VNet for PostgreSQL resolution
- NSG rules for runner VM

## Terraform State

**Important:** Store Terraform state remotely for production:

```hcl
# Add to providers.tf
terraform {
  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "terraformstate"
    container_name       = "tfstate"
    key                  = "ginraidee.tfstate"
  }
}
```

## Cleanup

To destroy all infrastructure:
```bash
terraform destroy
```

**WARNING:** This will delete:
- AKS cluster
- All databases
- Key Vault (with 7-day soft delete)
- ACR and all images
- Runner VM
- All networking resources

## Troubleshooting

### Issue: Terraform state drift
```bash
terraform refresh
terraform plan
```

### Issue: AKS cluster not accessible
```bash
# Re-fetch credentials
az aks get-credentials --name <AKS_NAME> --resource-group <RG_NAME> --overwrite-existing
```

### Issue: Key Vault access denied
```bash
# Check RBAC assignments
az role assignment list --scope $(terraform output -raw key_vault_id)

# Grant yourself access if needed
az role assignment create \
  --assignee <your-email> \
  --role "Key Vault Secrets Officer" \
  --scope $(terraform output -raw key_vault_id)
```

### Issue: PostgreSQL connection fails from AKS
```bash
# Verify private DNS zone link
az network private-dns link vnet list \
  --zone-name privatelink.postgres.database.azure.com \
  --resource-group <RG_NAME>

# Should show the AKS VNet linked
```

## Cost Estimation

| Resource | SKU | Estimated Cost/Month |
|----------|-----|---------------------|
| AKS | Standard_D2s_v3 x 2-4 nodes | $150-300 |
| PostgreSQL | B_Standard_B1ms | $15 |
| Key Vault | Standard | $5-10 |
| ACR | Basic | $5 |
| Runner VM | Standard_D2s_v3 | $70 |
| **Total** | | **~$245-400/month** |

## Next Steps

1. ✅ Terraform infrastructure deployed
2. ⏭️ Seed secrets to Key Vault (`scripts/seed-azure-keyvault.sh`)
3. ⏭️ Setup GitHub runner
4. ⏭️ Create Helm charts
5. ⏭️ Deploy services to AKS

---

**Managed by Terraform** | **Project: Ginraidee** | **Environment: ${var.environment}**
