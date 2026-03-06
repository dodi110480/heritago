import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="glass-card shadow-2xl transition-all duration-300 overflow-hidden"
      [ngClass]="customClass"
    >
      <div *ngIf="title" class="px-8 pt-8 pb-4 border-b border-neutral-300/50">
        <h2 class="text-xl font-bold text-neutral-900">{{ title }}</h2>
      </div>
      <div [ngClass]="contentClass">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None
})
export class AppCardComponent {
  @Input() title?: string;
  @Input() customClass: string = '';
  @Input() contentClass: string = 'p-8';
}
