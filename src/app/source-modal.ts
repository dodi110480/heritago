import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { AppModalShell } from './ui/app-modal-shell';

@Component({
    selector: 'app-source-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, AppModalShell],
    templateUrl: './source-modal.html'
})
export class SourceModal implements OnInit {
    @Input() mode: 'add' | 'edit' = 'add';
    @Input() sourceData: any = null;
    @Input() currentTree: string | null = null;
    @Input() allSources: any[] = [];
    @Output() closeModal = new EventEmitter<void>();
    @Output() saved = new EventEmitter<void>();
    @Output() deleted = new EventEmitter<any>();
    @Output() merged = new EventEmitter<{ sourceId: string, targetId: string }>();

    private gedcomService = inject(GedcomService);

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

    // Actions
    mergeTargetId = signal('');
    reassignTargetId = signal('');

    ngOnInit() {
        if (this.mode === 'edit' && this.sourceData) {
            this.title.set(this.sourceData.title || '');
            this.shortTitle.set(this.sourceData.shortTitle || '');
            this.author.set(this.sourceData.author || '');
            this.publication.set(this.sourceData.publication || '');
            this.repositoryId.set(this.sourceData.repositoryId || '');
        }

        if (this.currentTree) {
            this.gedcomService.getRepositories(this.currentTree).subscribe({
                next: (res: any) => {
                    if (res.success) this.repositories.set(res.repositories);
                }
            });

            if (this.mode === 'edit' && this.sourceData?.id) {
                this.isLoadingUsage.set(true);
                this.gedcomService.getSourceUsage(this.currentTree, this.sourceData.id).subscribe({
                    next: (res) => {
                        this.isLoadingUsage.set(false);
                        if (res.success && res.usage) {
                            this.usages.set(res.usage.citations || []);
                        }
                    },
                    error: () => this.isLoadingUsage.set(false)
                });
            }
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
            repositoryId: this.repositoryId() || null,
        };

        if (this.mode === 'edit' && this.sourceData) {
            payload.id = this.sourceData.id;
        }

        this.gedcomService.saveSource(tree, payload).subscribe({
            next: (res: any) => {
                this.isSaving.set(false);
                if (res.success) {
                    this.saved.emit();
                } else {
                    this.errorMessage.set(res.message || 'Fehler beim Speichern der Quelle.');
                }
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
