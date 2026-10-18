const express = require('express');
const { VALID_MODES, getRuntimeMode, getTargetServiceUrl, getAiProviderStatus } = require('../services/serviceSimulator');

const router = express.Router();

router.get('/api/scenarios', (req, res) => {
  res.json({
    current: getRuntimeMode(),
    options: VALID_MODES
  });
});

router.post('/api/scenario', (req, res) => {
  const requested = String(req.body?.mode || 'normal').toLowerCase();
  const nextMode = VALID_MODES.includes(requested) ? requested : 'normal';
  process.env.SERVICE_MODE = nextMode;

  res.json({
    current: nextMode,
    message: `Service mode changed to ${nextMode}`
  });
});

router.get('/api/config', (req, res) => {
  res.json({
    port: Number(process.env.PORT || 3000),
    currentMode: getRuntimeMode(),
    provider: getAiProviderStatus(),
    targetServiceUrl: getTargetServiceUrl(),
    apiKeyConfigured: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY)
  });
});

router.post('/api/provider-key', (req, res) => {
  const rawKey = String(req.body?.providerKey || '').trim();

  if (!rawKey) {
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    return res.json({ ok: true, provider: 'fallback', message: 'מפתח ה-AI נוקה מהזיכרון.' });
  }

  process.env.GOOGLE_API_KEY = rawKey;
  delete process.env.GEMINI_API_KEY;

  res.json({
    ok: true,
    provider: 'gemini',
    message: 'מפתח ה-Google Gemini נשמר לזיכרון הריצה.'
  });
});

module.exports = router;
