import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

interface Template {
  _id: string;
  name: string;
  type: 'connection_note' | 'direct_message' | 'inmail';
  subject: string;
  body: string;
  isDefault: boolean;
  usageCount: number;
  createdAt: string;
}

@Component({
  selector: 'app-template-list',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-4 animate-fade-in">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-100">Templates</h1>
          <p class="text-slate-500 text-sm mt-0.5">Manage your personalized outreach messages</p>
        </div>
        <button id="new-template-btn" (click)="openEditor(null)" class="btn-primary">+ New Template</button>
      </div>

      <!-- Template Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        @for (t of templates(); track t._id) {
          <div class="card hover:border-brand-600/40 transition-colors">
            <div class="flex items-start justify-between mb-3">
              <div>
                <h3 class="font-semibold text-slate-100">{{ t.name }}</h3>
                <div class="flex items-center gap-2 mt-1">
                  <span class="badge badge-blue">{{ t.type.replace('_', ' ') }}</span>
                  @if (t.isDefault) { <span class="badge badge-green">Default</span> }
                </div>
              </div>
              <div class="flex gap-1">
                <button (click)="openEditor(t)" class="btn-icon" title="Edit">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button (click)="deleteTemplate(t._id)" class="btn-icon text-red-400 hover:text-red-300" title="Delete">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </div>

            <p class="text-sm text-slate-400 line-clamp-3">{{ t.body }}</p>

            <div class="flex items-center justify-between mt-3 pt-3 border-t border-surface-border text-xs text-slate-500">
              <span>Used {{ t.usageCount }} times</span>
              <button (click)="previewTemplate(t)" class="hover:text-slate-300 transition-colors">Preview →</button>
            </div>
          </div>
        } @empty {
          <div class="col-span-2 card text-center py-12">
            <p class="text-slate-400 text-lg mb-2">No templates yet</p>
            <p class="text-slate-500 text-sm mb-4">Create your first outreach template to get started.</p>
            <button (click)="openEditor(null)" class="btn-primary">+ Create Template</button>
          </div>
        }
      </div>

      <!-- Editor Modal -->
      @if (showEditor()) {
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div class="bg-surface-card border border-surface-border rounded-2xl w-full max-w-2xl shadow-2xl">
            <!-- Modal Header -->
            <div class="flex items-center justify-between p-6 border-b border-surface-border">
              <h2 class="text-lg font-semibold text-slate-100">
                {{ editingTemplate()  ? 'Edit Template' : 'New Template' }}
              </h2>
              <button (click)="closeEditor()" class="btn-icon">✕</button>
            </div>

            <!-- Form -->
            <div class="p-6 space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <label for="tpl-name" class="label">Template Name</label>
                  <input id="tpl-name" type="text" [(ngModel)]="form.name" class="input" placeholder="e.g. Agency Outreach v2"/>
                </div>
                <div>
                  <label for="tpl-type" class="label">Type</label>
                  <select id="tpl-type" [(ngModel)]="form.type" class="select">
                    <option value="connection_note">Connection Note</option>
                    <option value="direct_message">Direct Message</option>
                    <option value="inmail">InMail</option>
                  </select>
                </div>
                <div class="flex items-center gap-3 mt-5">
                  <input id="tpl-default" type="checkbox" [(ngModel)]="form.isDefault" class="w-4 h-4 rounded"/>
                  <label for="tpl-default" class="text-sm text-slate-300 cursor-pointer">Set as default</label>
                </div>
                @if (form.type === 'inmail') {
                  <div class="col-span-2">
                    <label for="tpl-subject" class="label">Subject</label>
                    <input id="tpl-subject" type="text" [(ngModel)]="form.subject" class="input" placeholder="InMail subject line"/>
                  </div>
                }
                <div class="col-span-2">
                  <label for="tpl-body" class="label">
                    Message Body
                    <span class="text-slate-500 ml-2 font-normal">{{ variableHint }}</span>
                  </label>
                  <textarea id="tpl-body" [(ngModel)]="form.body" rows="6" class="textarea" [placeholder]="bodyPlaceholder"></textarea>
                  <p class="text-xs text-slate-500 mt-1">{{ form.body.length }}/300 chars for connection notes</p>
                </div>
              </div>

              <!-- Preview -->
              @if (previewText()) {
                <div class="bg-surface rounded-lg p-4 border border-surface-border">
                  <p class="text-xs font-medium text-slate-400 mb-2">Preview:</p>
                  <p class="text-sm text-slate-300 whitespace-pre-line">{{ previewText() }}</p>
                </div>
              }
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between p-6 border-t border-surface-border">
              <button (click)="generatePreview()" class="btn-ghost text-sm">👁 Preview</button>
              <div class="flex gap-3">
                <button (click)="closeEditor()" class="btn-secondary">Cancel</button>
                <button id="save-template-btn" (click)="saveTemplate()" [disabled]="!form.name || !form.body" class="btn-primary">
                  {{ saving() ? 'Saving...' : 'Save Template' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Preview Modal -->
      @if (previewModal()) {
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div class="bg-surface-card border border-surface-border rounded-2xl w-full max-w-lg p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="font-semibold text-slate-100">Template Preview</h3>
              <button (click)="previewModal.set(null)" class="btn-icon">✕</button>
            </div>
            <div class="bg-surface rounded-lg p-4 border border-surface-border">
              <p class="text-sm text-slate-300 whitespace-pre-line">{{ previewModal() }}</p>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class TemplateListComponent implements OnInit {
  templates       = signal<Template[]>([]);
  showEditor      = signal(false);
  editingTemplate = signal<Template | null>(null);
  saving          = signal(false);
  previewText     = signal('');
  previewModal    = signal<string | null>(null);

  form = { name: '', type: 'connection_note' as Template['type'], subject: '', body: '', isDefault: false };
  readonly variableHint = 'Use: {{firstName}}, {{company}}, {{headline}}';
  readonly bodyPlaceholder = 'Hi {{firstName}}, I noticed your work at {{company}}...';

  constructor(private api: ApiService) {}

  ngOnInit() { this.loadTemplates(); }

  loadTemplates() {
    this.api.get<{ data: Template[] }>('/templates').subscribe((r) => this.templates.set(r.data));
  }

  openEditor(t: Template | null) {
    this.editingTemplate.set(t);
    this.form = t
      ? { name: t.name, type: t.type, subject: t.subject, body: t.body, isDefault: t.isDefault }
      : { name: '', type: 'connection_note', subject: '', body: '', isDefault: false };
    this.previewText.set('');
    this.showEditor.set(true);
  }

  closeEditor() { this.showEditor.set(false); this.editingTemplate.set(null); }

  generatePreview() {
    const rendered = this.form.body
      .replace(/{{firstName}}/g, 'Alex')
      .replace(/{{company}}/g, 'Acme Corp')
      .replace(/{{headline}}/g, 'Software Engineer');
    this.previewText.set(rendered);
  }

  saveTemplate() {
    if (!this.form.name || !this.form.body) return;
    this.saving.set(true);
    const t = this.editingTemplate();
    const req = t
      ? this.api.put<{ data: Template }>(`/templates/${t._id}`, this.form)
      : this.api.post<{ data: Template }>('/templates', this.form);

    req.subscribe({
      next: () => { this.saving.set(false); this.closeEditor(); this.loadTemplates(); },
      error: () => this.saving.set(false),
    });
  }

  deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return;
    this.api.delete<void>(`/templates/${id}`).subscribe(() => this.loadTemplates());
  }

  previewTemplate(t: Template) {
    const rendered = t.body
      .replace(/{{firstName}}/g, 'Alex')
      .replace(/{{company}}/g, 'Acme Corp')
      .replace(/{{headline}}/g, 'Software Engineer');
    this.previewModal.set(rendered);
  }
}
