const winston = require('winston');
const { trace, context } = require('@opentelemetry/api');
const { logs } = require('@opentelemetry/api-logs');

const otelLogger = logs.getLogger('ocr-service', '1.0.0');

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

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    addTraceContext(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'ocr-service',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, trace_id, ...meta }) => {
          let log = `${timestamp} [${service}] ${level}: ${message}`;
          if (trace_id) {
            log += ` [trace_id=${trace_id.substring(0, 16)}]`;
          }
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

logger.logRequest = (req, res, duration) => {
  logger.info('HTTP Request', {
    method: req.method,
    path: req.path,
    status_code: res.statusCode,
    duration_ms: duration,
    user_id: req.userId || 'anonymous',
    ip: req.ip,
  });
};

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

logger.logBusinessEvent = (event, data) => {
  logger.info('Business Event', {
    event_type: event,
    ...data,
  });
};

const getSeverityNumber = (level) => {
  const severityMap = { debug: 5, info: 9, warn: 13, error: 17 };
  return severityMap[level] || 9;
};

const winstonMethods = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
};

const emitLog = (level, message, attributes = {}) => {
  winstonMethods[level](message, attributes);
  const span = trace.getSpan(context.active());
  otelLogger.emit({
    severityNumber: getSeverityNumber(level),
    severityText: level.toUpperCase(),
    body: message,
    attributes: { ...attributes, service: 'ocr-service', environment: process.env.NODE_ENV || 'development' },
    context: span ? context.active() : undefined,
  });
};

logger.debug = (message, attributes = {}) => emitLog('debug', message, attributes);
logger.info = (message, attributes = {}) => emitLog('info', message, attributes);
logger.warn = (message, attributes = {}) => emitLog('warn', message, attributes);
logger.error = (message, attributes = {}) => emitLog('error', message, attributes);

module.exports = logger;
