import { Component, OnInit, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WebSocketService } from '../../../core/services/websocket.service';
import { ApiService } from '../../../core/services/api.service';
import { Subscription } from 'rxjs';

interface AutomationJob {
  _id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  config: {
    keywords: string[];
    location: string;
    targetCount: number;
    actionType: string;
  };
  progress: { processed: number; successful: number; failed: number };
  startedAt?: string;
  completedAt?: string;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

const STATUS_ICONS: Record<string, string> = {
  pending: '⏳', running: '▶️', paused: '⏸', completed: '✅', failed: '❌',
};

@Component({
  selector: 'app-automation-control',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-6 animate-fade-in">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-slate-100">Automation Control</h1>
        <p class="text-slate-500 text-sm mt-0.5">Monitor and control your active automation jobs</p>
      </div>

      <!-- Active Jobs -->
      <div class="card">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-semibold text-slate-200">Active Jobs</h3>
          <button (click)="loadJobs()" class="btn-ghost text-sm">↻ Refresh</button>
        </div>

        @if (jobs().length === 0) {
          <div class="text-center py-8 text-slate-500">
            <p class="text-4xl mb-3">🤖</p>
            <p>No automation jobs yet.</p>
            <p class="text-sm mt-1">Start a job from the Search page.</p>
          </div>
        }

        @for (job of jobs(); track job._id) {
          <div class="border border-surface-border rounded-xl p-4 mb-3 last:mb-0">
            <!-- Job Header -->
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <span class="text-xl">{{ STATUS_ICONS[job.status] }}</span>
                <div>
                  <p class="font-medium text-slate-200">
                    {{ job.config.keywords.join(', ') }} — {{ job.config.location }}
                  </p>
                  <p class="text-xs text-slate-500">
                    {{ job.config.actionType }} · Target: {{ job.config.targetCount }}
                    @if (job.startedAt) { · Started: {{ formatTime(job.startedAt) }} }
                  </p>
                </div>
              </div>

              <!-- Controls -->
              <div class="flex gap-2">
                @if (job.status === 'running') {
                  <button (click)="pauseJob(job._id)" class="btn-secondary text-xs">⏸ Pause</button>
                  <button (click)="stopJob(job._id)" class="btn-danger text-xs">■ Stop</button>
                }
                @if (job.status === 'paused') {
                  <button (click)="resumeJob(job._id)" class="btn-primary text-xs">▶ Resume</button>
                  <button (click)="stopJob(job._id)" class="btn-danger text-xs">■ Stop</button>
                }
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="mb-2">
              <div class="flex justify-between text-xs text-slate-500 mb-1">
                <span>Progress</span>
                <span>{{ job.progress.processed }}/{{ job.config.targetCount }} processed</span>
              </div>
              <div class="h-2 bg-surface rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500 bg-brand-500"
                     [style.width.%]="job.config.targetCount > 0 ? (job.progress.processed / job.config.targetCount) * 100 : 0">
                </div>
              </div>
            </div>

            <!-- Stats Row -->
            <div class="flex gap-4 text-xs text-slate-400">
              <span class="text-emerald-400">✓ {{ job.progress.successful }} successful</span>
              <span class="text-red-400">✗ {{ job.progress.failed }} failed</span>
              <span class="capitalize">
                <span [class]="'dot-' + job.status + ' inline-block mr-1'"></span>
                {{ job.status }}
              </span>
            </div>
          </div>
        }
      </div>

      <!-- Live Log -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-slate-200">Live Activity Log</h3>
          <div class="flex gap-2">
            <button (click)="clearLogs()" class="btn-ghost text-xs">Clear</button>
            <span class="flex items-center gap-1.5 text-xs text-slate-500">
              <span [class]="ws.isConnected() ? 'dot-running' : 'dot-failed'"></span>
              {{ ws.isConnected() ? 'Connected' : 'Disconnected' }}
            </span>
          </div>
        </div>

        <div #logContainer id="log-container"
             class="bg-surface rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs space-y-1">
          @for (entry of logs(); track $index) {
            <div class="flex gap-3" [class]="logClass(entry.level)">
              <span class="text-slate-600 flex-shrink-0">{{ formatTime(entry.timestamp) }}</span>
              <span [class]="logTextClass(entry.level)">[{{ entry.level.toUpperCase() }}]</span>
              <span class="text-slate-300">{{ entry.message }}</span>
            </div>
          } @empty {
            <p class="text-slate-600 text-center py-8">Waiting for job activity...</p>
          }
        </div>
      </div>
    </div>
  `,
})
export class AutomationControlComponent implements OnInit, OnDestroy {
  jobs = signal<AutomationJob[]>([]);
  logs = signal<LogEntry[]>([]);
  STATUS_ICONS = STATUS_ICONS;

  private sub?: Subscription;

  constructor(public ws: WebSocketService, private api: ApiService) {}

  ngOnInit() {
    this.loadJobs();

    // Subscribe to real-time WebSocket events
    this.sub = this.ws.onMessage<any>('job:update').subscribe((update) => {
      this.loadJobs();
      this.addLog('info', `Job update: ${update.status ?? update.stage ?? JSON.stringify(update)}`);
    });

    this.ws.onMessage<{ message: string; level?: string }>('job:log').subscribe((entry) => {
      this.addLog((entry.level as LogEntry['level']) ?? 'info', entry.message);
    });

    this.ws.onMessage<{ message: string }>('job:error').subscribe((e) => {
      this.addLog('error', e.message);
    });

    this.ws.onMessage<{ message: string }>('captcha:detected').subscribe((e) => {
      this.addLog('warn', `⚠️ CAPTCHA detected — ${e.message}`);
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  loadJobs() {
    this.api.get<{ data: AutomationJob[] }>('/automation/jobs').subscribe((r) => this.jobs.set(r.data));
  }

  pauseJob(id: string) {
    this.api.post<void>(`/automation/pause/${id}`, {}).subscribe(() => this.loadJobs());
  }

  resumeJob(id: string) {
    this.api.post<void>(`/automation/resume/${id}`, {}).subscribe(() => this.loadJobs());
  }

  stopJob(id: string) {
    if (!confirm('Stop this job?')) return;
    this.api.post<void>(`/automation/stop/${id}`, {}).subscribe(() => this.loadJobs());
  }

  addLog(level: LogEntry['level'], message: string) {
    this.logs.update((l) => [
      ...l.slice(-199), // keep last 200 entries
      { timestamp: new Date().toISOString(), level, message },
    ]);
  }

  clearLogs() { this.logs.set([]); }

  logClass(level: string): string {
    return 'flex gap-3 py-0.5';
  }

  logTextClass(level: string): string {
    const map: Record<string, string> = {
      info: 'text-brand-400', warn: 'text-yellow-400', error: 'text-red-400', success: 'text-emerald-400',
    };
    return map[level] ?? 'text-slate-400';
  }

  formatTime(ts: string): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
