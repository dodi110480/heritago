import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-section-card',
    standalone: true,
    imports: [CommonModule],
    template: `
        <section class="glass-card shadow-xl" [ngClass]="containerClass">
            <header *ngIf="title || subtitle" class="mb-4 flex items-center justify-between gap-3" [ngClass]="headerClass">
                <div class="min-w-0">
                    <h3 *ngIf="title" class="text-[10px] font-black uppercase tracking-[.22em] text-neutral-500 truncate">
                        <span *ngIf="icon" class="mr-2">{{ icon }}</span>{{ title }}
                    </h3>
                    <p *ngIf="subtitle" class="text-xs text-neutral-400 mt-1 truncate">{{ subtitle }}</p>
                </div>
                <ng-content select="[header-actions]"></ng-content>
            </header>
            <ng-content></ng-content>
        </section>
    `
})
export class AppSectionCardComponent {
    @Input() title?: string;
    @Input() subtitle?: string;
    @Input() icon?: string;
    @Input() containerClass = '';
    @Input() headerClass = '';
}
