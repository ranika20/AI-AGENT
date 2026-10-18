const apiBase = window.API_URL || 'http://localhost:3001';
const scenarioSelect = document.getElementById('scenario');
const statusBox = document.getElementById('statusBox');
const reportBox = document.getElementById('report');
const evidenceList = document.getElementById('evidenceList');
const decisionBox = document.getElementById('decisionBox');
const logsBox = document.getElementById('logsBox');
const toolSummary = document.getElementById('toolSummary');
const providerBadge = document.getElementById('providerBadge');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const clearApiKeyBtn = document.getElementById('clearApiKeyBtn');
const copyResultBtn = document.getElementById('copyResultBtn');
const investigateBtn = document.getElementById('investigateBtn');
const applyScenario = document.getElementById('applyScenario');

function setProviderState(value) {
  const isGemini = value === 'gemini';
  providerBadge.textContent = isGemini ? 'מנוע AI: Google Gemini' : 'מנוע AI: גיבוי מקומי';
  providerBadge.classList.toggle('active', isGemini);
}

function setStatus(message, isSuccess = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle('success', isSuccess);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  return response.json();
}

async function loadScenario() {
  const config = await requestJson(`${apiBase}/api/config`);
  const scenarios = await requestJson(`${apiBase}/api/scenarios`);
  const currentMode = scenarios.current || config.currentMode || 'normal';
  scenarioSelect.value = currentMode;
  setProviderState(config.provider || 'fallback');
  const savedKey = localStorage.getItem('geminiApiKey');
  if (savedKey) apiKeyInput.value = savedKey;
}

async function applyCurrentScenario() {
  const mode = scenarioSelect.value;
  const data = await requestJson(`${apiBase}/api/scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode })
  });
  setStatus(`מצב השירות עודכן: ${data.current}`, true);
}

async function saveApiKey() {
  const providerKey = apiKeyInput.value.trim();
  const data = await requestJson(`${apiBase}/api/provider-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerKey })
  });

  if (providerKey) localStorage.setItem('geminiApiKey', providerKey);
  else localStorage.removeItem('geminiApiKey');

  setProviderState(data.provider || 'fallback');
  setStatus(data.message || 'סטטוס ה-AI עודכן.', true);
  apiKeyInput.value = '';
}

async function clearApiKey() {
  const data = await requestJson(`${apiBase}/api/provider-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerKey: '' })
  });

  localStorage.removeItem('geminiApiKey');
  setProviderState(data.provider || 'fallback');
  setStatus(data.message || 'מפתח ה-AI נוקה.', true);
  apiKeyInput.value = '';
}

async function investigate() {
  setStatus('בודק את השירות...', false);
  reportBox.textContent = 'סוכן 1 אוסף ראיות...';
  evidenceList.innerHTML = '';
  decisionBox.textContent = 'סוכן 2 מעריך את הממצאים...';
  logsBox.textContent = 'ממתין לקבלת לוגים...';
  toolSummary.innerHTML = '<span class="pill neutral">שליחת כלי חקירה</span>';

  const payload = await requestJson(`${apiBase}/api/investigate`, { method: 'POST' });

  if (!payload.ok) {
    setStatus('שגיאה במהלך החקירה', false);
    reportBox.textContent = payload.message || 'החקירה נכשלה';
    return;
  }

  const { report = {}, decision = {}, tools = {}, mode = 'normal', provider = 'fallback' } = payload;
  const health = tools.health || {};
  const logs = tools.logs?.logs || [];
  const version = tools.version || {};

  setStatus(`החוקר סיים: ${mode}`, true);
  setProviderState(provider);

  toolSummary.innerHTML = `
    <span class="pill ${health.status === 'ok' ? 'good' : health.status === 'degraded' ? 'warn' : 'bad'}">בריאות: ${health.status || 'unknown'}</span>
    <span class="pill neutral">לוגים: ${logs.length}</span>
    <span class="pill neutral">גרסה: ${version.version || 'unknown'}</span>
  `;

  reportBox.innerHTML = `
    <strong>תקלה:</strong> ${report.issue || 'לא זוהתה תקלה'}<br />
    <strong>סיכום:</strong> ${report.summary || 'אין סיכום'}<br />
    <strong>הצעד הבא:</strong> ${report.nextStep || 'אין המלצה'}
  `;

  evidenceList.innerHTML = (Array.isArray(report.evidence) ? report.evidence : [])
    .map((item) => `<li>${item}</li>`)
    .join('');

  decisionBox.innerHTML = `
    <strong>${decision.verdict || 'לא התקבלה החלטה'}</strong><br />
    ${decision.rationale || 'אין הסבר'}<br />
    <strong>המלצה:</strong> ${decision.recommendation || 'אין המלצה'}
  `;

  logsBox.textContent = logs.map((entry) => {
    if (typeof entry === 'string') return entry;
    const level = (entry.level || 'INFO').toUpperCase();
    const timestamp = entry.timestamp || new Date().toISOString();
    const message = entry.message || '';
    return `[${level}] ${timestamp} ${message}`;
  }).join('\n');
}

async function copyResult() {
  const snapshot = `${reportBox.innerText || 'לא היו תוצאות.'}\n\n${decisionBox.innerText || 'אין החלטה.'}`;
  try {
    await navigator.clipboard.writeText(snapshot);
    setStatus('התוצאות הועתקו ללוח.', true);
  } catch (error) {
    setStatus('לא ניתן להעתיק את התוצאות.', false);
  }
}

saveApiKeyBtn.addEventListener('click', saveApiKey);
clearApiKeyBtn.addEventListener('click', clearApiKey);
copyResultBtn.addEventListener('click', copyResult);
investigateBtn.addEventListener('click', investigate);
applyScenario.addEventListener('click', applyCurrentScenario);

window.addEventListener('DOMContentLoaded', loadScenario);
