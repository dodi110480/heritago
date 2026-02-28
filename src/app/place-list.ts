import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GedcomService } from './gedcom.service';
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
    private router = inject(Router);

    places = signal<any[]>([]);
    hierarchy = signal<any[]>([]);
    loading = signal(true);
    isSaving = signal(false);
    currentTree = signal<string | null>(null);
    errorMessage = signal<string | null>(null);
    selectedPlace = signal<any | null>(null);
    selectedUsage = signal<any | null>(null);
    loadingUsage = signal(false);
    mergeTargetId = signal<string>('');
    reassignTargetId = signal<string>('');
    detailsOpen = signal(false);

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
                const sel = this.selectedPlace();
                if (sel) {
                    const refreshed = items.find((p: any) => p.id === sel.id) || null;
                    this.selectedPlace.set(refreshed);
                    if (refreshed) this.loadUsage(refreshed.id);
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

    selectPlace(place: any) {
        this.selectedPlace.set(place);
        this.mergeTargetId.set('');
        this.reassignTargetId.set('');
        this.detailsOpen.set(true);
        this.loadUsage(place.id);
    }

    loadUsage(placeId: string) {
        const tree = this.currentTree();
        if (!tree) return;
        this.loadingUsage.set(true);
        this.gedcomService.getPlaceUsage(tree, placeId).subscribe({
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

    closeDetailsModal() {
        this.detailsOpen.set(false);
    }

    onPlaceSaved() {
        this.refreshList();
        this.closeModal();
    }

    deletePlace(place: any) {
        if (!confirm(`Möchten Sie den Ort "${place.name}" wirklich aus diesem Stammbaum entfernen?\nDies löscht auch den Ortsnamen aus allen verknüpften Personen und Familien!`)) return;

        const tree = this.currentTree();
        if (!tree) return;

        const payload: any = { mode: 'delete', id: place.id, name: place.name };
        if (this.reassignTargetId()) payload.reassignToId = this.reassignTargetId();

        this.gedcomService.savePlace(tree, payload).subscribe({
            next: (res: any) => {
                if (res.success) {
                    if (this.selectedPlace()?.id === place.id) {
                        this.selectedPlace.set(null);
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
                    ? `${err.error?.message}\nVerknüpfungen: ${usage.totalLinks}, Unterorte: ${usage.childCount}\nWähle einen Zielort zum Umhängen oder merge zuerst.`
                    : (err.error?.message || 'Unbekannter Fehler');
                alert('Fehler beim Löschen: ' + msg);
            }
        });
    }

    mergeSelected() {
        const source = this.selectedPlace();
        const targetId = this.mergeTargetId();
        const tree = this.currentTree();
        if (!source || !targetId || !tree) return;
        if (!confirm(`Ort "${source.name}" in Zielort zusammenführen?`)) return;

        this.gedcomService.mergePlaces(tree, source.id, targetId).subscribe({
            next: (res: any) => {
                if (res.success) {
                    this.selectedPlace.set(null);
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
