import { Component, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { WebSocketService } from '../../../core/services/websocket.service';

interface NavItem { label: string; icon: string; route: string; }

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="flex flex-col w-64 h-screen bg-surface-card border-r border-surface-border fixed left-0 top-0 z-20">
      <!-- Logo -->
      <div class="flex items-center gap-3 p-6 border-b border-surface-border">
        <div class="w-9 h-9 bg-linkedin rounded-lg flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </div>
        <div>
          <p class="text-sm font-semibold text-slate-100">LinkedIn Auto</p>
          <p class="text-xs text-slate-500">Lead Generation</p>
        </div>
      </div>

      <!-- Connection Status -->
      <div class="px-4 py-3 border-b border-surface-border">
        <div class="flex items-center gap-2 text-xs">
          <span [class]="wsConnected() ? 'dot-running' : 'dot-failed'"></span>
          <span class="text-slate-400">{{ wsConnected() ? 'Live Connected' : 'Disconnected' }}</span>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
        @for (item of navItems; track item.route) {
          <a [routerLink]="item.route" routerLinkActive="nav-item-active" [routerLinkActiveOptions]="{exact: item.route === '/'}"
             class="nav-item">
            <span class="text-lg">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </a>
        }
      </nav>

      <!-- User -->
      <div class="p-4 border-t border-surface-border">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {{ userInitial() }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm text-slate-200 truncate">{{ userEmail() }}</p>
            <p class="text-xs text-slate-500">Daily limit: {{ dailyLimit() }}</p>
          </div>
          <button (click)="logout()" class="btn-icon" title="Logout">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  navItems: NavItem[] = [
    { label: 'Dashboard',    icon: '📊', route: '/' },
    { label: 'Search',       icon: '🔍', route: '/search' },
    { label: 'Templates',    icon: '📝', route: '/templates' },
    { label: 'Automation',   icon: '🤖', route: '/automation' },
    { label: 'Analytics',    icon: '📈', route: '/analytics' },
  ];

  userEmail    = computed(() => this.auth.user()?.email ?? '');
  userInitial  = computed(() => (this.auth.user()?.email?.[0] ?? 'U').toUpperCase());
  dailyLimit   = computed(() => this.auth.user()?.dailyLimit ?? 300);
  wsConnected  = this.ws.isConnected;

  constructor(private auth: AuthService, private ws: WebSocketService) {}
  logout() { this.auth.logout(); }
}
