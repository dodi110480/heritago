import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface UsageEntry {
    context: string;
    contextLabel: string;
    entityId?: string;
    entityType?: string;
    dateText?: string;
    page?: string;
    confidence?: string;
}

@Component({
    selector: 'app-usage-list',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
        <div class="space-y-4">
            <h4 *ngIf="title" class="text-base font-bold text-neutral-900 dark:text-white mb-4 flex items-center justify-between">
                <span>{{ title }}</span>
                <span class="text-xs font-normal text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                    {{ usages.length }} Einträge
                </span>
            </h4>

            <div *ngIf="isLoading" class="flex flex-col items-center justify-center py-10 text-neutral-500">
                <div class="w-8 h-8 border-3 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-3"></div>
                <p class="text-sm">Lade Verwendungsnachweise...</p>
            </div>

            <div *ngIf="!isLoading && usages.length === 0"
                class="text-center py-10 bg-neutral-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
                <p class="text-sm text-neutral-500 italic">{{ emptyMessage }}</p>
            </div>

            <div class="flex flex-col gap-3" *ngIf="!isLoading && usages.length > 0">
                <div *ngFor="let u of usages" 
                    class="group p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-brand-500/30 transition-all shadow-sm hover:shadow-md">
                    
                    <div class="flex items-start justify-between gap-4">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="text-[10px] font-bold tracking-widest uppercase text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-md">
                                    {{ u.context }}
                                </span>
                            </div>
                            
                            <h5 class="text-sm font-bold text-neutral-900 dark:text-white truncate">
                                <ng-container *ngIf="u.entityId && u.entityType; else noLink">
                                    <a [routerLink]="['/' + u.entityType, u.entityId]" 
                                       (click)="linkClick.emit()"
                                       class="hover:text-brand-600 transition-colors">
                                        {{ u.contextLabel }}
                                    </a>
                                </ng-container>
                                <ng-template #noLink>
                                    {{ u.contextLabel }}
                                </ng-template>
                            </h5>
                        </div>

                        <div *ngIf="u.confidence" class="shrink-0 flex items-center gap-1.5 px-2 py-1 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-100 dark:border-neutral-700">
                            <span class="w-1.5 h-1.5 rounded-full" [ngClass]="{
                                'bg-emerald-500': u.confidence === 'CERTAIN' || u.confidence === 'VERY_LIKELY',
                                'bg-amber-500': u.confidence === 'LIKELY' || u.confidence === 'POSSIBLE',
                                'bg-rose-500': u.confidence === 'UNLIKELY'
                            }"></span>
                            <span class="text-[10px] font-bold text-neutral-500">{{ u.confidence }}</span>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                        <span *ngIf="u.dateText" class="flex items-center gap-1.5 text-xs text-neutral-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-40">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            {{ u.dateText }}
                        </span>
                        
                        <span *ngIf="u.page" class="flex items-center gap-1.5 text-xs text-neutral-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-40">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            </svg>
                            S. {{ u.page }}
                        </span>

                        <div class="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                             <ng-container *ngIf="u.entityId && u.entityType">
                                <a [routerLink]="['/' + u.entityType, u.entityId]" (click)="linkClick.emit()" class="text-brand-600 font-bold text-xs flex items-center gap-1">
                                    Ansehen
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                        <path d="M5 12h14"></path>
                                        <path d="m12 5 7 7-7 7"></path>
                                    </svg>
                                </a>
                             </ng-container>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
})
export class AppUsageList {
    @Input() usages: UsageEntry[] = [];
    @Input() isLoading = false;
    @Input() title = '';
    @Input() emptyMessage = 'Keine Verwendungsnachweise gefunden.';
    
    @Output() linkClick = new EventEmitter<void>();
}
