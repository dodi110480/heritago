import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppModalShell } from './app-modal-shell';
import { DisplayNote, NoteCategory } from '../models';

@Component({
  selector: 'app-note-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AppModalShell],
  template: `
    <app-modal-shell 
        [visible]="visible()" 
        [title]="note()?.id ? 'Notiz bearbeiten' : 'Neue Notiz'" 
        icon="📝" 
        size="md"
        [showSave]="true" 
        [showDelete]="!!note()?.id" 
        (close)="close.emit()"
        (save)="onSave()"
        (delete)="onDelete()"
    >
        <div class="space-y-4">
            <div class="form-group mb-0">
                <label class="form-label text-xs uppercase tracking-wider font-bold text-neutral-500">Kategorie / Typ</label>
                <select [(ngModel)]="draft().noteType" class="form-input">
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
                    [(ngModel)]="draft().text" 
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
                    [(ngModel)]="draft().isPrivate"
                    class="checkbox checkbox-brand"
                >
            </div>
        </div>
    </app-modal-shell>
  `
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
