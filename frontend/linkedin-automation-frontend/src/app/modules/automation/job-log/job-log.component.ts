import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { WebSocketService } from '../../../core/services/websocket.service';
import { ApiService } from '../../../core/services/api.service';
import { Subscription } from 'rxjs';
import { TruncatePipe } from '../../../shared/pipes/truncate.pipe';

interface ActivityLog {
  _id: string;
  action: string;
  details: string;
  timestamp: string;
  leadId?: { name: string };
}

const ACTION_EMOJI: Record<string, string> = {
  connect_sent:    '🔗',
  message_sent:    '💬',
  reply_received:  '📩',
  profile_visit:   '👁',
  error:           '❌',
  search:          '🔍',
};

@Component({
  selector: 'app-job-log',
  standalone: true,
  imports: [TruncatePipe],
  template: `
    <div class="space-y-4 animate-fade-in">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-100">Activity Log</h1>
          <p class="text-slate-500 text-sm mt-0.5">Full history of all automation actions</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1.5 text-xs text-slate-500">
            <span [class]="ws.isConnected() ? 'dot-running' : 'dot-failed'"></span>
            {{ ws.isConnected() ? 'Live' : 'Offline' }}
          </span>
          <button (click)="loadLogs()" class="btn-ghost text-sm">↻ Refresh</button>
        </div>
      </div>

      <div class="card p-0 overflow-hidden">
        <div class="overflow-y-auto max-h-[70vh]">
          <table class="w-full">
            <thead class="bg-surface border-b border-surface-border sticky top-0">
              <tr>
                <th class="table-header w-8">Action</th>
                <th class="table-header">Details</th>
                <th class="table-header">Lead</th>
                <th class="table-header">Time</th>
              </tr>
            </thead>
            <tbody>
              @for (log of logs(); track log._id) {
                <tr class="table-row">
                  <td class="table-cell text-center">{{ ACTION_EMOJI[log.action] ?? '📋' }}</td>
                  <td class="table-cell">{{ log.details | truncate:80 }}</td>
                  <td class="table-cell text-slate-400">{{ log.leadId?.name ?? '—' }}</td>
                  <td class="table-cell text-slate-500 whitespace-nowrap">{{ formatTime(log.timestamp) }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="py-12 text-center text-slate-500">No activity logged yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div class="flex items-center justify-between px-6 py-3 border-t border-surface-border">
            <span class="text-sm text-slate-500">Page {{ page() }} of {{ totalPages() }}</span>
            <div class="flex gap-2">
              <button (click)="prevPage()" [disabled]="page() <= 1" class="btn-ghost text-sm">← Prev</button>
              <button (click)="nextPage()" [disabled]="page() >= totalPages()" class="btn-ghost text-sm">Next →</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class JobLogComponent implements OnInit, OnDestroy {
  logs       = signal<ActivityLog[]>([]);
  page       = signal(1);
  totalPages = signal(1);
  ACTION_EMOJI = ACTION_EMOJI;

  private sub?: Subscription;

  constructor(public ws: WebSocketService, private api: ApiService) {}

  ngOnInit() {
    this.loadLogs();

    // Refresh on new activity from WebSocket
    this.sub = this.ws.onMessage<void>('job:update').subscribe(() => {
      if (this.page() === 1) this.loadLogs();
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  loadLogs() {
    this.api.get<{ data: ActivityLog[]; pages: number }>('/analytics/logs', { page: this.page(), limit: 50 })
      .subscribe((r) => {
        this.logs.set(r.data);
        this.totalPages.set(r.pages);
      });
  }

  prevPage() { this.page.update((p) => p - 1); this.loadLogs(); }
  nextPage() { this.page.update((p) => p + 1); this.loadLogs(); }

  formatTime(ts: string): string {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
}
