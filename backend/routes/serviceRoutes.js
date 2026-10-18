const express = require('express');
const { getRuntimeMode, getServiceSnapshot, getLogs } = require('../services/serviceSimulator');

const router = express.Router();

router.get('/service/health', (req, res) => {
  const mode = getRuntimeMode();
  const snapshot = getServiceSnapshot();

  if (mode === 'slow') {
    setTimeout(() => {
      res.json({
        ...snapshot,
        responseTimeMs: 4200,
        checks: {
          database: 'available',
          cache: 'available',
          api: 'degraded'
        }
      });
    }, 3500);
    return;
  }

  if (mode === 'timeout') {
    setTimeout(() => {
      res.status(504).json({
        status: 'timeout',
        code: 'REQUEST_TIMEOUT',
        message: 'The request timed out while waiting for the primary database.',
        database: 'unknown',
        checks: {
          database: 'pending',
          cache: 'available',
          api: 'timed_out'
        }
      });
    }, 10000);
    return;
  }

  if (mode === 'db_down') {
    res.status(503).json({
      ...snapshot,
      code: 'DB_UNAVAILABLE',
      checks: {
        database: 'down',
        cache: 'available',
        api: 'unhealthy'
      }
    });
    return;
  }

  res.json({
    ...snapshot,
    checks: {
      database: 'available',
      cache: 'available',
      api: 'healthy'
    }
  });
});

router.get('/service/version', (req, res) => {
  res.json({
    service: 'Order API',
    version: process.env.SERVICE_VERSION || '1.4.2',
    commit: process.env.COMMIT_SHA || 'unknown',
    runtime: process.env.NODE_ENV || 'development'
  });
});

router.get('/service/logs', (req, res) => {
  res.json({
    service: 'Order API',
    mode: getRuntimeMode(),
    logs: getLogs()
  });
});

module.exports = router;
