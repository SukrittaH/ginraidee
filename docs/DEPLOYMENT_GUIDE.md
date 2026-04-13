# Ginraidee AKS Deployment Guide

Complete guide for deploying Ginraidee microservices to Azure Kubernetes Service (AKS).

## 📋 Prerequisites

Before deploying, ensure you have:

- ✅ Azure subscription with appropriate permissions
- ✅ GitHub repository access
- ✅ Local tools installed: Azure CLI, Terraform, kubectl, Helm

## 🚀 Deployment Steps

### Step 1: Deploy Infrastructure with Terraform

```bash
cd terraform

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply infrastructure (takes ~15-20 minutes)
terraform apply

# Save outputs
terraform output -json > outputs.json
terraform output -raw runner_ssh_private_key > runner-ssh-key.pem
chmod 600 runner-ssh-key.pem
```

**Outputs you'll need:**
- `key_vault_name` - For seeding secrets
- `acr_login_server` - For Docker images
- `workload_identity_client_id` - For Helm values
- `runner_public_ip` - For SSH to runner VM
- `aks_cluster_name` - For kubectl

---

### Step 2: Seed Secrets to Azure Key Vault

```bash
./scripts/seed-azure-keyvault.sh
```

**You'll be prompted for:**
- Key Vault name (from Terraform output)
- JWT secret (for service-to-service auth)
- Database credentials (PostgreSQL)
- EntraID credentials (Azure AD)
- Azure OpenAI API key
- Azure Document Intelligence key
- SigNoz access token (optional)

**Verify secrets:**
```bash
az keyvault secret list --vault-name <KEY_VAULT_NAME>
```

---

### Step 3: Setup GitHub Self-Hosted Runner

SSH to the runner VM:
```bash
ssh -i runner-ssh-key.pem azureuser@<RUNNER_PUBLIC_IP>
```

Run the setup script:
```bash
# On the runner VM
cd ~
curl -O https://raw.githubusercontent.com/YOUR_ORG/ginraidee/main/scripts/setup-github-runner.sh
chmod +x setup-github-runner.sh
./setup-github-runner.sh
```

**You'll need:**
- GitHub repository URL
- GitHub runner token (from: Settings → Actions → Runners → New runner)

**Verify:**
Go to your GitHub repo → Settings → Actions → Runners
You should see "ginraidee-aks-runner" with status "Idle"

---

### Step 4: Configure GitHub Secrets

**Automated (Recommended):**
```bash
./scripts/setup-github-secrets.sh
```

This script automatically reads Terraform outputs and sets all GitHub secrets using GitHub CLI.

**Prerequisites:**
- GitHub CLI installed: `brew install gh`
- Authenticated: `gh auth login`

**Manual (Alternative):**

If you prefer to set secrets manually, go to GitHub → Settings → Secrets and variables → Actions:

```
AKS_CLUSTER_NAME             - From Terraform: terraform output aks_cluster_name
AZURE_RESOURCE_GROUP         - From Terraform: terraform output resource_group_name
KEY_VAULT_NAME               - From Terraform: terraform output key_vault_name
ACR_NAME                     - From Terraform: terraform output acr_name
ACR_LOGIN_SERVER             - From Terraform: terraform output acr_login_server
WORKLOAD_IDENTITY_CLIENT_ID  - From Terraform: terraform output workload_identity_client_id
```

**Note:** We don't need `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, or `AZURE_SUBSCRIPTION_ID` because the workflows use the runner VM's managed identity (`az login --identity`) for authentication.

**Verify secrets:**
```bash
gh secret list
```

---

### Step 5: Setup AKS Infrastructure

Go to GitHub Actions → Workflows → **Setup AKS Infrastructure**

Click "Run workflow":
- Environment: `dev` or `prod`

This workflow will:
1. Install NGINX Ingress Controller
2. Create `ginraidee` namespace
3. Verify Key Vault connectivity
4. Get external Load Balancer IP

**Important:** Note the external IP from the workflow output and add DNS record:
```
api.ginraidee.com  →  <EXTERNAL_IP>
```

---

### Step 6: Build and Push Docker Images

Go to GitHub Actions → Workflows → **Build and Push Docker Images**

Click "Run workflow":
- Environment: `dev` or `prod`
- Services: `all` (or specific: `auth-service,ocr-service`)

This workflow will:
1. Build Docker images for selected services
2. Scan images for vulnerabilities (Trivy)
3. Check image sizes
4. Push images to ACR with tags: `latest`, `<sha>`, `<env>`

**Verify images:**
```bash
az acr repository list --name <ACR_NAME>
az acr repository show-tags --name <ACR_NAME> --repository auth-service
```

---

### Step 7: Deploy Services to AKS

Go to GitHub Actions → Workflows → **Deploy to AKS**

Click "Run workflow":
- Environment: `dev` or `prod`
- Services: `all` (or specific services)
- Image tag: `latest` (or specific tag like `abc1234`)

This workflow will:
1. Run pre-deployment checks
2. Deploy services with Helm
3. Wait for pods to be ready
4. Verify secret mounts
5. Test health endpoints
6. Rollback automatically on failure

**Monitor deployment:**
```bash
# Get AKS credentials
az aks get-credentials \
  --name <AKS_CLUSTER_NAME> \
  --resource-group <RESOURCE_GROUP> \
  --overwrite-existing

# Watch pods
kubectl get pods -n ginraidee -w

# Check logs
kubectl logs -f <pod-name> -n ginraidee

# Check ingress
kubectl get ingress -n ginraidee
```

---

## 🧪 Testing the Deployment

### Check Pod Status
```bash
kubectl get pods -n ginraidee
kubectl describe pod <pod-name> -n ginraidee
```

### Verify Secrets are Mounted
```bash
POD_NAME=$(kubectl get pod -l app=auth-service -n ginraidee -o jsonpath='{.items[0].metadata.name}')
kubectl exec $POD_NAME -n ginraidee -- ls -la /mnt/secrets-store
```

### Test Health Endpoints
```bash
# Via port-forward
kubectl port-forward svc/auth-service 3001:3001 -n ginraidee
curl http://localhost:3001/health

# Via ingress (after DNS is configured)
curl http://api.ginraidee.com/api/auth/health
curl http://api.ginraidee.com/api/inventory/health
curl http://api.ginraidee.com/api/ocr/health
curl http://api.ginraidee.com/api/recipe/health
```

### Test Database Connectivity
```bash
POD_NAME=$(kubectl get pod -l app=auth-service -n ginraidee -o jsonpath='{.items[0].metadata.name}')
kubectl exec $POD_NAME -n ginraidee -- sh -c 'nc -zv $DB_HOST 5432'
```

### Check Logs
```bash
# Real-time logs
kubectl logs -f deployment/auth-service -n ginraidee

# Last 100 lines
kubectl logs deployment/auth-service -n ginraidee --tail=100

# Logs from all pods of a service
kubectl logs -l app=auth-service -n ginraidee
```

---

## 🔄 Updating Services

### Update Code and Redeploy
```bash
# 1. Make code changes
# 2. Commit and push

# 3. Build new images
# Run "Build and Push Docker Images" workflow

# 4. Deploy updated services
# Run "Deploy to AKS" workflow with new image tag
```

### Rollback to Previous Version
```bash
# Via GitHub Actions
# The deploy workflow automatically rolls back on failure

# Manual rollback
helm rollback auth-service -n ginraidee
helm rollback auth-service 2 -n ginraidee  # Specific revision
```

### View Helm History
```bash
helm list -n ginraidee
helm history auth-service -n ginraidee
```

---

## 🐛 Troubleshooting

### Pods Not Starting

**Check pod events:**
```bash
kubectl describe pod <pod-name> -n ginraidee
```

**Common issues:**
- Image pull failed → Check ACR credentials and image exists
- CSI mount failed → Check workload identity and Key Vault permissions
- CrashLoopBackOff → Check logs for application errors

### Secrets Not Loading

**Check SecretProviderClass:**
```bash
kubectl get secretproviderclass -n ginraidee
kubectl describe secretproviderclass auth-service-secrets -n ginraidee
```

**Check CSI driver:**
```bash
kubectl get pods -n kube-system -l app=secrets-store-csi-driver
kubectl logs -n kube-system -l app=secrets-store-csi-driver
```

**Verify workload identity:**
```bash
kubectl get sa auth-service-sa -n ginraidee -o yaml
# Should have annotation: azure.workload.identity/client-id
```

### Database Connection Fails

**Check private DNS:**
```bash
az network private-dns link vnet list \
  --zone-name privatelink.postgres.database.azure.com \
  --resource-group <RESOURCE_GROUP>
```

**Test DNS from pod:**
```bash
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  nslookup <postgresql-fqdn>
```

### Ingress Not Working

**Check ingress controller:**
```bash
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

**Check ingress resources:**
```bash
kubectl get ingress -n ginraidee
kubectl describe ingress auth-service -n ginraidee
```

**Get external IP:**
```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller
```

---

## 📊 Monitoring

### View Metrics
```bash
# CPU and memory usage
kubectl top pods -n ginraidee
kubectl top nodes

# HPA status
kubectl get hpa -n ginraidee
```

### View Events
```bash
kubectl get events -n ginraidee --sort-by='.lastTimestamp'
```

### Access Kubernetes Dashboard (Optional)
```bash
kubectl proxy
# Then visit: http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/
```

---

## 🔐 Security Best Practices

1. **Rotate secrets regularly** in Azure Key Vault
2. **Update Workload Identity** if compromised
3. **Scan images** for vulnerabilities (automated in CI)
4. **Review audit logs** in Azure Key Vault
5. **Enable pod security policies** (already configured)
6. **Keep Kubernetes updated** (configured for auto-upgrade)

---

## 📚 Additional Resources

- [Terraform Files](../terraform/)
- [Helm Charts](../helm/)
- [GitHub Workflows](../.github/workflows/)
- [Vault Implementation Guide](./VAULT_IMPLEMENTATION.md)

---

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review workflow logs in GitHub Actions
3. Check pod logs: `kubectl logs <pod> -n ginraidee`
4. Review the plan file: `/Users/atxm/.claude/plans/gleaming-munching-token.md`
