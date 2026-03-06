import { Component, computed, inject, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { PlaceModal } from './place-modal';
import { PlaceDisplayPipe } from './place-display.pipe';
import { AppEntityCard } from './ui/app-entity-card';
import { AppPageHeaderComponent } from './ui/app-page-header';
import { AppListViewComponent } from './ui/app-list-view';

@Component({
    selector: 'app-place-list',
    standalone: true,
    imports: [CommonModule, FormsModule, PlaceModal, PlaceDisplayPipe, AppEntityCard, AppPageHeaderComponent, AppListViewComponent],
    templateUrl: './place-list.html',
    encapsulation: ViewEncapsulation.None
})
export class PlaceList {
    private gedcomService = inject(GedcomService);
    private router = inject(Router);

    places = signal<any[]>([]);
    hierarchy = signal<any[]>([]);
    loading = signal(true);
    isSaving = signal(false);
    currentTree = signal<string | null>(null);
    errorMessage = signal<string | null>(null);

    // Modal State
    isModalOpen = false;
    modalMode: 'add' | 'edit' = 'add';
    selectedPlaceData: any = null;

    ngOnInit() {
        this.loadPlaces();
    }

    loadPlaces() {
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

        this.gedcomService.getPlaces(tree).subscribe({
            next: (res: any) => {
                const items = res.places || [];
                this.places.set(items);
                this.hierarchy.set(this.buildHierarchy(items));
                this.loading.set(false);
                // Refresh current modal data if open
                if (this.isModalOpen && this.selectedPlaceData?.id) {
                    const refreshed = items.find((p: any) => p.id === this.selectedPlaceData.id) || null;
                    if (refreshed) {
                        this.selectedPlaceData = refreshed;
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

    flattenHierarchy(nodes: any[], depth = 0): any[] {
        const out: any[] = [];
        for (const n of nodes) {
            out.push({ ...n, depth });
            out.push(...this.flattenHierarchy(n.children || [], depth + 1));
        }
        return out;
    }

    openAddModal() {
        this.modalMode = 'add';
        this.selectedPlaceData = null;
        this.isModalOpen = true;
    }

    openEditModal(place: any) {
        this.modalMode = 'edit';
        this.selectedPlaceData = place;
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
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
