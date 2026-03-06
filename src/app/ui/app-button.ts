import { Component, Input, Output, EventEmitter, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [type]="type"
      [disabled]="disabled"
      (click)="onClick.emit($event)"
      class="inline-flex items-center justify-center gap-2 rounded-btn font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
      [ngClass]="{
        'px-4 py-2 text-sm': size === 'sm',
        'px-6 py-3 text-base': size === 'md',
        'px-8 py-4 text-lg': size === 'lg',
        'bg-brand-500 hover:bg-brand-400 text-canvas-white shadow-lg shadow-brand-500/20': variant === 'primary',
        'bg-surface-light hover:bg-surface-lighter text-canvas-white/80 border border-brand-500/20': variant === 'secondary',
        'bg-accent-purple-500 hover:bg-accent-purple-400 text-canvas-white shadow-lg shadow-accent-purple-500/20': variant === 'accent',
        'bg-transparent hover:bg-canvas-white/5 text-canvas-white/40 hover:text-canvas-white/90 border border-canvas-white/5': variant === 'ghost',
        'bg-transparent border-2 border-brand-500/50 hover:border-brand-500 text-brand-400 hover:bg-brand-500/5': variant === 'outline'
      }"
    >
      <ng-content></ng-content>
    </button>
  `,
  encapsulation: ViewEncapsulation.None
})
export class AppButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'accent' | 'ghost' | 'outline' = 'primary';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() type: 'button' | 'submit' = 'button';
  @Input() disabled: boolean = false;

  @Output() onClick = new EventEmitter<MouseEvent>();
}
