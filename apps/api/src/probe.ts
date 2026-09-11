import { Configuration, operationReady } from './config';
import { IdentityService } from './auth';

// Metadata/local parsing only: never generates content, sends mail or prints secrets.
async function main() {
  const config = new Configuration();
  const identity = new IdentityService(config);
  const report: Record<string, unknown> = {
    configurationProblems: config.problems, pendingPolicies: config.pendingPolicies, operations: { gemini: operationReady(config, 'gemini', 'generate'), translation: operationReady(config, 'sarvam', 'translate'), transcription: operationReady(config, 'sarvam', 'transcribe'), speechOutput: operationReady(config, 'sarvam', 'speak') },
    firebaseCredentialFileValid: identity.configured,
    sarvamCredentialPresent: config.slots.sarvam.length > 0,
    sarvamLiveVerified: false,
    generationPerformed: false
  };
  const slot = config.slots.gemini[0];
  if (process.argv.includes('--local-only')) report.geminiMetadataStatus = 'NOT_REQUESTED';
  else if (slot && config.model) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}`, { headers: { 'x-goog-api-key': slot.secret }, signal: AbortSignal.timeout(15_000) });
      const result = await response.json();
      report.geminiMetadataStatus = response.status;
      const methods = result && typeof result === 'object' && 'supportedGenerationMethods' in result ? result.supportedGenerationMethods : undefined;
      report.geminiGenerationMethodAvailable = response.ok && Array.isArray(methods) && methods.includes('generateContent');
    } catch { report.geminiMetadataStatus = 'NETWORK_OR_TIMEOUT'; }
  } else report.geminiMetadataStatus = 'NOT_CONFIGURED';
  console.log(JSON.stringify(report, null, 2));
}
main().catch(() => { console.error('Configuration probe failed; no secret-bearing diagnostics printed.'); process.exitCode = 1; });
