import { Component, input, output, signal, computed, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { GlassCardComponent } from '../app-glass-card';

import { DisplayNote, NoteCategory } from '../../models';

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
      case 'RESEARCH': return '#3b82f6'; // blue
      case 'HINT': return '#8b5cf6'; // purple
      case 'QUESTION': return '#f59e0b'; // amber
      case 'TRANSCRIPTION': return '#10b981'; // emerald
      case 'TODO': return '#ef4444'; // red
      case 'COMMENT': return '#6b7280'; // gray
      default: return '#6366f1'; // brand/indigo
    }
  }

  getNoteTypeClass(type?: NoteCategory): string {
    switch (type) {
      case 'RESEARCH': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
      case 'HINT': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20';
      case 'QUESTION': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      case 'TRANSCRIPTION': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      case 'TODO': return 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20';
      case 'COMMENT': return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20';
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
