import { Component, OnInit, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

interface AnalyticsSummary {
  totalLeads: number;
  todaySent: number;
  totalReplied: number;
  conversionRate: string;
  byStatus: Record<string, number>;
}

interface DailyTrend {
  date: string;
  connects: number;
  messages: number;
  replies: number;
}

interface ConversionRate {
  templateName: string;
  sent: number;
  replied: number;
  rate: number;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [],
  template: `
    <div class="space-y-6 animate-fade-in">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-slate-100">Analytics</h1>
        <p class="text-slate-500 text-sm mt-0.5">Performance insights for your outreach campaigns</p>
      </div>

      <!-- Summary Cards -->
      @if (summary()) {
        <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div class="card text-center">
            <p class="text-3xl font-bold text-brand-400">{{ summary()!.totalLeads }}</p>
            <p class="text-sm text-slate-400 mt-1">Total Leads</p>
          </div>
          <div class="card text-center">
            <p class="text-3xl font-bold text-emerald-400">{{ summary()!.totalReplied }}</p>
            <p class="text-sm text-slate-400 mt-1">Replies Received</p>
          </div>
          <div class="card text-center">
            <p class="text-3xl font-bold text-yellow-400">{{ summary()!.conversionRate }}%</p>
            <p class="text-sm text-slate-400 mt-1">Reply Rate</p>
          </div>
          <div class="card text-center">
            <p class="text-3xl font-bold text-slate-100">{{ summary()!.todaySent }}</p>
            <p class="text-sm text-slate-400 mt-1">Sent Today</p>
          </div>
        </div>
      }

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Daily Trend Chart (Bar) -->
        <div class="card">
          <h3 class="font-semibold text-slate-200 mb-5">Daily Activity (Last 14 Days)</h3>
          @if (dailyTrend().length) {
            <div class="flex items-end gap-2 h-40">
              @for (day of dailyTrend(); track day.date) {
                <div class="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <div class="w-full flex flex-col-reverse gap-0.5">
                    <!-- Replies -->
                    <div class="w-full bg-emerald-500/70 rounded-sm transition-all duration-500"
                         [style.height.px]="barHeight(day.replies)"></div>
                    <!-- Messages -->
                    <div class="w-full bg-yellow-500/70 rounded-sm transition-all duration-500"
                         [style.height.px]="barHeight(day.messages)"></div>
                    <!-- Connects -->
                    <div class="w-full bg-brand-500/70 rounded-sm transition-all duration-500"
                         [style.height.px]="barHeight(day.connects)"></div>
                  </div>
                  <span class="text-[9px] text-slate-600 truncate">{{ formatDate(day.date) }}</span>
                </div>
              }
            </div>
            <!-- Legend -->
            <div class="flex gap-4 mt-3 text-xs text-slate-500">
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-brand-500/70 inline-block"></span>Connects</span>
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-yellow-500/70 inline-block"></span>Messages</span>
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-emerald-500/70 inline-block"></span>Replies</span>
            </div>
          } @else {
            <p class="text-slate-500 text-sm text-center py-8">No data yet. Run some automation jobs first.</p>
          }
        </div>

        <!-- Template Conversion -->
        <div class="card">
          <h3 class="font-semibold text-slate-200 mb-5">Template Performance</h3>
          @if (conversionRates().length) {
            <div class="space-y-4">
              @for (t of conversionRates(); track t.templateName) {
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span class="text-slate-300 truncate max-w-[60%]">{{ t.templateName }}</span>
                    <span class="text-slate-400">{{ t.sent }} sent · <span class="text-emerald-400">{{ t.rate.toFixed(1) }}%</span></span>
                  </div>
                  <div class="h-2 bg-surface rounded-full overflow-hidden">
                    <div class="h-full bg-emerald-500 rounded-full transition-all duration-700"
                         [style.width.%]="t.rate"></div>
                  </div>
                </div>
              }
            </div>
          } @else {
            <p class="text-slate-500 text-sm text-center py-8">No template data available yet.</p>
          }
        </div>
      </div>

      <!-- Status Breakdown -->
      @if (summary()?.byStatus) {
        <div class="card">
          <h3 class="font-semibold text-slate-200 mb-5">Lead Status Breakdown</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
            @for (entry of statusEntries(); track entry.key) {
              <div class="bg-surface rounded-lg p-4">
                <p class="text-2xl font-bold text-slate-100">{{ entry.value }}</p>
                <p class="text-xs text-slate-400 mt-1 capitalize">{{ entry.key.replace('_', ' ') }}</p>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class AnalyticsComponent implements OnInit {
  summary       = signal<AnalyticsSummary | null>(null);
  dailyTrend    = signal<DailyTrend[]>([]);
  conversionRates = signal<ConversionRate[]>([]);

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.get<{ data: AnalyticsSummary }>('/analytics/summary')
      .subscribe((r) => this.summary.set(r.data));
    this.api.get<{ data: DailyTrend[] }>('/analytics/daily-trend')
      .subscribe((r) => this.dailyTrend.set(r.data.slice(-14)));
    this.api.get<{ data: ConversionRate[] }>('/analytics/conversion-rate')
      .subscribe((r) => this.conversionRates.set(r.data));
  }

  maxDailyCount(): number {
    const vals = this.dailyTrend().map((d) => d.connects + d.messages + d.replies);
    return Math.max(...vals, 1);
  }

  barHeight(count: number): number {
    return Math.round((count / this.maxDailyCount()) * 120);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  statusEntries(): { key: string; value: number }[] {
    const s = this.summary()?.byStatus ?? {};
    return Object.entries(s).map(([key, value]) => ({ key, value }));
  }
}
