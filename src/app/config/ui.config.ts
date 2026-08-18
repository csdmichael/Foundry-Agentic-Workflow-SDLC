/**
 * UI tier configuration. All UI-tier settings live here (no hardcoded endpoints
 * or identity strings scattered through components). API/agent/DB config live in
 * their own tiers under api/.
 */
import { UserRole } from '../models/models';

export interface NavItem {
  title: string;
  path: string;
  icon: string;
  /** Capabilities that make this item visible. Empty = any authenticated user. */
  requiredCapabilities: string[];
}

export interface NavSection {
  id: string;
  title: string;
  icon: string;
  items: NavItem[];
}

// Cross-host API base: when the UI is served from its own App Service host, it
// must call the separately-hosted API. Local dev (localhost) keeps the relative
// '/api' path so the Angular dev-server proxy handles it.
const API_HOSTS_BY_UI_HOST: Record<string, string> = {
  'agentic-sdlc-ui-my.azurewebsites.net': 'https://agentic-sdlc-api-my.azurewebsites.net/api',
};

function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    const mapped = API_HOSTS_BY_UI_HOST[window.location.hostname];
    if (mapped) return mapped;
  }
  return '/api';
}

export const uiConfig = {
  apiBaseUrl: resolveApiBaseUrl(),
  tokenStorageKey: 'agentic_sdlc_token',
  userStorageKey: 'agentic_sdlc_user',
  accountStorageKey: 'agentic_sdlc_account',
  correlationHeader: 'x-correlation-id',

  identity: {
    name: 'Michael Yaacoub',
    title: 'Sr Solution Engineer',
    linkedIn: 'https://www.linkedin.com/in/michael-yaacoub-7a46436/',
    gitHub: 'csdmichael',
    gitHubUrl: 'https://github.com/csdmichael/Foundry-Agentic-Workflow-SDLC',
  },

  brand: {
    product: 'Agentic SDLC — Software Factory',
    tenantDomain: 'MngEnvMCAP829495.onmicrosoft.com',
    tagline:
      'Orchestrate Azure AI Foundry agents across the software lifecycle — with human approval gates at every stage.',
    poweredBy: 'Powered by Azure AI Foundry & Azure API Management',
    features: [
      {
        icon: 'sparkles-outline',
        title: 'Agentic SDLC',
        text: 'Foundry agents plan, design, build, test, and operate — you stay in control.',
      },
      {
        icon: 'shield-checkmark-outline',
        title: 'Governed access',
        text: 'Entra ID for staff, one-time codes for partners, guest read-only for everyone else.',
      },
      {
        icon: 'hand-left-outline',
        title: 'Human-in-the-loop',
        text: 'Explicit approval gates before any agent action advances a stage.',
      },
    ],
  },

  auth: {
    quickFill: [
      { label: '@MngEnvMCAP829495.onmicrosoft.com', email: 'admin@MngEnvMCAP829495.onmicrosoft.com' },
      { label: '@microsoft.com', email: 'myaacoub@microsoft.com' },
    ],
  },

  navSections: [
    {
      id: 'operations',
      title: 'Agentic SDLC Operations',
      icon: 'rocket-outline',
      items: [
        { title: 'Dashboard', path: '/dashboard', icon: 'grid-outline', requiredCapabilities: [] },
        { title: 'New Project', path: '/projects/new', icon: 'add-circle-outline', requiredCapabilities: ['projects.create'] },
        { title: 'Existing Projects', path: '/projects', icon: 'folder-open-outline', requiredCapabilities: ['projects.read'] },
        { title: 'Workflow Runs', path: '/workflow-runs', icon: 'git-network-outline', requiredCapabilities: ['projects.read'] },
        { title: 'Human Approval Queue', path: '/approvals', icon: 'checkmark-done-outline', requiredCapabilities: ['projects.read'] },
        { title: 'Agent Activity', path: '/agent-activity', icon: 'pulse-outline', requiredCapabilities: ['agents.read'] },
        { title: 'Audit Trail', path: '/audit', icon: 'receipt-outline', requiredCapabilities: ['audit.read'] },
      ],
    },
    {
      id: 'admin',
      title: 'Admin',
      icon: 'shield-outline',
      items: [
        { title: 'User Management', path: '/admin/users', icon: 'people-outline', requiredCapabilities: ['users.manage'] },
        { title: 'Agent Configuration', path: '/admin/agents', icon: 'construct-outline', requiredCapabilities: ['agents.configure'] },
        { title: 'Global Settings', path: '/admin/settings', icon: 'options-outline', requiredCapabilities: ['config.manage'] },
        { title: 'APIM & Config', path: '/admin/config', icon: 'settings-outline', requiredCapabilities: ['config.manage'] },
      ],
    },
    {
      id: 'documentation',
      title: 'Documentation',
      icon: 'library-outline',
      items: [
        { title: 'Overview', path: '/docs/overview', icon: 'book-outline', requiredCapabilities: [] },
        { title: 'Architecture', path: '/docs/architecture', icon: 'layers-outline', requiredCapabilities: [] },
        { title: 'Human-in-the-loop', path: '/docs/hitl', icon: 'hand-left-outline', requiredCapabilities: [] },
        { title: 'Agent Responsibilities', path: '/docs/agents', icon: 'people-circle-outline', requiredCapabilities: [] },
        { title: 'Security & Guardrails', path: '/docs/security', icon: 'shield-checkmark-outline', requiredCapabilities: [] },
      ],
    },
  ] as NavSection[],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  business_user: 'Business User',
  it_user: 'IT User',
  admin: 'Admin',
  app_owner: 'App Owner',
  guest: 'Guest (read-only)',
};

/** Display names for System of Record providers (keys come from the API catalog). */
export const PROVIDER_LABELS: Record<string, string> = {
  sharepoint: 'SharePoint',
  'ado-wiki': 'Azure DevOps Wiki',
  'github-wiki': 'GitHub Wiki',
  'azure-devops': 'Azure DevOps',
  'github-issues': 'GitHub Issues',
  'github-actions': 'GitHub Actions',
  github: 'GitHub',
  'azure-repos': 'Azure Repos',
};
