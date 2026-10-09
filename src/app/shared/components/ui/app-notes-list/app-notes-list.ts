import { Component, input, output, signal, computed, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { GlassCardComponent } from '../app-glass-card';

import { DisplayNote, NoteCategory } from '../../../../core/models/models';

export type EntityType = 'PERSON' | 'EVENT' | 'FACT' | 'FAMILY' | 'SOURCE' | 'PLACE' | 'RESEARCHLOG' | 'MEDIA' | 'CITATION';

@Component({
  selector: 'app-notes-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    GlassCardComponent
  ],
  templateUrl: './app-notes-list.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppNotesList {
  entityId = input.required<string>();
  entityType = input.required<string>();
  notesDisplay = input<DisplayNote[]>([]);
  allowCreate = input<boolean>(true);
  allowEdit = input<boolean>(true);
  readOnly = input<boolean>(false);
  showCreatedBy = input<boolean>(true);
  placeholder = input<string>('Notizen durchsuchen...');
  showHeader = input<boolean>(true);
  searchTerm = input<string>('');

  noteEditRequested = output<DisplayNote>();
  noteCreateRequested = output<void>();
  noteDeleted = output<string>();
  countChanged = output<number>();

  searchQuery = '';

  filteredNotes = computed(() => {
    const query = (this.searchQuery.toLowerCase().trim() || this.searchTerm().toLowerCase().trim());
    const notes = this.notesDisplay();
    if (!query) return notes;
    return notes.filter(n => 
      n.text.toLowerCase().includes(query) || 
      (n.tags && n.tags.some(t => t.toLowerCase().includes(query))) ||
      (n.noteType && n.noteType.toLowerCase().includes(query))
    );
  });

  onEdit(note: DisplayNote) {
    if (this.allowEdit() && !this.readOnly()) {
      this.noteEditRequested.emit(note);
    }
  }

  onDelete(noteId: string) {
    if (confirm('Möchtest du diese Notiz wirklich löschen?')) {
      this.noteDeleted.emit(noteId);
    }
  }

  getNoteTypeBorder(type?: NoteCategory): string {
    switch (type) {
      case 'RESEARCH': return 'var(--color-note-research)';
      case 'HINT': return 'var(--color-note-hint)';
      case 'QUESTION': return 'var(--color-note-question)';
      case 'TRANSCRIPTION': return 'var(--color-note-transcription)';
      case 'TODO': return 'var(--color-note-todo)';
      case 'COMMENT': return 'var(--color-note-comment)';
      default: return 'var(--color-note-default)';
    }
  }

  getNoteTypeClass(type?: NoteCategory): string {
    switch (type) {
      case 'RESEARCH': return 'bg-accent-violet-500/10 text-accent-violet-600 dark:text-accent-violet-400 border border-accent-violet-500/20';
      case 'HINT': return 'bg-accent-violet-500/10 text-accent-violet-600 dark:text-accent-violet-400 border border-accent-violet-500/20';
      case 'QUESTION': return 'bg-accent-highlight-500/10 text-accent-highlight-600 dark:text-accent-highlight-400 border border-accent-highlight-500/20';
      case 'TRANSCRIPTION': return 'bg-accent-success-500/10 text-accent-success-600 dark:text-accent-success-400 border border-accent-success-500/20';
      case 'TODO': return 'bg-accent-danger-500/10 text-accent-danger-600 dark:text-accent-danger-400 border border-accent-danger-500/20';
      case 'COMMENT': return 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20';
      default: return 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20';
    }
  }

  getNoteTypeLabel(type?: NoteCategory): string {
    switch (type) {
      case 'RESEARCH': return 'Forschung';
      case 'HINT': return 'Hinweis';
      case 'QUESTION': return 'Frage';
      case 'TRANSCRIPTION': return 'Transkription';
      case 'TODO': return 'Aufgabe';
      case 'COMMENT': return 'Kommentar';
      case 'OTHER': return 'Andere';
      default: return 'Andere';
    }
  }
}
