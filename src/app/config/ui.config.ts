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
  title: string;
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
  correlationHeader: 'x-correlation-id',

  identity: {
    name: 'Michael Yaacoub',
    title: 'Sr Solution Engineer',
    linkedIn: 'https://www.linkedin.com/in/michael-yaacoub-7a46436/',
    gitHub: 'csdmichael',
    gitHubUrl: 'https://github.com/csdmichael',
  },

  brand: {
    product: 'Agentic SDLC — Software Factory',
    tenantDomain: 'MngEnvMCAP829495.onmicrosoft.com',
  },

  navSections: [
    {
      title: 'Agentic SDLC Operations',
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
      title: 'Admin',
      items: [
        { title: 'User Management', path: '/admin/users', icon: 'people-outline', requiredCapabilities: ['users.manage'] },
        { title: 'Agent Configuration', path: '/admin/agents', icon: 'construct-outline', requiredCapabilities: ['agents.configure'] },
        { title: 'APIM & Config', path: '/admin/config', icon: 'settings-outline', requiredCapabilities: ['config.manage'] },
      ],
    },
    {
      title: 'Documentation',
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
};
