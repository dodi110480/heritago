import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-section-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex justify-between items-center mb-6 group/header">
      <div class="flex items-center gap-4">
        <div *ngIf="icon" class="w-12 h-12 rounded-2xl bg-brand-500/5 flex items-center justify-center text-2xl border border-brand-500/10 group-hover/header:bg-brand-500/10 transition-all duration-300">
          {{ icon }}
        </div>
        <div [class.pl-4]="!icon && accent" [class.border-l-4]="!icon && accent" [class.border-l-brand-500]="!icon && accent">
          <h2 class="text-xl font-bold text-canvas-white tracking-tight group-hover/header:text-brand-400 transition-colors duration-300">{{ title }}</h2>
          <p *ngIf="description" class="text-sm text-neutral-400 mt-1 leading-relaxed">{{ description }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <ng-content select="[actions]"></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
  `]
})
export class AppSectionHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() description?: string;
  @Input() icon?: string;
  @Input() accent: boolean = true;
}
