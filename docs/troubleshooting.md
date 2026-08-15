# Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `401 Missing bearer token` on API calls | Not signed in / token expired | Sign in again. In dev, set `AUTH_ALLOW_ANONYMOUS=1` to bypass. |
| OTP email never arrives | ACS not configured | Dev mode logs the code to the API console and `api/data/otp-log.json`, or use `000000` when `AUTH_OTP_DEV_BYPASS=1`. |
| `403 Forbidden: insufficient role` | Role lacks the capability | Have an App Owner adjust the user's role under Admin ▸ User Management. |
| `403 Human approval required before stage` | Stage gate not approved | Approve the corresponding gate in the Human Approval Queue first. |
| Agent run returns a `[MOCK ...]` response | No APIM subscription key configured | Expected in demo mode. Set `APIM_SUBSCRIPTION_KEY` to call Foundry via APIM. |
| UI cannot reach API | Proxy/API not running | Start the API (`npm run dev` in `api/`) and the UI (`npm start`); the UI proxies `/api` to `http://localhost:8080`. |
| Cosmos errors on startup | `provider: cosmos` without packages | `npm install @azure/cosmos @azure/identity` in `api/`, or set provider back to `file`. |

## Logs

- API console prints `[foundry-call]` records with the audited fields and
  `[<correlationId>]` on 5xx errors.
- The Audit Trail page shows every user/agent/approval action.
