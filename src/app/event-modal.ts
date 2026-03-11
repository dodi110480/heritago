import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppModalShell } from './shared/components/ui/app-modal-shell';
import { GedcomService } from './core/services/gedcom.service';
import { AppNotesList } from './shared/components/ui/app-notes-list/app-notes-list';
import { AppSourcesListComponent } from './shared/components/ui/app-sources-list/app-sources-list';
import { DisplayNote, NoteCategory, DisplaySource } from './core/models/models';


import { PlaceService } from './core/services/place.service';
import { MediaService } from './core/services/media.service';
@Component({
    selector: 'app-event-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, AppModalShell, AppNotesList, AppSourcesListComponent],
    templateUrl: './event-modal.html'
})
export class EventModal {
    public placeService = inject(PlaceService);
    public mediaService = inject(MediaService);
    @Input() visible = false;
    @Input() item: any = null; // draft
    @Input() isNew = false;
    @Input() showDelete = false;

    @Output() close = new EventEmitter<void>();
    @Output() save = new EventEmitter<void>();
    @Output() delete = new EventEmitter<void>();

    // action outputs for citations/media/notes

    @Output() addMedia = new EventEmitter<void>();
    @Output() removeMedia = new EventEmitter<number>();

    @Output() addNote = new EventEmitter<void>();
    @Output() removeNote = new EventEmitter<number>();

    @Output() openUpload = new EventEmitter<void>();
    @Output() openGallery = new EventEmitter<void>();
    @Output() openViewer = new EventEmitter<any>();
    @Output() masterSaved = new EventEmitter<void>();

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



        this.showNoteSubModal.set(false);
    }

    // Source Sub-Modal State
    showSourceSubModal = signal(false);
    activeSourceIndex = signal<number | null>(null);
    sourceDraft = signal<{ sourceId: string; confidence?: string; whereInSource?: string; date?: string; text?: string }>({
        sourceId: '', whereInSource: '', confidence: '', date: '', text: ''
    });
    @Input() availableSources: any[] = [];

    onSourceCreateRequested() {
        this.sourceDraft.set({ sourceId: '', whereInSource: '', confidence: '', date: '', text: '' });
        this.activeSourceIndex.set(null);
        this.showSourceSubModal.set(true);
    }

    onSourceEditRequested(source: DisplaySource & { _originalIndex?: number }) {
        if (source._originalIndex === undefined) return;
        const cit = this.item.citations[source._originalIndex];
        if (cit) {
            this.sourceDraft.set({
                sourceId: cit.sourceId || '',
                whereInSource: cit.whereInSource || '',
                confidence: cit.confidence || '',
                date: cit.date || '',
                text: cit.text || ''
            });
            this.activeSourceIndex.set(source._originalIndex);
            this.showSourceSubModal.set(true);
        }
    }

    onSourceSave() {
        const draft = this.sourceDraft();
        if (!draft.sourceId) {
            alert('Bitte wählen Sie eine gültige Quelle aus.');
            return;
        }

        if (!this.item.citations) this.item.citations = [];

        const newCit = {
            sourceId: draft.sourceId,
            whereInSource: draft.whereInSource || '',
            confidence: draft.confidence || '',
            date: draft.date || '',
            text: draft.text || ''
        };

        const idx = this.activeSourceIndex();
        if (idx !== null) {
            this.item.citations[idx] = { ...this.item.citations[idx], ...newCit };
        } else {
            this.item.citations.push(newCit);
        }

        this.showSourceSubModal.set(false);
    }

    normalizedSources(): (DisplaySource & { _originalIndex?: number })[] {
        if (!this.item || !this.item.citations) return [];
        return this.item.citations.map((c: any, i: number) => {
            const rawSource = this.availableSources.find(s => s.id === c.sourceId);
            return {
                id: c.id || `cit-${i}`,
                title: rawSource ? rawSource.title : 'Unbekannte Quelle',
                author: rawSource ? rawSource.author : undefined,
                publication: rawSource ? rawSource.publication : undefined,
                confidence: c.confidence as any,
                whereInSource: c.whereInSource || c.page,
                description: (c.whereInSource || c.page) ? `Fundstelle: ${c.whereInSource || c.page}` : '',
                text: c.text,
                createdAt: (c.date || c.dateText) ? new Date(c.date || c.dateText) : new Date(),
                _originalIndex: i
            };
        });
    }

    onSourceDeleted(sourceId: string) {
        const idx = this.item.citations.findIndex((c: any, i: number) => (c.id || `cit-${i}`) === sourceId);
        if (idx !== -1) {
            if (confirm('Möchtest du diesen Beleg wirklich löschen?')) {
                this.item.citations.splice(idx, 1);
            }
        }
    }

    onSourceDeleteFromModal() {
        const idx = this.activeSourceIndex();
        if (idx !== null && this.item.citations && this.item.citations[idx]) {
            this.item.citations.splice(idx, 1);
            this.showSourceSubModal.set(false);
        }
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
        return this.mediaService.getMediaUrl(idOrUrl, variant || 'thumbs');
    }

    emitClose() { this.close.emit(); }
    emitSave() { this.save.emit(); }
    emitDelete() { this.delete.emit(); }

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

        this.placeService.searchPlaces(treeName, query).subscribe(res => {
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
