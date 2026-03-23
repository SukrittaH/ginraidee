# Logging Quick Reference Guide

## Logger Usage

### Import Logger

```javascript
const logger = require('../config/logger');
```

### Basic Logging

```javascript
// Debug - Detailed diagnostic info (dev only)
logger.debug('Fetching user inventory', { user_id: '123', category: 'vegetables' });

// Info - Normal operational messages
logger.info('Recipe generated successfully', { user_id: '123', recipe_length: 1200 });

// Warn - Something unusual happened but was handled
logger.warn('Slow database query detected', { query_time_ms: 3500, table: 'inventory' });

// Error - Something went wrong
logger.error('Failed to connect to Azure API', {
  error: error.message,
  stack: error.stack,
  retry_count: 3,
});
```

### Custom Log Methods

**HTTP Request Logging** (automatically added via middleware):
```javascript
// In requestLogger middleware (already set up)
logger.logRequest(req, res, duration);
```

**External API Calls:**
```javascript
const startTime = Date.now();
try {
  const result = await axios.post(azureUrl, data);
  const duration = Date.now() - startTime;
  logger.logExternalCall('azure-openai', 'getChatCompletions', duration, true);
} catch (error) {
  const duration = Date.now() - startTime;
  logger.logExternalCall('azure-openai', 'getChatCompletions', duration, false, error);
}
```

**Business Events:**
```javascript
// Track important user actions
logger.logBusinessEvent('user_created_recipe', {
  user_id: req.userId,
  recipe_name: 'ผัดไทย',
  ingredients_count: 8,
});

logger.logBusinessEvent('inventory_item_added', {
  user_id: req.userId,
  item_name: 'Milk',
  category: 'dairy',
  quantity: 1,
  unit: 'L',
});
```

## Log Structure

Every log automatically includes:

```json
{
  "timestamp": "2026-03-23 15:30:45.123",
  "level": "info",
  "message": "Your log message",
  "service": "recipe-service",
  "environment": "development",
  "trace_id": "a1b2c3d4e5f6g7h8",  // ← Links to trace
  "span_id": "1234567890abcdef",
  // ... your custom fields
}
```

## Viewing Logs in SigNoz

### 1. Access Logs Tab
- Open: http://localhost:3301
- Click: **Logs** in left sidebar

### 2. Common Queries

**All errors in last hour:**
```
level="error" AND timestamp > now()-1h
```

**Logs for specific user:**
```
user_id="user-123"
```

**Logs for specific trace (click trace → view logs):**
```
trace_id="abc123..."
```

**Business events:**
```
event_type="menu_suggested"
```

**External API failures:**
```
external_service="azure-openai" AND success=false
```

**Slow requests:**
```
duration_ms > 5000
```

### 3. Trace-Log Correlation

**From a trace:**
1. Click on any span in the trace view
2. Click "View Logs" button
3. See all logs for that trace

**From a log:**
1. Click on any log entry
2. Click on the `trace_id` field
3. Jump to the related trace

## Best Practices

### ✅ DO

**Log important events:**
```javascript
logger.info('User authenticated successfully', {
  user_id: req.userId,
  method: 'microsoft_entra_id',
});
```

**Log errors with context:**
```javascript
logger.error('Database query failed', {
  query: 'SELECT * FROM inventory',
  error: error.message,
  stack: error.stack,
  user_id: req.userId,
  retry_attempt: 2,
});
```

**Log performance issues:**
```javascript
if (duration > 5000) {
  logger.warn('Slow AI response', {
    model: 'gpt-4o',
    duration_ms: duration,
    prompt_length: prompt.length,
  });
}
```

**Log business metrics:**
```javascript
logger.logBusinessEvent('recipe_generated', {
  user_id: req.userId,
  dish_name: 'ผัดไทย',
  ingredients_used: 8,
  generation_time_ms: 5200,
});
```

### ❌ DON'T

**Don't log sensitive data:**
```javascript
// ❌ BAD
logger.info('User login', {
  email: user.email,  // PII
  password: user.password,  // Sensitive!
});

// ✅ GOOD
logger.info('User login successful', {
  user_id: user.id,
  auth_method: 'microsoft_entra_id',
});
```

**Don't log full request/response bodies:**
```javascript
// ❌ BAD
logger.debug('Request received', {
  body: JSON.stringify(req.body),  // Too much data
});

// ✅ GOOD
logger.debug('Request received', {
  method: req.method,
  path: req.path,
  ingredients_count: req.body.ingredients?.length,
});
```

**Don't log in tight loops:**
```javascript
// ❌ BAD
items.forEach(item => {
  logger.debug('Processing item', { item_id: item.id });  // 1000s of logs!
  processItem(item);
});

// ✅ GOOD
logger.debug('Processing items batch', {
  items_count: items.length,
  batch_id: batchId,
});
items.forEach(item => processItem(item));
logger.info('Items processed successfully', {
  items_count: items.length,
  duration_ms: Date.now() - startTime,
});
```

**Don't use console.log in production:**
```javascript
// ❌ BAD
console.log('Recipe generated');  // Not structured, no trace correlation

// ✅ GOOD
logger.info('Recipe generated successfully', {
  user_id: req.userId,
  recipe_length: recipe.length,
});
```

## Log Levels Guide

| Level | When to Use | Example |
|-------|-------------|---------|
| **debug** | Detailed diagnostics (disable in prod) | `"Calling Azure API with params: ..."` |
| **info** | Normal operations | `"User created recipe"`, `"Service started"` |
| **warn** | Unusual but handled situations | `"Cache miss"`, `"Retry attempt 2/3"` |
| **error** | Errors requiring attention | `"Database connection failed"`, `"API timeout"` |

## Common Patterns

### Pattern 1: Operation with External Call

```javascript
exports.generateRecipe = async (req, res) => {
  logger.info('Generate recipe request received', {
    user_id: req.userId,
    ingredients_count: req.body.ingredients.length,
  });

  const startTime = Date.now();
  try {
    const recipe = await callAzureAPI(prompt);
    const duration = Date.now() - startTime;

    logger.logExternalCall('azure-openai', 'generate', duration, true);
    logger.logBusinessEvent('recipe_generated', {
      user_id: req.userId,
      generation_time_ms: duration,
    });

    res.json({ success: true, data: recipe });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logExternalCall('azure-openai', 'generate', duration, false, error);
    logger.error('Failed to generate recipe', {
      user_id: req.userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({ error: 'Failed to generate recipe' });
  }
};
```

### Pattern 2: CRUD Operation

```javascript
exports.create = async (req, res) => {
  logger.debug('Creating inventory item', {
    user_id: req.userId,
    item_name: req.body.name,
  });

  try {
    const item = await InventoryItem.create({
      ...req.body,
      userId: req.userId,
    });

    logger.logBusinessEvent('inventory_item_created', {
      user_id: req.userId,
      item_id: item.id,
      item_name: item.name,
      category: item.category,
    });

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    logger.error('Failed to create inventory item', {
      user_id: req.userId,
      item_name: req.body.name,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({ error: 'Failed to create item' });
  }
};
```

### Pattern 3: Performance Monitoring

```javascript
const startTime = Date.now();

// ... do expensive operation

const duration = Date.now() - startTime;

if (duration > 3000) {
  logger.warn('Slow operation detected', {
    operation: 'parseOCRText',
    duration_ms: duration,
    image_size_bytes: imageBuffer.length,
  });
}

logger.info('Operation completed', {
  operation: 'parseOCRText',
  duration_ms: duration,
  success: true,
});
```

## Environment-Specific Configuration

### Development
```bash
LOG_LEVEL=debug  # Show all logs including debug
```

### Production
```bash
LOG_LEVEL=info  # Hide debug logs, only show info/warn/error
```

### Debugging Issues
```bash
LOG_LEVEL=debug  # Temporarily enable debug logs
```

## Troubleshooting

### Logs not appearing in SigNoz

1. **Check service logs:**
```bash
docker-compose logs recipe-service | grep -i "log\|winston"
```

2. **Verify OTLP endpoint:**
```bash
echo $OTEL_EXPORTER_OTLP_ENDPOINT
# Should be: http://host.docker.internal:4318/v1/traces
```

3. **Check SigNoz logs collector:**
```bash
docker logs signoz-otel-collector
```

### Too many logs

**Increase log level in production:**
```javascript
// Set LOG_LEVEL=warn to only show warnings and errors
```

**Add sampling:**
```javascript
// Only log 10% of debug messages
if (Math.random() < 0.1) {
  logger.debug('Sampled debug message', { data });
}
```

### Missing trace_id in logs

**Ensure Winston instrumentation is enabled:**
```javascript
// In tracing.js
instrumentations: [
  new WinstonInstrumentation(),  // ← Must be present
]
```

---

## Quick Start Checklist

- [x] Winston installed in all services
- [x] Logger config created with trace correlation
- [x] Request logger middleware added
- [x] OpenTelemetry log exporter configured
- [x] Replaced console.log with logger calls
- [x] Added business event logging
- [x] Added external API call logging
- [x] Logs exported to SigNoz

**Next:** Use your app and view logs in SigNoz at http://localhost:3301!
