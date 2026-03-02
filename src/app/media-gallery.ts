import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GedcomService } from './gedcom.service';
import { AuthService } from './auth.service';
import { MediaAddModal } from './media-add-modal';

@Component({
    selector: 'app-media-gallery',
    standalone: true,
    imports: [CommonModule, FormsModule, MediaAddModal],
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

    personOptions = signal<{ id: string; name: string; birthYear?: string }[]>([]);
    familyOptions = signal<{ id: string; label: string }[]>([]);

    linkMode = signal<'person' | 'family' | 'source'>('person');
    linkPersonId = signal('');
    linkPersonQuery = signal('');
    linkFamilyId = signal('');
    linkSourceId = signal('');
    mediaTypeOptions: Array<'PHOTO' | 'DOCUMENT' | 'RECORD' | 'OTHER'> = ['PHOTO', 'DOCUMENT', 'RECORD', 'OTHER'];

    stats = computed(() => {
        const items = this.mediaItems();
        return {
            total: items.length,
            fotos: items.filter(i => i.mediaType === 'PHOTO' || (!i.mediaType && i.mimeType?.startsWith('image/'))).length,
            docs: items.filter(i => ['DOCUMENT', 'RECORD'].includes(i.mediaType) || (!i.mediaType && ['application/pdf', 'text/plain'].includes(i.mimeType))).length,
            unlinked: items.filter(i => !i.links?.length).length
        };
    });

    filteredItems = computed(() => {
        const filter = this.filterType();
        const items = this.mediaItems();
        if (filter === 'UNLINKED') return items.filter(i => !i.links?.length);
        return items;
    });

    filteredPersonOptions = computed(() => {
        const q = this.linkPersonQuery().trim().toLowerCase();
        if (!q) return this.personOptions().slice(0, 12);
        return this.personOptions()
            .filter(p => `${p.name} ${p.birthYear || ''} ${p.id}`.toLowerCase().includes(q))
            .slice(0, 12);
    });

    ngOnInit() {
        this.loadMedia();
        this.loadLinkTargets();
    }

    get tree() {
        return this.authService.currentTree();
    }

    loadMedia() {
        const tree = this.tree;
        if (!tree) return;

        this.loading.set(true);
        const backendType = this.filterType();

        this.gedcomService.getMedia(tree.id, backendType, this.searchQuery()).subscribe({
            next: (res: any) => {
                const items = (res.media || []).map((m: any) => ({
                    ...m,
                    previewUrl: this.gedcomService.getMediaUrl(m.remoteUrl || (m.filePath ? `/uploads/${m.filePath}` : ''))
                }));
                this.mediaItems.set(items);
                this.loading.set(false);
            },
            error: () => this.loading.set(false)
        });
    }

    loadLinkTargets() {
        const tree = this.tree;
        if (!tree) return;

        this.gedcomService.getTreeData(tree.name).subscribe((data: any) => {
            if (!data) return;

            this.personOptions.set((data.individuals || []).map((p: any) => ({
                id: p.id,
                name: p.name || p.id,
                birthYear: this.extractYear(p.birthDate || p.birth || p.dateOfBirth || '')
            })));
            this.familyOptions.set((data.families || []).map((f: any) => ({
                id: f.id,
                label: `${f.id} (${f.husband || '-'} + ${f.wife || '-'})`
            })));
        });
    }

    openDetails(item: any) {
        this.selected.set({ ...item });
    }

    closeDetails() {
        this.selected.set(null);
        this.linkPersonId.set('');
        this.linkPersonQuery.set('');
        this.linkFamilyId.set('');
        this.linkSourceId.set('');
    }

    saveTitle() {
        const current = this.selected();
        if (!current) return;

        this.gedcomService.updateMedia(current.id, { title: current.title, mediaType: current.mediaType }).subscribe({
            next: () => this.loadMedia()
        });
    }

    addLink() {
        const media = this.selected();
        const tree = this.tree;
        if (!media || !tree) return;

        const payload: any = { treeId: tree.id, isPrimary: false };
        if (this.linkMode() === 'person' && this.linkPersonId()) payload.personId = this.linkPersonId();
        if (this.linkMode() === 'family' && this.linkFamilyId()) payload.familyId = this.linkFamilyId();
        if (this.linkMode() === 'source' && this.linkSourceId()) payload.sourceId = this.linkSourceId();

        this.gedcomService.linkMedia(media.id, payload).subscribe({
            next: () => {
                this.loadMedia();
                const selectedId = media.id;
                const refreshed = this.mediaItems().find(i => i.id === selectedId);
                if (refreshed) this.selected.set({ ...refreshed });
            }
        });
    }

    choosePerson(person: { id: string; name: string; birthYear?: string }) {
        this.linkPersonId.set(person.id);
        const suffix = person.birthYear ? `* ${person.birthYear}` : person.id;
        this.linkPersonQuery.set(`${person.name} (${suffix})`);
    }

    unlinkMedia(linkId: string) {
        if (!linkId) return;
        this.gedcomService.unlinkMedia(linkId).subscribe({
            next: () => {
                const selectedId = this.selected()?.id;
                this.loadMedia();
                if (selectedId) {
                    setTimeout(() => {
                        const refreshed = this.mediaItems().find(i => i.id === selectedId);
                        if (refreshed) this.selected.set({ ...refreshed });
                    }, 0);
                }
            }
        });
    }

    deleteMedia(item: any) {
        if (!confirm(`Medium "${item.title || item.filePath || item.id}" wirklich löschen?`)) return;

        this.gedcomService.deleteMedia(item.id).subscribe({
            next: () => {
                this.loadMedia();
                if (this.selected()?.id === item.id) this.closeDetails();
            }
        });
    }

    adoptOrphan(item: any) {
        const tree = this.tree;
        if (!tree || !item?.filePath) return;

        this.gedcomService.adoptOrphanMedia(tree.id, item.filePath, item.title || item.filePath, item.mediaType).subscribe({
            next: () => {
                this.loadMedia();
                this.closeDetails();
            }
        });
    }

    deleteOrphan(item: any) {
        if (!item?.filePath) return;
        if (!confirm(`Datei "${item.filePath}" wirklich von der Platte löschen?`)) return;

        this.gedcomService.deleteOrphanFile(item.filePath).subscribe({
            next: () => {
                this.loadMedia();
                this.closeDetails();
            }
        });
    }

    formatSize(bytes?: number) {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        let value = bytes;
        let idx = 0;
        while (value >= 1024 && idx < units.length - 1) {
            value /= 1024;
            idx++;
        }
        return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
    }

    isImage(item: any): boolean {
        const mime = String(item?.mimeType || '').toLowerCase();
        return mime.startsWith('image/');
    }

    isPdf(item: any): boolean {
        const mime = String(item?.mimeType || '').toLowerCase();
        const filePath = String(item?.filePath || '').toLowerCase();
        const title = String(item?.title || '').toLowerCase();
        return mime.includes('pdf') || filePath.endsWith('.pdf') || title.endsWith('.pdf');
    }

    pdfUrl(item: any): string {
        const base = item?.previewUrl || '';
        if (!base) return '';
        return `${base}#toolbar=1&navpanes=0&scrollbar=1`;
    }

    linkLabel(link: any): string {
        if (link.person) {
            const name = link.person.names?.[0];
            return name?.full || link.person.id;
        }
        if (link.familyId) return `Familie ${link.familyId}`;
        if (link.sourceId) return `Quelle ${link.sourceId}`;
        return 'Verknüpfung';
    }

    private extractYear(value: string): string | undefined {
        if (!value) return undefined;
        const m = String(value).match(/\b(15|16|17|18|19|20)\d{2}\b/);
        return m ? m[0] : undefined;
    }
}
