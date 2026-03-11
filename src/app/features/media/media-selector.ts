import { Component, EventEmitter, Output, Input, signal, inject, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GedcomService } from '../../core/services/gedcom.service';
import { AuthService } from '../../core/services/auth.service';
import { FormsModule } from '@angular/forms';
import { AppModalShell } from '../../shared/components/ui/app-modal-shell';


import { MediaService } from '../../core/services/media.service';
@Component({
    selector: 'app-media-selector',
    standalone: true,
    imports: [CommonModule, FormsModule, AppModalShell],
    templateUrl: './media-selector.html'
})
export class MediaSelector implements OnInit, OnChanges {
    public mediaService = inject(MediaService);

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
        this.mediaService.getMedia(tree.id, 'FOTOS', this.searchQuery()).subscribe({
            next: (res: any) => {
                const items = (res.media || []).map((m: any) => ({
                    ...m,
                    previewUrl: this.mediaService.getMediaUrl(m.id, 'thumbs'),
                    fullUrl: this.mediaService.getMediaUrl(m.id)
                }));
                this.mediaItems.set(items);
                this.loading.set(false);
            },
            error: () => this.loading.set(false)
        });
    }

    onSearch() {
        this.loadMedia();
    }

    selectItem(item: any) {
        this.selected.emit(item);
        this.close();
    }

    close() {
        this.closed.emit();
    }
}
