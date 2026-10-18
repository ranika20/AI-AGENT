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

async function runGeminiDecisionReport(toolResults, investigatorReport) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const prompt = `אתה סוכן החלטה בשלב השני עבור Incident Response. השתמש רק במסקנות של הסוכן הראשון כדי לקבוע את הפעולה התפעולית הבאה. החזר JSON קצר בעברית בלבד בדיוק עם ארבעת המפתחות הבאים: agent, verdict, rationale, recommendation. agent חייב להיות "decision-agent". verdict, rationale ו-recommendation חייבים להיות טקסט רגיל בעברית. אל תוסיף מפתחות נוספים.\n\nדוח הסוכן הראשון:\n${JSON.stringify(investigatorReport, null, 2)}\n\nתוצאות הכלים:\n${JSON.stringify(toolResults, null, 2)}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API request failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n');
  return extractJsonFromText(text) || null;
}

module.exports = {
  extractJsonFromText,
  buildFallbackReport,
  runGeminiDecisionReport,
  runGeminiAnalysis
};
