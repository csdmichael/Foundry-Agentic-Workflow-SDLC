/**
 * Guardrail evaluation service. Applies configured policies before (pre) and
 * after (post) agent output. Findings are attached to agent runs and audited.
 * The content-safety check here is a deterministic mock; wire it to the Foundry
 * Content Safety route through APIM for production screening.
 */
import { config } from '../config';
import { GuardrailFinding, GuardrailPhase, GuardrailPolicy, GuardrailSeverity } from '../models';

function policies(): GuardrailPolicy[] {
  return (config.guardrails.policies as GuardrailPolicy[]).filter((p) => p.enabled);
}

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /xox[baprs]-[0-9A-Za-z-]{10,}/,
  /(password|secret|api[_-]?key)\s*[:=]\s*['"][^'"]{6,}/i,
];

const HARMFUL_TERMS = /\b(malware|exploit\s+kit|ransomware payload)\b/i;

export function evaluate(text: string, phase: GuardrailPhase): GuardrailFinding[] {
  const findings: GuardrailFinding[] = [];
  for (const policy of policies()) {
    if (!policy.appliesTo.includes(phase)) continue;

    if (policy.id === 'gp-content-safety' && HARMFUL_TERMS.test(text)) {
      findings.push(finding(policy, phase, 'high', 'Potentially harmful content detected'));
    }
    if (policy.id === 'gp-secret-scan' && SECRET_PATTERNS.some((r) => r.test(text))) {
      findings.push(finding(policy, phase, 'critical', 'Possible secret/key in output'));
    }
    if (policy.id === 'gp-pii-redaction' && /\b\d{3}-\d{2}-\d{4}\b/.test(text)) {
      findings.push(finding(policy, phase, 'medium', 'Possible PII (SSN pattern) detected'));
    }
  }
  return findings;
}

export function isBlocked(findings: GuardrailFinding[]): boolean {
  return findings.some((f) => f.blocked);
}

/** Redacts obvious secrets/PII for safe persistence. */
export function redact(text: string): string {
  let out = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED-PII]');
  for (const r of SECRET_PATTERNS) out = out.replace(r, '[REDACTED-SECRET]');
  return out;
}

function finding(
  policy: GuardrailPolicy,
  phase: GuardrailPhase,
  severity: GuardrailSeverity,
  message: string,
): GuardrailFinding {
  return { policyId: policy.id, phase, severity, message, blocked: policy.action === 'block' };
}
