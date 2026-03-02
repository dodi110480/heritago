import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GedcomService } from './gedcom.service';

@Component({
    selector: 'app-source-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './source-modal.html'
})
export class SourceModal implements OnInit {
    @Input() mode: 'add' | 'edit' = 'add';
    @Input() sourceData: any = null;
    @Input() currentTree: string | null = null;
    @Output() closeModal = new EventEmitter<void>();
    @Output() saved = new EventEmitter<void>();

    private gedcomService = inject(GedcomService);

    isSaving = signal(false);
    errorMessage = signal<string | null>(null);

    // Form Fields
    title = signal('');
    shortTitle = signal('');
    author = signal('');
    publication = signal('');
    repositoryId = signal('');
    repositoryName = signal(''); // Free text fallback or placeholder logic

    ngOnInit() {
        if (this.mode === 'edit' && this.sourceData) {
            this.title.set(this.sourceData.title || '');
            this.shortTitle.set(this.sourceData.shortTitle || '');
            this.author.set(this.sourceData.author || '');
            this.publication.set(this.sourceData.publication || '');
            this.repositoryId.set(this.sourceData.repositoryId || '');
            this.repositoryName.set(this.sourceData.repositoryName || '');
        }
    }

    close() {
        this.closeModal.emit();
    }

    save() {
        if (!this.title().trim()) {
            this.errorMessage.set('Source Title is required.');
            return;
        }

        const tree = this.currentTree;
        if (!tree) return;

        this.isSaving.set(true);
        this.errorMessage.set(null);

        const payload: any = {
            title: this.title().trim(),
            shortTitle: this.shortTitle().trim(),
            author: this.author().trim(),
            publication: this.publication().trim(),
            // repositoryId: this.repositoryId().trim() || null // Skipping repository linking for the simple V1 implementation unless specifically searched
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
}
