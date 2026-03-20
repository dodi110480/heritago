import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Family } from '../../core/models/models';
import { AppSectionHeaderComponent } from '../../shared/components/ui/app-section-header';
import { AppEmptyStateComponent } from '../../shared/components/ui/app-empty-state';

@Component({
    selector: 'app-family-tab-events',
    standalone: true,
    imports: [CommonModule, AppSectionHeaderComponent, AppEmptyStateComponent],
    template: `
        <div class="glass-card !p-6 sm:!p-8 flex flex-col gap-6">
            <app-section-header title="Ereignisse" icon="📅">
                <button actions class="btn-primary !w-auto !py-1.5 text-sm" (click)="addEventRequested.emit()">+
                    Ereignis</button>
            </app-section-header>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" *ngIf="family?.events?.length">
                <div *ngFor="let ev of family?.events; let i = index" (click)="editEventRequested.emit(i)"
                    class="glass-card !p-5 !rounded-2xl hover:scale-[1.02] transition-transform cursor-pointer group">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center gap-3">
                            <div
                                class="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xl">
                                {{ ev.type === 'MARR' ? '💍' : '📅' }}
                            </div>
                            <div class="flex flex-col">
                                <span class="text-sm font-bold text-neutral-900 dark:text-white">{{ ev.type
                                    }}</span>
                                <span
                                    class="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-semibold tracking-wider">{{
                                    ev.subType || 'Allgemein' }}</span>
                            </div>
                        </div>
                        <button (click)="$event.stopPropagation(); removeEventRequested.emit(i)"
                            class="p-2 text-neutral-400 hover:text-accent-danger-500 hover:bg-accent-danger-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18"></path>
                                <path
                                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2">
                                </path>
                            </svg>
                        </button>
                    </div>
                    <div class="space-y-1.5">
                        <div class="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                            <span class="text-neutral-400">📅</span>
                            <span>{{ ev.dateText || ev.date || 'Kein Datum' }}</span>
                        </div>
                        <div class="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                            <span class="text-neutral-400">📍</span>
                            <span>{{ ev.place || 'Kein Ort' }}</span>
                        </div>
                    </div>

                    <!-- Data Indicators -->
                    <div class="flex flex-wrap gap-2 mt-4"
                        *ngIf="ev.citations?.length || ev.media?.length || ev.notes?.length">
                        <span *ngIf="ev.citations?.length"
                            class="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase rounded-full border border-emerald-500/20">
                            📖 {{ ev.citations.length }}
                        </span>
                        <span *ngIf="ev.media?.length"
                            class="px-2 py-0.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-bold uppercase rounded-full border border-brand-500/20">
                            🖼 {{ ev.media.length }}
                        </span>
                        <span *ngIf="ev.notes?.length"
                            class="px-2 py-0.5 bg-accent-highlight-500/10 text-accent-highlight-600 dark:text-accent-highlight-400 text-[10px] font-bold uppercase rounded-full border border-accent-highlight-500/20">
                            📝 {{ ev.notes.length }}
                        </span>
                        <span *ngIf="ev.associations?.length"
                            class="px-2 py-0.5 bg-accent-violet-500/10 text-accent-violet-600 dark:text-accent-violet-400 text-[10px] font-bold uppercase rounded-full border border-accent-violet-500/20">
                            👥 {{ ev.associations.length }}
                        </span>
                    </div>
                </div>
            </div>

            <app-empty-state *ngIf="!family?.events || family?.events?.length === 0" icon="📅"
                title="Keine Ereignisse"
                message="In dieser Familie wurden noch keine gemeinsamen Ereignisse hinterlegt.">
            </app-empty-state>
        </div>
    `
})
export class FamilyTabEventsComponent {
    @Input() family: Family | null = null;
    
    @Output() addEventRequested = new EventEmitter<void>();
    @Output() editEventRequested = new EventEmitter<number>();
    @Output() removeEventRequested = new EventEmitter<number>();
}
