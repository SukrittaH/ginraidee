const winston = require('winston');
const { trace, context } = require('@opentelemetry/api');
const { logs } = require('@opentelemetry/api-logs');

// Get the OpenTelemetry logger for programmatic logging
const otelLogger = logs.getLogger('recipe-service', '1.0.0');

/**
 * Custom format to add trace context to logs
 * This links logs with distributed traces in SigNoz
 */
const addTraceContext = winston.format((info) => {
  const span = trace.getSpan(context.active());
  if (span) {
    const spanContext = span.spanContext();
    info.trace_id = spanContext.traceId;
    info.span_id = spanContext.spanId;
    info.trace_flags = spanContext.traceFlags;
  }
  return info;
});

/**
 * Create Winston logger with structured format (for console output only)
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    addTraceContext(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'recipe-service',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console output (for local development and container logs)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, trace_id, ...meta }) => {
          let log = `${timestamp} [${service}] ${level}: ${message}`;

          // Add trace_id if present (for correlation)
          if (trace_id) {
            log += ` [trace_id=${trace_id.substring(0, 16)}]`;
          }

          // Add additional metadata
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          if (metaStr) {
            log += ` ${metaStr}`;
          }

          return log;
        })
      ),
    }),
  ],
});

/**
 * Map log level to OpenTelemetry severity
 */
const getSeverityNumber = (level) => {
  const severityMap = {
    debug: 5,   // DEBUG
    info: 9,    // INFO
    warn: 13,   // WARN
    error: 17,  // ERROR
  };
  return severityMap[level] || 9;
};

// Save original Winston methods before overriding
const winstonMethods = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
};

/**
 * Emit log to both Winston (console) and OpenTelemetry (SigNoz)
 */
const emitLog = (level, message, attributes = {}) => {
  // Log to Winston (console) using original method
  winstonMethods[level](message, attributes);

  // Log to OpenTelemetry (SigNoz)
  const span = trace.getSpan(context.active());
  const traceContext = span ? span.spanContext() : null;

  otelLogger.emit({
    severityNumber: getSeverityNumber(level),
    severityText: level.toUpperCase(),
    body: message,
    attributes: {
      ...attributes,
      service: 'recipe-service',
      environment: process.env.NODE_ENV || 'development',
    },
    context: traceContext ? context.active() : undefined,
  });
};

// Override logger methods to use dual logging
logger.debug = (message, attributes = {}) => emitLog('debug', message, attributes);
logger.info = (message, attributes = {}) => emitLog('info', message, attributes);
logger.warn = (message, attributes = {}) => emitLog('warn', message, attributes);
logger.error = (message, attributes = {}) => emitLog('error', message, attributes);

/**
 * Log HTTP requests with correlation
 */
logger.logRequest = (req, res, duration) => {
  logger.info('HTTP Request', {
    method: req.method,
    path: req.path,
    status_code: res.statusCode,
    duration_ms: duration,
    ip: req.ip,
    user_agent: req.get('user-agent'),
  });
};

/**
 * Log external API calls
 */
logger.logExternalCall = (service, operation, duration, success, error = null) => {
  const level = success ? 'info' : 'error';
  logger[level]('External API Call', {
    external_service: service,
    operation,
    duration_ms: duration,
    success,
    error: error?.message,
  });
};

/**
 * Log business events
 */
logger.logBusinessEvent = (event, data) => {
  logger.info('Business Event', {
    event_type: event,
    ...data,
  });
};

module.exports = logger;
