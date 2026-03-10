import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppModalShell } from '../app-modal-shell';
import { AppNotesList } from '../app-notes-list/app-notes-list';
import { AppNoteModal } from '../app-note-modal/app-note-modal';
import { Citation, DisplayNote, NoteCategory } from '../../models';

@Component({
  selector: 'app-citation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AppModalShell, AppNotesList, AppNoteModal],
  templateUrl: './citation-modal.html'
})
export class CitationModalComponent {
  visible = input.required<boolean>();
  citation = input<Citation | null>(null);
  availableSources = input<any[]>([]);
  
  close = output<void>();
  save = output<Citation>();
  delete = output<void>();

  activeTab = signal<'basics' | 'notes'>('basics');
  
  showNoteModal = signal(false);
  activeNote = signal<DisplayNote | null>(null);
  activeNoteIndex = signal<number | null>(null);

  draft = signal<Citation>({
    sourceId: '',
    whereInSource: '',
    date: '',
    text: '',
    quality: 2,
    notes: []
  });

  // Since we rely on the parent to provide the citation, we need to sync it to our draft when it changes or modal opens
  // However, with signal inputs, we can use an effect or just update when visible changes.
  // We'll use a setter or simple logic in the template/parent.
  // For now, let's provide a method the parent can call or use a computed/effect.
  
  private lastCitationId: string | undefined = undefined;

  constructor() {
    // We update the draft when the citation input changes
    // or when the modal becomes visible
  }

  ngOnChanges() {
    if (this.visible()) {
      const cit = this.citation();
      if (cit) {
        this.draft.set({
          ...cit,
          sourceId: cit.sourceId || '',
          whereInSource: cit.whereInSource || '',
          date: cit.date || '',
          text: cit.text || '',
          quality: cit.quality ?? 2,
          notes: cit.notes ? [...cit.notes] : []
        });
      } else {
        this.draft.set({
          sourceId: '',
          whereInSource: '',
          date: '',
          text: '',
          quality: 2,
          notes: []
        });
      }
    }
  }

  onSave() {
    this.save.emit(this.draft());
  }

  onDelete() {
    if (confirm('Möchten Sie diesen Beleg wirklich löschen?')) {
      this.delete.emit();
    }
  }

  // Note Handlers
  onNoteCreateRequested() {
    this.activeNote.set(null);
    this.activeNoteIndex.set(null);
    this.showNoteModal.set(true);
  }

  onNoteEditRequested(note: DisplayNote) {
    const notes = this.draft().notes || [];
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx !== -1) {
      this.activeNote.set(note);
      this.activeNoteIndex.set(idx);
      this.showNoteModal.set(true);
    }
  }

  onNoteSave(note: DisplayNote) {
    const d = this.draft();
    const notes = [...(d.notes || [])];
    const idx = this.activeNoteIndex();

    if (idx !== null) {
      notes[idx] = note;
    } else {
      notes.push({ ...note, id: 'note-' + Date.now() });
    }

    this.draft.set({ ...d, notes });
    this.showNoteModal.set(false);
  }

  onNoteDeleteFromModal() {
    const idx = this.activeNoteIndex();
    if (idx !== null) {
      const d = this.draft();
      const notes = [...(d.notes || [])];
      notes.splice(idx, 1);
      this.draft.set({ ...d, notes });
    }
    this.showNoteModal.set(false);
  }

  onNoteDeleted(noteId: string) {
    const currentNotes = this.draft().notes || [];
    this.draft.update(d => ({
      ...d,
      notes: currentNotes.filter(n => n.id !== noteId)
    }));
  }

  getConfidenceLabel(val?: number): string {
    switch(val) {
      case 3: return 'Sicher';
      case 2: return 'Sehr wahrscheinlich';
      case 1: return 'Wahrscheinlich';
      case 0: return 'Unzuverlässig';
      default: return 'Wählen...';
    }
  }
}
