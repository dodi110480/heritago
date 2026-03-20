import { Component, Input, Output, EventEmitter, ViewEncapsulation, inject, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { AppSearchInputComponent } from './app-search-input';
import { AppIconComponent } from './app-icon';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, RouterLink, AppSearchInputComponent, AppIconComponent],
  template: `
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4" [class.mb-8]="!flat" [class.mb-4]="flat">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-2 text-neutral-500 text-[10px] font-bold uppercase tracking-widest [&_a]:transition-colors [&_a]:hover:text-brand-600 [&_svg]:mr-1.5 line-clamp-1">
          <ng-content select="[breadcrumbs]"></ng-content>
          
          @if (breadcrumbs().length > 0) {
            @for (bc of breadcrumbs(); track bc.url; let i = $index) {
              @if (i > 0) { <span class="mx-1.5 opacity-40 font-black"><</span> }
              <a [routerLink]="bc.url" class="flex items-center flex-shrink-0">
                @if (i === 0) {
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                }
                {{ bc.label }}
              </a>
            }
          }
        </div>
        <h1 class="font-bold text-neutral-900 tracking-tight transition-all" 
            [class.text-3xl]="!flat" [class.text-xl]="flat">
          {{ title }}
        </h1>
        <p *ngIf="description" class="mt-1 text-neutral-800 dark:text-neutral-200 text-sm truncate">
          {{ description }}
        </p>
      </div>

      <!-- Header Search & Sort -->
      <div *ngIf="showSearch || showSort" class="flex-1 flex flex-col sm:flex-row items-center gap-3 max-w-2xl w-full md:mx-4">
        
        <div *ngIf="showSearch" class="flex-1 w-full">
          <app-search-input 
              [placeholder]="searchPlaceholder" 
              [(value)]="searchTerm"
              [fullWidth]="true">
          </app-search-input>
        </div>

        <div *ngIf="showSort" class="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
          <select 
              class="glass-card !px-3 !py-2.5 !rounded-2xl text-neutral-900 dark:text-neutral-100 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 transition-all min-w-[160px] flex-1 sm:flex-none"
              [ngModel]="sortValue()" (ngModelChange)="sortValue.set($event)">
            <option *ngFor="let opt of sortOptions" [value]="opt.value" class="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
              {{ opt.label }}
            </option>
          </select>
          
          <button *ngIf="showSortDirection"
              class="flex items-center justify-center p-2 text-neutral-500 hover:text-brand-600 transition-colors shrink-0"
              (click)="sortDirection.set(sortDirection() === 'asc' ? 'desc' : 'asc')"
              [attr.title]="sortDirection() === 'asc' ? 'Aufsteigend' : 'Absteigend'">
            <app-icon *ngIf="sortDirection() === 'asc'" name="sort-asc" folder="ui" size="1.1rem"></app-icon>
            <app-icon *ngIf="sortDirection() === 'desc'" name="sort-desc" folder="ui" size="1.1rem"></app-icon>
          </button>
        </div>

      </div>

      <div class="flex items-center gap-3 shrink-0">
        <ng-content select="[actions]"></ng-content>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None
})
export class AppPageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() description?: string;
  @Input() flat: boolean = false;
  
  // Search Integration
  @Input() showSearch: boolean = false;
  @Input() searchPlaceholder: string = 'Suchen...';
  searchTerm = model<string>('');

  // Sort Integration
  @Input() showSort: boolean = false;
  @Input() showSortDirection: boolean = false;
  @Input() sortOptions: { label: string, value: string }[] = [];
  sortValue = model<string>('');
  sortDirection = model<'asc' | 'desc'>('asc');

  private bcService = inject(BreadcrumbService);
  breadcrumbs = this.bcService.breadcrumbs;
}
