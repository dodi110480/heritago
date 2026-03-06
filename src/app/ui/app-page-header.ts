import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div class="flex-1">
        <ng-content select="[breadcrumbs]"></ng-content>
        <h1 class="text-3xl font-bold text-neutral-900 tracking-tight transition-all">
          {{ title }}
        </h1>
        <p *ngIf="description" class="mt-1 text-neutral-950 text-sm">
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
}
