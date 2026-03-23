# Tracing Design Decisions & FAQ

This document answers key questions about our observability architecture.

---

## Q1: Is the implementation tied to SigNoz? Can we switch to Datadog?

### Short Answer: **No, we can switch anytime. Only 10 lines of config change.**

### The Power of OpenTelemetry

**What we implemented:**
- ✅ OpenTelemetry SDK (vendor-agnostic standard)
- ✅ Custom spans (portable across all backends)
- ✅ Standard attributes (understood by all tools)
- ✅ Auto-instrumentation (works everywhere)

**What's vendor-specific:**
- ❌ Only the exporter configuration (~10 lines per service)

### Switching Example

**Current (SigNoz):**
```javascript
// services/recipe-service/src/config/tracing.js
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const traceExporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
});
```

**Switch to Datadog:**
```javascript
// Same file, just change exporter
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const traceExporter = new OTLPTraceExporter({
  url: 'https://http-intake.logs.datadoghq.com/v1/traces',
  headers: {
    'DD-API-KEY': process.env.DD_API_KEY,
  },
});
```

**Switch to Jaeger:**
```javascript
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const traceExporter = new OTLPTraceExporter({
  url: 'http://jaeger-collector:4318/v1/traces',
});
```

**Switch to Grafana Tempo:**
```javascript
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const traceExporter = new OTLPTraceExporter({
  url: 'http://tempo:4318/v1/traces',
});
```

### What Stays Exactly the Same

**All your instrumentation code:**
```javascript
// This works with ANY backend
const span = tracer.startSpan('generateRecipe', {
  attributes: {
    'recipe.dish': dish,
    'recipe.language': language,
  },
});

try {
  const recipe = await callAI(prompt);
  span.setAttribute('recipe.output_length', recipe.length);
  span.setStatus({ code: 1 }); // OK
  return recipe;
} catch (error) {
  span.recordException(error);
  span.setStatus({ code: 2, message: error.message });
  throw error;
} finally {
  span.end();
}
```

### Migration Effort

| Component | Lines Changed | Effort |
|-----------|---------------|--------|
| Exporter config | 10 per service | 5 minutes |
| Environment variables | 2-3 per service | 2 minutes |
| Custom spans | 0 | None |
| Auto-instrumentation | 0 | None |
| **Total** | **~40 lines** | **~30 minutes** |

**This is the entire point of OpenTelemetry** - instrument once, switch backends freely.

---

## Q2: How do you decide what to trace?

### The Framework I Use

```
┌─────────────────────────────────────────────────┐
│  Decision Tree: Should I add a span?            │
├─────────────────────────────────────────────────┤
│                                                 │
│  1️⃣ Is this user-facing? (API endpoint)        │
│     → YES = Add span                            │
│     Examples: suggestMenu, parseImage, getAll  │
│                                                 │
│  2️⃣ Is this an external dependency?            │
│     → YES = Add span                            │
│     Examples: Azure API, database, HTTP call   │
│                                                 │
│  3️⃣ Is this expected to be slow? (>50ms)       │
│     → YES = Add span                            │
│     Examples: AI calls, OCR, heavy parsing     │
│                                                 │
│  4️⃣ Do I debug this often?                      │
│     → YES = Consider adding span               │
│     Examples: Complex business logic           │
│                                                 │
│  5️⃣ Is this a simple helper? (<1ms)            │
│     → NO = Don't add span                      │
│     Examples: formatDate, validateEmail        │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Practical Examples from Our Code

#### ✅ GOOD: Recipe Service

**Traced operations:**
```javascript
exports.generateRecipe = async (req, res) => {
  // ✅ User-facing operation
  const span = tracer.startSpan('generateRecipe');

  try {
    // ❌ Don't trace - too fast
    const inventoryText = formatIngredients(ingredients);

    // ✅ Traced inside callAI - external dependency
    const recipe = await callAI(systemPrompt, userPrompt);

    // ✅ Add useful attributes
    span.setAttribute('recipe.output_length', recipe.length);

    res.json({ success: true, data: { recipe } });
  } finally {
    span.end();
  }
};
```

**Result in SigNoz:**
```
POST /api/recipes/generate - 5600ms
  ├─ generateRecipe - 5598ms
  │   └─ azure_openai_call - 5500ms  ← Clear bottleneck!
  └─ Response - 2ms
```

#### ✅ GOOD: Inventory Service

**Traced operations:**
```javascript
exports.getAll = async (req, res) => {
  // ✅ User-facing CRUD operation
  const span = tracer.startSpan('getAll');

  try {
    // ✅ Database query auto-instrumented by OpenTelemetry
    const items = await InventoryItem.findAll({
      where: { userId: req.userId },
    });

    // ✅ Useful metric
    span.setAttribute('inventory.items_count', items.length);

    res.json({ success: true, data: items });
  } finally {
    span.end();
  }
};
```

**Result in SigNoz:**
```
GET /api/inventory - 50ms
  ├─ getAll - 48ms
  │   ├─ SELECT * FROM inventory... - 15ms  ← Auto-instrumented!
  │   └─ Processing - 33ms
  └─ Response - 2ms
```

#### ❌ BAD: Over-instrumentation

**Don't do this:**
```javascript
exports.generateRecipe = async (req, res) => {
  const span1 = tracer.startSpan('generateRecipe');

  // ❌ Too granular - adds noise
  const span2 = tracer.startSpan('formatIngredients');
  const inventoryText = formatIngredients(ingredients);
  span2.end();

  // ❌ Too granular
  const span3 = tracer.startSpan('buildSystemPrompt');
  const systemPrompt = buildSystemPrompt(language);
  span3.end();

  // ❌ Too granular
  const span4 = tracer.startSpan('buildUserPrompt');
  const userPrompt = buildUserPrompt(inventoryText);
  span4.end();

  // ✅ This one is OK - external call
  const recipe = await callAI(systemPrompt, userPrompt);

  // ❌ Too granular
  const span5 = tracer.startSpan('validateRecipe');
  validateRecipe(recipe);
  span5.end();

  span1.end();
};
```

**Result: Unreadable trace with 90% noise:**
```
POST /api/recipes/generate - 5600ms
  ├─ generateRecipe - 5598ms
  │   ├─ formatIngredients - 0.1ms  ← Noise
  │   ├─ buildSystemPrompt - 0.05ms  ← Noise
  │   ├─ buildUserPrompt - 0.03ms  ← Noise
  │   ├─ azure_openai_call - 5500ms  ← Only useful one
  │   └─ validateRecipe - 2ms  ← Noise
  └─ Response - 2ms
```

### The "5% Rule"

> **Only trace operations that represent >5% of total request time, OR external dependencies**

**Example calculation:**
```
Total request: 100ms

Operation A: 60ms → 60% of total → ✅ Trace it
Operation B: 10ms → 10% of total → ✅ Trace it
Operation C: 5ms  → 5% of total  → ✅ Borderline, trace if debugged often
Operation D: 0.5ms → 0.5% of total → ❌ Don't trace
```

### Attributes: What to Track

**✅ DO track:**
- User identifiers (IDs, not names)
- Business metrics (item count, file size, score)
- Configuration (language, model, settings)
- Outcomes (success/failure, fallback used)

**❌ DON'T track:**
- Sensitive data (passwords, tokens, PII)
- Full request/response bodies
- Internal implementation details

**Example:**
```javascript
span.setAttribute('recipe.dish', dish);  // ✅ Good
span.setAttribute('recipe.ingredients_count', count);  // ✅ Good
span.setAttribute('recipe.full_ingredients_list', JSON.stringify(ingredients));  // ❌ Too much
span.setAttribute('user.email', email);  // ❌ PII
```

### Levels of Instrumentation

**Level 1: Automatic (Free)**
- HTTP requests (Express)
- Database queries (Sequelize)
- Outgoing HTTP calls (axios)
- **Effort:** 0 lines of code (auto-instrumentation)

**Level 2: Operation Boundaries (Recommended)**
- Controller functions
- Service methods
- External API wrappers
- **Effort:** 5-10 lines per operation

**Level 3: Detailed (For Debugging)**
- Complex algorithms
- Heavy processing loops
- Multi-step business logic
- **Effort:** 20+ lines, only when needed

### Real-World Balance

**Our implementation (Level 2):**
```
Recipe Service: 3 custom spans
Inventory Service: 5 custom spans
OCR Service: 2 custom spans

Total: 10 custom spans across 3 services
Average: ~8 lines of tracing code per operation
```

**Result:**
- Clear visibility into bottlenecks
- Readable traces (5-10 spans per request)
- Low overhead (<1ms per request)
- Easy to maintain

---

## Q3: How does production cloud deployment change the config?

### Short Answer: **Only endpoint and authentication change**

### Configuration Matrix

| Environment | Endpoint | Auth | TLS | Changes |
|-------------|----------|------|-----|---------|
| **Local Dev** | `http://localhost:4318` | None | No | 0 lines |
| **Staging (SigNoz Cloud)** | `https://ingest.us.signoz.cloud:443` | Token | Yes | 2 env vars |
| **Production (Self-hosted)** | `http://signoz.svc.cluster.local:4318` | Optional | Optional | 1-2 env vars |

### Development (Current)

**Setup:**
```
Your Laptop
  ├─ Docker Compose (services)
  └─ SigNoz (separate docker-compose)
```

**Config:**
```javascript
// tracing.js
url: 'http://localhost:4318/v1/traces'
```

### Staging → SigNoz Cloud

**Setup:**
```
Azure App Service (your services)
       │
       │ HTTPS + Token
       ▼
SigNoz Cloud (fully managed)
```

**Changes needed:**
1. Set environment variables:
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.us.signoz.cloud:443
SIGNOZ_ACCESS_TOKEN=your-token-here
```

2. Update tracing.js (one time):
```javascript
const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  headers: {
    'signoz-access-token': process.env.SIGNOZ_ACCESS_TOKEN || '',
  },
});
```

3. Deploy services - done!

**Pros:**
- ✅ Zero infrastructure management
- ✅ 5-minute setup
- ✅ Auto-scaling
- ✅ Free tier available

**Cons:**
- ❌ Monthly cost (~$50-200)

### Production → Self-Hosted on Kubernetes

**Setup:**
```
Azure Kubernetes Service
  ├─ Application Namespace
  │   ├─ Recipe Service
  │   ├─ Inventory Service
  │   └─ OCR Service
  │
  └─ SigNoz Namespace
      ├─ OTEL Collector (4318)
      ├─ ClickHouse (storage)
      └─ Frontend UI (3301)
```

**Changes needed:**
1. Deploy SigNoz to Kubernetes:
```bash
helm repo add signoz https://charts.signoz.io
helm install signoz signoz/signoz -n signoz
```

2. Update environment variables:
```bash
# For services in same cluster
OTEL_EXPORTER_OTLP_ENDPOINT=http://signoz-otel-collector.signoz.svc.cluster.local:4318/v1/traces

# No auth token needed (internal network)
```

3. Deploy services - done!

**Pros:**
- ✅ Full control
- ✅ Cost-effective at scale
- ✅ Data sovereignty

**Cons:**
- ❌ Need to manage infrastructure
- ❌ Requires Kubernetes expertise

### Environment-Aware Config (Recommended)

**Single tracing.js that works everywhere:**

```javascript
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';
const isSigNozCloud = process.env.SIGNOZ_CLOUD === 'true';

// Build exporter config based on environment
const exporterConfig = {
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
};

// Add auth for SigNoz Cloud only
if (isProduction && isSigNozCloud) {
  exporterConfig.headers = {
    'signoz-access-token': process.env.SIGNOZ_ACCESS_TOKEN,
  };
}

const traceExporter = new OTLPTraceExporter(exporterConfig);

const sdk = new NodeSDK({
  serviceName: process.env.SERVICE_NAME || 'recipe-service',
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],

  // Sample in production to reduce costs
  sampler: isProduction
    ? new TraceIdRatioBasedSampler(0.1)  // 10% sampling
    : undefined,  // 100% in dev
});

sdk.start();
```

**Then just set env vars per environment:**

```bash
# Local dev
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
# (no other vars needed)

# Staging (SigNoz Cloud)
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.us.signoz.cloud:443
SIGNOZ_ACCESS_TOKEN=token-abc123
SIGNOZ_CLOUD=true
NODE_ENV=production

# Production (Self-hosted)
OTEL_EXPORTER_OTLP_ENDPOINT=http://signoz-otel-collector.signoz.svc:4318/v1/traces
NODE_ENV=production
# (no token needed)
```

### Cost Comparison

**Assumptions:** 3 services, 10K requests/day, 30-day retention

| Option | Setup Time | Monthly Cost | Ops Burden |
|--------|-----------|--------------|------------|
| **SigNoz Cloud** | 10 minutes | $80-150 | None |
| **Self-hosted (K8s)** | 2-4 hours | $150-300* | Medium |
| **Local (dev only)** | 5 minutes | $0 | None |

*Includes AKS cluster + storage

### Migration Path

**Recommended progression:**

```
Phase 1: Local Dev
  └─ SigNoz via docker-compose

Phase 2: Staging
  └─ SigNoz Cloud (free tier)

Phase 3: Production (small)
  └─ SigNoz Cloud (paid tier)

Phase 4: Production (scale)
  └─ Self-hosted on Kubernetes
```

---

## Key Takeaways

### 1. OpenTelemetry Portability ✅
- Instrumentation is portable
- Only exporter config is vendor-specific
- ~30 minutes to switch backends

### 2. Tracing Strategy 📊
- Trace user-facing operations
- Trace external dependencies
- Don't trace fast helpers
- Follow the 5% rule

### 3. Production Deployment 🚀
- Use SigNoz Cloud for quick start
- Move to self-hosted for scale
- Only env vars change between environments
- Tracing code stays identical

---

## Further Reading

- Full production guide: `docs/observability-production.md`
- Current setup & patterns: `docs/observability.md`
- SigNoz setup guide: `docs/observability-setup.md`
