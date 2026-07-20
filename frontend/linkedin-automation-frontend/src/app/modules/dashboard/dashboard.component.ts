import { Component, OnInit, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';

interface Summary {
  totalLeads: number;
  todaySent: number;
  totalReplied: number;
  conversionRate: string;
  byStatus: Record<string, number>;
  recentActivity: { action: string; details: string; timestamp: string; leadId?: { name: string } }[];
}
interface DailyUsage { used: number; limit: number; remaining: number; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [StatCardComponent, AsyncPipe, FormsModule],
  template: `
    <div class="space-y-6 animate-fade-in">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p class="text-slate-500 text-sm mt-0.5">Overview of your automation activity</p>
        </div>
        <button (click)="refresh()" class="btn-ghost text-sm">
          ↻ Refresh
        </button>
      </div>

      <!-- LinkedIn Connection Card -->
      <div class="card bg-surface-card border border-surface-border p-5 rounded-xl">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 class="font-semibold text-slate-200">LinkedIn Account Connection</h3>
            <p class="text-xs text-slate-500 mt-0.5">Connect your account by pasting session cookies. You can get these cookies using Chrome Extensions like 'EditThisCookie' or from DevTools.</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium">Status:</span>
            <span [class]="sessionStatus() === 'checking' ? 'text-yellow-400 bg-yellow-400/10' : (sessionStatus() === 'valid' ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10')" class="px-2.5 py-1 rounded-full text-xs font-semibold">
              {{ sessionStatus() === 'checking' ? '⏳ Verifying...' : (sessionStatus() === 'valid' ? '✅ Connected (Active)' : '❌ Session Invalid / Disconnected') }}
            </span>
          </div>
        </div>

        <div class="space-y-3">
          <textarea [(ngModel)]="cookieInput" placeholder="Paste LinkedIn Cookies JSON here... e.g. [{ &quot;name&quot;: &quot;li_at&quot;, &quot;value&quot;: &quot;...&quot; }]" class="input font-mono text-xs w-full h-20 bg-surface/50 resize-y" [disabled]="saving()"></textarea>
          <div class="flex items-center gap-3">
            <button (click)="saveCookies()" [disabled]="saving() || !cookieInput.trim()" class="btn-primary py-2 text-xs">
              {{ saving() ? 'Saving...' : '💾 Save Cookies' }}
            </button>
            <button (click)="checkSession()" [disabled]="sessionStatus() === 'checking'" class="btn-secondary py-2 text-xs">
              🔄 Test Connection Status
            </button>
            @if (cookieFeedback()) {
              <span class="text-xs" [class]="cookieFeedbackError() ? 'text-red-400' : 'text-emerald-400'">
                {{ cookieFeedback() }}
              </span>
            }
          </div>
        </div>
      </div>

      <!-- Daily Limit Bar -->
      @if (usage(); as u) {
        <div class="card">
          <div class="flex items-center justify-between mb-3">
            <div>
              <p class="text-sm font-medium text-slate-300">Today's Actions</p>
              <p class="text-xs text-slate-500 mt-0.5">{{ u.used }} of {{ u.limit }} used — {{ u.remaining }} remaining</p>
            </div>
            <span class="text-sm font-bold" [class]="u.remaining > 5 ? 'text-emerald-400' : 'text-red-400'">
              {{ u.remaining > 0 ? u.remaining + ' left' : 'Limit reached' }}
            </span>
          </div>
          <div class="h-2 bg-surface rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-700"
                 [style.width.%]="(u.used / u.limit) * 100"
                 [class]="u.used >= u.limit ? 'bg-red-500' : 'bg-brand-500'"></div>
          </div>
        </div>
      }

      <!-- Stat Cards -->
      @if (summary(); as s) {
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <app-stat-card icon="👥" label="Total Leads" [value]="s.totalLeads" trend="All time" [progress]="60" color="blue"/>
          <app-stat-card icon="📤" label="Sent Today" [value]="s.todaySent" trend="Today" [progress]="(s.todaySent/25)*100" color="green"/>
          <app-stat-card icon="💬" label="Replies Received" [value]="s.totalReplied" trend="Total" [progress]="30" color="yellow"/>
          <app-stat-card icon="📊" label="Conversion Rate" [value]="s.conversionRate + '%'" trend="Reply rate" [progress]="+s.conversionRate" color="green"/>
        </div>

        <!-- Status Breakdown -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card">
            <h3 class="text-sm font-semibold text-slate-300 mb-4">Lead Pipeline</h3>
            <div class="space-y-3">
              @for (entry of pipelineEntries(s.byStatus); track entry.key) {
                <div class="flex items-center gap-3">
                  <span class="text-xs w-28 text-slate-400 capitalize">{{ entry.key.replace('_', ' ') }}</span>
                  <div class="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-700 bg-brand-500"
                         [style.width.%]="s.totalLeads > 0 ? (entry.value / s.totalLeads) * 100 : 0"></div>
                  </div>
                  <span class="text-xs text-slate-300 w-8 text-right">{{ entry.value }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Recent Activity -->
          <div class="card">
            <h3 class="text-sm font-semibold text-slate-300 mb-4">Recent Activity</h3>
            <div class="space-y-2 max-h-64 overflow-y-auto">
              @for (log of s.recentActivity; track $index) {
                <div class="flex items-start gap-3 py-2 border-b border-surface-border last:border-0">
                   <span class="text-sm">{{ actionEmoji(log.action) }}</span>
                   <div class="flex-1 min-w-0">
                     <p class="text-sm text-slate-300 truncate">{{ log.details }}</p>
                     <p class="text-xs text-slate-500">{{ formatTime(log.timestamp) }}</p>
                   </div>
                </div>
              }
              @if (!s.recentActivity.length) {
                <p class="text-slate-500 text-sm text-center py-4">No recent activity yet</p>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  summary = signal<Summary | null>(null);
  usage = signal<DailyUsage | null>(null);

  sessionStatus = signal<'checking' | 'valid' | 'invalid'>('invalid');
  cookieInput = '';
  saving = signal(false);
  cookieFeedback = signal('');
  cookieFeedbackError = signal(false);

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.refresh();
    this.checkSession();
  }

  refresh() {
    this.api.get<{ success: boolean; data: Summary }>('/analytics/summary').subscribe((r) => this.summary.set(r.data));
    this.api.get<{ success: boolean; data: DailyUsage }>('/automation/daily-usage').subscribe((r) => this.usage.set(r.data));
  }

  checkSession() {
    this.sessionStatus.set('checking');
    this.api.get<{ success: boolean; sessionValid: boolean }>('/auth/linkedin/session-status').subscribe({
      next: (r) => {
        this.sessionStatus.set(r.sessionValid ? 'valid' : 'invalid');
      },
      error: () => {
        this.sessionStatus.set('invalid');
      },
    });
  }

  saveCookies() {
    this.saving.set(true);
    this.cookieFeedback.set('');
    
    const inputVal = this.cookieInput.trim();
    let cookiesToSave: any = inputVal;

    if (inputVal.startsWith('[') || inputVal.startsWith('{')) {
      try {
        const parsed = JSON.parse(inputVal);
        if (Array.isArray(parsed)) {
          cookiesToSave = parsed;
        } else {
          throw new Error('JSON is not a cookie array.');
        }
      } catch (e) {
        this.saving.set(false);
        this.cookieFeedback.set('Invalid JSON format. Please paste valid cookies JSON or plain li_at value.');
        this.cookieFeedbackError.set(true);
        return;
      }
    }

    this.api.post<{ success: boolean; message: string }>('/auth/linkedin/save-session', { cookies: cookiesToSave }).subscribe({
      next: (r) => {
        this.saving.set(false);
        this.cookieFeedback.set(r.message || 'Cookies saved successfully!');
        this.cookieFeedbackError.set(false);
        this.cookieInput = '';
        this.checkSession();
      },
      error: (err) => {
        this.saving.set(false);
        this.cookieFeedback.set(err?.error?.error || 'Failed to save cookies.');
        this.cookieFeedbackError.set(true);
      }
    });
  }

  pipelineEntries(byStatus: Record<string, number>): { key: string; value: number }[] {
    return Object.entries(byStatus).map(([key, value]) => ({ key, value }));
  }
  actionEmoji(action: string): string {
    const map: Record<string, string> = { connect_sent: '🔗', message_sent: '💬', reply_received: '📩', job_started: '▶️', job_completed: '✅', error: '❌', search: '🔍' };
    return map[action] ?? '📋';
  }
  formatTime(ts: string): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
