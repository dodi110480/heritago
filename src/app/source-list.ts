import { Component, inject, signal, OnInit, ViewEncapsulation, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { SourceModal } from './source-modal';
import { AppEntityCard } from './ui/app-entity-card';
import { AppPageHeaderComponent } from './ui/app-page-header';
import { AppPageContainerComponent } from './ui/app-page-container';
import { RepositoryList } from './repository-list';

@Component({
    selector: 'app-source-list',
    standalone: true,
    imports: [CommonModule, FormsModule, SourceModal, AppEntityCard, RepositoryList, AppPageHeaderComponent, AppPageContainerComponent],
    templateUrl: './source-list.html',
    encapsulation: ViewEncapsulation.None
})
export class SourceList implements OnInit {
    private gedcomService = inject(GedcomService);
    private router = inject(Router);

    @ViewChild(RepositoryList) repositoryListRef?: RepositoryList;

    sources = signal<any[]>([]);
    loading = signal(true);
    isSaving = signal(false);
    currentTree = signal<string | null>(null);
    errorMessage = signal<string | null>(null);
    selectedSource = signal<any | null>(null);
    searchQuery = signal<string>('');

    // Tab State
    activeTab = signal<'sources' | 'repositories'>('sources');

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

    openAddRepositoryModal() {
        this.activeTab.set('repositories');
        // Kleine Verzögerung damit der Tab-Wechsel ViewChild initialisieren kann
        setTimeout(() => this.repositoryListRef?.openAddModal(), 50);
    }

    navigateToRepository(repositoryId: string) {
        this.activeTab.set('repositories');
    }

    onSourceSaved() {
        this.refreshList();
        this.closeModal();
    }

    onSourceDeleted(payload: { source: any, reassignToId: string }) {
        const { source, reassignToId } = payload;
        if (!confirm(`Möchten Sie die Quelle "${source.title}" wirklich aus diesem Stammbaum entfernen?\nDies löscht diese Quelle aus allen Zitationsverknüpfungen!`)) return;

        const tree = this.currentTree();
        if (!tree) return;

        const reqPayload: any = { mode: 'delete', id: source.id };
        if (reassignToId) reqPayload.reassignToId = reassignToId;

        this.gedcomService.saveSource(tree, reqPayload).subscribe({
            next: (res: any) => {
                if (res.success) {
                    if (this.selectedSource()?.id === source.id) {
                        this.selectedSource.set(null);
                    }
                    this.refreshList();
                    this.closeModal();
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

    onSourceMerged(payload: { sourceId: string, targetId: string }) {
        const { sourceId, targetId } = payload;
        const sourceData = this.selectedSourceData || this.selectedSource();
        const tree = this.currentTree();
        if (!sourceId || !targetId || !tree) return;
        if (!confirm(`Quelle "${sourceData?.title || 'diese'}" in Ziel-Quelle zusammenführen?`)) return;

        this.gedcomService.mergeSources(tree, sourceId, targetId).subscribe({
            next: (res: any) => {
                if (res.success) {
                    this.selectedSource.set(null);
                    this.refreshList();
                    this.closeModal();
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
