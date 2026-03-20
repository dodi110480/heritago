import { Component, Output, EventEmitter, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppSectionHeaderComponent } from '../app-section-header';
import { AppSourcesListComponent } from '../app-sources-list/app-sources-list';
import { CitationModalComponent } from '../citation-modal/citation-modal';
import { Citation } from '../../../../core/models/models';

@Component({
    selector: 'app-tab-citations',
    standalone: true,
    imports: [CommonModule, FormsModule, AppSectionHeaderComponent, AppSourcesListComponent, CitationModalComponent],
    template: `
        <div class="glass-card flex flex-col">
            <div class="p-0">
                <app-section-header title="Quellen" icon="📖">
                    <div actions class="flex items-center gap-3">
                        <div class="relative hidden md:block w-64">
                            <input 
                                type="text" 
                                [(ngModel)]="searchText"
                                placeholder="Quellen durchsuchen..."
                                class="w-full bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-btn pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all font-medium"
                            >
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </span>
                        </div>
                        <button (click)="addCitation()" class="btn-primary !w-auto !py-2">
                            + Beleg
                        </button>
                    </div>
                </app-section-header>

                <app-sources-list
                    [entityId]="entity().id"
                    [entityType]="entityType()"
                    [sourcesDisplay]="mappedSources()"
                    [allowCreate]="true"
                    [allowEdit]="true"
                    [showHeader]="false"
                    [searchTerm]="searchText"
                    (sourceEditRequested)="openCitationModal($event)"
                    (sourceCreateRequested)="addCitation()"
                    (sourceDeleted)="onSourceDeleted($event)"
                    (masterSaved)="changed.emit()"
                ></app-sources-list>
            </div>
        </div>

        <app-citation-modal
            [visible]="showCitationModal()"
            [citation]="activeCitation()"
            [availableSources]="availableSources()"
            (close)="showCitationModal.set(false)"
            (save)="saveCitationModal($event)"
            (delete)="removeCitationModal()"
        ></app-citation-modal>
    `
})
export class TabCitationsComponent {
    entity = input.required<any>();
    entityType = input.required<any>();
    availableSources = input<any[]>([]);
    @Output() changed = new EventEmitter<{ notes: any[], citations: any[] }>();
    searchText = '';

    showCitationModal = signal(false);
    activeCitationIndex = signal<number | null>(null);
    activeCitation = signal<Citation | null>(null);

    mappedSources = computed(() => {
        const ent = this.entity();
        if (!ent || !ent.formattedCitations) return [];
        
        return ent.formattedCitations.map((cit: any, i: number) => ({
            ...cit,
            _originalIndex: i
        }));
    });

    addCitation() {
        this.activeCitationIndex.set(null);
        this.activeCitation.set(null);
        this.showCitationModal.set(true);
    }

    openCitationModal(sourceOrIndex: any) {
        let index = typeof sourceOrIndex === 'number' ? sourceOrIndex : sourceOrIndex._originalIndex;
        const ent = this.entity();
        if (!ent || !ent.citations || !ent.citations[index]) return;
        const cit = ent.citations[index] as any;
        this.activeCitationIndex.set(index);
        this.activeCitation.set({
            sourceId: cit.sourceId,
            quality: cit.quality ?? 2,
            whereInSource: cit.whereInSource || cit.page || '',
            text: cit.text || '',
            date: cit.date || cit.dateText || '',
            notes: cit.notes || []
        });
        this.showCitationModal.set(true);
    }

    saveCitationModal(draft: Citation) {
        const ent = this.entity() as any;
        if (!ent) return;
        
        const idx = this.activeCitationIndex();
        if (idx !== null) {
            ent.citations[idx] = {
                ...ent.citations[idx],
                ...draft
            };
        } else {
            ent.citations = ent.citations || [];
            ent.citations.push({ ...draft });
        }
        
        this.changed.emit({ notes: [...(ent.notes || [])], citations: [...ent.citations] });
        this.showCitationModal.set(false);
    }

    removeCitationModal() {
        const idx = this.activeCitationIndex();
        if (idx === null) return;
        const ent = this.entity() as any;
        if (ent && ent.citations) {
            ent.citations.splice(idx, 1);
            this.changed.emit({ notes: [...(ent.notes || [])], citations: [...ent.citations] });
        }
        this.showCitationModal.set(false);
    }

    onSourceDeleted(sourceId: string) {
        const ent = this.entity() as any;
        if (!ent || !ent.citations) return;
        const idx = ent.citations.findIndex((c: any, i: number) => (c.id || `cit-${i}`) === sourceId);
        if (idx !== -1) {
            if (confirm('Möchtest du diesen Beleg wirklich löschen?')) {
                ent.citations.splice(idx, 1);
                this.changed.emit({ notes: [...(ent.notes || [])], citations: [...ent.citations] });
            }
        }
    }
}
