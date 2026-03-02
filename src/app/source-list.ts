import { Component, inject, signal, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { SourceModal } from './source-modal';

@Component({
    selector: 'app-source-list',
    standalone: true,
    imports: [CommonModule, FormsModule, SourceModal],
    templateUrl: './source-list.html',
    encapsulation: ViewEncapsulation.None
})
export class SourceList implements OnInit {
    private gedcomService = inject(GedcomService);
    private router = inject(Router);

    sources = signal<any[]>([]);
    loading = signal(true);
    isSaving = signal(false);
    currentTree = signal<string | null>(null);
    errorMessage = signal<string | null>(null);
    selectedSource = signal<any | null>(null);
    selectedUsage = signal<any | null>(null);
    loadingUsage = signal(false);
    mergeTargetId = signal<string>('');
    reassignTargetId = signal<string>('');
    detailsOpen = signal(false);
    searchQuery = signal<string>('');

    // Modal State
    isModalOpen = false;
    modalMode: 'add' | 'edit' = 'add';
    selectedSourceData: any = null;

    ngOnInit() {
        this.loadSources();
    }

    loadSources() {
        this.loading.set(true);
        this.gedcomService.getTreeData().subscribe(treeData => {
            if (treeData && treeData.meta && treeData.meta.tree) {
                this.currentTree.set(treeData.meta.tree);
                this.refreshList();
            } else {
                this.loading.set(false);
            }
        });
    }

    refreshList() {
        const tree = this.currentTree();
        if (!tree) return;

        this.gedcomService.getSources(tree).subscribe({
            next: (res: any) => {
                const items = res.sources || [];
                // Client-side sorting is already done from backend, but could be dynamic
                this.sources.set(items);
                this.loading.set(false);
                const sel = this.selectedSource();
                if (sel) {
                    const refreshed = items.find((s: any) => s.id === sel.id) || null;
                    this.selectedSource.set(refreshed);
                    if (refreshed) this.loadUsage(refreshed.id);
                }
            },
            error: () => this.loading.set(false)
        });
    }

    get filteredSources() {
        const query = this.searchQuery().toLowerCase();
        if (!query) return this.sources();
        return this.sources().filter((s: any) =>
            (s.title || '').toLowerCase().includes(query) ||
            (s.shortTitle || '').toLowerCase().includes(query) ||
            (s.author || '').toLowerCase().includes(query) ||
            (s.repositoryName || '').toLowerCase().includes(query)
        );
    }

    selectSource(source: any) {
        this.selectedSource.set(source);
        this.mergeTargetId.set('');
        this.reassignTargetId.set('');
        this.detailsOpen.set(true);
        this.loadUsage(source.id);
    }

    loadUsage(sourceId: string) {
        const tree = this.currentTree();
        if (!tree) return;
        this.loadingUsage.set(true);
        this.gedcomService.getSourceUsage(tree, sourceId).subscribe({
            next: (res: any) => {
                this.selectedUsage.set(res?.usage || null);
                this.loadingUsage.set(false);
            },
            error: () => {
                this.selectedUsage.set(null);
                this.loadingUsage.set(false);
            }
        });
    }

    openAddModal() {
        this.modalMode = 'add';
        this.selectedSourceData = null;
        this.isModalOpen = true;
    }

    openEditModal(source: any) {
        this.modalMode = 'edit';
        this.selectedSourceData = source;
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
    }

    closeDetailsModal() {
        this.detailsOpen.set(false);
    }

    onSourceSaved() {
        this.refreshList();
        this.closeModal();
    }

    deleteSource(source: any) {
        if (!confirm(`Möchten Sie die Quelle "${source.title}" wirklich aus diesem Stammbaum entfernen?\nDies löscht diese Quelle aus allen Zitationsverknüpfungen!`)) return;

        const tree = this.currentTree();
        if (!tree) return;

        const payload: any = { mode: 'delete', id: source.id };
        if (this.reassignTargetId()) payload.reassignToId = this.reassignTargetId();

        this.gedcomService.saveSource(tree, payload).subscribe({
            next: (res: any) => {
                if (res.success) {
                    if (this.selectedSource()?.id === source.id) {
                        this.selectedSource.set(null);
                        this.selectedUsage.set(null);
                        this.detailsOpen.set(false);
                    }
                    this.refreshList();
                } else {
                    alert('Fehler beim Löschen: ' + res.message);
                }
            },
            error: (err: any) => {
                const usage = err.error?.usage;
                const msg = usage
                    ? `${err.error?.message}\nVerknüpfungen: ${usage.totalLinks}\nWähle eine Ziel-Quelle zum Umhängen oder merge zuerst.`
                    : (err.error?.message || 'Unbekannter Fehler');
                alert('Fehler beim Löschen: ' + msg);
            }
        });
    }

    mergeSelected() {
        const source = this.selectedSource();
        const targetId = this.mergeTargetId();
        const tree = this.currentTree();
        if (!source || !targetId || !tree) return;
        if (!confirm(`Quelle "${source.title}" in Ziel-Quelle zusammenführen?`)) return;

        this.gedcomService.mergeSources(tree, source.id, targetId).subscribe({
            next: (res: any) => {
                if (res.success) {
                    this.selectedSource.set(null);
                    this.selectedUsage.set(null);
                    this.mergeTargetId.set('');
                    this.detailsOpen.set(false);
                    this.refreshList();
                } else {
                    alert('Merge fehlgeschlagen: ' + (res.message || 'Unbekannter Fehler'));
                }
            },
            error: (err: any) => alert('Merge fehlgeschlagen: ' + (err.error?.message || 'Unbekannter Fehler'))
        });
    }

    openPersonProfile(personId?: string | null) {
        if (!personId) return;
        this.router.navigate(['/person', personId]);
    }
}
