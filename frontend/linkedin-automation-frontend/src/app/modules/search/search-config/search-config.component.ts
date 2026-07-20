import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LeadsTableComponent } from '../leads-table/leads-table.component';
import { ApiService } from '../../../core/services/api.service';

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
  imports: [FormsModule, LeadsTableComponent],
  template: `
    <div class="space-y-6 animate-fade-in">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-slate-100">Search & Leads</h1>
        <p class="text-slate-500 text-sm mt-0.5">Configure search parameters and view discovered leads</p>
      </div>

      <!-- Search Config Card -->
      <div class="card">
        <h3 class="text-base font-semibold text-slate-200 mb-5">Search Configuration</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label for="sc-keywords" class="label">Keywords (comma-separated)</label>
            <input id="sc-keywords" type="text" [(ngModel)]="config.keywords"
              placeholder="e.g. Software Engineer, Product Manager"
              class="input" />
            <p class="text-xs text-slate-500 mt-1">Separate multiple keywords with commas</p>
          </div>

          <div>
            <label for="sc-location" class="label">Location</label>
            <input id="sc-location" type="text" [(ngModel)]="config.location"
              placeholder="e.g. San Francisco, CA"
              class="input" />
          </div>

          <div>
            <label for="sc-target" class="label">Target Count</label>
            <input id="sc-target" type="number" [(ngModel)]="config.targetCount"
              min="5" max="100" class="input" />
            <p class="text-xs text-slate-500 mt-1">Max 100 per job run</p>
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
            class="btn-primary">
            {{ submitting() ? '⏳ Starting...' : '🚀 Start Automation Job' }}
          </button>
          @if (message()) {
            <span class="text-sm" [class]="messageError() ? 'text-red-400' : 'text-emerald-400'">
              {{ message() }}
            </span>
          }
        </div>
      </div>

      <!-- Leads Table -->
      <app-leads-table />
    </div>
  `,
})
export class SearchConfigComponent {
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

  constructor(private api: ApiService) {
    this.api.get<{ data: Template[] }>('/templates').subscribe((r) => this.templates.set(r.data));
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
      templateId: this.config.templateId,
      actionType: this.config.actionType,
    };

    this.api.post<{ success: boolean; message: string }>('/automation/start', payload).subscribe({
      next: (r) => {
        this.submitting.set(false);
        this.message.set(r.message || 'Job started successfully!');
        this.messageError.set(false);
      },
      error: (err) => {
        this.submitting.set(false);
        this.message.set(err?.error?.error || 'Failed to start job. Check your config.');
        this.messageError.set(true);
      },
    });
  }
}
