import { Component, EventEmitter, Output, Input, signal, inject, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GedcomService } from './gedcom.service';
import { AuthService } from './auth.service';
import { FormsModule } from '@angular/forms';
import { AppModalShell } from './ui/app-modal-shell';

@Component({
    selector: 'app-media-selector',
    standalone: true,
    imports: [CommonModule, FormsModule, AppModalShell],
    templateUrl: './media-selector.html'
})
export class MediaSelector implements OnInit, OnChanges {
    @Input() visible = false;
    @Output() selected = new EventEmitter<any>();
    @Output() closed = new EventEmitter<void>();

    private gedcomService = inject(GedcomService);
    private authService = inject(AuthService);

    mediaItems = signal<any[]>([]);
    loading = signal(false);
    searchQuery = signal('');

    ngOnInit() { }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['visible'] && changes['visible'].currentValue === true) {
            this.loadMedia();
        }
    }

    loadMedia() {
        const tree = this.authService.currentTree();
        if (!tree) return;
        this.loading.set(true);
        this.gedcomService.getMedia(tree.id, this.searchQuery()).subscribe({
            next: (res: any) => {
                const items = (res.media || []).map((m: any) => ({
                    ...m,
                    url: this.gedcomService.getMediaUrl(m.remoteUrl || (m.filePath ? `/uploads/${m.filePath}` : m.url || '')),
                    mimeType: m.mimeType || 'application/octet-stream'
                }));
                // Only images for now
                const imagesOnly = items.filter((i: any) => i.mimeType.startsWith('image/'));
                this.mediaItems.set(imagesOnly);
                this.loading.set(false);
            },
            error: () => this.loading.set(false)
        });
    }

    onSearch() {
        this.loadMedia();
    }

    selectItem(item: any) {
        // Strip the localhost:3000 mapping back to relative path if possible for saving
        const itemCopy = { ...item };
        if (itemCopy.url && itemCopy.url.includes('/uploads/')) {
            itemCopy.url = '/uploads/' + itemCopy.url.split('/uploads/')[1];
        }
        this.selected.emit(itemCopy);
        this.close();
    }

    close() {
        this.closed.emit();
    }
}
