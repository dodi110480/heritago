import { Component, inject, signal, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GedcomService } from './gedcom.service';
import { AppEntityCard } from './ui/app-entity-card';
import { AppModalShell } from './ui/app-modal-shell';

@Component({
    selector: 'app-repository-list',
    standalone: true,
    imports: [CommonModule, FormsModule, AppEntityCard, AppModalShell],
    templateUrl: './repository-list.html'
})
export class RepositoryList implements OnInit {
    @Input() currentTree: string | null = null;

    private gedcomService = inject(GedcomService);

    repositories = signal<any[]>([]);
    loading = signal(true);
    selectedRepo = signal<any | null>(null);

    // Modal state
    modalVisible = false;
    modalMode: 'add' | 'edit' = 'add';
    isSaving = signal(false);
    errorMessage = signal<string | null>(null);

    // Form fields
    formName = signal('');
    formAddress = signal('');
    formPhone = signal('');
    formEmail = signal('');
    formWebsite = signal('');

    ngOnInit() {
        this.loadRepositories();
    }

    loadRepositories() {
        if (!this.currentTree) return;
        this.loading.set(true);
        this.gedcomService.getRepositories(this.currentTree).subscribe({
            next: (res: any) => {
                if (res.success) this.repositories.set(res.repositories);
                this.loading.set(false);
            },
            error: () => this.loading.set(false)
        });
    }

    openAddModal() {
        this.modalMode = 'add';
        this.selectedRepo.set(null);
        this.resetForm();
        this.errorMessage.set(null);
        this.modalVisible = true;
    }

    openEditModal(repo: any) {
        this.modalMode = 'edit';
        this.selectedRepo.set(repo);
        this.formName.set(repo.name || '');
        this.formAddress.set(repo.address || '');
        this.formPhone.set(repo.phone || '');
        this.formEmail.set(repo.email || '');
        this.formWebsite.set(repo.website || '');
        this.errorMessage.set(null);
        this.modalVisible = true;
    }

    closeModal() {
        this.modalVisible = false;
    }

    resetForm() {
        this.formName.set('');
        this.formAddress.set('');
        this.formPhone.set('');
        this.formEmail.set('');
        this.formWebsite.set('');
    }

    save() {
        if (!this.formName().trim()) {
            this.errorMessage.set('Name ist erforderlich.');
            return;
        }
        if (!this.currentTree) return;

        this.isSaving.set(true);
        this.errorMessage.set(null);

        const payload: any = {
            name: this.formName().trim(),
            address: this.formAddress().trim() || null,
            phone: this.formPhone().trim() || null,
            email: this.formEmail().trim() || null,
            website: this.formWebsite().trim() || null,
        };

        if (this.modalMode === 'edit' && this.selectedRepo()) {
            payload.id = this.selectedRepo().id;
        }

        this.gedcomService.saveRepository(this.currentTree, payload).subscribe({
            next: (res: any) => {
                this.isSaving.set(false);
                if (res.success) {
                    this.modalVisible = false;
                    this.loadRepositories();
                } else {
                    this.errorMessage.set(res.message || 'Fehler beim Speichern.');
                }
            },
            error: (err: any) => {
                this.isSaving.set(false);
                this.errorMessage.set(err.error?.message || 'Netzwerkfehler.');
            }
        });
    }

    deleteRepo(repo: any) {
        if (!this.currentTree) return;
        if (!confirm(`Archiv "${repo.name}" wirklich löschen? Verknüpfte Quellen werden nicht gelöscht.`)) return;

        this.gedcomService.saveRepository(this.currentTree, { id: repo.id, mode: 'delete' }).subscribe({
            next: () => {
                if (this.selectedRepo()?.id === repo.id) {
                    this.selectedRepo.set(null);
                    this.modalVisible = false;
                }
                this.loadRepositories();
            }
        });
    }
}
