const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { WinstonInstrumentation } = require('@opentelemetry/instrumentation-winston');

// Configure the OTLP exporter to send traces to SigNoz
const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  headers: {},
});

// Configure the OTLP exporter to send logs to SigNoz
const baseUrl = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces').replace('/v1/traces', '');
const logExporter = new OTLPLogExporter({
  url: `${baseUrl}/v1/logs`,
  headers: {},
});

// Initialize the SDK
const sdk = new NodeSDK({
  serviceName: 'ocr-service',
  traceExporter,
  logRecordProcessor: new (require('@opentelemetry/sdk-logs').BatchLogRecordProcessor)(logExporter),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Automatically instrument Express, HTTP, and other common libraries
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable filesystem instrumentation to reduce noise
      },
    }),
    new WinstonInstrumentation(),
  ],
});

// Start the SDK
sdk.start();

console.log('🔍 OpenTelemetry tracing initialized for ocr-service');

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('🔍 Tracing terminated'))
    .catch((error) => console.error('Error terminating tracing', error))
    .finally(() => process.exit(0));
});

module.exports = sdk;
