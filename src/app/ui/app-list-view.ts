import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-list-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-full overflow-y-visible pb-10">
      <!-- Loading State -->
      <div *ngIf="isLoading" class="py-20 flex flex-col items-center justify-center gap-4 text-brand-400">
        <div class="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin shadow-brand-glow"></div>
        <p class="font-bold tracking-widest uppercase text-xs animate-pulse">{{ loadingText }}</p>
      </div>

      <!-- Empty State -->
      <div *ngIf="!isLoading && isEmpty" class="py-32 flex flex-col items-center justify-center text-neutral-950 glass-card">
        <div class="w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center mb-6 text-4xl opacity-50">
          {{ emptyIcon }}
        </div>
        <h3 class="text-xl font-bold text-neutral-900 mb-2">{{ emptyTitle }}</h3>
        <p class="text-neutral-950 text-center max-w-md">{{ emptySubtitle }}</p>
        <ng-content select="[empty-actions]"></ng-content>
      </div>

      <!-- Content Grid -->
      <div [style.display]="(isLoading || isEmpty) ? 'none' : ''" 
           class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None
})
export class AppListViewComponent {
  @Input() isLoading: boolean = false;
  @Input() isEmpty: boolean = false;
  
  @Input() loadingText: string = 'Lade Daten...';
  
  @Input() emptyIcon: string = '📂';
  @Input() emptyTitle: string = 'Keine Einträge gefunden';
  @Input() emptySubtitle: string = 'Passe deine Suche an oder erstelle einen neuen Eintrag.';
}
