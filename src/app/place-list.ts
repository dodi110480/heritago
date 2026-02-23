import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GedcomService } from './gedcom.service';
import { TreeData } from './models';
import { PlaceModal } from './place-modal';

@Component({
    selector: 'app-place-list',
    standalone: true,
    imports: [CommonModule, FormsModule, PlaceModal],
    templateUrl: './place-list.html',
    styleUrl: './place-list.css'
})
export class PlaceList implements OnInit {
    private gedcomService = inject(GedcomService);

    places = signal<any[]>([]);
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
                this.places.set(res.places || []);
                this.loading.set(false);
            },
            error: () => this.loading.set(false)
        });
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

    deletePlace(name: string) {
        if (!confirm(`Möchten Sie den Ort "${name}" wirklich aus diesem Stammbaum entfernen?\nDies löscht auch den Ortsnamen aus allen verknüpften Personen und Familien!`)) return;

        const tree = this.currentTree();
        if (!tree) return;

        this.gedcomService.deletePlace(tree, name).subscribe({
            next: (res: any) => {
                if (res.success) {
                    this.refreshList();
                } else {
                    alert('Fehler beim Löschen: ' + res.message);
                }
            },
            error: (err: any) => {
                alert('Fehler beim Löschen: ' + (err.error?.message || 'Unbekannter Fehler'));
            }
        });
    }
}
