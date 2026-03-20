import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppIconComponent } from './app-icon';

@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  template: `
    <div class="search-wrapper" [class.w-full]="fullWidth" [class.md:w-80]="!fullWidth">
      <div class="search-icon-wrapper">
        <app-icon name="search" size="1.1rem"></app-icon>
      </div>
      <input type="text" [placeholder]="placeholder" [ngModel]="value"
          (ngModelChange)="onValueChange($event)" class="search-input glass-card">
    </div>
  `,
  styles: [`
    .search-wrapper { @apply flex items-center gap-3; }
    .search-icon-wrapper { @apply text-neutral-600 dark:text-neutral-300 flex items-center justify-center shrink-0; }
    .search-input { 
        @apply w-full px-5 py-2.5 !rounded-2xl text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-brand-500/30 transition-all duration-300; 
    }
  `]
})
export class AppSearchInputComponent {
  @Input() value: string = '';
  @Input() placeholder: string = 'Suchen...';
  @Input() fullWidth: boolean = false;
  @Output() valueChange = new EventEmitter<string>();

  onValueChange(newValue: string) {
    this.value = newValue;
    this.valueChange.emit(newValue);
  }
}
