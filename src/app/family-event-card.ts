import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppSourcesListComponent } from './ui/app-sources-list/app-sources-list';
import { AppModalShell } from './ui/app-modal-shell';
import { DisplaySource } from './models';

@Component({
    selector: 'app-family-event-card',
    standalone: true,
    imports: [CommonModule, FormsModule, AppSourcesListComponent, AppModalShell],
    template: `
        <div class="glass-card !p-5 !rounded-2xl space-y-5 group">
            <!-- Main Event Row -->
            <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div class="flex flex-col gap-1.5 md:col-span-3 lg:col-span-2">
                    <label class="form-label">Typ</label>
                    <select [(ngModel)]="event.type" (change)="change()"
                        class="form-input !py-2 text-sm">
                        <option value="MARR">Hochzeit</option>
                        <option value="DIV">Scheidung</option>
                        <option value="ENGA">Verlobung</option>
                        <option value="MARB">Aufgebot</option>
                        <option value="MARC">Ehevertrag</option>
                        <option value="MARS">Eheschließung (Zivil)</option>
                        <option value="DIVF">Scheidungsantrag</option>
                        <option value="ANUL">Annullierung</option>
                    </select>
                </div>
                <div class="flex flex-col gap-1.5 md:col-span-3 lg:col-span-2">
                    <label class="form-label">Datum</label>
                    <input type="text" [(ngModel)]="event.dateText" (ngModelChange)="change()"
                        placeholder="DD MMM YYYY" class="form-input !py-2 text-sm">
                </div>
                <div class="flex flex-col gap-1.5 md:col-span-3 lg:col-span-2" *ngIf="event.type === 'MARR'">
                    <label class="form-label">Untertyp</label>
                    <select [(ngModel)]="event.subType" (change)="change()"
                        class="form-input !py-2 text-sm">
                        <option value="">Bitte wählen</option>
                        <option value="CIVIL">Standesamtlich</option>
                        <option value="RELIGIOUS">Kirchlich</option>
                    </select>
                </div>
                <div class="flex flex-col gap-1.5 md:col-span-full lg:col-span-5 flex-1">
                    <label class="form-label">Ort</label>
                    <input type="text" [(ngModel)]="event.place" (ngModelChange)="change()"
                        placeholder="Ort eingeben" class="form-input !py-2 text-sm">
                </div>
                <div class="flex justify-end lg:col-span-1">
                    <button
                        class="p-2 text-neutral-800 dark:text-neutral-200 hover:text-accent-danger-500 hover:bg-accent-danger-500/10 rounded-xl transition-colors"
                        (click)="removeRequested.emit()" title="Ereignis löschen">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Expert Sections -->
            <div class="flex flex-col gap-3 pt-3 border-t border-neutral-300/30">

                <!-- Medien -->
                <div class="bg-brand-100/50 border border-neutral-300/30 rounded-xl p-3 md:p-4">
                    <div class="flex items-center justify-between mb-3">
                        <strong class="text-sm font-semibold text-neutral-700">🖼 Medien</strong>
                        <button class="btn-ghost !w-auto !py-1 text-xs" (click)="addMedia()">+ Medium</button>
                    </div>
                    <div *ngIf="event.media && event.media.length > 0" class="flex flex-col gap-3">
                        <div *ngFor="let med of event.media; let mIndex = index"
                            class="grid grid-cols-1 md:grid-cols-[64px_1fr_1fr_auto] gap-3 items-center">
                            <div class="w-full md:w-16 h-24 md:h-12 bg-brand-100 rounded-lg border border-neutral-300 overflow-hidden flex items-center justify-center shrink-0">
                                <img *ngIf="isImageUrl(med.url)" [src]="med.url" class="w-full h-full object-cover" alt="">
                                <svg *ngIf="!isImageUrl(med.url)" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-neutral-800 dark:text-neutral-200">
                                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                                    <polyline points="13 2 13 9 20 9"></polyline>
                                </svg>
                            </div>
                            <input type="text" [(ngModel)]="med.title" (ngModelChange)="change()"
                                placeholder="Titel" class="form-input form-input-sm">
                            <input type="text" [(ngModel)]="med.url" (ngModelChange)="change()"
                                placeholder="URL / Dateipfad" class="form-input form-input-sm">
                            <button class="p-2 text-neutral-800 dark:text-neutral-200 hover:text-accent-danger-500 hover:bg-accent-danger-500/10 rounded-lg transition-colors place-self-end md:place-self-auto"
                                (click)="removeMedia(mIndex)">&times;</button>
                        </div>
                    </div>
                    <p *ngIf="!event.media || event.media.length === 0" class="text-xs text-neutral-800 dark:text-neutral-200 italic">Keine Medien.</p>
                </div>

                <!-- Notizen -->
                <div class="bg-brand-100/50 border border-neutral-300/30 rounded-xl p-3 md:p-4">
                    <div class="flex items-center justify-between mb-3">
                        <strong class="text-sm font-semibold text-neutral-700">📝 Notizen</strong>
                        <button class="btn-ghost !w-auto !py-1 text-xs" (click)="addNote()">+ Notiz</button>
                    </div>
                    <div *ngIf="event.notes && event.notes.length > 0" class="flex flex-col gap-3">
                        <div *ngFor="let note of event.notes; let nIndex = index"
                            class="grid grid-cols-[1fr_auto] gap-3 items-start">
                            <textarea [ngModel]="note" (ngModelChange)="updateNote(nIndex, $event)"
                                class="form-input form-input-sm min-h-[60px]" placeholder="Notiz zum Ereignis"></textarea>
                            <button class="p-2 text-neutral-800 dark:text-neutral-200 hover:text-accent-danger-500 hover:bg-accent-danger-500/10 rounded-lg transition-colors"
                                (click)="removeNote(nIndex)">&times;</button>
                        </div>
                    </div>
                    <p *ngIf="!event.notes || event.notes.length === 0" class="text-xs text-neutral-800 dark:text-neutral-200 italic">Keine Notizen.</p>
                </div>

                <!-- Quellenbelege -->
                <div class="bg-brand-100/50 border border-neutral-300/30 rounded-xl p-3 md:p-4">
                    <div class="flex items-center justify-between mb-3">
                        <strong class="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
                            📖 Quellenbelege
                            <span *ngIf="mappedSources().length"
                                class="text-xs bg-brand-500/20 text-brand-300 px-1.5 py-0.5 rounded-full">
                                {{ mappedSources().length }}
                            </span>
                        </strong>
                        <button class="btn-ghost !w-auto !py-1 text-xs" (click)="addCitation()">+ Beleg</button>
                    </div>
                    
                    <app-sources-list
                        *ngIf="mappedSources().length > 0"
                        [entityId]="event.id || 'new'"
                        [entityType]="'EVENT'"
                        [sourcesDisplay]="mappedSources()"
                        (sourceEditRequested)="openCitationModal($event)"
                        (sourceCreateRequested)="addCitation()"
                    ></app-sources-list>

                    <p *ngIf="mappedSources().length === 0" class="text-xs text-neutral-800 dark:text-neutral-200 italic">Noch kein Quellbeleg.</p>
                </div>

            </div>
        </div>

        <!-- CITATION MODAL -->
        <app-modal-shell [visible]="showCitationModal()" 
            [title]="activeCitationIndex() === null ? 'Beleg hinzufügen' : 'Beleg bearbeiten'" icon="📖" size="md"
            [showSave]="true" [saveText]="activeCitationIndex() === null ? 'Beleg hinzufügen' : 'Speichern'" 
            [showDelete]="activeCitationIndex() !== null" deleteText="Beleg löschen" 
            (close)="closeCitationModal()" (save)="saveCitation()" (delete)="removeCitationAction()">
            <div class="space-y-4">
                <div class="form-group mb-0">
                    <label class="form-label">Quelle</label>
                    <select [ngModel]="citationDraft().sourceId"
                        (ngModelChange)="citationDraft.update(v => ({ ...v, sourceId: $event }))"
                        class="form-input !py-2.5">
                        <option value="">— Quelle wählen —</option>
                        <option *ngFor="let s of availableSources" [value]="s.id">
                            {{ s.title }}{{ s.author ? ' · ' + s.author : '' }}
                        </option>
                    </select>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="form-group mb-0">
                        <label class="form-label">Fundstelle</label>
                        <input type="text" [ngModel]="citationDraft().page"
                            (ngModelChange)="citationDraft.update(v => ({ ...v, page: $event }))" class="form-input"
                            placeholder="z.B. Seite 42">
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label">Konfidenz</label>
                        <select [ngModel]="citationDraft().confidence"
                            (ngModelChange)="citationDraft.update(v => ({ ...v, confidence: $event }))"
                            class="form-input !py-2.5">
                            <option value="">Bitte wählen</option>
                            <option value="CERTAIN">✅ Sicher</option>
                            <option value="VERY_LIKELY">🟩 Sehr wahrscheinlich</option>
                            <option value="LIKELY">🟨 Wahrscheinlich</option>
                            <option value="POSSIBLE">🟧 Möglich</option>
                            <option value="UNLIKELY">🟥 Unwahrscheinlich</option>
                        </select>
                    </div>
                </div>
                <div class="form-group mb-0">
                    <label class="form-label">Zitat</label>
                    <input type="text" [ngModel]="citationDraft().text"
                        (ngModelChange)="citationDraft.update(v => ({ ...v, text: $event }))" class="form-input"
                        placeholder="Zitierter Ausschnitt (optional)...">
                </div>
            </div>
        </app-modal-shell>
    `
})
export class FamilyEventCardComponent {
    @Input({ required: true }) event!: any;
    @Input() availableSources: any[] = [];
    @Output() changed = new EventEmitter<void>();
    @Output() removeRequested = new EventEmitter<void>();

    showCitationModal = signal(false);
    activeCitationIndex = signal<number | null>(null);
    citationDraft = signal<{ sourceId: string; confidence?: string; page?: string; text?: string; dateText?: string }>({ sourceId: '' });

    mappedSources = computed(() => {
        if (!this.event || !this.event.citations) return [];
        return this.event.citations.map((cit: any, i: number) => {
            const rawSource = this.availableSources.find(s => s.id === cit.sourceId);
            const display: DisplaySource = {
                id: cit.id || `cit-${i}`,
                title: rawSource ? rawSource.title : 'Unbekannte Quelle',
                author: rawSource ? rawSource.author : undefined,
                publication: rawSource ? rawSource.publication : undefined,
                confidence: cit.confidence as any,
                description: cit.page ? `Fundstelle: ${cit.page}` : '',
                createdAt: cit.dateText ? new Date(cit.dateText) : new Date(),
                _originalIndex: i
            } as any;
            return display;
        });
    });

    change() {
        this.changed.emit();
    }

    isImageUrl(url: string | undefined): boolean {
        if (!url) return false;
        return /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(url);
    }

    addMedia() {
        this.event.media = this.event.media || [];
        this.event.media.push({ url: '', title: '', isPrimary: false });
        this.change();
    }

    removeMedia(index: number) {
        this.event.media?.splice(index, 1);
        this.change();
    }

    addNote() {
        this.event.notes = this.event.notes || [];
        this.event.notes.push('');
        this.change();
    }

    updateNote(index: number, value: string) {
        if (!this.event.notes) return;
        this.event.notes[index] = value;
        this.change();
    }

    removeNote(index: number) {
        this.event.notes?.splice(index, 1);
        this.change();
    }

    addCitation() {
        this.activeCitationIndex.set(null);
        this.citationDraft.set({ sourceId: '', confidence: '', page: '', text: '' });
        this.showCitationModal.set(true);
    }

    openCitationModal(sourceOrIndex: any) {
        let index = typeof sourceOrIndex === 'number' ? sourceOrIndex : sourceOrIndex._originalIndex;
        if (!this.event || !this.event.citations || !this.event.citations[index]) return;
        const cit = this.event.citations[index];
        this.activeCitationIndex.set(index);
        this.citationDraft.set({
            sourceId: cit.sourceId || '',
            confidence: cit.confidence || '',
            page: cit.page || '',
            text: cit.text || '',
            dateText: cit.dateText || ''
        });
        this.showCitationModal.set(true);
    }

    closeCitationModal() {
        this.showCitationModal.set(false);
        this.activeCitationIndex.set(null);
    }

    saveCitation() {
        this.event.citations = this.event.citations || [];
        const draft = this.citationDraft();
        const idx = this.activeCitationIndex();

        if (!draft.sourceId) {
            alert("Bitte wählen Sie eine gültige Quelle aus.");
            return;
        }

        if (idx !== null && this.event.citations[idx]) {
            this.event.citations[idx] = { ...this.event.citations[idx], ...draft };
        } else {
            this.event.citations.push({ ...draft });
        }
        
        this.change();
        this.closeCitationModal();
    }

    removeCitationAction() {
        const idx = this.activeCitationIndex();
        if (idx !== null) {
            this.event.citations?.splice(idx, 1);
            this.change();
        }
        this.closeCitationModal();
    }
}
