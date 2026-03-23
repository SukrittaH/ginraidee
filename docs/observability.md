# Observability Guide - GinRaiDee

This document covers distributed tracing, monitoring, and performance analysis for the GinRaiDee microservices.

## Current Setup

- **Platform**: SigNoz (self-hosted, separate deployment)
- **Instrumentation**: OpenTelemetry
- **Instrumented Services**:
  - ✅ Recipe Service (port 3004) - Traces ✅ | Logs ✅
  - ✅ Inventory Service (port 3002) - Traces ✅ | Logs ✅
  - ✅ OCR Service (port 3003) - Traces ✅ | Logs ✅
  - ❌ Auth Service (not instrumented yet)
- **SigNoz UI**: http://localhost:3301
- **OTLP Endpoints**:
  - Traces: http://localhost:4318/v1/traces
  - Logs: http://localhost:4318/v1/logs

**Logging Implementation**: Dual logging with Winston (console) + OpenTelemetry Logs API (SigNoz)

## Logging Architecture

### Structured Logging with Winston

All services use **Winston** for structured logging with automatic trace correlation.

**Key features:**
- **JSON format** - Machine-readable, easy to query
- **Log levels** - debug, info, warn, error
- **Trace correlation** - Every log linked to its trace via trace_id
- **Context enrichment** - Automatic service name, timestamp, environment
- **OTLP export** - Logs sent to SigNoz alongside traces

### Log Levels

```javascript
logger.debug('Detailed info for debugging', { key: 'value' });
logger.info('Normal operational messages', { key: 'value' });
logger.warn('Warning conditions', { key: 'value' });
logger.error('Error conditions', { error: err.message, stack: err.stack });
```

**When to use each level:**

| Level | Use Case | Example |
|-------|----------|---------|
| **debug** | Detailed diagnostics | `"Fetching items from database"` |
| **info** | Normal operations | `"User created recipe"`, `"API call successful"` |
| **warn** | Unusual but handled | `"Slow request detected (>5s)"`, `"Cache miss"` |
| **error** | Failures requiring attention | `"Database connection failed"`, `"API call failed"` |

### Trace-Log Correlation

Every log entry includes the current trace ID, allowing you to:
1. **Click on a trace** in SigNoz
2. **View all logs** for that trace
3. **See the full story** - spans + logs together

**Example log output:**
```json
{
  "timestamp": "2026-03-23 15:30:45.123",
  "level": "info",
  "message": "Menu suggestions generated successfully",
  "service": "recipe-service",
  "trace_id": "a1b2c3d4e5f6g7h8",
  "span_id": "1234567890abcdef",
  "user_id": "user-123",
  "language": "th",
  "ingredients_count": 5
}
```

### Custom Log Methods

**HTTP Request Logging:**
```javascript
logger.logRequest(req, res, duration);
// Logs: method, path, status, duration, user_id, IP
```

**External API Calls:**
```javascript
logger.logExternalCall('azure-openai', 'getChatCompletions', duration, success, error);
// Logs: service, operation, duration, success/failure
```

**Business Events:**
```javascript
logger.logBusinessEvent('menu_suggested', {
  user_id: req.userId,
  language: 'th',
  ingredients_count: 5,
});
// Logs: event type + custom data
```

### What Gets Logged

**✅ DO log:**
- Request metadata (method, path, status, duration)
- Business events (user actions, state changes)
- External API calls (start, end, latency, errors)
- Errors and exceptions (with stack traces)
- Performance warnings (slow requests, timeouts)
- User context (user ID, session ID - not email/PII)

**❌ DON'T log:**
- Passwords, tokens, API keys
- Credit card numbers, PII
- Full request/response bodies (unless debugging)
- Inside tight loops (performance impact)
- Redundant info already in traces

### Viewing Logs in SigNoz

1. **Open SigNoz**: http://localhost:3301
2. **Navigate to Logs** tab
3. **Filter by:**
   - Service name: `recipe-service`, `inventory-service`, `ocr-service`
   - Log level: `error`, `warn`, `info`, `debug`
   - Time range: Last 1h, 6h, 24h
   - Trace ID: Find all logs for a specific trace
   - Custom fields: `user_id`, `event_type`, etc.

4. **Click on a log** to see:
   - Full JSON payload
   - Link to related trace
   - Timeline view with other logs

### Example Queries

**Find all errors in the last hour:**
```
level="error" AND timestamp > now()-1h
```

**Find all logs for a specific user:**
```
user_id="user-123"
```

**Find slow requests:**
```
message="Slow request detected" AND duration_ms > 5000
```

**Find all menu suggestion events:**
```
event_type="menu_suggested"
```

**Find logs for a specific trace:**
```
trace_id="a1b2c3d4e5f6g7h8"
```

### Log Retention

**Development (current):**
- Logs stored in SigNoz for 7 days
- No sampling - 100% of logs collected

**Production recommendations:**
- Retain error logs: 30 days
- Retain info logs: 7 days
- Retain debug logs: 1 day (or disable in prod)
- Use sampling for high-volume services

### Performance Impact

**Minimal overhead:**
- Structured logging: ~0.1ms per log
- Async batching: Logs sent in batches every 5 seconds
- Non-blocking: Logging doesn't slow down requests

**Best practices:**
- Use appropriate log levels (debug only in dev)
- Don't log inside hot loops
- Use lazy evaluation for expensive computations

---

## Understanding Distributed Tracing

### What is a Trace?

A **trace** represents one complete request through your system. It contains multiple **spans** (steps/operations).

### Span Hierarchy (Parent-Child Relationship)

```
POST /api/recipes/generate  ← ROOT PARENT (entire HTTP request)
│
├─ middleware - cors  ← CHILD of POST
├─ middleware - helmet  ← CHILD of POST
├─ middleware - jsonParser  ← CHILD of POST
├─ middleware - authMiddleware  ← CHILD of POST
│
└─ generateRecipe  ← CHILD of POST (your controller function)
   │
   └─ azure_openai_call  ← CHILD of generateRecipe (grandchild of POST)
```

**Key Concept**:
- **Parent span duration** = Total time including all children
- **Child spans** = Break down where that time went
- Children run **inside** the parent's timeframe

### Visual Timeline Example

```
Time →  0ms          1000ms        2000ms        3000ms        4000ms        5000ms
        │                                                                      │
POST    ├──────────────────────────────────────────────────────────────────────┤
        │                                                                      │
cors    ├┤                                                                     │
        │                                                                      │
auth    │  ├┤                                                                  │
        │                                                                      │
generateRecipe  │    ├────────────────────────────────────────────────────────┤
        │                                                                      │
azure_openai_call    │    ├──────────────────────────────────────────┤       │
```

## Reading Traces in SigNoz

### Trace List View

| Column | Meaning | What to Look For |
|--------|---------|------------------|
| **Timestamp** | When the request started | Recent activity patterns |
| **service.name** | Which service handled it | Service distribution |
| **name** | Operation performed | Endpoint being called |
| **duration_nano** | How long it took | Performance bottlenecks |
| **http_method** | GET, POST, PUT, DELETE | Request type |
| **response_status_code** | 200, 400, 500, etc. | Success/failure rate |

### Example Trace Breakdown

```
Request: POST /api/recipes/generate
Total Duration: 5624ms

Timeline:
1. [00:20:17.713] POST request arrives → 5624ms total
2. [00:20:17.714] CORS middleware → 0.10ms ⚡
3. [00:20:17.714] Helmet security → 0.10ms ⚡
4. [00:20:17.714] JSON parser → 1.64ms ⚡
5. [00:20:17.716] Auth middleware → 0.64ms ⚡ (token validation)
6. [00:20:17.716] URL parser → 0.03ms ⚡
7. [00:20:17.716] Logger middleware → 0.22ms ⚡
8. [00:20:17.717] Route matched → 0.01ms ⚡
9. [00:20:17.717] generateRecipe starts → 5630.79ms 🐌
   └─ azure_openai_call → 5500ms 🐌 (AI generation)
10. [00:20:17.719] Response sent → 200 OK
```

**Performance Analysis**:
- ✅ Middleware: ~3ms (0.05% of total time) - Fast and efficient
- ⚠️ AI Call: 5500ms (99.9% of total time) - Expected bottleneck
- ✅ No database queries visible - Good caching or not needed

## Making Traces Easier to Read

### 1. Filter Traces

Use SigNoz filters to narrow down results:

```
# Only recipe generation
name = "POST /api/recipes/generate"

# Only menu suggestions
name = "POST /api/recipes/suggest-menu"

# Only errors
response_status_code >= 400

# Only slow requests (>10 seconds)
duration_nano > 10000000000

# Specific language
recipe.language = "th"
```

### 2. Use Service Metrics View

Instead of individual traces, view **aggregated metrics**:
- Go to: **Services → recipe-service**
- See average response times per endpoint
- Identify which endpoints are consistently slow
- View error rates and throughput

### 3. Flamegraph View

Click on any trace → **Flamegraph tab**:
- Visual timeline of all spans
- Parent-child relationships as nested blocks
- Color-coded by duration (red = slow, green = fast)
- Easy to spot bottlenecks at a glance

### 4. Service Map

Go to: **Services → Service Map**
- Visual diagram of microservice calls
- Error rates per service
- Latency between services
- Request flow visualization

### 5. Create Saved Views

Save common queries:
- "Slow Recipe Generation": `name = "generateRecipe" AND duration > 10s`
- "Menu Suggestions Only": `name = "suggestMenu"`
- "Errors Only": `response_status_code >= 400`
- "Thai Language Requests": `recipe.language = "th"`

## Custom Spans Added

We've instrumented the following operations with custom spans for better visibility:

### Recipe Service

1. **suggestMenu** span
   - Attributes:
     - `recipe.language`: Language of request (th/en)
     - `recipe.has_craving`: Whether user specified a craving
     - `recipe.ingredients_count`: Number of ingredients
   - Child span: `azure_openai_call`

2. **generateRecipe** span
   - Attributes:
     - `recipe.language`: Language of request
     - `recipe.dish`: Dish name being generated
     - `recipe.ingredients_count`: Number of ingredients
     - `recipe.output_length`: Length of generated recipe
     - `recipe.used_fallback`: True if fallback recipe was used
   - Child span: `azure_openai_call`

3. **azure_openai_call** span (reusable)
   - Attributes:
     - `ai.model`: Azure OpenAI model name (gpt-4o)
     - `ai.max_tokens`: Token limit
     - `ai.temperature`: Temperature setting
     - `ai.response_length`: Length of AI response
   - This span isolates AI call time from business logic

### Inventory Service

1. **getAll** span - Get all inventory items
   - Attributes:
     - `inventory.user_id`: User ID
     - `inventory.items_count`: Number of items returned

2. **create** span - Create new inventory item
   - Attributes:
     - `inventory.user_id`: User ID
     - `inventory.item_name`: Item name
     - `inventory.category`: Item category
     - `inventory.item_id`: Created item ID

3. **update** span - Update inventory item
   - Attributes:
     - `inventory.user_id`: User ID
     - `inventory.item_id`: Item ID being updated

4. **delete** span - Delete inventory item
   - Attributes:
     - `inventory.user_id`: User ID
     - `inventory.item_id`: Item ID being deleted

5. **getExpiringSoon** span - Get items expiring within 3 days
   - Attributes:
     - `inventory.user_id`: User ID
     - `inventory.expiry_window_days`: Days until expiry (3)
     - `inventory.expiring_items_count`: Number of expiring items

**Note**: Sequelize database queries are automatically instrumented by OpenTelemetry, so you'll see individual SQL queries as child spans under these operations.

### OCR Service

1. **parseImage** span - Process image with OCR
   - Attributes:
     - `ocr.language`: Language setting
     - `ocr.has_file`: Whether file upload was used
     - `ocr.has_base64`: Whether base64 image was used
     - `ocr.image_size_bytes`: Image size in bytes
     - `ocr.text_length`: Length of extracted text
     - `ocr.product_name`: Extracted product name
     - `ocr.quality_score`: Quality score (0-100)
     - `ocr.confidence`: Confidence level (low/medium/high)
   - Child span: `azure_document_intelligence_call`

2. **azure_document_intelligence_call** span
   - Attributes:
     - `azure.endpoint`: Azure endpoint URL
     - `azure.api_version`: API version (2023-07-31)
     - `azure.model`: Model name (prebuilt-read)
   - This span isolates Azure API call time from image processing

## Performance Indicators

### 🟢 Good Signs
- Response code: 200 (success)
- Consistent timing across similar requests
- Fast middleware execution (<5ms)
- Clear identification of bottlenecks

### 🔴 Red Flags
- Response code: 500, 401, 404 (errors)
- Suddenly slow requests (>10 seconds)
- Missing spans (indicates instrumentation gaps)
- High variance in timing (performance instability)
- Increasing error rates over time

## Common Performance Patterns

### Expected Bottlenecks
1. **Azure OpenAI API calls**: 3-8 seconds (normal for AI generation)
2. **Database queries**: 10-100ms (acceptable with proper indexing)
3. **Image processing (OCR)**: 2-5 seconds (normal for Azure Document Intelligence)

### Unexpected Bottlenecks (Investigate)
1. **Middleware > 100ms**: Check for blocking operations
2. **Authentication > 500ms**: Token validation shouldn't be slow
3. **Simple CRUD > 1s**: Database performance issue
4. **Memory leaks**: Increasing response times over time

## Alert Recommendations

Set up alerts for:

1. **High Error Rate**: `error_rate > 5%` for 5 minutes
2. **Slow Requests**: `p95_latency > 10s` for recipe generation
3. **Service Down**: No traces received for 2 minutes
4. **AI Timeout**: `azure_openai_call > 30s` (indicates Azure issues)

## Next Steps

### Expand Tracing to Other Services

Following the same pattern as Recipe Service:

1. **Inventory Service** (Priority: High)
   - Track CRUD operations
   - Monitor expiring items queries
   - Measure database query performance

2. **OCR Service** (Priority: Medium)
   - Monitor Azure Document Intelligence latency
   - Track image processing time
   - Measure extraction accuracy

3. **Auth Service** (Priority: Low)
   - Track authentication flows
   - Monitor token validation time
   - Identify failed login attempts

### Add Custom Metrics

Beyond traces, consider adding:
- **Counters**: Number of recipes generated, menu suggestions
- **Gauges**: Active users, current inventory count
- **Histograms**: Recipe generation time distribution

### Production Considerations

When moving to production:

1. **Sampling**: Sample 10-20% of traces to reduce costs
   ```javascript
   const { TraceIdRatioBasedSampler } = require('@opentelemetry/sdk-trace-base');

   const sdk = new NodeSDK({
     sampler: new TraceIdRatioBasedSampler(0.1), // 10% sampling
   });
   ```

2. **Resource Detection**: Automatically detect cloud environment
3. **Secure Communication**: Use TLS for OTLP exports
4. **Log Correlation**: Link logs to traces via trace IDs

## Troubleshooting

### Traces Not Appearing

1. Check SigNoz is running:
   ```bash
   curl http://localhost:4318/v1/traces
   ```

2. Check service can reach SigNoz:
   ```bash
   docker-compose exec recipe-service curl http://host.docker.internal:4318/v1/traces
   ```

3. Check service logs for OTEL errors:
   ```bash
   docker-compose logs recipe-service | grep -i "otel\|trace"
   ```

### High Memory Usage

1. Disable file system instrumentation (already done)
2. Add sampling (see above)
3. Reduce retention period in SigNoz settings

### Incomplete Traces

If spans are missing:
1. Check that tracing is initialized **before** all imports in server.js
2. Verify OpenTelemetry packages are installed
3. Check for manual span.end() calls in error paths

## References

- [SigNoz Documentation](https://signoz.io/docs/)
- [OpenTelemetry Node.js](https://opentelemetry.io/docs/instrumentation/js/)
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
- [Observability Setup Guide](./observability-setup.md)

## Changelog

### 2026-03-23

**Phase 1: Distributed Tracing**
- Initial tracing setup with SigNoz
- Instrumented Recipe Service with custom spans
- Added azure_openai_call span for AI performance tracking
- Documented trace reading and analysis techniques
- Added performance indicators and alert recommendations

**Phase 2: Expand Tracing**
- Instrumented Inventory Service with CRUD operation spans
- Enabled automatic Sequelize database query tracing
- Instrumented OCR Service with parseImage and Azure API spans
- Added comprehensive attributes for all operations
- All three core services now fully instrumented

**Phase 3: Structured Logging**
- Implemented Winston structured logging across all services
- Automatic trace-log correlation via OpenTelemetry
- Created custom log methods (logRequest, logExternalCall, logBusinessEvent)
- Logs exported to SigNoz via OTLP
- Replaced morgan with custom request logger middleware
- Added context-aware logging (user_id, trace_id, service)
- Documented log levels, best practices, and query patterns

---

**Note**: This is a living document. Update it as we add more instrumentation, learn new patterns, or discover issues.
