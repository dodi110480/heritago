import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GedcomService } from './gedcom.service';
import { AuthService } from './auth.service';
import { MediaAddModal } from './media-add-modal';
import { AppEntityCard } from './ui/app-entity-card';
import { AppPageHeaderComponent } from './ui/app-page-header';
import { AppListViewComponent } from './ui/app-list-view';

@Component({
    selector: 'app-media-gallery',
    standalone: true,
    imports: [CommonModule, FormsModule, MediaAddModal, AppEntityCard, AppPageHeaderComponent, AppListViewComponent],
    templateUrl: './media-gallery.html'
})
export class MediaGallery implements OnInit {
    private gedcomService = inject(GedcomService);
    private authService = inject(AuthService);

    loading = signal(false);
    mediaItems = signal<any[]>([]);
    selected = signal<any | null>(null);

    searchQuery = signal('');
    filterType = signal<'ALLE' | 'FOTOS' | 'DOKUMENTE' | 'UNLINKED'>('ALLE');
    showAddModal = signal(false);

    mediaStats = signal<any>({ total: 0, fotos: 0, docs: 0, unlinked: 0 });
    stats = computed(() => this.mediaStats());

    filteredItems = computed(() => {
        const filter = this.filterType();
        const items = this.mediaItems();
        if (filter === 'UNLINKED') return items.filter(i => !i.links?.length);
        return items;
    });

    ngOnInit() {
        this.loadMedia();
    }

    get tree() {
        return this.authService.currentTree();
    }

    treeId = computed(() => this.tree?.id || '');

    loadMedia() {
        const tree = this.tree;
        if (!tree) {
            console.warn('[MediaGallery] No active tree, skipping loadMedia');
            return;
        }

        this.loading.set(true);
        const backendType = this.filterType();

        this.gedcomService.getMedia(tree.id, backendType, this.searchQuery()).subscribe({
            next: (res: any) => {
                const items = (res.media || []).map((m: any) => {
                    return {
                        ...m,
                        previewUrl: this.gedcomService.getMediaUrl(m.id || m.path, 'thumbs')
                    };
                });
                this.mediaItems.set(items);
                if (res.stats) {
                    this.mediaStats.set(res.stats);
                }
                this.loading.set(false);
            },
            error: (err) => {
                console.error('[MediaGallery] Failed to load media:', err);
                this.loading.set(false);
            }
        });
    }

    openDetails(item: any) {
        this.selected.set(item);
    }

    closeDetails() {
        this.selected.set(null);
    }

    closeAddModal() {
        this.showAddModal.set(false);
    }

    deleteMedia(item: any) {
        if (!confirm(`Medium "${item.title || item.path || item.id}" wirklich löschen?`)) return;

        const obs = item.orphanFile 
            ? this.gedcomService.deleteOrphanFile(item.path)
            : this.gedcomService.deleteMedia(item.id);

        obs.subscribe({
            next: () => {
                this.loadMedia();
                if (this.selected()?.id === item.id || (item.orphanFile && this.selected()?.path === item.path)) {
                    this.closeDetails();
                }
            }
        });
    }

    isImage(item: any): boolean {
        return this.gedcomService.isImage(item);
    }

    isPdf(item: any): boolean {
        return this.gedcomService.isPdf(item);
    }
}
