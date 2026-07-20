import { Component, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LeadsTableComponent, Lead } from '../leads-table/leads-table.component';
import { ApiService } from '../../../core/services/api.service';
import { TruncatePipe } from '../../../shared/pipes/truncate.pipe';

interface SearchConfig {
  keywords: string;
  location: string;
  targetCount: number;
  templateId: string;
  actionType: 'connect' | 'message' | 'both';
}

interface Template { _id: string; name: string; type: string; }

@Component({
  selector: 'app-search-config',
  standalone: true,
  imports: [FormsModule, LeadsTableComponent, TruncatePipe],
  template: `
    <div class="space-y-6 animate-fade-in">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-slate-100">Search & Bulk Lead Outreach</h1>
        <p class="text-slate-500 text-sm mt-0.5">Discover prospects live on LinkedIn and dispatch bulk connection requests in 1 click</p>
      </div>

      <!-- Search Config Card -->
      <div class="card">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h3 class="text-base font-semibold text-slate-200">Search Configuration</h3>
          <!-- Presets -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs text-slate-400 font-medium">Quick Presets:</span>
            <button (click)="applyPreset('Founder, CEO, Co-Founder', 'United States')" 
              class="px-2.5 py-1 text-xs rounded-full bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 transition-all">
              🚀 SaaS Founders
            </button>
            <button (click)="applyPreset('Agency Owner, Managing Director', 'United Kingdom')" 
              class="px-2.5 py-1 text-xs rounded-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition-all">
              💼 Agency Owners
            </button>
            <button (click)="applyPreset('Head of E-Commerce, Marketing Director', 'United States')" 
              class="px-2.5 py-1 text-xs rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all">
              🛒 E-Commerce Heads
            </button>
            <button (click)="applyPreset('Tech Recruiter, Talent Acquisition Lead', 'India')" 
              class="px-2.5 py-1 text-xs rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all">
              🎯 Tech Recruiters
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label for="sc-keywords" class="label">Keywords (comma-separated)</label>
            <input id="sc-keywords" type="text" [(ngModel)]="config.keywords"
              placeholder="e.g. Agency Owner, Managing Director"
              class="input" />
            <p class="text-xs text-slate-500 mt-1">Separate multiple keywords with commas</p>
          </div>

          <div>
            <label for="sc-location" class="label">Location</label>
            <input id="sc-location" type="text" [(ngModel)]="config.location"
              placeholder="e.g. India, United States"
              class="input" />
          </div>

          <div>
            <label for="sc-target" class="label">Target Count</label>
            <input id="sc-target" type="number" [(ngModel)]="config.targetCount"
              min="5" max="100" class="input" />
            <p class="text-xs text-slate-500 mt-1">Number of prospects to fetch</p>
          </div>

          <div>
            <label for="sc-action" class="label">Action Type</label>
            <select id="sc-action" [(ngModel)]="config.actionType" class="select">
              <option value="connect">Connection Request Only</option>
              <option value="message">Direct Message Only</option>
              <option value="both">Connect + Message</option>
            </select>
          </div>

          <div class="md:col-span-2">
            <label for="sc-template" class="label">Message Template</label>
            <select id="sc-template" [(ngModel)]="config.templateId" class="select">
              <option value="">— Select a template —</option>
              @for (t of templates(); track t._id) {
                <option [value]="t._id">{{ t.name }} ({{ t.type.replace('_', ' ') }})</option>
              }
            </select>
          </div>
        </div>

        <div class="mt-6 flex items-center gap-3">
          <button
            id="start-search-job"
            (click)="startJob()"
            [disabled]="!isValid() || submitting()"
            class="btn-primary flex items-center gap-2">
            @if (submitting()) {
              <span class="animate-spin">⏳</span> Searching LinkedIn...
            } @else {
              🔍 Start Automation Job (Fetch Clients)
            }
          </button>
          @if (message()) {
            <span class="text-sm" [class]="messageError() ? 'text-red-400' : 'text-emerald-400'">
              {{ message() }}
            </span>
          }
        </div>
      </div>

      <!-- Discovered Clients Modal -->
      @if (showDiscoveredModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div class="card max-w-4xl w-full p-6 space-y-5 bg-surface-card border border-surface-border shadow-2xl rounded-2xl max-h-[85vh] flex flex-col">
            <!-- Modal Header -->
            <div class="flex items-start justify-between border-b border-surface-border pb-4">
              <div>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  🎯 LinkedIn Clients Discovered
                </span>
                <h3 class="text-xl font-bold text-slate-100 mt-1">Discovered {{ discoveredLeads().length }} Prospects</h3>
                <p class="text-xs text-slate-400 mt-0.5">Select clients below and click Send Bulk Requests to connect with all at once</p>
              </div>
              <button (click)="closeDiscoveredModal()" class="text-slate-400 hover:text-slate-200 text-lg font-semibold px-2">✕</button>
            </div>

            <!-- Table of Discovered Leads -->
            <div class="overflow-y-auto flex-1 rounded-xl border border-surface-border">
              <table class="w-full">
                <thead class="bg-surface sticky top-0 border-b border-surface-border z-10">
                  <tr>
                    <th class="table-header w-10 text-center">
                      <input type="checkbox" [checked]="isAllModalSelected()" (change)="toggleSelectAllModal($event)" class="rounded border-slate-700 bg-slate-900 text-brand-500 focus:ring-brand-500" />
                    </th>
                    <th class="table-header">Name</th>
                    <th class="table-header">Headline</th>
                    <th class="table-header">Company</th>
                    <th class="table-header">Match Score</th>
                    <th class="table-header">Degree</th>
                  </tr>
                </thead>
                <tbody>
                  @for (lead of discoveredLeads(); track lead._id) {
                    <tr class="table-row">
                      <td class="table-cell text-center">
                        <input type="checkbox" [checked]="selectedModalIds().has(lead._id)" (change)="toggleSelectModal(lead._id)" class="rounded border-slate-700 bg-slate-900 text-brand-500 focus:ring-brand-500" />
                      </td>
                      <td class="table-cell font-medium text-slate-100">
                        <a [href]="lead.linkedinProfileUrl" target="_blank" rel="noopener" class="hover:text-brand-400 transition-colors">
                          {{ lead.name }}
                        </a>
                      </td>
                      <td class="table-cell text-slate-400 text-xs">{{ lead.headline | truncate:40 }}</td>
                      <td class="table-cell text-xs">{{ lead.company || '—' }}</td>
                      <td class="table-cell">
                        @if (lead.matchLevel === 'high') {
                          <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            🔥 {{ lead.leadScore || 90 }}% High
                          </span>
                        } @else if (lead.matchLevel === 'medium') {
                          <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            ⚡ {{ lead.leadScore || 75 }}% Med
                          </span>
                        } @else {
                          <span class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-700/50 text-slate-400">
                            {{ lead.leadScore || 50 }}% Basic
                          </span>
                        }
                      </td>
                      <td class="table-cell text-slate-400 text-xs">{{ lead.connectionDegree }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Modal Footer -->
            <div class="flex items-center justify-between pt-3 border-t border-surface-border">
              <span class="text-xs text-slate-400 font-medium">
                {{ selectedModalIds().size }} of {{ discoveredLeads().length }} clients selected
              </span>
              <div class="flex items-center gap-3">
                <button (click)="closeDiscoveredModal()" class="btn-ghost text-xs px-4 py-2 border border-surface-border">Cancel</button>
                <button 
                  (click)="sendBulkFromModal()" 
                  [disabled]="selectedModalIds().size === 0 || sendingBulkModal()"
                  class="btn-primary bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 text-xs sm:text-sm flex items-center gap-2 px-5 rounded-xl shadow-lg border border-emerald-400/30">
                  @if (sendingBulkModal()) {
                    <span class="animate-spin">⚡</span> Sending Requests...
                  } @else {
                    🚀 Send Bulk Connection Requests ({{ selectedModalIds().size }})
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Main Leads Table (History) -->
      <app-leads-table #leadsTable />
    </div>
  `,
})
export class SearchConfigComponent {
  @ViewChild('leadsTable') leadsTableComponent?: LeadsTableComponent;

  config: SearchConfig = {
    keywords: '',
    location: '',
    targetCount: 20,
    templateId: '',
    actionType: 'connect',
  };

  templates  = signal<Template[]>([]);
  submitting = signal(false);
  message    = signal('');
  messageError = signal(false);

  showDiscoveredModal = signal(false);
  discoveredLeads     = signal<Lead[]>([]);
  selectedModalIds    = signal<Set<string>>(new Set());
  sendingBulkModal    = signal(false);

  constructor(private api: ApiService) {
    this.api.get<{ data: Template[] }>('/templates').subscribe((r) => this.templates.set(r.data));
  }

  applyPreset(keywords: string, location: string) {
    this.config.keywords = keywords;
    this.config.location = location;
  }

  isValid(): boolean {
    return !!(this.config.keywords.trim() && this.config.location.trim() && this.config.templateId);
  }

  startJob() {
    if (!this.isValid()) return;
    this.submitting.set(true);
    this.message.set('');

    const payload = {
      keywords: this.config.keywords.split(',').map((k) => k.trim()).filter(Boolean),
      location: this.config.location,
      targetCount: this.config.targetCount,
    };

    this.api.post<{ success: boolean; count: number; data: Lead[] }>('/automation/discover-clients', payload).subscribe({
      next: (r) => {
        this.submitting.set(false);
        this.discoveredLeads.set(r.data);
        const allIds = new Set(r.data.map((l) => l._id));
        this.selectedModalIds.set(allIds);
        this.showDiscoveredModal.set(true);
      },
      error: (err) => {
        this.submitting.set(false);
        const errorMsg = err?.error?.message || err?.error?.error || 'Failed to search LinkedIn. Make sure session is valid.';
        this.message.set(errorMsg);
        this.messageError.set(true);
      },
    });
  }

  closeDiscoveredModal() {
    this.showDiscoveredModal.set(false);
  }

  isAllModalSelected(): boolean {
    const list = this.discoveredLeads();
    return list.length > 0 && list.every((l) => this.selectedModalIds().has(l._id));
  }

  toggleSelectAllModal(evt: Event) {
    const checked = (evt.target as HTMLInputElement).checked;
    const current = new Set(this.selectedModalIds());
    if (checked) {
      this.discoveredLeads().forEach((l) => current.add(l._id));
    } else {
      this.discoveredLeads().forEach((l) => current.delete(l._id));
    }
    this.selectedModalIds.set(current);
  }

  toggleSelectModal(id: string) {
    const current = new Set(this.selectedModalIds());
    if (current.has(id)) current.delete(id);
    else current.add(id);
    this.selectedModalIds.set(current);
  }

  sendBulkFromModal() {
    const ids = Array.from(this.selectedModalIds());
    if (ids.length === 0 || !this.config.templateId) return;

    this.sendingBulkModal.set(true);
    this.api.post<{ success: boolean; message: string }>('/automation/bulk-start', {
      leadIds: ids,
      templateId: this.config.templateId,
    }).subscribe({
      next: (res) => {
        this.sendingBulkModal.set(false);
        this.showDiscoveredModal.set(false);
        this.message.set(`🚀 ${res.message} Direct high-speed connection requests started!`);
        this.messageError.set(false);
        this.leadsTableComponent?.loadLeads();
      },
      error: (err) => {
        this.sendingBulkModal.set(false);
        this.message.set(err?.error?.message || 'Failed to dispatch bulk requests.');
        this.messageError.set(true);
      },
    });
  }
}
