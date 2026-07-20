import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Redirect root to dashboard
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Auth
  {
    path: 'login',
    loadComponent: () =>
      import('./modules/auth/login/login.component').then((m) => m.LoginComponent),
  },

  // Protected shell
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./modules/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'search',
        loadComponent: () =>
          import('./modules/search/search-config/search-config.component').then(
            (m) => m.SearchConfigComponent
          ),
      },
      {
        path: 'templates',
        loadComponent: () =>
          import('./modules/templates/template-list/template-list.component').then(
            (m) => m.TemplateListComponent
          ),
      },
      {
        path: 'automation',
        loadComponent: () =>
          import('./modules/automation/automation-control/automation-control.component').then(
            (m) => m.AutomationControlComponent
          ),
      },
      {
        path: 'automation/logs',
        loadComponent: () =>
          import('./modules/automation/job-log/job-log.component').then(
            (m) => m.JobLogComponent
          ),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./modules/analytics/analytics.component').then(
            (m) => m.AnalyticsComponent
          ),
      },
    ],
  },

  // Wildcard
  { path: '**', redirectTo: 'dashboard' },
];

