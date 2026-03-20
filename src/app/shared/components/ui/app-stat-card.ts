import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export type StatCardAccent = 'brand' | 'purple' | 'emerald' | 'amber';

import { AppIconComponent } from './app-icon';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  template: `
    <div class="group relative glass-card flex flex-col shadow-lg overflow-hidden transition-all duration-300 cursor-pointer !p-5 border-transparent"
      [ngClass]="accentClasses()">
      <div class="text-2xl md:text-4xl font-black mb-1 leading-none tracking-tight" [ngClass]="valueClasses()">
        {{ value }}
      </div>
      <div class="text-slate-800/80 dark:text-slate-300/80 text-[10px] font-bold tracking-widest uppercase">{{ label }}</div>

      <div *ngIf="icon" class="absolute right-6 top-6 transition-all duration-300 opacity-80 group-hover:opacity-40 group-hover:scale-110">
        <app-icon [name]="icon" size="3rem" [class]="valueClasses()"></app-icon>
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
      brand: 'hover:border-brand-500/40',
      purple: 'hover:border-accent-violet-500/40',
      emerald: 'hover:border-accent-success-500/40',
      amber: 'hover:border-accent-highlight-500/40' // maps to gold
    };
    return map[this.accent];
  }

  valueClasses(): string {
    const map: Record<StatCardAccent, string> = {
      brand: 'text-brand-700 dark:text-brand-300',
      purple: 'text-accent-violet-700 dark:text-accent-violet-300',
      emerald: 'text-accent-success-700 dark:text-accent-success-300',
      amber: 'text-accent-highlight-700 dark:text-accent-highlight-300'
    };
    return map[this.accent];
  }
}
