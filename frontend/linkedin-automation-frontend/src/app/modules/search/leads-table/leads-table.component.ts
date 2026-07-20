import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TruncatePipe } from '../../../shared/pipes/truncate.pipe';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { WebSocketService } from '../../../core/services/websocket.service';

export interface Lead {
  _id: string;
  name: string;
  headline: string;
  company: string;
  location: string;
  email?: string;
  connectionDegree: '1st' | '2nd' | '3rd';
  status: 'discovered' | 'request_sent' | 'connected' | 'messaged' | 'replied' | 'email_sent' | 'ignored';
  leadScore?: number;
  matchLevel?: 'high' | 'medium' | 'low';
  linkedinProfileUrl: string;
  messageSentAt?: string;
  createdAt: string;
}

export interface AiPitchItem {
  title: string;
  note: string;
}

const STATUS_COLORS: Record<string, string> = {
  discovered:   'badge-gray',
  request_sent: 'badge-blue',
  connected:    'badge-green',
  messaged:     'badge-yellow',
  replied:      'badge-purple',
  email_sent:   'badge-purple',
  ignored:      'badge-red',
};

@Component({
  selector: 'app-leads-table',
  standalone: true,
  imports: [FormsModule, TruncatePipe],
  template: `
    <div class="space-y-4 animate-fade-in">
      <!-- Filters toolbar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card border border-surface-border rounded-xl p-4">
        <div class="flex flex-wrap items-center gap-3 flex-1 max-w-3xl">
          <!-- Search input wrapper with icon -->
          <div class="relative flex-1 min-w-[220px]">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
              🔍
            </span>
            <input
              id="leads-search"
              type="text"
              [(ngModel)]="searchQuery"
              (ngModelChange)="onFilterChange()"
              placeholder="Search by name, headline, company..."
              class="input pl-10 h-10 w-full"
            />
          </div>
          <!-- Status Dropdown wrapper -->
          <div class="relative min-w-[150px]">
            <select id="leads-status-filter" [(ngModel)]="statusFilter" (ngModelChange)="onFilterChange()" class="select pr-8 h-10 w-full">
              <option value="">All Statuses</option>
              <option value="discovered">Discovered</option>
              <option value="request_sent">Request Sent</option>
              <option value="connected">Connected</option>
              <option value="messaged">Messaged</option>
              <option value="replied">Replied</option>
              <option value="email_sent">Email Sent</option>
              <option value="ignored">Ignored</option>
            </select>
            <span class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 text-xs">
              ▼
            </span>
          </div>

          <!-- Match Level Dropdown -->
          <div class="relative min-w-[150px]">
            <select id="leads-match-filter" [(ngModel)]="matchLevelFilter" (ngModelChange)="onFilterChange()" class="select pr-8 h-10 w-full">
              <option value="">All Lead Quality</option>
              <option value="high">🔥 High Match</option>
              <option value="medium">⚡ Medium Match</option>
              <option value="low">Basic Lead</option>
            </select>
            <span class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 text-xs">
              ▼
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <button (click)="syncResponses()" [disabled]="syncing()" class="btn-primary h-10 text-sm flex items-center gap-1.5 px-4 font-medium">
            @if (syncing()) {
              <span class="animate-spin">⏳</span> Syncing...
            } @else {
              💬 Sync Responses
            }
          </button>
          <button (click)="exportCsv()" class="btn-secondary h-10 text-sm flex items-center gap-1.5 px-4 font-medium hover:bg-slate-700 transition-colors">
            📥 Export CSV
          </button>
          <button (click)="loadLeads()" class="btn-ghost h-10 text-sm flex items-center gap-1.5 px-4 border border-surface-border hover:bg-surface-border/50 transition-colors">
            🔄 Refresh
          </button>
        </div>
      </div>

      @if (syncMessage()) {
        <div class="p-3 bg-brand-600/20 border border-brand-500/30 rounded-xl text-xs text-brand-300 flex items-center justify-between">
          <span>{{ syncMessage() }}</span>
        </div>
      }

      <!-- Table -->
      <div class="card p-0 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-surface border-b border-surface-border">
              <tr>
                <th class="table-header">Name</th>
                <th class="table-header">Email</th>
                <th class="table-header">Headline</th>
                <th class="table-header">Company</th>
                <th class="table-header">Match Score</th>
                <th class="table-header">Degree</th>
                <th class="table-header">Status</th>
                <th class="table-header">Added</th>
                <th class="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (lead of leads(); track lead._id) {
                <tr class="table-row">
                  <td class="table-cell font-medium text-slate-100">
                    <a [href]="lead.linkedinProfileUrl" target="_blank" rel="noopener"
                       class="hover:text-brand-400 transition-colors">
                      {{ lead.name }}
                    </a>
                  </td>
                  <td class="table-cell">
                    @if (lead.email) {
                      <span class="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        ✉️ {{ lead.email }}
                      </span>
                    } @else {
                      <span class="text-xs text-slate-500 italic">No email</span>
                    }
                  </td>
                  <td class="table-cell text-slate-400">{{ lead.headline | truncate:35 }}</td>
                  <td class="table-cell">{{ lead.company || '—' }}</td>
                  <td class="table-cell">
                    @if (lead.matchLevel === 'high') {
                      <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        🔥 High ({{ lead.leadScore || 85 }}%)
                      </span>
                    } @else if (lead.matchLevel === 'medium') {
                      <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        ⚡ Med ({{ lead.leadScore || 75 }}%)
                      </span>
                    } @else {
                      <span class="px-2 py-0.5 rounded-full text-xs text-slate-400 bg-slate-800 border border-slate-700">
                        Basic ({{ lead.leadScore || 50 }}%)
                      </span>
                    }
                  </td>
                  <td class="table-cell">
                    <span class="badge badge-gray">{{ lead.connectionDegree }}</span>
                  </td>
                  <td class="table-cell">
                    <span [class]="statusBadgeClass(lead.status)">
                      {{ lead.status.replace('_', ' ') }}
                    </span>
                  </td>
                  <td class="table-cell text-slate-500">{{ formatDate(lead.createdAt) }}</td>
                  <td class="table-cell text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button (click)="openAiPitch(lead)" 
                        class="px-2.5 py-1 text-xs rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 transition-all font-medium">
                        ✨ AI Pitch
                      </button>
                      <select
                        [id]="'status-' + lead._id"
                        [value]="lead.status"
                        (change)="updateStatus(lead, $event)"
                        class="select w-32 text-xs py-1">
                        <option value="discovered">Discovered</option>
                        <option value="request_sent">Request Sent</option>
                        <option value="connected">Connected</option>
                        <option value="messaged">Messaged</option>
                        <option value="replied">Replied</option>
                        <option value="email_sent">Email Sent</option>
                        <option value="ignored">Ignored</option>
                      </select>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="9" class="py-12 text-center text-slate-500">
                    @if (loading()) {
                      <span>Loading leads...</span>
                    } @else {
                      No leads found. Run an automation job to discover leads.
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-surface-card border-t border-surface-border gap-4">
          <span class="text-sm text-slate-400">
            Showing <span class="font-medium text-slate-200">{{ showingFrom() }}</span> 
            to <span class="font-medium text-slate-200">{{ showingTo() }}</span> 
            of <span class="font-medium text-slate-200">{{ total() }}</span> leads
          </span>
          <div class="flex items-center gap-1.5">
            <button 
              (click)="goToPage(currentPage() - 1)" 
              [disabled]="currentPage() <= 1" 
              class="btn-ghost px-3 py-1.5 text-xs border border-surface-border flex items-center gap-1">
              ← Prev
            </button>
            
            @for (p of pageNumbers(); track p) {
              <button 
                (click)="goToPage(p)" 
                [class.bg-brand-600]="currentPage() === p"
                [class.text-white]="currentPage() === p"
                [class.border-brand-600]="currentPage() === p"
                [class.hover:bg-brand-700]="currentPage() === p"
                class="btn-ghost min-w-[32px] h-8 px-2 py-1 text-xs border border-surface-border">
                {{ p }}
              </button>
            }
            
            <button 
              (click)="goToPage(currentPage() + 1)" 
              [disabled]="currentPage() >= totalPages()" 
              class="btn-ghost px-3 py-1.5 text-xs border border-surface-border flex items-center gap-1">
              Next →
            </button>
          </div>
        </div>
      </div>

      <!-- AI Pitch Modal -->
      @if (selectedLeadForPitch()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div class="card max-w-2xl w-full p-6 space-y-5 bg-surface-card border border-surface-border shadow-2xl rounded-2xl">
            <div class="flex items-start justify-between border-b border-surface-border pb-4">
              <div>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  ✨ AI Pitch Generator
                </span>
                <h3 class="text-lg font-bold text-slate-100 mt-1">Personalized Outreach for {{ selectedLeadForPitch()?.name }}</h3>
                <p class="text-xs text-slate-400 mt-0.5">{{ selectedLeadForPitch()?.headline }} • {{ selectedLeadForPitch()?.company }}</p>
              </div>
              <button (click)="closeAiPitch()" class="text-slate-400 hover:text-slate-200 text-lg font-semibold px-2">✕</button>
            </div>

            @if (loadingPitch()) {
              <div class="py-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                <span class="animate-spin text-2xl">⚡</span>
                Generating tailored outreach notes...
              </div>
            } @else {
              <div class="space-y-4">
                @for (pitch of pitches(); track pitch.title) {
                  <div class="p-4 rounded-xl bg-surface border border-surface-border hover:border-brand-500/30 transition-all space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-semibold text-brand-400">{{ pitch.title }}</span>
                      <button (click)="copyNote(pitch.note)" 
                        class="px-2.5 py-1 text-xs rounded bg-surface-card hover:bg-slate-700 text-slate-300 border border-surface-border transition-colors">
                        📋 Copy Note
                      </button>
                    </div>
                    <p class="text-xs text-slate-300 leading-relaxed">{{ pitch.note }}</p>
                  </div>
                }
              </div>
            }

            <div class="flex justify-end pt-3 border-t border-surface-border">
              <button (click)="closeAiPitch()" class="btn-ghost text-xs px-4 py-2 border border-surface-border">Close</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class LeadsTableComponent implements OnInit {
  leads      = signal<Lead[]>([]);
  loading    = signal(false);
  total      = signal(0);
  currentPage = signal(1);
  totalPages  = signal(1);

  showingFrom = computed(() => {
    if (this.total() === 0) return 0;
    return (this.currentPage() - 1) * 20 + 1;
  });

  showingTo = computed(() => {
    return Math.min(this.currentPage() * 20, this.total());
  });

  pageNumbers = computed(() => {
    const pages = [];
    for (let i = 1; i <= this.totalPages(); i++) {
      pages.push(i);
    }
    return pages;
  });

  searchQuery  = '';
  statusFilter = '';
  matchLevelFilter = '';
  syncing      = signal(false);
  syncMessage  = signal('');

  selectedLeadForPitch = signal<Lead | null>(null);
  pitches = signal<AiPitchItem[]>([]);
  loadingPitch = signal(false);

  selectedIds = signal<Set<string>>(new Set());
  startingBulk = signal(false);
  templates = signal<Array<{ _id: string; name: string }>>([]);

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private ws: WebSocketService
  ) {}

  ngOnInit() {
    this.loadLeads();
    this.api.get<{ success: boolean; data: Array<{ _id: string; name: string }> }>('/templates').subscribe({
      next: (r) => this.templates.set(r.data),
    });
    this.ws.onMessage<{ leadId: string; status: Lead['status'] }>('lead:updated').subscribe((evt) => {
      if (evt?.leadId) {
        this.leads.update((list) =>
          list.map((l) => (l._id === evt.leadId ? { ...l, status: evt.status } : l))
        );
      }
    });
  }

  isAllSelected(): boolean {
    const list = this.leads();
    return list.length > 0 && list.every((l) => this.selectedIds().has(l._id));
  }

  toggleSelectAll(evt: Event) {
    const checked = (evt.target as HTMLInputElement).checked;
    const current = new Set(this.selectedIds());
    if (checked) {
      this.leads().forEach((l) => current.add(l._id));
    } else {
      this.leads().forEach((l) => current.delete(l._id));
    }
    this.selectedIds.set(current);
  }

  toggleSelect(id: string) {
    const current = new Set(this.selectedIds());
    if (current.has(id)) current.delete(id);
    else current.add(id);
    this.selectedIds.set(current);
  }

  sendBulkRequests() {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    const templateId = this.templates()[0]?._id;
    if (!templateId) {
      this.syncMessage.set('❌ Please create a message template first in Templates section.');
      return;
    }

    this.startingBulk.set(true);
    this.syncMessage.set(`⚡ Dispatching parallel bulk connection requests for ${ids.length} selected leads...`);

    this.api.post<{ success: boolean; message: string }>('/automation/bulk-start', { leadIds: ids, templateId })
      .subscribe({
        next: (res) => {
          this.startingBulk.set(false);
          this.syncMessage.set(`🚀 ${res.message} Requests dispatched in high-speed parallel batches.`);
          this.selectedIds.set(new Set());
          setTimeout(() => this.syncMessage.set(''), 8000);
        },
        error: (err) => {
          this.startingBulk.set(false);
          const msg = err?.error?.message || 'Failed to start bulk outreach.';
          this.syncMessage.set(`❌ ${msg}`);
        }
      });
  }

  openAiPitch(lead: Lead) {
    this.selectedLeadForPitch.set(lead);
    this.loadingPitch.set(true);
    this.pitches.set([]);
    this.api.get<{ success: boolean; data: { pitches: AiPitchItem[] } }>(`/leads/${lead._id}/ai-pitch`)
      .subscribe({
        next: (res) => {
          this.pitches.set(res.data.pitches);
          this.loadingPitch.set(false);
        },
        error: () => this.loadingPitch.set(false),
      });
  }

  closeAiPitch() {
    this.selectedLeadForPitch.set(null);
  }

  copyNote(note: string) {
    navigator.clipboard.writeText(note);
    this.syncMessage.set('📋 Copied outreach note to clipboard!');
    setTimeout(() => this.syncMessage.set(''), 4000);
  }

  syncResponses() {
    this.syncing.set(true);
    this.syncMessage.set('Checking connections & replies on LinkedIn...');
    this.api.post<{ success: boolean; data: { connectedUpdated: number; repliedUpdated: number } }>('/automation/sync-responses', {})
      .subscribe({
        next: (res) => {
          this.syncing.set(false);
          const c = res.data.connectedUpdated;
          const r = res.data.repliedUpdated;
          this.syncMessage.set(`Sync complete: ${c} accepted connections, ${r} new replies.`);
          this.loadLeads();
          setTimeout(() => this.syncMessage.set(''), 6000);
        },
        error: (err) => {
          this.syncing.set(false);
          const msg = err?.error?.message || 'Failed to sync LinkedIn responses.';
          this.syncMessage.set(`❌ ${msg}`);
          setTimeout(() => this.syncMessage.set(''), 8000);
        }
      });
  }

  loadLeads() {
    this.loading.set(true);
    const params: Record<string, string | number> = { page: this.currentPage(), limit: 20 };
    if (this.searchQuery) params['search'] = this.searchQuery;
    if (this.statusFilter) params['status'] = this.statusFilter;
    if (this.matchLevelFilter) params['matchLevel'] = this.matchLevelFilter;

    this.api.get<{ success: boolean; data: Lead[]; total: number; pages: number }>('/leads', params)
      .subscribe({
        next: (r) => {
          this.leads.set(r.data);
          this.total.set(r.total);
          this.totalPages.set(r.pages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onFilterChange() {
    this.currentPage.set(1);
    this.loadLeads();
  }

  goToPage(page: number) {
    this.currentPage.set(page);
    this.loadLeads();
  }

  updateStatus(lead: Lead, event: Event) {
    const status = (event.target as HTMLSelectElement).value as Lead['status'];
    this.api.patch<{ success: boolean; data: Lead }>(`/leads/${lead._id}/status`, { status })
      .subscribe((r) => {
        this.leads.update((list) => list.map((l) => l._id === lead._id ? r.data : l));
      });
  }

  exportCsv() {
    const params = new URLSearchParams();
    if (this.statusFilter) params.set('status', this.statusFilter);
    const token = this.auth.token();
    if (token) {
      params.set('token', token);
    }
    window.open(`${this.api.baseUrl}/leads/export/csv?${params}`, '_blank');
  }

  statusBadgeClass(status: string): string {
    return STATUS_COLORS[status] ?? 'badge-gray';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
