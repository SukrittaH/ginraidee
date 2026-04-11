# Helm Charts for Ginraidee Microservices

This directory contains Helm charts for deploying the Ginraidee microservices platform to Kubernetes (AKS).

## Services

| Service | Port | Description |
|---------|------|-------------|
| **auth-service** | 3001 | Authentication & authorization (JWT, EntraID) |
| **inventory-service** | 3002 | Inventory & stock management |
| **ocr-service** | 3003 | OCR image processing (Azure Document Intelligence) |
| **recipe-service** | 3004 | Recipe & AI recommendations (Azure OpenAI) |

## Prerequisites

1. **AKS cluster** with workload identity enabled
2. **Azure Key Vault** with secrets seeded
3. **Azure Container Registry** with images pushed
4. **NGINX Ingress Controller** installed
5. **kubectl** configured for AKS access

## Quick Start

### 1. Update Values

Before deploying, update these placeholders in each service's `values.yaml`:

```yaml
image:
  repository: REPLACE_WITH_ACR_NAME.azurecr.io/auth-service  # e.g., ginraideeprodacr.azurecr.io

serviceAccount:
  annotations:
    azure.workload.identity/client-id: "REPLACE_WITH_WORKLOAD_IDENTITY_CLIENT_ID"

keyVault:
  name: "REPLACE_WITH_KEY_VAULT_NAME"  # e.g., ginraidee-prod-sea-kv
  tenantId: "REPLACE_WITH_TENANT_ID"
```

Get these values from Terraform outputs:
```bash
cd terraform
terraform output workload_identity_client_id
terraform output acr_login_server
terraform output key_vault_name
```

### 2. Deploy a Service

```bash
# Deploy to dev environment
helm install auth-service ./auth-service \
  --namespace ginraidee \
  --create-namespace \
  --values ./auth-service/values-dev.yaml \
  --set image.repository=<ACR_NAME>.azurecr.io/auth-service \
  --set image.tag=latest \
  --set serviceAccount.annotations."azure\.workload\.identity/client-id"=<CLIENT_ID> \
  --set keyVault.name=<KEY_VAULT_NAME> \
  --set keyVault.tenantId=<TENANT_ID>

# Or deploy to prod environment
helm install auth-service ./auth-service \
  --namespace ginraidee \
  --values ./auth-service/values-prod.yaml \
  --set image.repository=<ACR_NAME>.azurecr.io/auth-service \
  --set image.tag=v1.0.0 \
  --set serviceAccount.annotations."azure\.workload\.identity/client-id"=<CLIENT_ID> \
  --set keyVault.name=<KEY_VAULT_NAME> \
  --set keyVault.tenantId=<TENANT_ID>
```

### 3. Upgrade a Service

```bash
helm upgrade auth-service ./auth-service \
  --namespace ginraidee \
  --values ./auth-service/values-prod.yaml \
  --set image.tag=v1.1.0 \
  --wait
```

### 4. Rollback

```bash
# List releases
helm list -n ginraidee

# Rollback to previous version
helm rollback auth-service -n ginraidee

# Rollback to specific revision
helm rollback auth-service 2 -n ginraidee
```

## Chart Structure

Each service chart contains:

```
<service-name>/
├── Chart.yaml                      # Chart metadata
├── values.yaml                     # Default values (base)
├── values-dev.yaml                 # Dev environment overrides
├── values-prod.yaml                # Prod environment overrides
└── templates/
    ├── _helpers.tpl                # Template helpers
    ├── deployment.yaml             # Pod deployment
    ├── service.yaml                # ClusterIP service
    ├── serviceaccount.yaml         # Service account with workload identity
    ├── hpa.yaml                    # Horizontal Pod Autoscaler
    ├── ingress.yaml                # NGINX ingress rules
    └── secretproviderclass.yaml    # Azure Key Vault CSI driver config
```

## Configuration

### Image

```yaml
image:
  repository: myacr.azurecr.io/auth-service
  pullPolicy: IfNotPresent
  tag: "v1.0.0"
```

### Resources

**Dev:**
```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "250m"
```

**Prod:**
```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

### Autoscaling

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

### Ingress

```yaml
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: api.ginraidee.com
      paths:
        - path: /api/auth(/|$)(.*)
          pathType: Prefix
```

### Secrets (Key Vault)

Secrets are automatically loaded from Azure Key Vault using workload identity:

```yaml
keyVault:
  name: "ginraidee-prod-kv"
  tenantId: "your-tenant-id"
  secrets:
    - secretName: "jwt-secret"
      objectName: "auth-service-jwt-secret"
    - secretName: "database-url"
      objectName: "database-connection-string"
```

## Service-Specific Secrets

### Auth Service
- `jwt-secret`
- `entraid-client-id`
- `entraid-tenant-id`
- `entraid-authority`
- `database-url`

### Inventory Service
- `jwt-secret`
- `database-url`

### OCR Service
- `jwt-secret`
- `database-url`
- `azure-document-intelligence-endpoint`
- `azure-document-intelligence-key`

### Recipe Service
- `jwt-secret`
- `database-url`
- `azure-openai-api-key`
- `azure-openai-endpoint`
- `azure-openai-deployment-name`

## Testing

### Lint Charts
```bash
helm lint auth-service
helm lint inventory-service
helm lint ocr-service
helm lint recipe-service
```

### Dry Run
```bash
helm install auth-service ./auth-service \
  --namespace ginraidee \
  --values ./auth-service/values-dev.yaml \
  --dry-run --debug
```

### Port Forward
```bash
kubectl port-forward svc/auth-service 3001:3001 -n ginraidee
curl http://localhost:3001/health
```

## Troubleshooting

### Pods not starting
```bash
# Check pod status
kubectl get pods -n ginraidee

# Check pod logs
kubectl logs -f <pod-name> -n ginraidee

# Describe pod for events
kubectl describe pod <pod-name> -n ginraidee
```

### Secrets not loading
```bash
# Check if SecretProviderClass exists
kubectl get secretproviderclass -n ginraidee

# Check CSI driver logs
kubectl logs -n kube-system -l app=secrets-store-csi-driver

# Verify secret mount
kubectl exec -it <pod-name> -n ginraidee -- ls -la /mnt/secrets-store
```

### Ingress not working
```bash
# Check ingress
kubectl get ingress -n ginraidee

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller

# Test from inside cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://auth-service.ginraidee.svc.cluster.local:3001/health
```

## Uninstall

```bash
# Uninstall a service
helm uninstall auth-service -n ginraidee

# Uninstall all services
for service in auth-service inventory-service ocr-service recipe-service; do
  helm uninstall $service -n ginraidee
done

# Delete namespace
kubectl delete namespace ginraidee
```

## CI/CD Integration

These charts are designed to work with GitHub Actions workflows:

- `setup-aks-infra.yml` - Setup ingress + namespace
- `build-and-push.yml` - Build Docker images → Push to ACR
- `deploy-aks.yml` - Deploy services using Helm

See `.github/workflows/` for workflow definitions.

---

**Next:** Setup GitHub workflows for automated deployments
