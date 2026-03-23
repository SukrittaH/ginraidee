# Observability Setup with SigNoz

This guide explains how to set up distributed tracing for the GinRaiDee microservices using SigNoz.

## Architecture Overview

SigNoz is deployed separately from the main application services to keep the core docker-compose.yml clean and maintainable. The microservices send traces to SigNoz via OpenTelemetry.

```
┌─────────────────────────────────────────┐
│  GinRaiDee Microservices                │
│  (docker-compose.yml)                   │
│                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐│
│  │ Auth    │  │Inventory │  │  OCR   ││
│  │ :3001   │  │  :3002   │  │ :3003  ││
│  └────┬────┘  └─────┬────┘  └────┬───┘│
│       │             │              │   │
│  ┌────┴─────────────┴──────────────┴──┐│
│  │         Recipe Service              ││
│  │            :3004                    ││
│  │  (OpenTelemetry instrumented)      ││
│  └────────────────┬────────────────────┘│
└───────────────────┼─────────────────────┘
                    │ Sends traces via HTTP
                    │ (http://localhost:4318)
                    ▼
         ┌──────────────────────┐
         │   SigNoz Platform    │
         │ (separate deployment)│
         │                      │
         │  UI:    :3301        │
         │  OTLP:  :4317/:4318  │
         └──────────────────────┘
```

## Step 1: Deploy SigNoz Separately

### Option A: Using SigNoz Docker Compose (Recommended for Development)

1. Clone SigNoz repository in a separate directory:
```bash
cd ~/Desktop/sandbox
git clone https://github.com/SigNoz/signoz.git
cd signoz/deploy
```

2. Start SigNoz:
```bash
docker-compose -f docker/clickhouse-setup/docker-compose.yaml up -d
```

3. Wait for all services to be healthy (takes 2-3 minutes):
```bash
docker-compose -f docker/clickhouse-setup/docker-compose.yaml ps
```

4. Access SigNoz UI:
- Open http://localhost:3301
- Create an account (first user becomes admin)

### Option B: Using Docker (Simpler, but less customizable)

```bash
docker run -d \
  --name signoz \
  -p 3301:3301 \
  -p 4317:4317 \
  -p 4318:4318 \
  -v signoz-data:/var/lib/signoz \
  signoz/signoz:latest
```

## Step 2: Configure OpenTelemetry in Recipe Service

The Recipe Service is the most complex microservice and perfect for the first trace implementation.

### Install OpenTelemetry Dependencies

```bash
cd /Users/atxm/Desktop/sandbox/ginraidee/services/recipe-service
npm install @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http
```

### Create Tracing Configuration

Create `services/recipe-service/src/config/tracing.js`:

```javascript
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// Configure the OTLP exporter to send traces to SigNoz
const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  headers: {},
});

// Initialize the SDK
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'recipe-service',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  }),
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Automatically instrument Express, HTTP, and other common libraries
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable filesystem instrumentation to reduce noise
      },
    }),
  ],
});

// Start the SDK
sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('🔍 Tracing terminated'))
    .catch((error) => console.error('Error terminating tracing', error))
    .finally(() => process.exit(0));
});

module.exports = sdk;
```

### Update server.js to Initialize Tracing

Modify `services/recipe-service/src/server.js` to require tracing at the very top (before any other imports):

```javascript
// IMPORTANT: Tracing must be initialized FIRST, before any other requires
require('./config/tracing');

require('dotenv').config();
const express = require('express');
// ... rest of the imports
```

### Update docker-compose.yml

Add environment variable to Recipe Service to point to SigNoz:

```yaml
recipe-service:
  # ... existing config
  environment:
    # ... existing environment variables
    - OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318/v1/traces
```

## Step 3: Test the First Trace

1. Restart Recipe Service:
```bash
cd /Users/atxm/Desktop/sandbox/ginraidee
docker-compose restart recipe-service
```

2. Check Recipe Service logs for tracing initialization:
```bash
docker-compose logs recipe-service | grep -i "trace\|otel"
```

3. Generate some traffic to create traces:
```bash
# From your React Native app, make a recipe suggestion request
# Or use curl:
curl -X POST http://localhost:3004/api/recipes/suggest-menu \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "ingredients": [{"name": "chicken", "quantity": "500", "unit": "g"}],
    "language": "en",
    "craving": "something quick"
  }'
```

4. View traces in SigNoz:
- Open http://localhost:3301
- Navigate to "Services" tab
- You should see "recipe-service" appear
- Click on it to view traces
- Click on any trace to see the full span details

## Step 4: Understanding Your First Trace

Your first trace will show:
- **HTTP Request Span**: The incoming POST request to `/api/recipes/suggest-menu`
- **Database Spans**: Any Sequelize/PostgreSQL queries (if auto-instrumented)
- **HTTP Client Spans**: Outgoing requests to Azure OpenAI API
- **Custom Spans**: Any manual spans you add for specific operations

### Key Metrics to Watch:
- **Latency**: How long each request takes end-to-end
- **Error Rate**: Percentage of failed requests
- **Throughput**: Requests per second
- **Dependencies**: Which external services are being called

## Step 5: Add Custom Spans (Optional)

For more granular tracing, add custom spans:

```javascript
const { trace } = require('@opentelemetry/api');

// In recipeController.js
exports.generateRecipe = async (req, res) => {
  const tracer = trace.getTracer('recipe-controller');
  const span = tracer.startSpan('generateRecipe');

  try {
    // Your existing code here
    span.setAttributes({
      'recipe.language': language,
      'recipe.ingredients_count': ingredients.length,
    });

    // ... generate recipe logic

    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    throw error;
  } finally {
    span.end();
  }
};
```

## Step 6: Expand to Other Services

Once Recipe Service tracing works well, expand to other services:

1. **Inventory Service**: Track CRUD operations, expiring items queries
2. **OCR Service**: Monitor Azure Document Intelligence latency, image processing time
3. **Auth Service**: Track authentication flows, token validation

Each service follows the same pattern:
1. Install OpenTelemetry dependencies
2. Create tracing config with unique service name
3. Initialize tracing at the top of server.js
4. Add OTEL environment variable to docker-compose.yml

## Troubleshooting

### Traces not appearing in SigNoz

1. Check SigNoz is running:
```bash
curl http://localhost:4318/v1/traces
```

2. Check Recipe Service can reach SigNoz:
```bash
docker-compose exec recipe-service curl http://host.docker.internal:4318/v1/traces
```

3. Check Recipe Service logs:
```bash
docker-compose logs recipe-service
```

### High memory usage from tracing

1. Disable file system instrumentation (already done in config)
2. Add sampling:
```javascript
const { TraceIdRatioBasedSampler } = require('@opentelemetry/sdk-trace-base');

const sdk = new NodeSDK({
  // ... other config
  sampler: new TraceIdRatioBasedSampler(0.1), // Sample 10% of traces
});
```

## Production Considerations

For production deployment:

1. **Use SigNoz Cloud**: https://signoz.io/teams/
   - No infrastructure management
   - Automatic scaling
   - Built-in alerting

2. **Or self-host with Kubernetes**: See https://signoz.io/docs/install/kubernetes/

3. **Set up alerts**: Configure SigNoz alerts for:
   - High error rates (>5%)
   - Slow requests (>2s p95 latency)
   - Service downtime

4. **Add sampling**: Sample 10-20% of traces in production to reduce costs

## References

- SigNoz Documentation: https://signoz.io/docs/
- OpenTelemetry Node.js: https://opentelemetry.io/docs/instrumentation/js/
- Auto-instrumentation: https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/metapackages/auto-instrumentations-node
