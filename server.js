const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const VALID_MODES = ['normal', 'db_down', 'slow', 'timeout'];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/provider-key', (req, res) => {
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

function getRuntimeMode() {
  const mode = (process.env.SERVICE_MODE || 'normal').trim().toLowerCase();
  return VALID_MODES.includes(mode) ? mode : 'normal';
}

function getTargetServiceUrl() {
  const targetBase = process.env.TARGET_SERVICE_URL || `http://127.0.0.1:${PORT}`;
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

app.get('/api/scenarios', (req, res) => {
  res.json({
    current: getRuntimeMode(),
    options: VALID_MODES
  });
});

app.post('/api/scenario', (req, res) => {
  const requested = String(req.body?.mode || 'normal').toLowerCase();
  const nextMode = VALID_MODES.includes(requested) ? requested : 'normal';
  process.env.SERVICE_MODE = nextMode;

  res.json({
    current: nextMode,
    message: `Service mode changed to ${nextMode}`
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    port: PORT,
    currentMode: getRuntimeMode(),
    provider: getAiProviderStatus(),
    targetServiceUrl: getTargetServiceUrl(),
    apiKeyConfigured: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY)
  });
});

app.get('/service/health', (req, res) => {
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

app.get('/service/version', (req, res) => {
  res.json({
    service: 'Order API',
    version: process.env.SERVICE_VERSION || '1.4.2',
    commit: process.env.COMMIT_SHA || 'unknown',
    runtime: process.env.NODE_ENV || 'development'
  });
});

app.get('/service/logs', (req, res) => {
  res.json({
    service: 'Order API',
    mode: getRuntimeMode(),
    logs: getLogs()
  });
});

function extractJsonFromText(text) {
  if (!text) {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.substring(start, end + 1));
      } catch (innerError) {
        return null;
      }
    }
  }

  return null;
}

function getAiProviderStatus() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  return apiKey ? 'gemini' : 'fallback';
}

function buildFallbackReport(toolResults) {
  const health = toolResults.health || {};
  const logs = toolResults.logs?.logs || [];
  const logText = logs.map((log) => typeof log === 'string' ? log : log.message || '').join('\n');

  if (health.status === 'error' || health.code === 'DB_UNAVAILABLE' || logText.includes('ECONNREFUSED')) {
    return {
      issue: 'מסד הנתונים אינו זמין',
      evidence: [
        'נקודת הבריאות החזירה HTTP 503 וסטטוס של "error".',
        'הלוגים מצביעים על "Connection refused: ECONNREFUSED" במסד הנתונים הראשי.',
        'בדיקת מסד הנתונים מסומנת כ"down".'
      ],
      nextStep: 'הפעל מחדש את שירות מסד הנתונים, אמת את כתובת השרת והסיסמאות, ונסה שוב את החיבור לפני שקמפיין ההפצה מחדש יבוצע.'
    };
  }

  if (health.status === 'degraded' || health.latencyMs >= 4000 || logText.includes('4200')) {
    return {
      issue: 'זמן תגובה איטי',
      evidence: [
        'נקודת הבריאות דיווחה על latency של 4200 מילי-שניות.',
        'הלוגים מצביעים על כך שהשאילתה חרגה מהסף של 4 שניות.',
        'הלקוחות מנסים שוב כי ה-API לא עומד ב-SLA של זמן התגובה.'
      ],
      nextStep: 'בדוק את השאילתה האיטית, הוסף אינדקסים או הפחת את עלות השאילתה, ושקול להגדיל את קנה המידה של מסד הנתונים או שכבת ה-cache.'
    };
  }

  if (health.status === 'timeout' || health.code === 'REQUEST_TIMEOUT' || logText.includes('timed out')) {
    return {
      issue: 'פסק זמן בבקשת מסד הנתונים',
      evidence: [
        'השירות נכשל בזמן המתנה לתשובת שאילתת מסד הנתונים.',
        'הלוגים מצביעים על כך שהבקשה חרגה ממסגרת הזמן המותרת.',
        'הגייטווי החזיר HTTP 504 עבור הבקשה.'
      ],
      nextStep: 'בדוק את שאילתת SQL הארוכה, הפחת את נפח העסקאות, והגבר את זמן הפסק רק לאחר שהסיבה השורשית אומתה.'
    };
  }

  const failedTools = Object.entries(toolResults)
    .filter(([, result]) => result?.error)
    .map(([name]) => name);
  if (failedTools.length > 0) {
    return {
      issue: 'איסוף ראיות חלקי',
      evidence: [
        `לא ניתן היה לאסוף נתונים מהכלים הבאים: ${failedTools.join(', ')}.`,
        'תוצאות הכלים שהצליחו נשמרו וזמינות לבדיקה.',
        'יש לאמת את זמינות השירות ולנסות את החקירה שוב.'
      ],
      nextStep: 'בדוק את זמינות השירות ואת נקודות הקצה שנכשלו, ואז הרץ את החקירה מחדש.'
    };
  }

  return {
    issue: 'המערכת תקינה',
    evidence: [
      'נקודת הבריאות מחזירה סטטוס רגיל.',
      'הלוגים מציגים רק אירועים אינפורמטיביים ואזהרות ללא כשלים.',
      'גרסת היישום רשומה ואין בעיות במסד הנתונים או בזמן תגובה.'
    ],
    nextStep: 'המשך לעקוב אחרי המערכת, אבל אין צורך בפעולת תגובה כרגע.'
  };
}

function buildDecisionReport(investigatorReport) {
  const issue = investigatorReport.issue || '';

  if (issue.includes('המערכת תקינה')) {
    return {
      agent: 'decision-agent',
      verdict: 'לא זוהתה תקלה',
      rationale: 'המערכת תקינה וכל הבדיקות נמצאות בטווחי הפעולה הרגילים.',
      recommendation: 'המשך במעקב ושמור על ההטמעה הנוכחית ללא התערבות.'
    };
  }

  if (issue.includes('מסד הנתונים אינו זמין')) {
    return {
      agent: 'decision-agent',
      verdict: 'הגברת התראה על פגיעה במסד הנתונים',
      rationale: 'התלות העיקרית נכשלת והשירות מדווח על חוסר זמינות של מסד הנתונים.',
      recommendation: 'הפעל מחדש את מסד הנתונים, אמת את האישורים ויכולת ההגעה לשרת, וודא שהצומת הראשי זמין לפני הפצה מחדש.'
    };
  }

  if (issue.includes('זמן תגובה איטי')) {
    return {
      agent: 'decision-agent',
      verdict: 'חקירת ביצועים',
      rationale: 'השירות חורג מהסף של זמן התגובה והמסד נתון ככל הנראה מאט את מסלול הבקשה.',
      recommendation: 'סקור את תכנית השאילתה האיטית, הוסף אינדקסים או Cache לקריאות חמות, ושקול להרחיב את מסד הנתונים או את מספר ה-workers של ה-API.'
    };
  }

  return {
    agent: 'decision-agent',
    verdict: 'חקירת פסק זמן',
    rationale: 'הבקשה נתקעת בזמן ההמתנה לסיום שאילתת מסד הנתונים.',
    recommendation: 'בדוק את שאילתה הארוכה, הפחת את גודל העסקאות, והגדל את זמן הפסק רק לאחר שאמתת את הסיבה השורשית.'
  };
}

async function runGeminiDecisionReport(toolResults, investigatorReport) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const prompt = `אתה סוכן החלטה בשלב השני עבור Incident Response. השתמש רק במסקנות של הסוכן הראשון כדי לקבוע את הפעולה התפעולית הבאה. החזר JSON קצר בעברית בלבד בדיוק עם ארבעת המפתחות הבאים: agent, verdict, rationale, recommendation. agent חייב להיות "decision-agent". verdict, rationale ו-recommendation חייבים להיות טקסט רגיל בעברית. אל תוסיף מפתחות נוספים.\n\nדוח הסוכן הראשון:\n${JSON.stringify(investigatorReport, null, 2)}\n\nתוצאות הכלים:\n${JSON.stringify(toolResults, null, 2)}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini decision request failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n');
  const parsedJson = extractJsonFromText(text);

  if (!parsedJson || typeof parsedJson.verdict !== 'string' || typeof parsedJson.rationale !== 'string' || typeof parsedJson.recommendation !== 'string') {
    return null;
  }

  return {
    agent: 'decision-agent',
    verdict: parsedJson.verdict,
    rationale: parsedJson.rationale,
    recommendation: parsedJson.recommendation
  };
}

async function runGeminiAnalysis(toolResults) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const prompt = `אתה סוכן חקירה לטיפול בתקלות. חקור רק באמצעות פלטי הכלים להלן. החזר JSON קצר בעברית בלבד בדיוק עם שלושת המפתחות הבאים: issue, evidence, nextStep. issue חייב להיות טקסט רגיל בעברית. evidence חייב להיות מערך של מחרוזות טקסט בעברית. nextStep חייב להיות טקסט רגיל בעברית. אל תוסיף מפתחות נוספים.\n\nתוצאות הכלים:\n${JSON.stringify(toolResults, null, 2)}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API request failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n');
  return extractJsonFromText(text) || null;
}

app.post('/api/investigate', async (req, res) => {
  const targetBase = getTargetServiceUrl();
  const requestTimeoutMs = 3000;

  async function fetchJsonWithTimeout(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  try {
    const results = await Promise.allSettled([
      fetchJsonWithTimeout(`${targetBase}/service/health`),
      fetchJsonWithTimeout(`${targetBase}/service/logs`),
      fetchJsonWithTimeout(`${targetBase}/service/version`)
    ]);

    const [healthResult, logsResult, versionResult] = results;
    const getRejectedError = (result) => result.status === 'rejected'
      ? result.reason instanceof Error ? result.reason : new Error(String(result.reason))
      : null;
    const healthError = getRejectedError(healthResult);
    const logsError = getRejectedError(logsResult);
    const versionError = getRejectedError(versionResult);
    const health = healthResult.status === 'fulfilled'
      && healthResult.value && typeof healthResult.value === 'object'
      ? healthResult.value
      : {
          status: healthError?.name === 'AbortError' ? 'timeout' : 'unknown',
          code: healthError?.name === 'AbortError' ? 'INVESTIGATION_TIMEOUT' : 'HEALTH_CHECK_FAILED',
          error: healthError?.message || 'Health endpoint returned an invalid response.'
        };
    const logs = logsResult.status === 'fulfilled'
      && logsResult.value && typeof logsResult.value === 'object' && Array.isArray(logsResult.value.logs)
      ? logsResult.value
      : {
          logs: [createLog('ERROR', `Unable to collect service logs: ${logsError?.message || 'Logs endpoint returned an invalid response.'}`, 'investigation-agent', 'LOGS_UNAVAILABLE')],
          error: logsError?.message || 'Logs endpoint returned an invalid response.'
        };
    const version = versionResult.status === 'fulfilled'
      && versionResult.value && typeof versionResult.value === 'object'
      ? versionResult.value
      : {
          version: 'unknown',
          error: versionError?.message || 'Version endpoint returned an invalid response.'
        };

    const toolResults = { health, logs, version };
    let investigatorReport = buildFallbackReport(toolResults);

    try {
      const geminiReport = await runGeminiAnalysis(toolResults);
      if (geminiReport && geminiReport.issue && Array.isArray(geminiReport.evidence)) {
        investigatorReport = geminiReport;
      }
    } catch (error) {
      console.warn('Gemini analysis unavailable, using fallback report:', error.message);
    }

    let decisionReport = buildDecisionReport(investigatorReport);
    try {
      const geminiDecision = await runGeminiDecisionReport(toolResults, investigatorReport);
      if (geminiDecision && geminiDecision.verdict && geminiDecision.recommendation) {
        decisionReport = geminiDecision;
      }
    } catch (error) {
      console.warn('Gemini decision unavailable, using fallback decision:', error.message);
    }

    const finalReport = {
      issue: investigatorReport.issue,
      evidence: investigatorReport.evidence,
      nextStep: decisionReport.recommendation || investigatorReport.nextStep,
      summary: `${decisionReport.verdict}. ${decisionReport.rationale}`
    };
    const aiProvider = getAiProviderStatus();

    res.json({
      ok: true,
      mode: getRuntimeMode(),
      targetBase,
      provider: aiProvider,
      tools: toolResults,
      investigator: investigatorReport,
      decision: decisionReport,
      report: finalReport
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
      message: 'Unable to run the investigation.'
    });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AI troubleshooting app listening on http://localhost:${PORT}`);
  console.log(`Current scenario: ${getRuntimeMode()}`);
  console.log('Set SERVICE_MODE to one of: normal, db_down, slow, timeout');
});
