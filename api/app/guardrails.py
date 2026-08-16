"""Guardrail evaluation (mirror of guardrails.service.ts)."""
import re
from typing import Dict, List

from .config import CONFIG

SECRET_PATTERNS = [
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"xox[baprs]-[0-9A-Za-z-]{10,}"),
    re.compile(r"(password|secret|api[_-]?key)\s*[:=]\s*['\"][^'\"]{6,}", re.IGNORECASE),
]

HARMFUL_TERMS = re.compile(r"\b(malware|exploit\s+kit|ransomware payload)\b", re.IGNORECASE)
SSN_PATTERN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")


def _policies() -> List[Dict]:
    return [p for p in CONFIG["guardrails"]["policies"] if p.get("enabled")]


def _finding(policy: Dict, phase: str, severity: str, message: str) -> Dict:
    return {
        "policyId": policy["id"],
        "phase": phase,
        "severity": severity,
        "message": message,
        "blocked": policy.get("action") == "block",
    }


def evaluate(text: str, phase: str) -> List[Dict]:
    findings: List[Dict] = []
    for policy in _policies():
        if phase not in policy.get("appliesTo", []):
            continue
        if policy["id"] == "gp-content-safety" and HARMFUL_TERMS.search(text):
            findings.append(_finding(policy, phase, "high", "Potentially harmful content detected"))
        if policy["id"] == "gp-secret-scan" and any(r.search(text) for r in SECRET_PATTERNS):
            findings.append(_finding(policy, phase, "critical", "Possible secret/key in output"))
        if policy["id"] == "gp-pii-redaction" and SSN_PATTERN.search(text):
            findings.append(_finding(policy, phase, "medium", "Possible PII (SSN pattern) detected"))
    return findings


def is_blocked(findings: List[Dict]) -> bool:
    return any(f.get("blocked") for f in findings)


def redact(text: str) -> str:
    out = SSN_PATTERN.sub("[REDACTED-PII]", text)
    for r in SECRET_PATTERNS:
        out = r.sub("[REDACTED-SECRET]", out)
    return out
