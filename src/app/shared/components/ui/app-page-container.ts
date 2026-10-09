import { Component, Input, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mx-auto pb-20 transition-all duration-300"
         [ngClass]="wide ? 'max-w-none px-4 md:px-8' : 'max-w-7xl px-4 md:px-12'">
      <ng-content></ng-content>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  encapsulation: ViewEncapsulation.None
})
export class AppPageContainerComponent {
  @Input() wide: boolean = false;
}
