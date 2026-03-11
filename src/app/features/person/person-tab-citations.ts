import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppSectionHeaderComponent } from '../../shared/components/ui/app-section-header';
import { AppSourcesListComponent } from '../../shared/components/ui/app-sources-list/app-sources-list';
import { CitationModalComponent } from '../../shared/components/ui/citation-modal/citation-modal';
import { DisplaySource, Citation } from '../../core/models/models';

@Component({
    selector: 'app-person-tab-citations',
    standalone: true,
    imports: [CommonModule, FormsModule, AppSectionHeaderComponent, AppSourcesListComponent, CitationModalComponent],
    template: `
        <div class="glass-card shadow-sm flex flex-col">
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
                        <button (click)="addPersonCitation()" class="btn-primary !w-auto !py-2">
                            + Beleg
                        </button>
                    </div>
                </app-section-header>

                <app-sources-list
                    [entityId]="person.id"
                    [entityType]="'PERSON'"
                    [sourcesDisplay]="mappedSources()"
                    [allowCreate]="true"
                    [allowEdit]="true"
                    [showHeader]="false"
                    [searchTerm]="searchText"
                    (sourceEditRequested)="openPersonCitationModal($event)"
                    (sourceCreateRequested)="addPersonCitation()"
                    (sourceDeleted)="onSourceDeleted($event)"
                    (masterSaved)="changed.emit()"
                ></app-sources-list>
            </div>
        </div>

        <app-citation-modal
            [visible]="showCitationModal()"
            [citation]="activeCitation()"
            [availableSources]="availableSources"
            (close)="showCitationModal.set(false)"
            (save)="savePersonCitationModal($event)"
            (delete)="removePersonCitationModal()"
        ></app-citation-modal>
    `
})
export class PersonTabCitationsComponent {
    @Input({ required: true }) person!: any;
    @Input() availableSources: any[] = [];
    @Output() changed = new EventEmitter<void>();
    searchText = '';

    showCitationModal = signal(false);
    activePersonCitationIndex = signal<number | null>(null);
    activeCitation = signal<Citation | null>(null);

    mappedSources = computed(() => {
        if (!this.person || !this.person.citations) return [];
        return this.person.citations.map((cit: any, i: number) => {
            const rawSource = this.availableSources.find((s: any) => s.id === cit.sourceId);
            const display: DisplaySource = {
                id: cit.id || `cit-${i}`,
                title: rawSource ? rawSource.title : 'Unbekannte Quelle',
                author: rawSource ? rawSource.author : undefined,
                publication: rawSource ? rawSource.publication : undefined,
                confidence: cit.confidence as any,
                whereInSource: cit.whereInSource || cit.page, // Keep cit.page for backward compatibility if needed, but prefer whereInSource
                description: (cit.whereInSource || cit.page) ? `Fundstelle: ${cit.whereInSource || cit.page}` : '',
                text: cit.text,
                createdAt: (cit.date || cit.dateText) ? new Date(cit.date || cit.dateText) : new Date(), // Keep cit.dateText for backward compatibility
                _originalIndex: i
            } as any;
            return display;
        });
    });

    getSourceTitle(sourceId?: string): string {
        if (!sourceId) return 'Ohne Quelle';
        const src = this.availableSources.find((s: any) => s.id === sourceId);
        return src ? src.title : sourceId;
    }

    getConfidenceLabel(conf: string): string {
        switch (conf) {
            case 'CERTAIN': return 'Sicher';
            case 'VERY_LIKELY': return 'Sehr wahrscheinlich';
            case 'LIKELY': return 'Wahrscheinlich';
            case 'POSSIBLE': return 'Möglich';
            case 'UNLIKELY': return 'Unwahrscheinlich';
            default: return 'Keine Angabe';
        }
    }

    getConfidenceColorClass(conf: string): string {
        switch (conf) {
            case 'CERTAIN': return 'badge-success';
            case 'VERY_LIKELY': return 'bg-emerald-500/10 text-emerald-500';
            case 'LIKELY': return 'badge-highlight';
            case 'POSSIBLE': return 'badge-warn';
            case 'UNLIKELY': return 'badge-danger';
            default: return 'bg-neutral-950/10 text-neutral-400';
        }
    }

    addPersonCitation() {
        this.activePersonCitationIndex.set(null);
        this.activeCitation.set(null);
        this.showCitationModal.set(true);
    }

    openPersonCitationModal(sourceOrIndex: any) {
        let index = typeof sourceOrIndex === 'number' ? sourceOrIndex : sourceOrIndex._originalIndex;
        const p = this.person;
        if (!p || !p.citations || !p.citations[index]) return;
        const cit = p.citations[index] as any;
        this.activePersonCitationIndex.set(index);
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

    savePersonCitationModal(draft: Citation) {
        const p = this.person;
        if (!p) return;
        
        const idx = this.activePersonCitationIndex();
        if (idx !== null) {
            // Edit
            p.citations[idx] = {
                ...p.citations[idx],
                ...draft
            };
        } else {
            // Create
            p.citations = p.citations || [];
            p.citations.push({ ...draft });
        }
        
        this.changed.emit();
        this.showCitationModal.set(false);
    }

    removePersonCitationModal() {
        const idx = this.activePersonCitationIndex();
        if (idx === null) return;
        const p = this.person;
        if (p && p.citations) {
            p.citations.splice(idx, 1);
            this.changed.emit();
        }
        this.showCitationModal.set(false);
    }

    onSourceDeleted(sourceId: string) {
        const p = this.person;
        if (!p || !p.citations) return;
        const idx = p.citations.findIndex((c: any, i: number) => (c.id || `cit-${i}`) === sourceId);
        if (idx !== -1) {
            if (confirm('Möchtest du diesen Beleg wirklich löschen?')) {
                p.citations.splice(idx, 1);
                this.changed.emit();
            }
        }
    }
}
