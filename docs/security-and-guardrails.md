# Security & guardrails

## Principles

- **No secrets in code.** Secrets come from environment variables or Azure
  managed identity. `.env` files are git-ignored.
- **Human approval before consequential actions.** Work item creation, repo
  creation, pipeline changes, SharePoint publishing, Azure provisioning, and
  deployment all require an approved gate. Enforcement is server-side.
- **Defense in depth for authorization.** The UI hides unauthorized navigation
  and the API independently blocks unauthorized calls — bypassing the UI cannot
  bypass authorization.

## Roles

| Role | Capabilities |
| --- | --- |
| Business User | Create projects, ingest requirements/mockups, review outputs, approve business gates |
| IT User | Review technical design, repos, pipelines, provisioning plans, tests, deployment gates |
| Admin | All functionality except user maintenance |
| App Owner | Everything Admin can do **plus** user maintenance (add/edit/remove users, set auth method) |

## Guardrail policies

Configured in [`api/src/config/guardrails.config.json`](../api/src/config/guardrails.config.json)
and evaluated before (`pre`) and after (`post`) each agent output:

- **Content Safety** — screens for harmful content (wire to Foundry Content
  Safety through APIM in production).
- **PII Redaction** — redacts detected PII before persistence.
- **Secret Scanning** — blocks outputs containing apparent secrets/keys/tokens.
- **Human Approval Required** — blocks stage promotion when a gate is missing.

Blocking findings set the agent run to `Blocked` and are written to the audit trail.

## Correlation & audit

A correlation ID is generated in the UI and propagated via the
`x-correlation-id` header across UI → API → APIM → agent calls → audit logs.
Every user action, agent action, and approval decision is recorded in the
[audit trail](../src/app/pages/audit/audit.page.ts).

## Upload validation

Uploaded files are validated against allowed extensions and a maximum size
defined in [`api.config.json`](../api/src/config/api.config.json).
