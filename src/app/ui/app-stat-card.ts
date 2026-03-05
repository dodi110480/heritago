import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export type StatCardAccent = 'brand' | 'purple' | 'emerald' | 'amber';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="group relative glass-card flex flex-col shadow-xl overflow-hidden transition-all duration-300"
      [ngClass]="accentClasses()">
      <div class="text-3xl md:text-5xl font-black mb-2 leading-none" [ngClass]="valueClasses()">
        {{ value }}
      </div>
      <div class="text-neutral-400 text-sm md:text-base font-semibold tracking-wide uppercase">{{ label }}</div>

      <div *ngIf="icon" class="absolute right-6 top-6 text-4xl opacity-10 group-hover:opacity-20 transition-opacity">
        {{ icon }}
      </div>

      <ng-content></ng-content>
    </div>
  `
})
export class AppStatCardComponent {
  @Input({ required: true }) value: string | number = '';
  @Input({ required: true }) label = '';
  @Input() icon?: string;
  @Input() accent: StatCardAccent = 'brand';

  accentClasses(): string {
    const map: Record<StatCardAccent, string> = {
      brand: 'hover:border-brand-500/30',
      purple: 'hover:border-accent-highlight-500/30',
      emerald: 'hover:border-emerald-500/30',
      amber: 'hover:border-amber-500/30'
    };
    return map[this.accent];
  }

  valueClasses(): string {
    const map: Record<StatCardAccent, string> = {
      brand: 'text-brand-400',
      purple: 'text-accent-highlight-400',
      emerald: 'text-emerald-400',
      amber: 'text-amber-400'
    };
    return map[this.accent];
  }
}
