import { Component, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { WebSocketService } from '../../../core/services/websocket.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [],
  template: `
    <header class="h-16 bg-surface-card border-b border-surface-border flex items-center justify-between px-6 fixed top-0 right-0 left-64 z-10">
      <!-- Page title slot -->
      <div class="flex items-center gap-3">
        <h2 class="text-base font-semibold text-slate-100">{{ pageTitle() }}</h2>
      </div>

      <!-- Right section -->
      <div class="flex items-center gap-4">
        <!-- WebSocket status -->
        <div class="flex items-center gap-2 text-xs text-slate-500">
          <span [class]="ws.isConnected() ? 'dot-running' : 'dot-failed'"></span>
          <span class="hidden sm:inline">{{ ws.isConnected() ? 'Live' : 'Offline' }}</span>
        </div>

        <!-- User Avatar + Email -->
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white">
            {{ userInitial() }}
          </div>
          <span class="text-sm text-slate-400 hidden md:inline">{{ userEmail() }}</span>
        </div>

        <!-- Logout -->
        <button (click)="logout()" class="btn-ghost text-xs" title="Logout">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
        </button>
      </div>
    </header>
  `,
})
export class TopbarComponent {
  userEmail   = computed(() => this.auth.user()?.email ?? '');
  userInitial = computed(() => (this.auth.user()?.email?.[0] ?? 'U').toUpperCase());

  pageTitle = computed(() => {
    const url = this.router.url;
    if (url.includes('search')) return 'Search & Leads';
    if (url.includes('templates')) return 'Templates';
    if (url.includes('automation')) return 'Automation';
    if (url.includes('analytics')) return 'Analytics';
    return 'Dashboard';
  });

  constructor(public ws: WebSocketService, private auth: AuthService, private router: Router) {}

  logout() { this.auth.logout(); }
}
