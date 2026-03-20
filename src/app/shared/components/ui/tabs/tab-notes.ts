import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


import { AppNotesList } from '../app-notes-list/app-notes-list';
import { AppNoteModal } from '../app-note-modal/app-note-modal';
import { AppSectionHeaderComponent } from '../app-section-header';
import { DisplayNote, NoteCategory } from '../../../../core/models/models';

@Component({
    selector: 'app-tab-notes',
    standalone: true,
    imports: [CommonModule, FormsModule, AppNotesList, AppNoteModal, AppSectionHeaderComponent],
    template: `
        <div class="glass-card shadow-sm flex flex-col">
            <div class="p-0">
                <app-section-header title="Notizen" icon="📝">
                    <div actions class="flex items-center gap-3">
                        <div class="relative hidden md:block w-64">
                            <input 
                                type="text" 
                                [(ngModel)]="searchText"
                                placeholder="Notizen durchsuchen..."
                                class="w-full bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-btn pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all font-medium"
                            >
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </span>
                        </div>
                        <button (click)="onNoteCreateRequested()" class="btn-primary !w-auto !py-2">
                            + Notiz
                        </button>
                    </div>
                </app-section-header>

                <app-notes-list
                    [entityId]="entity?.id"
                    [entityType]="entityType"
                    [notesDisplay]="displayNotes()"
                    [allowCreate]="true"
                    [allowEdit]="true"
                    [showHeader]="false"
                    [searchTerm]="searchText"
                    (noteCreateRequested)="onNoteCreateRequested()"
                    (noteEditRequested)="onNoteEditRequested($event)"
                    (noteDeleted)="onNoteDeleted($event)"
                ></app-notes-list>
            </div>
        </div>

        <app-note-modal
            [visible]="showNoteSubModal()"
            [note]="activeNote()"
            (close)="showNoteSubModal.set(false)"
            (save)="onNoteSave($event)"
            (delete)="onNoteDeleteFromModal()"
        ></app-note-modal>
    `
})
export class TabNotesComponent {
    @Input({ required: true }) entity!: any;
    @Input({ required: true }) entityType!: string;
    @Output() changed = new EventEmitter<{ notes: any[], citations: any[] }>();
    searchText = '';

    showNoteSubModal = signal(false);
    activeNoteIndex = signal<number | null>(null);
    activeNote = signal<DisplayNote | null>(null);

    displayNotes = computed(() => {
        if (!this.entity?.formattedNotes) return [];
        return this.entity.formattedNotes;
    });

    onNoteCreateRequested() {
        this.activeNoteIndex.set(null);
        this.activeNote.set(null);
        this.showNoteSubModal.set(true);
    }

    onNoteEditRequested(displayNote: DisplayNote) {
        const ent = this.entity;
        if (!ent || !ent.formattedNotes) return;

        const idx = ent.formattedNotes.findIndex((n: any) => n.id === displayNote.id);
        if (idx !== -1) {
            this.activeNoteIndex.set(idx);
            this.activeNote.set({ ...displayNote });
            this.showNoteSubModal.set(true);
        }
    }

    onNoteSave(draft: DisplayNote) {
        if (!draft.text.trim()) return;

        const ent = this.entity;
        if (!ent) return;

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
            ent.notes[idx] = { ...ent.notes[idx], ...apiNote };
        } else {
            ent.notes = ent.notes || [];
            ent.notes.push(apiNote);
        }

        this.changed.emit({ notes: [...ent.notes], citations: [...(ent.citations || [])] });
        this.showNoteSubModal.set(false);
    }

    onNoteDeleted(noteId: string) {
        const ent = this.entity;
        if (!ent || !ent.notes) return;

        const idx = ent.notes.findIndex((n: any, i: number) => (n.id || `note-${i}`) === noteId);
        if (idx !== -1) {
            ent.notes.splice(idx, 1);
            this.changed.emit({ notes: [...ent.notes], citations: [...(ent.citations || [])] });
            return true;
        }
        return false;
    }

    onNoteDeleteFromModal() {
        const idx = this.activeNoteIndex();
        if (idx === null) return;

        const ent = this.entity;
        if (!ent || !ent.notes) return;

        ent.notes.splice(idx, 1);
        this.changed.emit({ notes: [...ent.notes], citations: [...(ent.citations || [])] });
        this.showNoteSubModal.set(false);
    }
}
