import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GedcomService } from './gedcom.service';
import { TreeData } from './models';

@Component({
    selector: 'app-place-list',
    standalone: true,
    imports: [CommonModule, FormsModule],
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
    modalData = {
        detail: '',
        city: '',
        district: '',
        region: '',
        country: '',
        old_name: '',
        latitude: '',
        longitude: ''
    };

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
        this.errorMessage.set(null);
        this.modalMode = 'add';
        this.modalData = {
            detail: '',
            city: '',
            district: '',
            region: '',
            country: '',
            old_name: '',
            latitude: '',
            longitude: ''
        };
        this.isModalOpen = true;
    }

    openEditModal(place: any) {
        this.errorMessage.set(null);
        this.modalMode = 'edit';

        const parts = (place.name || '').split(',').map((p: string) => p.trim());
        // Right-align if fewer than 5 parts
        const fullParts = new Array(5).fill('');
        const offset = Math.max(0, 5 - parts.length);
        for (let i = 0; i < parts.length; i++) {
            if (i + offset < 5) fullParts[i + offset] = parts[i];
        }

        this.modalData = {
            detail: fullParts[0],
            city: fullParts[1],
            district: fullParts[2],
            region: fullParts[3],
            country: fullParts[4],
            old_name: place.name,
            latitude: place.latitude?.toString() || '',
            longitude: place.longitude?.toString() || ''
        };
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
    }

    savePlace() {
        const tree = this.currentTree();
        if (!tree) return;

        // Construct name strictly with 4 commas
        const name = [
            this.modalData.detail.trim(),
            this.modalData.city.trim(),
            this.modalData.district.trim(),
            this.modalData.region.trim(),
            this.modalData.country.trim()
        ].join(', ');

        const payload = {
            name: name,
            old_name: this.modalMode === 'edit' ? this.modalData.old_name : undefined,
            latitude: this.modalData.latitude,
            longitude: this.modalData.longitude
        };

        this.errorMessage.set(null);
        this.isSaving.set(true);
        this.gedcomService.savePlace(tree, payload).subscribe({
            next: (res: any) => {
                this.isSaving.set(false);
                if (res.success) {
                    this.refreshList();
                    this.closeModal();
                } else {
                    this.errorMessage.set(res.message);
                }
            },
            error: (err: any) => {
                this.isSaving.set(false);
                this.errorMessage.set(err.error?.message || 'Ein Fehler ist aufgetreten beim Speichern des Ortes.');
            }
        });
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
