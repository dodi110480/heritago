import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppModalShell } from './ui/app-modal-shell';
import { AppNotesList } from './ui/app-notes-list';
import { DisplayNote, NoteCategory } from './models';

@Component({
    selector: 'app-person-tab-notes',
    standalone: true,
    imports: [CommonModule, FormsModule, AppModalShell, AppNotesList],
    template: `
        <div class="space-y-6">
            <app-notes-list
                [entityId]="person?.id"
                [entityType]="'PERSON'"
                [notesDisplay]="displayNotes"
                [allowCreate]="true"
                [allowEdit]="true"
                [placeholder]="'Notizen zu dieser Person durchsuchen...'"
                (noteCreateRequested)="onNoteCreateRequested()"
                (noteEditRequested)="onNoteEditRequested($event)"
                (noteDeleted)="onNoteDeleted($event)"
            ></app-notes-list>
        </div>

        <!-- NOTE EDIT SUB-MODAL -->
        <app-modal-shell 
            [visible]="showNoteSubModal()" 
            [title]="activeNoteIndex() !== null ? 'Notiz bearbeiten' : 'Neue Notiz'" 
            icon="📝" 
            size="md"
            [showSave]="true" 
            [showDelete]="activeNoteIndex() !== null" 
            (close)="showNoteSubModal.set(false)"
            (save)="onNoteSave()"
            (delete)="onNoteDeleteFromModal()"
        >
            <div class="space-y-4">
                <div class="form-group mb-0">
                    <label class="form-label text-xs uppercase tracking-wider font-bold text-neutral-500">Kategorie / Typ</label>
                    <select [(ngModel)]="noteDraft().noteType" class="form-input">
                        <option value="COMMENT">Kommentar</option>
                        <option value="TRANSCRIPTION">Transkription</option>
                        <option value="RESEARCH">Forschung</option>
                        <option value="QUESTION">Frage</option>
                        <option value="TODO">Aufgabe</option>
                        <option value="HINT">Hinweis</option>
                        <option value="OTHER">Andere</option>
                    </select>
                </div>

                <div class="form-group mb-0">
                    <label class="form-label text-xs uppercase tracking-wider font-bold text-neutral-500">Inhalt</label>
                    <textarea 
                        [(ngModel)]="noteDraft().text" 
                        class="form-input min-h-[160px] font-body" 
                        placeholder="Deine Gedanken, Forschungsergebnisse oder Entdeckungen..."
                    ></textarea>
                </div>

                <div class="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border border-neutral-200 dark:border-neutral-800">
                    <div class="flex-1">
                        <div class="text-sm font-bold text-neutral-900 dark:text-white">Private Notiz</div>
                        <div class="text-[10px] text-neutral-500">Nur für dich und berechtigte Bearbeiter sichtbar.</div>
                    </div>
                    <input 
                        type="checkbox" 
                        [(ngModel)]="noteDraft().isPrivate"
                        class="checkbox checkbox-brand"
                    >
                </div>
            </div>
        </app-modal-shell>
    `
})
export class PersonTabNotesComponent {
    @Input({ required: true }) person!: any;
    @Output() changed = new EventEmitter<void>();

    showNoteSubModal = signal(false);
    activeNoteIndex = signal<number | null>(null);
    noteDraft = signal<DisplayNote>({
        id: '',
        text: '',
        noteType: 'COMMENT',
        createdAt: new Date(),
        isPrivate: false
    });

    get displayNotes(): DisplayNote[] {
        if (!this.person?.notes) return [];
        return this.person.notes.map((n: any, i: number) => ({
            id: n.id || `note-${i}`,
            text: n.text || '',
            noteType: n.noteType || 'COMMENT',
            createdAt: n.createdAt || new Date(),
            isPrivate: n.privacyLevel === 'PRIVATE' || !!n.isPrivate,
            createdBy: n.createdBy,
            updatedAt: n.updatedAt
        }));
    }

    onNoteCreateRequested() {
        this.activeNoteIndex.set(null);
        this.noteDraft.set({
            id: 'note-' + Date.now(),
            text: '',
            noteType: 'COMMENT' as NoteCategory,
            createdAt: new Date(),
            isPrivate: true // Default to private for persons
        });
        this.showNoteSubModal.set(true);
    }

    onNoteEditRequested(displayNote: DisplayNote) {
        const p = this.person;
        if (!p || !p.notes) return;

        const idx = p.notes.findIndex((n: any, i: number) => (n.id || `note-${i}`) === displayNote.id);
        if (idx !== -1) {
            this.activeNoteIndex.set(idx);
            this.noteDraft.set({ ...displayNote });
            this.showNoteSubModal.set(true);
        }
    }

    onNoteSave() {
        const draft = this.noteDraft();
        if (!draft.text.trim()) return;

        const p = this.person;
        if (!p) return;

        const idx = this.activeNoteIndex();

        // Map back to API structure
        const apiNote = {
            id: draft.id.startsWith('note-') ? undefined : draft.id,
            text: draft.text,
            noteType: draft.noteType || 'COMMENT',
            privacyLevel: draft.isPrivate ? 'PRIVATE' : 'PUBLIC',
            isPrivate: draft.isPrivate
        };

        if (idx !== null) {
            p.notes[idx] = { ...p.notes[idx], ...apiNote };
        } else {
            p.notes = p.notes || [];
            p.notes.push(apiNote);
        }

        this.changed.emit();
        this.showNoteSubModal.set(false);
    }

    onNoteDeleted(noteId: string) {
        const p = this.person;
        if (!p || !p.notes) return;

        const idx = p.notes.findIndex((n: any, i: number) => (n.id || `note-${i}`) === noteId);
        if (idx !== -1) {
            if (confirm('Möchtest du diese Notiz wirklich löschen?')) {
                p.notes.splice(idx, 1);
                this.changed.emit();
                return true;
            }
        }
        return false;
    }

    onNoteDeleteFromModal() {
        const idx = this.activeNoteIndex();
        if (idx === null) return;

        const p = this.person;
        if (!p || !p.notes) return;

        const note = p.notes[idx];
        const noteId = note.id || `note-${idx}`;

        // Wir rufen onNoteDeleted auf, aber wir wollen das confirm eventuell hier steuern oder doppelung vermeiden.
        // Die Anforderung sagt "sofortiges Löschen (mit Schließen des Modals)".
        // Im app-notes-list gibt es schon ein confirm.

        p.notes.splice(idx, 1);
        this.changed.emit();
        this.showNoteSubModal.set(false);
    }
}
