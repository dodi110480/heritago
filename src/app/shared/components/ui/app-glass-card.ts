import { Component, Input, Output, EventEmitter, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-glass-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="glass-card flex flex-col transition-all duration-300 relative group overflow-hidden"
      [class.cursor-pointer]="clickable"
      [class.hover-lift]="clickable"
      [style.border-left-color]="borderColor"
      [style.border-left-width]="borderColor ? '4px' : null"
      (click)="onClick($event)"
    >
      <!-- Background Glow (optional, based on design) -->
      <div class="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
      
      <!-- Top Action Bar (Absolute or relative depending on design, here we allow content projection) -->
      <div class="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <ng-content select="[actions]"></ng-content>
      </div>

      <!-- Main Content -->
      <div class="relative flex-1">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
  `],
  encapsulation: ViewEncapsulation.None
})
export class GlassCardComponent {
  @Input() variant: 'default' | 'note' | 'stat' = 'default';
  @Input() borderColor?: string;
  @Input() clickable: boolean = false;
  
  @Output() cardClicked = new EventEmitter<MouseEvent>();

  onClick(event: MouseEvent) {
    if (this.clickable) {
      this.cardClicked.emit(event);
    }
  }
}
