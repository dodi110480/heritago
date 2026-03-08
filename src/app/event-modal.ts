import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppModalShell } from './ui/app-modal-shell';
import { GedcomService } from './gedcom.service';
import { AppNotesList } from './ui/app-notes-list';
import { DisplayNote, NoteCategory } from './models';

@Component({
    selector: 'app-event-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, AppModalShell, AppNotesList],
    templateUrl: './event-modal.html'
})
export class EventModal {
    @Input() visible = false;
    @Input() item: any = null; // draft
    @Input() isNew = false;
    @Input() showDelete = false;

    @Output() close = new EventEmitter<void>();
    @Output() save = new EventEmitter<void>();
    @Output() delete = new EventEmitter<void>();

    // action outputs for citations/media/notes
    @Output() addCitation = new EventEmitter<void>();
    @Output() removeCitation = new EventEmitter<number>();

    @Output() addMedia = new EventEmitter<void>();
    @Output() removeMedia = new EventEmitter<number>();

    @Output() addNote = new EventEmitter<void>();
    @Output() removeNote = new EventEmitter<number>();

    @Output() openUpload = new EventEmitter<void>();
    @Output() openGallery = new EventEmitter<void>();
    @Output() openViewer = new EventEmitter<any>();

    activeTab = signal<'basics' | 'participants' | 'citations' | 'media' | 'notes'>('basics');

    // Note Sub-Modal State
    showNoteSubModal = signal(false);
    activeNoteIndex = signal<number | null>(null);
    noteDraft = signal<{ text: string; noteType: NoteCategory; isPrivate: boolean }>({
        text: '', noteType: 'OTHER', isPrivate: false
    });

    onNoteCreateRequested() {
        this.noteDraft.set({ text: '', noteType: 'OTHER', isPrivate: false });
        this.activeNoteIndex.set(null);
        this.showNoteSubModal.set(true);
    }

    onNoteEditRequested(note: DisplayNote) {
        const idx = this.item.notes.findIndex((n: any, i: number) => (n.id || `note-${i}`) === note.id);
        if (idx !== -1) {
            this.noteDraft.set({
                text: note.text || '',
                noteType: note.noteType || 'OTHER',
                isPrivate: !!note.isPrivate
            });
            this.activeNoteIndex.set(idx);
            this.showNoteSubModal.set(true);
        }
    }

    onNoteSave() {
        const draft = this.noteDraft();
        if (!draft.text.trim()) return;

        if (!this.item.notes) this.item.notes = [];

        const newNote: DisplayNote = {
            id: `note-${Date.now()}`,
            text: draft.text.trim(),
            noteType: draft.noteType,
            isPrivate: draft.isPrivate,
            createdAt: new Date()
        };

        const idx = this.activeNoteIndex();
        if (idx !== null) {
            this.item.notes[idx] = { ...this.item.notes[idx], ...newNote, id: this.item.notes[idx].id || newNote.id };
        } else {
            this.item.notes.push(newNote);
        }

        try {
            console.log('[EventModal] note saved locally', { itemId: this.item?.id, note: newNote, notesCount: this.item?.notes?.length });
        } catch (e) {}

        this.showNoteSubModal.set(false);
    }

    // Normalize legacy notes (strings) to DisplayNote objects for the notes list
    normalizedNotes(): DisplayNote[] {
        if (!this.item || !this.item.notes) return [];
        return this.item.notes.map((n: any, i: number) => {
            if (!n) return null;
            if (typeof n === 'string') {
                return {
                    id: this.item.notes[i] && typeof this.item.notes[i] === 'string' ? `note-${i}` : `note-${Date.now()}-${i}`,
                    text: n,
                    noteType: 'OTHER',
                    createdAt: new Date()
                } as DisplayNote;
            }
            return n as DisplayNote;
        }).filter(Boolean) as DisplayNote[];
    }

    onNoteDeleted(noteId: string) {
        const idx = this.item.notes.findIndex((n: any, i: number) => (n.id || `note-${i}`) === noteId);
        if (idx !== -1) {
            if (confirm('Möchtest du diese Notiz wirklich löschen?')) {
                this.item.notes.splice(idx, 1);
            }
        }
    }

    onNoteDeleteFromModal() {
        const idx = this.activeNoteIndex();
        if (idx !== null && this.item.notes && this.item.notes[idx]) {
            this.item.notes.splice(idx, 1);
            this.showNoteSubModal.set(false);
        }
    }

    private gedcomService = inject(GedcomService);

    // Place search suggestions
    placeSearchResults = signal<string[]>([]);
    showPlaceResults = signal(false);

    getMediaUrl(idOrUrl: string | undefined, variant?: string) {
        if (!idOrUrl) return null;
        return this.gedcomService.getMediaUrl(idOrUrl, variant || 'thumbs');
    }

    emitClose() { this.close.emit(); }
    emitSave() { this.save.emit(); }
    emitDelete() { this.delete.emit(); }

    emitAddCitation() { this.addCitation.emit(); }
    emitRemoveCitation(i: number) { this.removeCitation.emit(i); }

    emitAddMedia() { this.addMedia.emit(); }
    emitRemoveMedia(i: number) { this.removeMedia.emit(i); }

    emitAddNote() { this.addNote.emit(); }
    emitRemoveNote(i: number) { this.removeNote.emit(i); }

    emitOpenUpload() { this.openUpload.emit(); }
    emitOpenGallery() { this.openGallery.emit(); }
    emitOpenViewer(m: any) { this.openViewer.emit(m); }

    // Participant management (client-side in draft for now, like citations)
    @Input() allPersonsOptions: any[] = [];
    showParticipantAddModal = signal(false);
    newParticipantDraft = signal<any>({ role: 'OTHER', personInput: '', relationText: '', notes: '' });

    addParticipant() {
        this.newParticipantDraft.set({ role: 'OTHER', personInput: '', relationText: '', notes: '' });
        this.showParticipantAddModal.set(true);
    }

    confirmAddParticipant() {
        const draft = this.newParticipantDraft();
        const personInput = (draft.personInput || '').trim();
        const match = this.allPersonsOptions.find((opt: any) => opt.displayName === personInput);
        
        const participant = {
            role: draft.role || 'OTHER',
            associatedPersonId: match?.id || null,
            associatedPersonName: match ? match.displayName.replace(` (${match.id})`, '') : personInput,
            relationText: draft.relationText || '',
            notes: draft.notes || '',
            citations: []
        };

        if (!this.item.associations) this.item.associations = [];
        this.item.associations.push(participant);
        this.showParticipantAddModal.set(false);
    }

    removeParticipant(index: number) {
        if (this.item.associations) {
            this.item.associations.splice(index, 1);
        }
    }

    // Place search for live suggestions
    onPlaceInput(query: string) {
        if (!query || query.length < 2) {
            this.placeSearchResults.set([]);
            this.showPlaceResults.set(false);
            return;
        }

        const treeName = this.gedcomService.currentTreeData()?.meta?.tree || '';
        if (!treeName) {
            this.placeSearchResults.set([]);
            this.showPlaceResults.set(false);
            return;
        }

        this.gedcomService.searchPlaces(treeName, query).subscribe(res => {
            this.placeSearchResults.set(res.results || []);
            this.showPlaceResults.set(true);
        });
    }

    selectPlace(placeName: string) {
        if (!this.item) return;
        this.item.place = placeName;
        this.placeSearchResults.set([]);
        this.showPlaceResults.set(false);
    }

    getRoleLabel(role: string): string {
        switch (role) {
            case 'GODPARENT': return 'Pate / Gevatter';
            case 'WITNESS': return 'Zeuge';
            case 'CLERGY': return 'Pfarrer / Priester';
            case 'INFORMANT': return 'Informant';
            case 'MIDWIFE': return 'Hebamme';
            case 'DOCTOR': return 'Arzt';
            case 'UNDERTAKER': return 'Bestatter';
            case 'OTHER': return 'Andere / Beteiligter';
            default: return role;
        }
    }
}
