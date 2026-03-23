# Production Observability Setup

This document covers deploying SigNoz and your microservices to production cloud environments.

## Architecture Options

### Option A: SigNoz Cloud (Recommended for Small-Medium Apps)

**Best for:** Quick setup, low maintenance, predictable costs

```
Your Services (Azure/AWS/GCP)
       │
       │ HTTPS + Auth Token
       ▼
SigNoz Cloud (Fully Managed)
```

**Setup:**

1. **Sign up for SigNoz Cloud**: https://signoz.io/teams/

2. **Get your ingestion endpoint and token**:
   - Region: Choose closest to your services (us, eu, in)
   - Endpoint: `https://ingest.{region}.signoz.cloud:443`
   - Token: Found in Settings → Ingestion Settings

3. **Update tracing config**:

```javascript
// services/*/src/config/tracing.js
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  headers: {
    'signoz-access-token': process.env.SIGNOZ_ACCESS_TOKEN,
  },
});

const sdk = new NodeSDK({
  serviceName: process.env.SERVICE_NAME || 'recipe-service',
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();
console.log(`🔍 OpenTelemetry tracing initialized for ${process.env.SERVICE_NAME}`);

process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('🔍 Tracing terminated'))
    .catch((error) => console.error('Error terminating tracing', error))
    .finally(() => process.exit(0));
});

module.exports = sdk;
```

4. **Set environment variables** (Azure App Service example):

```bash
# Azure Portal → App Service → Configuration → Application Settings

OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.us.signoz.cloud:443
SIGNOZ_ACCESS_TOKEN=your-actual-token-here
SERVICE_NAME=recipe-service  # Different per service
NODE_ENV=production
```

5. **Deploy and verify**:
   - Check SigNoz Cloud UI for incoming traces
   - Typical latency: First traces appear within 1-2 minutes

**Costs:**
- **Free tier**: 1GB ingestion/month, 15-day retention
- **Team**: $49/month + $0.30/GB ingestion
- **Enterprise**: Custom pricing

---

### Option B: Self-Hosted SigNoz on Kubernetes (Recommended for Large Apps)

**Best for:** Cost control, data sovereignty, high volume

```
┌─────────────────────────────────────────────┐
│  Azure Kubernetes Service (AKS)             │
│                                             │
│  Application Namespace                      │
│  ┌────────────┐  ┌────────────┐           │
│  │  Recipe    │  │ Inventory  │           │
│  │  Service   │  │  Service   │           │
│  └─────┬──────┘  └──────┬─────┘           │
│        │                 │                  │
│        └────────┬────────┘                  │
│                 │                            │
│  SigNoz Namespace                           │
│                 ▼                            │
│  ┌──────────────────────────────────┐      │
│  │  SigNoz Platform                 │      │
│  │  ┌─────────────────────────┐    │      │
│  │  │ OTEL Collector (4318)   │    │      │
│  │  └────────┬────────────────┘    │      │
│  │           │                      │      │
│  │  ┌────────▼────────┐            │      │
│  │  │ ClickHouse DB   │            │      │
│  │  │ (trace storage) │            │      │
│  │  └────────┬────────┘            │      │
│  │           │                      │      │
│  │  ┌────────▼────────┐            │      │
│  │  │ Query Service   │            │      │
│  │  └────────┬────────┘            │      │
│  │           │                      │      │
│  │  ┌────────▼────────┐            │      │
│  │  │ Frontend (3301) │            │      │
│  │  └─────────────────┘            │      │
│  └──────────────────────────────────┘      │
└─────────────────────────────────────────────┘
```

#### Step 1: Install SigNoz on Kubernetes

**Prerequisites:**
- Kubernetes cluster (AKS, EKS, GKE) with at least:
  - 3 nodes
  - 4 vCPUs and 16GB RAM per node
- kubectl configured
- Helm 3 installed

**Installation:**

```bash
# Add SigNoz Helm repository
helm repo add signoz https://charts.signoz.io
helm repo update

# Create namespace
kubectl create namespace signoz

# Install with custom values
cat > signoz-values.yaml <<EOF
# SigNoz production configuration
clickhouse:
  persistence:
    enabled: true
    size: 100Gi
    storageClass: managed-premium  # Azure Premium SSD

queryService:
  replicas: 2
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 4Gi

otelCollector:
  replicas: 3  # High availability
  resources:
    requests:
      cpu: 1000m
      memory: 2Gi
    limits:
      cpu: 4000m
      memory: 8Gi

  # Enable auto-scaling
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70

frontend:
  service:
    type: LoadBalancer  # Or ClusterIP if using Ingress
  ingress:
    enabled: true
    className: nginx
    hosts:
      - host: signoz.yourdomain.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: signoz-tls
        hosts:
          - signoz.yourdomain.com
EOF

# Install SigNoz
helm install signoz signoz/signoz -n signoz -f signoz-values.yaml

# Wait for all pods to be ready
kubectl wait --for=condition=ready pod -l app=signoz -n signoz --timeout=600s

# Get the OTEL Collector endpoint
kubectl get svc signoz-otel-collector -n signoz
```

**Verify installation:**
```bash
# Port-forward to access UI locally
kubectl port-forward svc/signoz-frontend -n signoz 3301:3301

# Open http://localhost:3301
```

#### Step 2: Configure Your Services

**Option 2a: Services in Same Kubernetes Cluster**

```yaml
# kubernetes/recipe-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: recipe-service
  namespace: ginraidee
spec:
  replicas: 3
  selector:
    matchLabels:
      app: recipe-service
  template:
    metadata:
      labels:
        app: recipe-service
    spec:
      containers:
      - name: recipe-service
        image: yourregistry.azurecr.io/recipe-service:latest
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3004"
        - name: SERVICE_NAME
          value: "recipe-service"
        # OTEL endpoint - internal Kubernetes service DNS
        - name: OTEL_EXPORTER_OTLP_ENDPOINT
          value: "http://signoz-otel-collector.signoz.svc.cluster.local:4318/v1/traces"
        # Azure secrets from KeyVault or ConfigMap
        - name: AZURE_OPENAI_ENDPOINT
          valueFrom:
            secretKeyRef:
              name: azure-secrets
              key: openai-endpoint
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
```

**Apply all services:**
```bash
kubectl apply -f kubernetes/recipe-service-deployment.yaml
kubectl apply -f kubernetes/inventory-service-deployment.yaml
kubectl apply -f kubernetes/ocr-service-deployment.yaml
```

**Option 2b: Services in Azure App Service (Outside Kubernetes)**

If your services run on Azure App Service but SigNoz is in AKS:

```bash
# Get the external IP of OTEL Collector
kubectl get svc signoz-otel-collector -n signoz

# If LoadBalancer: Use the EXTERNAL-IP
# Example: 20.123.45.67

# Set in Azure App Service Configuration:
OTEL_EXPORTER_OTLP_ENDPOINT=http://20.123.45.67:4318/v1/traces
```

**Security best practice:** Use Azure Private Link or VPN to keep traffic internal.

#### Step 3: Secure the Setup

**1. Add authentication to SigNoz UI:**

```yaml
# signoz-values.yaml
frontend:
  env:
    - name: BASIC_AUTH_USERNAME
      value: admin
    - name: BASIC_AUTH_PASSWORD
      valueFrom:
        secretKeyRef:
          name: signoz-auth
          key: password
```

**2. Use TLS for OTEL Collector:**

```yaml
# signoz-values.yaml
otelCollector:
  service:
    annotations:
      service.beta.kubernetes.io/azure-load-balancer-internal: "true"

  config:
    receivers:
      otlp:
        protocols:
          http:
            endpoint: 0.0.0.0:4318
            tls:
              cert_file: /certs/tls.crt
              key_file: /certs/tls.key
```

**3. Network policies (restrict access):**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: signoz-ingress
  namespace: signoz
spec:
  podSelector:
    matchLabels:
      app: otel-collector
  policyTypes:
  - Ingress
  ingress:
  # Only allow from application namespace
  - from:
    - namespaceSelector:
        matchLabels:
          name: ginraidee
    ports:
    - protocol: TCP
      port: 4318
```

#### Step 4: Monitoring & Maintenance

**Set up alerts:**

```yaml
# kubernetes/signoz-alertmanager-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
  namespace: signoz
data:
  config.yml: |
    route:
      receiver: 'slack'
    receivers:
    - name: 'slack'
      slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
        title: 'SigNoz Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

**Backup ClickHouse data:**

```bash
# Create CronJob for daily backups
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: signoz-backup
  namespace: signoz
spec:
  schedule: "0 2 * * *"  # 2 AM daily
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: clickhouse/clickhouse-server:latest
            command:
            - /bin/bash
            - -c
            - |
              clickhouse-backup create && \
              clickhouse-backup upload
            env:
            - name: AZURE_STORAGE_ACCOUNT
              value: yourstorageaccount
            - name: AZURE_STORAGE_KEY
              valueFrom:
                secretKeyRef:
                  name: azure-storage
                  key: key
          restartPolicy: OnFailure
EOF
```

**Monitor SigNoz itself:**

```bash
# Add Prometheus monitoring
kubectl apply -f https://raw.githubusercontent.com/SigNoz/signoz/main/deploy/kubernetes/platform/prometheus-operator.yaml

# View SigNoz metrics
kubectl port-forward svc/prometheus-operated -n signoz 9090:9090
# Open http://localhost:9090
```

---

### Option C: Hybrid (Dev on SigNoz Cloud, Production Self-Hosted)

**Use case:** Test with SigNoz Cloud, then migrate to self-hosted for cost savings

**Config:**

```javascript
// services/*/src/config/tracing.js
const isProduction = process.env.NODE_ENV === 'production';
const isSelfHosted = process.env.SIGNOZ_SELF_HOSTED === 'true';

const traceExporter = new OTLPTraceExporter({
  url: isProduction && !isSelfHosted
    ? process.env.OTEL_EXPORTER_OTLP_ENDPOINT  // SigNoz Cloud
    : process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',  // Self-hosted
  headers: isProduction && !isSelfHosted
    ? { 'signoz-access-token': process.env.SIGNOZ_ACCESS_TOKEN }
    : {},
});
```

---

## Cost Comparison (Typical Small App)

### Assumptions:
- 3 services
- 10,000 requests/day
- ~5KB per trace
- 30-day retention

| Option | Monthly Cost | Pros | Cons |
|--------|-------------|------|------|
| **SigNoz Cloud** | $80-120 | Zero ops, auto-scaling | Ongoing cost, egress fees |
| **Self-Hosted (AKS)** | $150-300* | One-time setup, control | Ops burden, need expertise |
| **Development (Local)** | $0 | Free testing | Not for production |

*Includes: 3-node AKS cluster ($200/mo) + storage ($50/mo)

---

## Migration Path

### Phase 1: Development (Current)
```
Local Docker → SigNoz Docker (separate)
```

### Phase 2: Staging
```
Azure App Service (staging) → SigNoz Cloud (free tier)
```

### Phase 3: Production (Small)
```
Azure App Service (prod) → SigNoz Cloud (paid)
```

### Phase 4: Production (Scale)
```
Azure Kubernetes Service → Self-Hosted SigNoz (same AKS)
```

---

## Configuration Matrix

| Environment | OTEL Endpoint | Auth | TLS |
|-------------|---------------|------|-----|
| Local Dev | `http://localhost:4318/v1/traces` | None | No |
| Staging | `https://ingest.us.signoz.cloud:443` | Token | Yes |
| Production (Cloud) | `https://ingest.us.signoz.cloud:443` | Token | Yes |
| Production (Self-hosted) | `http://signoz-otel-collector.signoz.svc:4318/v1/traces` | Optional | Optional |

---

## Troubleshooting Production Issues

### Traces not appearing in production

**1. Check network connectivity:**
```bash
# From your service pod
kubectl exec -it recipe-service-xxx -- sh
wget -O- http://signoz-otel-collector.signoz.svc:4318/v1/traces
```

**2. Check OTEL Collector logs:**
```bash
kubectl logs -n signoz -l app=otel-collector --tail=100
```

**3. Verify environment variables:**
```bash
kubectl get pod recipe-service-xxx -o yaml | grep -A 5 OTEL
```

### High latency / slow traces

**Enable sampling in production:**

```javascript
// tracing.js
const { TraceIdRatioBasedSampler } = require('@opentelemetry/sdk-trace-base');

const sdk = new NodeSDK({
  // ... other config
  sampler: process.env.NODE_ENV === 'production'
    ? new TraceIdRatioBasedSampler(0.1)  // Sample 10% in prod
    : undefined,  // Sample 100% in dev
});
```

### SigNoz storage growing too fast

**Adjust retention:**

```sql
-- Connect to ClickHouse
kubectl exec -it signoz-clickhouse-0 -n signoz -- clickhouse-client

-- Check current data size
SELECT
  table,
  formatReadableSize(sum(bytes)) as size
FROM system.parts
WHERE database = 'signoz_traces'
GROUP BY table
ORDER BY sum(bytes) DESC;

-- Reduce retention (default 7 days → 3 days)
ALTER TABLE signoz_traces.signoz_index_v2 MODIFY TTL toDateTime(timestamp) + INTERVAL 3 DAY;
```

---

## Security Checklist

- [ ] Enable TLS for OTEL Collector in production
- [ ] Use Azure KeyVault for SigNoz credentials
- [ ] Restrict network access with NetworkPolicies
- [ ] Enable authentication on SigNoz UI
- [ ] Set up backup for ClickHouse data
- [ ] Configure log rotation (prevent disk fill)
- [ ] Monitor SigNoz resource usage
- [ ] Set up alerts for trace ingestion failures

---

## References

- [SigNoz Kubernetes Installation](https://signoz.io/docs/install/kubernetes/)
- [SigNoz Cloud Documentation](https://signoz.io/docs/cloud/)
- [OpenTelemetry Best Practices](https://opentelemetry.io/docs/specs/otel/trace/sdk/)
- [Azure Kubernetes Service](https://docs.microsoft.com/en-us/azure/aks/)
