import { Component, input, output, signal, computed, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { GlassCardComponent } from './app-glass-card';

import { DisplayNote, NoteCategory } from '../models';

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
  template: `
    <div class="space-y-6">
      <!-- Header -->
      @if (showHeader()) {
        <div class="flex items-center justify-between gap-4">
          <div class="flex-1 max-w-sm relative">
            <input
              *ngIf="!readOnly()"
              type="text"
              [(ngModel)]="searchQuery"
              [placeholder]="placeholder()"
              class="w-full bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-btn pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all font-medium"
            >
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
          </div>

          <button
            *ngIf="allowCreate() && !readOnly()"
            (click)="noteCreateRequested.emit()"
            class="btn-primary !w-auto !py-2 shadow-brand-sm transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Neue Notiz</span>
          </button>
        </div>
      }

      <!-- Empty State -->
      <div *ngIf="filteredNotes().length === 0" class="flex flex-col items-center justify-center py-16 text-neutral-500 bg-neutral-50/50 dark:bg-neutral-900/20 rounded-card border-2 border-dashed border-neutral-200 dark:border-neutral-800">
        <span class="text-3xl mb-3 opacity-50">📝</span>
        <p class="font-medium text-sm">{{ searchQuery ? 'Keine passenden Notizen gefunden.' : 'Noch keine Notizen hinzugefügt.' }}</p>
      </div>

      <!-- Notizenliste -->
      <div class="space-y-4">
        @for (note of filteredNotes(); track note.id) {
          <app-glass-card
            variant="note"
            [borderColor]="getNoteTypeBorder(note.noteType)"
            [clickable]="allowEdit() && !readOnly()"
            (cardClicked)="onEdit(note)"
          >
            <div class="flex flex-col gap-3">
              <!-- Meta Row -->
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" [ngClass]="getNoteTypeClass(note.noteType)">
                  {{ note.noteType || 'NOTIZ' }}
                </span>

                @for (tag of note.tags; track tag) {
                  <span class="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-[10px] font-medium">#{{ tag }}</span>
                }

                <span *ngIf="note.isPrivate" class="text-amber-500" title="Privat">🔒</span>
              </div>

              <!-- Content Row -->
              <div class="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed font-body">
                <div [class.line-clamp-4]="!note.expanded" class="whitespace-pre-line overflow-hidden transition-all duration-300">
                  {{ note.text }}
                </div>

                <button
                  *ngIf="note.text.length > 220"
                  (click)="note.expanded = !note.expanded; $event.stopPropagation()"
                  class="text-xs text-brand-600 hover:text-brand-500 font-bold mt-2 flex items-center gap-1"
                >
                  @if (note.expanded) {
                    <span>Weniger anzeigen</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                  } @else {
                    <span>Mehr anzeigen</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  }
                </button>
              </div>

              <!-- Footer Row -->
              <div class="text-[11px] text-neutral-500 flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800/50 pt-3 mt-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-neutral-600 dark:text-neutral-400">
                    {{ note.createdBy?.username || 'Unbekannt' }}
                  </span>
                  <span class="opacity-30">•</span>
                  <span>{{ note.createdAt | date:'dd.MM.yyyy HH:mm' }}</span>
                </div>

                <div *ngIf="note.linkedEntity" class="flex items-center gap-1">
                  <span class="opacity-50">verknüpft mit</span>
                  <a
                    [routerLink]="note.linkedEntity.url"
                    class="text-brand-600 hover:text-brand-500 font-bold decoration-brand-500/30 underline underline-offset-2"
                    (click)="$event.stopPropagation()"
                  >
                    {{ note.linkedEntity.label }}
                  </a>
                </div>
              </div>
            </div>

            <!-- Actions Slot -->
            <ng-container actions>
              <button
                *ngIf="allowEdit() && !readOnly()"
                (click)="onDelete(note.id); $event.stopPropagation()"
                class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-neutral-400 hover:text-red-500 transition-all"
                title="Löschen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </ng-container>
          </app-glass-card>
        }
      </div>
    </div>
  `,
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
