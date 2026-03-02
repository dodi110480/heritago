import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-input',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="flex flex-col gap-2">
      <label *ngIf="label" class="text-sm font-semibold text-slate-400 ml-1">{{ label }}</label>
      <input
        [type]="type"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [(ngModel)]="value"
        (ngModelChange)="valueChange.emit($event)"
        class="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all duration-200 disabled:opacity-50"
      />
    </div>
  `
})
export class AppInputComponent {
    @Input() label?: string;
    @Input() placeholder: string = '';
    @Input() type: string = 'text';
    @Input() disabled: boolean = false;
    @Input() value: any;
    @Output() valueChange = new EventEmitter<any>();
}
