import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-modal-shell',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="fixed inset-0 z-modal flex items-end md:items-center justify-center bg-ui-bgSoft/40 backdrop-blur-xl md:p-4"
             *ngIf="visible" (click)="close.emit()">
            
            <!-- Modal Window -->
            <div class="w-full flex flex-col bg-canvas dark:bg-neutral-900 border-t md:border border-brand-500/15 shadow-modal overflow-hidden transition-all duration-300
                        h-[95vh] rounded-t-modal md:h-auto md:max-h-[90vh] md:rounded-modal"
                 [ngClass]="{
                     'md:max-w-xl': size === 'sm',
                     'md:max-w-2xl': size === 'md',
                     'md:max-w-4xl': size === 'lg',
                     'md:max-w-6xl': size === 'xl'
                 }"
                 (click)="$event.stopPropagation()">
                 
                <!-- Header -->
                <div class="flex justify-between items-center p-4 md:p-6 border-b border-brand-500/10 bg-canvas/40 dark:bg-black/20 flex-shrink-0">
                    <h2 class="text-xl md:text-2xl font-bold text-neutral-900 dark:text-white m-0 flex items-center gap-3">
                        <span *ngIf="icon" class="text-2xl">{{ icon }}</span>
                        {{ title }}
                    </h2>
                    <button class="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-full md:rounded-btn bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                            (click)="close.emit()" title="Schließen">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <!-- Body (Scrollable Content Projection) -->
                <div class="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1 relative bg-transparent text-neutral-900 dark:text-neutral-100">
                    <ng-content></ng-content>
                </div>

                <!-- Footer (Actions) -->
                <div *ngIf="showFooter" class="flex flex-col-reverse md:flex-row justify-between items-stretch md:items-center gap-3 p-4 md:p-6 border-t border-brand-500/10 bg-canvas/40 dark:bg-black/20 flex-shrink-0">
                    <!-- Optionale Löschen-Aktion auf der linken Seite -->
                    <div class="w-full md:w-auto flex gap-2">
                        <button *ngIf="showDelete" class="btn-danger w-full md:w-auto !px-4 !py-3 md:!py-2.5 flex items-center justify-center gap-2" 
                                [disabled]="loading" (click)="delete.emit()">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            {{ deleteText }}
                        </button>
                        <ng-content select="[extraActions]"></ng-content>
                    </div>

                    <!-- Abbrechen und Speichern / Primäre Aktion auf der rechten Seite -->
                    <div class="flex flex-col-reverse md:flex-row gap-3 w-full md:w-auto md:justify-end">
                        <button class="btn-secondary w-full md:w-auto !px-5 !py-3 md:!py-2.5" 
                                [disabled]="loading" (click)="close.emit()">
                            Abbrechen
                        </button>
                        
                        <button *ngIf="showSave" class="btn-primary w-full md:w-auto !px-6 !py-3 md:!py-2.5 flex items-center justify-center gap-2" 
                                [disabled]="loading || disabledSave" (click)="save.emit()">
                            <span *ngIf="loading" class="w-4 h-4 border-2 border-canvas-white/20 border-t-white rounded-full animate-spin"></span>
                            {{ saveText }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `
})
export class AppModalShell {
    @Input() visible = false;
    @Input() title = 'Modal Titel';
    @Input() icon?: string;

    // lg=4xl, md=2xl, sm=xl, xl=6xl for Tailwind max-widths
    @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'lg';

    // Button Configuration
    @Input() showFooter = true;
    @Input() showSave = true;
    @Input() showDelete = false;
    @Input() saveText = 'Speichern';
    @Input() deleteText = 'Löschen';
    @Input() loading = false;
    @Input() disabledSave = false;

    // Action Events
    @Output() close = new EventEmitter<void>();
    @Output() save = new EventEmitter<void>();
    @Output() delete = new EventEmitter<void>();
}
