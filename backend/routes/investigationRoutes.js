const express = require('express');
const { getRuntimeMode, getTargetServiceUrl, getAiProviderStatus, createLog } = require('../services/serviceSimulator');
const { buildFallbackReport, runGeminiAnalysis, runGeminiDecisionReport } = require('../agents/investigationAgent');
const { buildDecisionReport } = require('../agents/decisionAgent');

const router = express.Router();

router.post('/api/investigate', async (req, res) => {
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

    const health = healthResult.status === 'fulfilled' && healthResult.value && typeof healthResult.value === 'object'
      ? healthResult.value
      : {
          status: healthError?.name === 'AbortError' ? 'timeout' : 'unknown',
          code: healthError?.name === 'AbortError' ? 'INVESTIGATION_TIMEOUT' : 'HEALTH_CHECK_FAILED',
          error: healthError?.message || 'Health endpoint returned an invalid response.'
        };

    const logs = logsResult.status === 'fulfilled' && logsResult.value && typeof logsResult.value === 'object' && Array.isArray(logsResult.value.logs)
      ? logsResult.value
      : {
          logs: [createLog('ERROR', `Unable to collect service logs: ${logsError?.message || 'Logs endpoint returned an invalid response.'}`, 'investigation-agent', 'LOGS_UNAVAILABLE')],
          error: logsError?.message || 'Logs endpoint returned an invalid response.'
        };

    const version = versionResult.status === 'fulfilled' && versionResult.value && typeof versionResult.value === 'object'
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

    res.json({
      ok: true,
      mode: getRuntimeMode(),
      targetBase,
      provider: getAiProviderStatus(),
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

module.exports = router;
