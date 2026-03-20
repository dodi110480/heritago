import { Component, Input, Output, EventEmitter, OnInit, signal, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { TreeService } from '../../core/services/tree.service';
import { AppModalShell } from '../../shared/components/ui/app-modal-shell';
import { AppNotesList } from '../../shared/components/ui/app-notes-list/app-notes-list';
import { AppUsageList } from '../../shared/components/ui/app-usage-list/app-usage-list';
import { DisplayNote, NoteCategory } from '../../core/models/models';


import { SourceService } from '../../core/services/source.service';
@Component({
    selector: 'app-source-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, AppModalShell, AppNotesList, AppUsageList],
    templateUrl: './source-modal.html'
})
export class SourceModal implements OnInit {
    public sourceService = inject(SourceService);
    @Input() mode: 'add' | 'edit' = 'add';
    @Input() sourceData: any = null;
    @Input() currentTree: string | null = null;
    @Input() allSources: any[] = [];
    @Output() closeModal = new EventEmitter<void>();
    @Output() saved = new EventEmitter<void>();
    @Output() deleted = new EventEmitter<any>();
    @Output() merged = new EventEmitter<{ sourceId: string, targetId: string }>();

    private treeService = inject(TreeService);
    private cdr = inject(ChangeDetectorRef);

    visible = true;
    isSaving = signal(false);
    isLoadingUsage = signal(false);
    errorMessage = signal<string | null>(null);
    repositories = signal<any[]>([]);
    usages = signal<any[]>([]);

    // Form Fields
    title = signal('');
    shortTitle = signal('');
    author = signal('');
    publication = signal('');
    repositoryId = signal('');
    sourceType = signal<string>('ANDERE');
    category = signal<string>('SECONDARY');

    mergeTargetId = signal('');
    reassignTargetId = signal('');

    // Notes State (Standardized)
    notes = signal<DisplayNote[]>([]);
    showNoteSubModal = signal(false);
    activeNoteIndex = signal<number | null>(null);
    noteDraft = signal<{ text: string, noteType: NoteCategory, isPrivate: boolean }>({
        text: '',
        noteType: 'OTHER',
        isPrivate: false
    });
    
    // Tab State
    activeTab = signal<'details' | 'notes'>('details');

    setTab(tab: 'details' | 'notes') {
        this.activeTab.set(tab);
        this.cdr.detectChanges();
    }

    ngOnInit() {
        if (this.mode === 'edit' && this.sourceData) {
            this.title.set(this.sourceData.title || '');
            this.shortTitle.set(this.sourceData.shortTitle || '');
            this.author.set(this.sourceData.author || '');
            this.publication.set(this.sourceData.publication || '');
            this.repositoryId.set(this.sourceData.repositoryId || '');
            this.sourceType.set(this.sourceData.sourceType || 'ANDERE');
            this.category.set(this.sourceData.category || 'SECONDARY');
        }

        if (this.currentTree) {
            this.sourceService.getRepositories(this.currentTree).subscribe({
                next: (repos: any) => {
                    this.repositories.set(repos || []);
                }
            });

            if (this.mode === 'edit' && this.sourceData?.id) {
                // Fetch full source data including notes
                this.treeService.getTreeData().subscribe();
                this.sourceService.getSource(this.currentTree, this.sourceData.id).subscribe({
                    next: (source) => {
                        if (source) {
                            this.notes.set(source.notes || []);
                        }
                    }
                });

                this.isLoadingUsage.set(true);
                this.sourceService.getSourceUsage(this.currentTree, this.sourceData.id).subscribe({
                    next: (usage) => {
                        this.isLoadingUsage.set(false);
                        if (usage) {
                            this.usages.set(usage.citations || []);
                        }
                    },
                    error: () => this.isLoadingUsage.set(false)
                });
            }
        }
    }

    // Note Management
    onNoteCreateRequested() {
        this.activeNoteIndex.set(null);
        this.noteDraft.set({ text: '', noteType: 'OTHER', isPrivate: false });
        this.showNoteSubModal.set(true);
    }

    onNoteEditRequested(note: DisplayNote) {
        const idx = this.notes().findIndex(n => n.id === note.id);
        if (idx !== -1) {
            this.activeNoteIndex.set(idx);
            this.noteDraft.set({
                text: note.text,
                noteType: note.noteType || 'OTHER',
                isPrivate: !!note.isPrivate
            });
            this.showNoteSubModal.set(true);
        }
    }

    onNoteSave() {
        const draft = this.noteDraft();
        if (!draft.text.trim()) return;

        const currentNotes = [...this.notes()];
        const idx = this.activeNoteIndex();

        if (idx !== null) {
            currentNotes[idx] = {
                ...currentNotes[idx],
                text: draft.text.trim(),
                noteType: draft.noteType as NoteCategory,
                isPrivate: draft.isPrivate,
                updatedAt: new Date()
            };
        } else {
            currentNotes.push({
                id: `note-${Date.now()}`,
                text: draft.text.trim(),
                noteType: draft.noteType as NoteCategory,
                isPrivate: draft.isPrivate,
                createdAt: new Date()
            });
        }

        this.notes.set(currentNotes);
        this.showNoteSubModal.set(false);
    }

    onNoteDeleted(noteId: string) {
        if (confirm('Möchtest du diese Notiz wirklich löschen?')) {
            this.notes.set(this.notes().filter(n => n.id !== noteId));
        }
    }

    onNoteDeleteFromModal() {
        const idx = this.activeNoteIndex();
        if (idx !== null) {
            const currentNotes = [...this.notes()];
            currentNotes.splice(idx, 1);
            this.notes.set(currentNotes);
            this.showNoteSubModal.set(false);
        }
    }

    close() {
        this.closeModal.emit();
    }

    save() {
        if (!this.title().trim()) {
            this.errorMessage.set('Titel der Quelle ist erforderlich.');
            return;
        }

        const tree = this.currentTree;
        if (!tree) return;

        this.isSaving.set(true);
        this.errorMessage.set(null);

        const payload: any = {
            title: this.title().trim(),
            shortTitle: this.shortTitle().trim() || null,
            author: this.author().trim() || null,
            publication: this.publication().trim() || null,
            sourceType: this.sourceType() || null,
            category: this.category() || null,
            repositoryId: this.repositoryId() || null,
            notes: this.notes()
        };

        if (this.mode === 'edit' && this.sourceData) {
            payload.id = this.sourceData.id;
        }

        this.sourceService.saveSource(tree, payload).pipe(
            map(res => res?.success ? res : { success: false, message: res?.message || 'Unknown error' })
        ).subscribe({
            next: (res: any) => {
                this.isSaving.set(false);
                if (res.success) {
                    this.saved.emit();
                } else {
                    this.errorMessage.set(res.message || 'Fehler beim Speichern der Quelle.');
                }
                this.cdr.detectChanges();
            },
            error: (err: any) => {
                this.isSaving.set(false);
                this.errorMessage.set(err.error?.message || 'Netzwerkfehler beim Speichern.');
            }
        });
    }

    deleteSource() {
        if (!this.sourceData) return;
        const payload = {
            source: this.sourceData,
            reassignToId: this.reassignTargetId()
        };
        this.deleted.emit(payload);
    }

    mergeSource() {
        if (!this.sourceData || !this.mergeTargetId()) return;
        this.merged.emit({
            sourceId: this.sourceData.id,
            targetId: this.mergeTargetId()
        });
    }
}
