import { Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TreeService } from '../../core/services/tree.service';
import { PlaceModal } from '../../shared/components/ui/place-modal/place-modal';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';
import { AppPlacesList } from '../../shared/components/ui/app-places-list/app-places-list';


import { PlaceService } from '../../core/services/place.service';
@Component({
    selector: 'app-place-list',
    standalone: true,
    imports: [CommonModule, FormsModule, PlaceModal, AppPageHeaderComponent, AppPlacesList],
    templateUrl: './place-list.html',
    encapsulation: ViewEncapsulation.None
})
export class PlaceList {
    public placeService = inject(PlaceService);
    private treeService = inject(TreeService);
    private router = inject(Router);

    places = signal<any[]>([]);
    hierarchy = signal<any[]>([]);
    loading = signal(true);
    isSaving = signal(false);
    currentTree = signal<string | null>(null);
    errorMessage = signal<string | null>(null);

    // Modal State
    isModalOpen = signal(false);
    modalMode = signal<'add' | 'edit'>('add');
    selectedPlaceData = signal<any>(null);

    ngOnInit() {
        this.loadPlaces();
    }

    loadPlaces() {
        this.loading.set(true);
        this.treeService.getTreeData().subscribe(treeData => {
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

        this.placeService.getPlaces(tree).subscribe({
            next: (res: any) => {
                const items = res.places || [];
                this.places.set(items);
                this.hierarchy.set(this.buildHierarchy(items));
                this.loading.set(false);
                // Refresh current modal data if open
                if (this.isModalOpen() && this.selectedPlaceData()?.id) {
                    const refreshed = items.find((p: any) => p.id === this.selectedPlaceData().id) || null;
                    if (refreshed) {
                        this.selectedPlaceData.set(refreshed);
                    } else {
                        this.closeModal();
                    }
                }
            },
            error: () => this.loading.set(false)
        });
    }

    private buildHierarchy(places: any[]) {
        const byId = new Map<string, any>();
        const nodes = places.map((p) => ({ ...p, children: [] as any[] }));
        nodes.forEach((n) => byId.set(n.id, n));
        const roots: any[] = [];
        for (const n of nodes) {
            if (n.parentId && byId.has(n.parentId)) byId.get(n.parentId).children.push(n);
            else roots.push(n);
        }
        const sortRec = (arr: any[]) => {
            arr.sort((a, b) => a.name.localeCompare(b.name));
            arr.forEach((c) => sortRec(c.children));
        };
        sortRec(roots);
        return roots;
    }

    openAddModal() {
        this.modalMode.set('add');
        this.selectedPlaceData.set(null);
        this.isModalOpen.set(true);
    }

    openEditModal(place: any) {
        this.modalMode.set('edit');
        this.selectedPlaceData.set(place);
        this.isModalOpen.set(true);
    }

    closeModal() {
        this.isModalOpen.set(false);
    }

    onPlaceSaved() {
        this.refreshList();
        this.closeModal();
    }

    onPlaceDeleted() {
        this.refreshList();
        this.closeModal();
    }

    onPlaceMerged() {
        this.refreshList();
        this.closeModal();
    }
}
