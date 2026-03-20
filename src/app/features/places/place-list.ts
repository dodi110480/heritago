import { Component, inject, signal, effect, ViewEncapsulation, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
export class PlaceList implements OnInit {
    public placeService = inject(PlaceService);
    private treeService = inject(TreeService);
    private cdr = inject(ChangeDetectorRef);

    places = signal<any[]>([]);
    hierarchy = signal<any[]>([]);
    loading = signal(true);
    isSaving = signal(false);
    currentTree = signal<string | null>(null);
    errorMessage = signal<string | null>(null);
    searchTerm = signal('');

    // Modal State
    isModalOpen = signal(false);
    modalMode = signal<'add' | 'edit'>('add');
    selectedPlaceData = signal<any>(null);

    constructor() {
        effect(() => {
            const term = this.searchTerm();
            this.refreshHierarchy(term);
        }, { allowSignalWrites: true });
    }

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
                const items = Array.isArray(res) ? res : (res.data || res.places || []);
                this.places.set(items);
                
                this.refreshHierarchy(this.searchTerm());

                if (this.isModalOpen() && this.selectedPlaceData()?.id) {
                    const refreshed = items.find((p: any) => p.id === this.selectedPlaceData().id) || null;
                    if (refreshed) {
                        this.selectedPlaceData.set(refreshed);
                    } else {
                        this.closeModal();
                    }
                }
            },
            error: (err) => {
                console.error('PlaceList: Error fetching places:', err);
                this.loading.set(false);
                this.cdr.detectChanges();
            }
        });
    }

    refreshHierarchy(search?: string) {
        const tree = this.currentTree();
        if (!tree) return;
        this.placeService.getPlacesHierarchy(tree, search).subscribe(h => {
            this.hierarchy.set(h);
            this.loading.set(false);
            this.cdr.detectChanges();
        });
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
