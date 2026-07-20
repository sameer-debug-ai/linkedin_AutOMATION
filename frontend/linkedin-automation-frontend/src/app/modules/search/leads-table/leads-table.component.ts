import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TruncatePipe } from '../../../shared/pipes/truncate.pipe';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

export interface Lead {
  _id: string;
  name: string;
  headline: string;
  company: string;
  location: string;
  connectionDegree: '1st' | '2nd' | '3rd';
  status: 'discovered' | 'request_sent' | 'connected' | 'messaged' | 'replied' | 'ignored';
  linkedinProfileUrl: string;
  messageSentAt?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  discovered:   'badge-gray',
  request_sent: 'badge-blue',
  connected:    'badge-green',
  messaged:     'badge-yellow',
  replied:      'badge-green',
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
        <div class="flex flex-wrap items-center gap-3 flex-1 max-w-2xl">
          <!-- Search input wrapper with icon -->
          <div class="relative flex-1 min-w-[240px]">
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
          <div class="relative min-w-[160px]">
            <select id="leads-status-filter" [(ngModel)]="statusFilter" (ngModelChange)="onFilterChange()" class="select pr-8 h-10 w-full">
              <option value="">All Statuses</option>
              <option value="discovered">Discovered</option>
              <option value="request_sent">Request Sent</option>
              <option value="connected">Connected</option>
              <option value="messaged">Messaged</option>
              <option value="replied">Replied</option>
              <option value="ignored">Ignored</option>
            </select>
            <span class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 text-xs">
              ▼
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <button (click)="exportCsv()" class="btn-secondary h-10 text-sm flex items-center gap-1.5 px-4 font-medium hover:bg-slate-700 transition-colors">
            📥 Export CSV
          </button>
          <button (click)="loadLeads()" class="btn-ghost h-10 text-sm flex items-center gap-1.5 px-4 border border-surface-border hover:bg-surface-border/50 transition-colors">
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- Table -->
      <div class="card p-0 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-surface border-b border-surface-border">
              <tr>
                <th class="table-header">Name</th>
                <th class="table-header">Headline</th>
                <th class="table-header">Company</th>
                <th class="table-header">Location</th>
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
                  <td class="table-cell text-slate-400">{{ lead.headline | truncate:40 }}</td>
                  <td class="table-cell">{{ lead.company || '—' }}</td>
                  <td class="table-cell text-slate-400">{{ lead.location | truncate:25 }}</td>
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
                    <select
                      [id]="'status-' + lead._id"
                      [value]="lead.status"
                      (change)="updateStatus(lead, $event)"
                      class="select w-36 text-xs py-1">
                      <option value="discovered">Discovered</option>
                      <option value="request_sent">Request Sent</option>
                      <option value="connected">Connected</option>
                      <option value="messaged">Messaged</option>
                      <option value="replied">Replied</option>
                      <option value="ignored">Ignored</option>
                    </select>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="py-12 text-center text-slate-500">
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

  constructor(private api: ApiService, private auth: AuthService) {}

  ngOnInit() { this.loadLeads(); }

  loadLeads() {
    this.loading.set(true);
    const params: Record<string, string | number> = { page: this.currentPage(), limit: 20 };
    if (this.searchQuery) params['search'] = this.searchQuery;
    if (this.statusFilter) params['status'] = this.statusFilter;

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
