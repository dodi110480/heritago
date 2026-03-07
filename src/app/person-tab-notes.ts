import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppModalShell } from './ui/app-modal-shell';
import { AppEmptyStateComponent } from './ui/app-empty-state';
import { AppSectionHeaderComponent } from './ui/app-section-header';

@Component({
    selector: 'app-person-tab-notes',
    standalone: true,
    imports: [CommonModule, FormsModule, AppModalShell, AppEmptyStateComponent, AppSectionHeaderComponent],
    template: `
        <div class="glass-card shadow-sm flex flex-col">
            <div class="p-0">
                <app-section-header title="Persönliche Notizen" icon="📝">
                    <button actions (click)="addPersonNote()" class="btn-primary !w-auto !py-2">
                        + Notiz
                    </button>
                </app-section-header>

                <div *ngIf="person?.notes && person.notes.length > 0" class="space-y-3">
                    <ng-container *ngFor="let note of person.notes; let i = index">
                        <div class="glass-card !bg-brand-50 !rounded-2xl !p-4 space-y-3 cursor-pointer hover:bg-neutral-100 transition-all"
                            (click)="openPersonNoteModal(i)">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="badge badge-primary">{{ getNoteTypeLabel(note.noteType) }}</span>
                                <span class="badge badge-highlight">{{ note.researchStatus || 'OPEN' }}</span>
                                <span class="badge badge-neutral">{{ note.privacyLevel || 'PRIVATE' }}</span>
                            </div>
                            <p class="text-sm text-neutral-700 leading-relaxed line-clamp-4">
                                {{ note.text || 'Leere Notiz' }}
                            </p>
                        </div>
                    </ng-container>
                </div>

                <app-empty-state *ngIf="!person?.notes || person.notes.length === 0"
                    icon="📝" 
                    title="Keine Notizen" 
                    message="Halte wichtige Details oder Forschungsergebnisse zu dieser Person in Notizen fest.">
                </app-empty-state>
            </div>
        </div>

        <!-- NOTE CREATE MODAL -->
        <app-modal-shell [visible]="showNoteCreateModal()" title="Notiz hinzufügen" icon="📝" size="md" [showSave]="true"
            saveText="Notiz hinzufügen" [showDelete]="false" (close)="closeNoteModal()" (save)="confirmAddPersonNote()">
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="form-group mb-0">
                        <label class="form-label">Typ</label>
                        <select [ngModel]="newNoteDraft().noteType"
                            (ngModelChange)="newNoteDraft.update(v => ({ ...v, noteType: $event }))"
                            class="form-input !py-2.5">
                            <option value="GENERAL">Allgemein</option>
                            <option value="RESEARCH">Recherche</option>
                            <option value="TRANSCRIPTION">Transkript</option>
                            <option value="ANALYSIS">Analyse</option>
                            <option value="TODO">ToDo</option>
                        </select>
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label">Status</label>
                        <select [ngModel]="newNoteDraft().researchStatus"
                            (ngModelChange)="newNoteDraft.update(v => ({ ...v, researchStatus: $event }))"
                            class="form-input !py-2.5">
                            <option value="OPEN">Offen</option>
                            <option value="IN_PROGRESS">In Bearbeitung</option>
                            <option value="DONE">Fertig</option>
                            <option value="BLOCKED">Blockiert</option>
                        </select>
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label">Datenschutz</label>
                        <select [ngModel]="newNoteDraft().privacyLevel"
                            (ngModelChange)="newNoteDraft.update(v => ({ ...v, privacyLevel: $event }))"
                            class="form-input !py-2.5">
                            <option value="PUBLIC">Öffentlich</option>
                            <option value="FAMILY">Familie</option>
                            <option value="PRIVATE">Privat</option>
                        </select>
                    </div>
                </div>
                <div class="form-group mb-0">
                    <label class="form-label">Notiztext</label>
                    <textarea [ngModel]="newNoteDraft().text"
                        (ngModelChange)="newNoteDraft.update(v => ({ ...v, text: $event }))"
                        class="form-input min-h-[120px]" placeholder="Notiz eingeben..."></textarea>
                </div>
            </div>
        </app-modal-shell>

        <!-- NOTE EDIT MODAL -->
        <app-modal-shell [visible]="showNoteEditModal()" title="Notiz bearbeiten" icon="📝" size="md" [showSave]="true"
            saveText="Speichern" [showDelete]="true" deleteText="Notiz löschen" (close)="closePersonNoteModal()"
            (save)="savePersonNoteModal()" (delete)="removePersonNoteModal()">
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="form-group mb-0">
                        <label class="form-label">Typ</label>
                        <select [ngModel]="noteEditDraft().noteType"
                            (ngModelChange)="noteEditDraft.update(v => ({ ...v, noteType: $event }))"
                            class="form-input !py-2.5">
                            <option value="GENERAL">Allgemein</option>
                            <option value="RESEARCH">Recherche</option>
                            <option value="TRANSCRIPTION">Transkript</option>
                            <option value="ANALYSIS">Analyse</option>
                            <option value="TODO">ToDo</option>
                        </select>
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label">Status</label>
                        <select [ngModel]="noteEditDraft().researchStatus"
                            (ngModelChange)="noteEditDraft.update(v => ({ ...v, researchStatus: $event }))"
                            class="form-input !py-2.5">
                            <option value="OPEN">Offen</option>
                            <option value="IN_PROGRESS">In Bearbeitung</option>
                            <option value="DONE">Fertig</option>
                            <option value="BLOCKED">Blockiert</option>
                        </select>
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label">Datenschutz</label>
                        <select [ngModel]="noteEditDraft().privacyLevel"
                            (ngModelChange)="noteEditDraft.update(v => ({ ...v, privacyLevel: $event }))"
                            class="form-input !py-2.5">
                            <option value="PUBLIC">Öffentlich</option>
                            <option value="FAMILY">Familie</option>
                            <option value="PRIVATE">Privat</option>
                        </select>
                    </div>
                </div>
                <div class="form-group mb-0">
                    <label class="form-label">Notiz</label>
                    <textarea [ngModel]="noteEditDraft().text"
                        (ngModelChange)="noteEditDraft.update(v => ({ ...v, text: $event }))"
                        class="form-input min-h-[140px]" placeholder="Notiztext"></textarea>
                </div>
            </div>
        </app-modal-shell>
    `
})
export class PersonTabNotesComponent {
    @Input({ required: true }) person!: any;
    @Output() changed = new EventEmitter<void>();

    showNoteCreateModal = signal(false);
    showNoteEditModal = signal(false);
    newNoteDraft = signal<{ text: string; noteType: string; researchStatus: string; privacyLevel: string }>({
        text: '', noteType: 'GENERAL', researchStatus: 'OPEN', privacyLevel: 'PRIVATE'
    });
    noteEditDraft = signal<{ text: string; noteType: string; researchStatus: string; privacyLevel: string }>({
        text: '', noteType: 'GENERAL', researchStatus: 'OPEN', privacyLevel: 'PRIVATE'
    });
    activePersonNoteIndex = signal<number | null>(null);

    getNoteTypeLabel(type?: string): string {
        const map: Record<string, string> = {
            GENERAL: 'Allgemein',
            RESEARCH: 'Recherche',
            TRANSCRIPTION: 'Transkript',
            ANALYSIS: 'Analyse',
            TODO: 'ToDo'
        };
        return map[type || ''] || (type || 'Allgemein');
    }

    addPersonNote() {
        this.newNoteDraft.set({ text: '', noteType: 'GENERAL', researchStatus: 'OPEN', privacyLevel: 'PRIVATE' });
        this.showNoteCreateModal.set(true);
    }

    closeNoteModal() {
        this.showNoteCreateModal.set(false);
    }

    confirmAddPersonNote() {
        const p = this.person;
        if (p) {
            const draft = this.newNoteDraft();
            const text = (draft.text || '').trim();
            if (!text) return;
            p.notes = p.notes || [];
            p.notes.push({
                text,
                noteType: draft.noteType || 'GENERAL',
                researchStatus: draft.researchStatus || 'OPEN',
                privacyLevel: draft.privacyLevel || 'PRIVATE'
            } as any);
            this.changed.emit();
            this.showNoteCreateModal.set(false);
        }
    }

    openPersonNoteModal(index: number) {
        const p = this.person;
        if (!p || !p.notes || !p.notes[index]) return;
        const note = p.notes[index] as any;
        this.noteEditDraft.set({
            text: note.text || '',
            noteType: note.noteType || 'GENERAL',
            researchStatus: note.researchStatus || 'OPEN',
            privacyLevel: note.privacyLevel || 'PRIVATE'
        });
        this.activePersonNoteIndex.set(index);
        this.showNoteEditModal.set(true);
    }

    closePersonNoteModal() {
        this.showNoteEditModal.set(false);
        this.activePersonNoteIndex.set(null);
    }

    savePersonNoteModal() {
        const p = this.person;
        const idx = this.activePersonNoteIndex();
        if (!p || idx === null || !p.notes || !p.notes[idx]) return;
        const draft = this.noteEditDraft();
        p.notes[idx] = {
            ...(p.notes[idx] as any),
            text: draft.text || '',
            noteType: draft.noteType || 'GENERAL',
            researchStatus: draft.researchStatus || 'OPEN',
            privacyLevel: draft.privacyLevel || 'PRIVATE'
        } as any;
        this.changed.emit();
        this.closePersonNoteModal();
    }

    removePersonNoteModal() {
        const idx = this.activePersonNoteIndex();
        if (idx === null) return;
        const p = this.person;
        if (p) {
            p.notes!.splice(idx, 1);
            this.changed.emit();
        }
        this.closePersonNoteModal();
    }
}
