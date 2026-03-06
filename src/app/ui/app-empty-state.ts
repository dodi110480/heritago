import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="py-12 px-6 flex flex-col items-center justify-center border-2 border-dashed border-ui-border/20 rounded-3xl text-center bg-ui-card/5 backdrop-blur-sm group hover:border-brand-500/30 transition-all duration-300">
      <div class="w-20 h-20 bg-brand-500/5 rounded-full flex items-center justify-center mb-6 text-4xl group-hover:scale-110 group-hover:bg-brand-500/10 transition-all duration-500">
        <span class="opacity-40 group-hover:opacity-100 transition-opacity">{{ icon }}</span>
      </div>
      <h3 class="text-lg font-bold text-canvas-white mb-2 tracking-tight">{{ title }}</h3>
      <p class="text-neutral-400 text-sm max-w-xs leading-relaxed">{{ message }}</p>
      
      <div class="mt-8 flex items-center gap-3">
        <ng-content select="[actions]"></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
  `]
})
export class AppEmptyStateComponent {
  @Input() icon: string = '📂';
  @Input() title: string = 'Keine Daten vorhanden';
  @Input() message: string = 'Es wurden noch keine Einträge für diesen Bereich angelegt.';
}
