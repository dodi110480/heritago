import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppModalShell } from '../app-modal-shell';
import { DisplayNote, NoteCategory } from '../../../../core/models/models';

@Component({
  selector: 'app-note-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AppModalShell],
  templateUrl: './app-note-modal.html'
})
export class AppNoteModal {
  visible = input.required<boolean>();
  note = input<DisplayNote | null>(null);
  
  close = output<void>();
  save = output<DisplayNote>();
  delete = output<void>();

  draft = signal<DisplayNote>({
    id: '',
    text: '',
    noteType: 'COMMENT' as NoteCategory,
    createdAt: new Date(),
    isPrivate: false
  });

  ngOnChanges() {
    if (this.visible()) {
      const n = this.note();
      if (n) {
        this.draft.set({ ...n });
      } else {
        this.draft.set({
          id: '',
          text: '',
          noteType: 'COMMENT' as NoteCategory,
          createdAt: new Date(),
          isPrivate: false
        });
      }
    }
  }

  onSave() {
    if (!this.draft().text.trim()) return;
    this.save.emit(this.draft());
  }

  onDelete() {
    if (confirm('Möchtest du diese Notiz wirklich löschen?')) {
      this.delete.emit();
    }
  }
}
