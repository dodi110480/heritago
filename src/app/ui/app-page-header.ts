import { Component, Input, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BreadcrumbService } from '../breadcrumb.service';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4" [class.mb-8]="!flat" [class.mb-4]="flat">
      <div class="flex-1">
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
        <p *ngIf="description" class="mt-1 text-neutral-800 dark:text-neutral-200 text-sm">
          {{ description }}
        </p>
      </div>
      <div class="flex items-center gap-3">
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

  private bcService = inject(BreadcrumbService);
  breadcrumbs = this.bcService.breadcrumbs;
}
