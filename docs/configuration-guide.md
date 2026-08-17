# Configuration guide

No secrets are stored in source. Non-secret settings live in per-tier config
files; secrets come from environment variables or Azure managed identity.

## Environment variables (API)

Copy [`api/.env.example`](../api/.env.example) to `api/.env` for local dev.

| Variable | Purpose |
| --- | --- |
| `AUTH_ENTRA_TENANT_ID` | Entra tenant for token validation |
| `AUTH_ENTRA_UI_CLIENT_ID` / `AUTH_ENTRA_API_CLIENT_ID` | App registrations |
| `AUTH_JWT_SIGNING_KEY` | HMAC key for OTP-user app JWTs |
| `AUTH_ACS_CONNECTION_STRING` / `AUTH_ACS_SENDER_ADDRESS` | ACS email for OTP |
| `AUTH_OTP_DEV_BYPASS` | `1` accepts OTP `000000` (DEV ONLY) |
| `AUTH_ALLOW_ANONYMOUS` | `1` runs all requests as app_owner (DEV ONLY) |
| `PERSIST_COSMOS_ENDPOINT` / `PERSIST_COSMOS_DATABASE` | Cosmos (managed identity) |
| `PERSIST_COSMOS_CONNECTION_STRING` | Cosmos (alternative to MI) |
| `APIM_SUBSCRIPTION_KEY` | APIM subscription key for Foundry |
| `FOUNDRY_ALLOW_DIRECT` | `1` allows direct Foundry calls (LOCAL DEV ONLY) |
| `ADO_PAT` | Azure DevOps project, work item, test plan, and pipeline permissions |
| `GITHUB_PAT` | GitHub organization repository and Actions permissions |
| `GRAPH_ACCESS_TOKEN` | Optional local Graph token; Azure uses managed identity when omitted |

## Per-tier config files

- UI: [`src/app/config/ui.config.ts`](../src/app/config/ui.config.ts) — API base URL, identity, nav.
- API: [`api/src/config/api.config.json`](../api/src/config/api.config.json), [`apim.config.json`](../api/src/config/apim.config.json), [`integrations.config.json`](../api/src/config/integrations.config.json), [`guardrails.config.json`](../api/src/config/guardrails.config.json).
- DB: [`api/src/persistence/config/persistence.config.json`](../api/src/persistence/config/persistence.config.json).
- Agents: [`api/src/agents/config/agents.config.json`](../api/src/agents/config/agents.config.json).

## Switching persistence to Cosmos DB

Set `provider` to `cosmos` in `persistence.config.json`, then supply
`PERSIST_COSMOS_ENDPOINT` (managed identity) or `PERSIST_COSMOS_CONNECTION_STRING`.
Install the optional packages: `npm install @azure/cosmos @azure/identity` in `api/`.

## Enabling real integrations

Each connector in `integrations.config.json` has `useMock: true` by default.
Set it to `false` and provide the real endpoint/credentials via env or managed
identity to switch from the mock to a live implementation.

- **SharePoint**: grant the App Service managed identity Microsoft Graph access
	to the configured site/library, then set `sharePoint.useMock` to `false`.
	`GRAPH_ACCESS_TOKEN` is a local-development fallback only.
- **Azure DevOps**: set `ADO_PAT`, confirm `organizationUrl` is
	`https://dev.azure.com/csdmichael`, and set `azureDevOps.useMock` to `false`.
- **GitHub**: set `GITHUB_PAT` with organization repository permissions and set
	`github.useMock` to `false`.
- **Testing**: choose `azure-pipelines` or `github-actions` in
	`testAutomation.defaultRunner`. Configure `azurePipelineId`, or
	`githubWorkflow` and `githubRef`, then disable mock mode for the selected
	backing connector.

Turning off a mock does not bypass workflow controls. The named human approval
gate is evaluated by the Agent Framework approval executor before any connector
receives the request.
