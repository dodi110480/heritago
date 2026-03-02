import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mx-auto px-4 md:px-12 pb-20 transition-all duration-300"
         [ngClass]="wide ? 'max-w-[1400px]' : 'max-w-6xl'">
      <ng-content></ng-content>
    </div>
  `,
  encapsulation: ViewEncapsulation.None
})
export class AppPageContainerComponent {
  @Input() wide: boolean = false;
}
