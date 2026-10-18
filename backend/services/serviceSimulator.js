const VALID_MODES = ['normal', 'db_down', 'slow', 'timeout'];

function getRuntimeMode() {
  const mode = (process.env.SERVICE_MODE || 'normal').trim().toLowerCase();
  return VALID_MODES.includes(mode) ? mode : 'normal';
}

function getTargetServiceUrl() {
  const targetBase = process.env.TARGET_SERVICE_URL || `http://127.0.0.1:${process.env.PORT || 3001}`;
  return targetBase.replace(/^(https?:\/\/)localhost(?=[:/]|$)/i, (_, protocol) => `${protocol}127.0.0.1`);
}

function getServiceSnapshot() {
  const mode = getRuntimeMode();

  if (mode === 'normal') {
    return {
      status: 'ok',
      mode,
      service: 'Order API',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.SERVICE_VERSION || '1.4.2',
      database: 'available',
      message: 'Everything is healthy and responding normally.'
    };
  }

  if (mode === 'db_down') {
    return {
      status: 'error',
      mode,
      service: 'Order API',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.SERVICE_VERSION || '1.4.2',
      database: 'down',
      message: 'Database connection refused on the primary node.'
    };
  }

  if (mode === 'slow') {
    return {
      status: 'degraded',
      mode,
      service: 'Order API',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.SERVICE_VERSION || '1.4.2',
      database: 'available',
      latencyMs: 4200,
      message: 'The service responds slowly and exceeds the SLA threshold.'
    };
  }

  return {
    status: 'error',
    mode,
    service: 'Order API',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.SERVICE_VERSION || '1.4.2',
    database: 'unknown',
    message: 'The request timed out while waiting for a database query to finish.'
  };
}

function createLog(level, message, component = 'order-api', code = null, context = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    component,
    code,
    context
  };
}

function getLogs(mode = getRuntimeMode()) {
  const base = [
    createLog('INFO', 'Starting Order API service'),
    createLog('INFO', 'Loaded configuration from environment variables'),
    createLog('INFO', 'Metrics exporter initialized', 'metrics'),
    createLog('WARN', 'Traffic is above the 90th percentile', 'traffic-monitor', 'HIGH_TRAFFIC')
  ];

  if (mode === 'normal') {
    return [...base, createLog('INFO', 'Health check passed for all dependencies', 'health-check')];
  }

  if (mode === 'db_down') {
    return [
      ...base,
      createLog('ERROR', 'Failed to connect to PostgreSQL on db-primary.internal:5432', 'database', 'DB_CONNECTION_FAILED'),
      createLog('ERROR', 'Connection refused: ECONNREFUSED', 'database', 'ECONNREFUSED'),
      createLog('ERROR', 'Health check returned 503 for /orders/summary', 'health-check', 'HEALTH_CHECK_FAILED')
    ];
  }

  if (mode === 'slow') {
    return [
      ...base,
      createLog('WARN', 'Database query slice exceeded 4s threshold', 'database', 'QUERY_SLOW'),
      createLog('WARN', 'Response time peak reached 4200 ms', 'order-api', 'HIGH_LATENCY', { latencyMs: 4200 }),
      createLog('INFO', 'Client retries are increasing due to latency', 'order-api')
    ];
  }

  return [
    ...base,
    createLog('ERROR', 'SQL query to orders table exceeded the request timeout window', 'database', 'QUERY_TIMEOUT'),
    createLog('ERROR', 'Gateway timeout for /orders/summary after 10s', 'gateway', 'GATEWAY_TIMEOUT', { timeoutMs: 10000 }),
    createLog('WARN', 'Resource pool is saturated and connection handling is blocked', 'database', 'POOL_SATURATED')
  ];
}

function getAiProviderStatus() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  return apiKey ? 'gemini' : 'fallback';
}

module.exports = {
  VALID_MODES,
  getRuntimeMode,
  getTargetServiceUrl,
  getServiceSnapshot,
  createLog,
  getLogs,
  getAiProviderStatus
};
