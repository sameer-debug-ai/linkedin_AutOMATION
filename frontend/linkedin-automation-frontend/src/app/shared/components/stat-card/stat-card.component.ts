import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="stat-card animate-fade-in">
      <div class="flex items-center justify-between">
        <span class="text-2xl">{{ icon }}</span>
        <span class="text-xs font-medium px-2 py-0.5 rounded-full"
              [ngClass]="trendClass">
          {{ trend }}
        </span>
      </div>
      <div class="mt-2">
        <p class="text-3xl font-bold text-slate-100">{{ value }}</p>
        <p class="text-sm text-slate-500 mt-0.5">{{ label }}</p>
      </div>
      <div class="h-1 rounded-full mt-3 overflow-hidden bg-surface-border">
        <div class="h-full rounded-full transition-all duration-700"
             [style.width.%]="progress"
             [ngClass]="progressClass"></div>
      </div>
    </div>
  `,
})
export class StatCardComponent {
  @Input() label = '';
  @Input() value: string | number = 0;
  @Input() icon = '📊';
  @Input() trend = '';
  @Input() progress = 0;
  @Input() color: 'blue' | 'green' | 'yellow' | 'red' = 'blue';

  get trendClass() {
    return {
      'bg-emerald-900/50 text-emerald-400': this.color === 'green',
      'bg-blue-900/50 text-blue-400': this.color === 'blue',
      'bg-yellow-900/50 text-yellow-400': this.color === 'yellow',
      'bg-red-900/50 text-red-400': this.color === 'red',
    };
  }
  get progressClass() {
    return {
      'bg-brand-500': this.color === 'blue',
      'bg-emerald-500': this.color === 'green',
      'bg-yellow-500': this.color === 'yellow',
      'bg-red-500': this.color === 'red',
    };
  }
}
