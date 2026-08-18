import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { requireCapabilities } from './guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'access-denied',
    loadComponent: () => import('./pages/access-denied/access-denied.page').then((m) => m.AccessDeniedPage),
  },
  {
    path: '',
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'projects/new',
        loadComponent: () => import('./pages/new-project/new-project.page').then((m) => m.NewProjectPage),
        canActivate: [requireCapabilities('projects.create')],
      },
      {
        path: 'projects',
        loadComponent: () => import('./pages/projects/projects.page').then((m) => m.ProjectsPage),
        canActivate: [requireCapabilities('projects.read')],
      },
      {
        path: 'projects/:id',
        loadComponent: () => import('./pages/project-detail/project-detail.page').then((m) => m.ProjectDetailPage),
        canActivate: [requireCapabilities('projects.read')],
      },
      {
        path: 'workflow-runs',
        loadComponent: () => import('./pages/workflow-runs/workflow-runs.page').then((m) => m.WorkflowRunsPage),
        canActivate: [requireCapabilities('projects.read')],
      },
      {
        path: 'approvals',
        loadComponent: () => import('./pages/approvals/approvals.page').then((m) => m.ApprovalsPage),
        canActivate: [requireCapabilities('projects.read')],
      },
      {
        path: 'agent-activity',
        loadComponent: () => import('./pages/agent-activity/agent-activity.page').then((m) => m.AgentActivityPage),
        canActivate: [requireCapabilities('agents.read')],
      },
      {
        path: 'audit',
        loadComponent: () => import('./pages/audit/audit.page').then((m) => m.AuditPage),
        canActivate: [requireCapabilities('audit.read')],
      },
      {
        path: 'admin/users',
        loadComponent: () => import('./pages/admin-users/admin-users.page').then((m) => m.AdminUsersPage),
        canActivate: [requireCapabilities('users.manage')],
      },
      {
        path: 'admin/agents',
        loadComponent: () => import('./pages/admin-agents/admin-agents.page').then((m) => m.AdminAgentsPage),
        canActivate: [requireCapabilities('agents.configure')],
      },
      {
        path: 'admin/config',
        loadComponent: () => import('./pages/admin-config/admin-config.page').then((m) => m.AdminConfigPage),
        canActivate: [requireCapabilities('config.manage')],
      },
      {
        path: 'admin/settings',
        loadComponent: () => import('./pages/admin-settings/admin-settings.page').then((m) => m.AdminSettingsPage),
        canActivate: [requireCapabilities('config.manage')],
      },
      {
        path: 'docs/:topic',
        loadComponent: () => import('./pages/docs/docs.page').then((m) => m.DocsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
