import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GedcomService } from './gedcom.service';

@Component({
    selector: 'app-media-gallery',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './media-gallery.html',
    styleUrl: './media-gallery.css'
})
export class MediaGallery implements OnInit {
    private gedcomService = inject(GedcomService);

    mediaItems = signal<any[]>([]);
    loading = signal(true);
    selectedImage = signal<any | null>(null);

    ngOnInit() {
        this.loadMedia();
    }

    loadMedia() {
        this.loading.set(true);
        this.gedcomService.getTreeData().subscribe(treeData => {
            if (treeData && treeData.meta && treeData.meta.tree) {
                this.gedcomService.getMedia(treeData.meta.tree).subscribe({
                    next: (res: any) => {
                        this.mediaItems.set(res.media || []);
                        this.loading.set(false);
                    },
                    error: () => {
                        this.loading.set(false);
                    }
                });
            } else {
                this.loading.set(false);
            }
        });
    }

    openLightbox(item: any) {
        this.selectedImage.set(item);
    }

    closeLightbox() {
        this.selectedImage.set(null);
    }
}
