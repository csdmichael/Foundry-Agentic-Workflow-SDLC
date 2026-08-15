# Architecture

The Agentic SDLC / Software Factory is an AI Foundry–based platform that orchestrates
specialized agents across the software development lifecycle, with explicit
human accountability at every stage.

> The reference architecture and the "Agentic SDLC: Human Accountability + Agent
> Execution" operating model are captured in
> [`Microsoft-AI-Stack-for-SDLC.pptx`](./Microsoft-AI-Stack-for-SDLC.pptx). Export
> the two slides as PNGs into [`images/`](./images) to display them inline (see
> [images/README.md](./images/README.md)). The Mermaid diagrams below reproduce
> the same model and render directly on GitHub.

## Layered architecture

```mermaid
flowchart TB
  subgraph EXP[Experience Layer]
    U1[Business Stakeholders]
    U2[Product Owners / Engineers]
    U3[Developers]
    U4[QA / Testers]
    U5[IT / Platform]
    U6[Operations]
  end

  subgraph AGENT[Agent & AI Layer — built on Microsoft Foundry]
    A1[Requirements Agent]
    A2[Architecture Advisor]
    A3[Code Generation Agent]
    A4[Test Automation Agent]
    A5[DevOps / Release Agent]
    A6[Security & Compliance Agent]
    A7[Knowledge Assistant]
  end

  subgraph GATE[Human-in-the-loop Approval Gates]
    G[9 gates: Plan · Design · Backlog · Code · PR · Security · Test · Release · Operate]
  end

  subgraph FACTORY[Factory & Tooling]
    F1[Azure DevOps]
    F2[GitHub]
    F3[Azure Pipelines]
    F4[Azure Test Plans]
    F5[Artifacts / Feeds]
    F6[Environments]
  end

  subgraph INT[Integration & Data]
    I1[Microsoft 365 / SharePoint / OneDrive]
    I2[Azure OpenAI via APIM]
    I3[Enterprise Data]
    I4[Entra ID — SSO / RBAC]
  end

  subgraph CLOUD[Cloud & Foundation — Microsoft Azure]
    C1[App Service]
    C2[Cosmos DB]
    C3[Azure Functions]
    C4[Key Vault]
    C5[Azure Monitor]
    C6[Communication Services — Email/OTP]
  end

  EXP --> AGENT
  AGENT --> GATE
  GATE --> FACTORY
  AGENT -->|via APIM| I2
  AGENT --> INT
  FACTORY --> CLOUD
  INT --> CLOUD
```

## Tiered configuration

Configuration is strictly separated by tier; business logic never hardcodes
endpoints, keys, tenant IDs, or routes.

| Tier | Config location |
| --- | --- |
| UI | [`src/app/config/`](../src/app/config) |
| API | [`api/src/config/`](../api/src/config) |
| DB / persistence | [`api/src/persistence/config/`](../api/src/persistence/config) |
| Agent orchestration | [`api/src/agents/config/`](../api/src/agents/config) |

## APIM gateway

All Azure AI Foundry calls route through Azure API Management. The backend never
calls Foundry directly except when `FOUNDRY_ALLOW_DIRECT=1` is set for local
development. Every call logs prompt ID, agent ID, model name, token estimate,
project ID, user ID, approval gate ID, workflow run ID, and correlation ID.
