import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GedcomService } from './gedcom.service';
import { AuthService } from './auth.service';
import { ImageCropper } from './image-cropper';

@Component({
    selector: 'app-media-gallery',
    standalone: true,
    imports: [CommonModule, FormsModule, ImageCropper],
    templateUrl: './media-gallery.html',
    styleUrl: './media-gallery.css'
})
export class MediaGallery implements OnInit {
    private gedcomService = inject(GedcomService);
    private authService = inject(AuthService);

    mediaItems = signal<any[]>([]);
    loading = signal(true);
    viewMode = signal<'grid' | 'list'>('grid');
    selectedImage = signal<any | null>(null);
    isEditing = signal(false);

    // Cropper state
    showCropper = signal(false);
    cropImageUrl = signal<string | null>(null);
    currentUploadFile = signal<File | null>(null);

    // Filters
    searchQuery = signal('');
    filterType = signal<string>('ALLE');

    // Statistics
    stats = computed(() => {
        const items = this.mediaItems();
        return {
            total: items.length,
            fotos: items.filter(i => i.mimeType?.startsWith('image/')).length,
            docs: items.filter(i => i.mimeType === 'application/pdf').length,
            unlinked: items.filter(i => !i.links || i.links.length === 0).length
        };
    });

    ngOnInit() {
        this.loadMedia();
    }

    loadMedia() {
        this.loading.set(true);
        const tree = this.authService.currentTree();
        if (!tree) {
            this.loading.set(false);
            return;

        }

        this.gedcomService.getMedia(tree.id, this.filterType(), this.searchQuery()).subscribe({
            next: (res: any) => {
                console.log("MEDIA RAW RESPONSE:", res);
                const items = (res.media || []).map((m: any) => ({
                    ...m,
                    url: this.gedcomService.getMediaUrl(m.url),
                    mimeType: m.mimeType || 'application/octet-stream' // Fallback
                }));
                this.mediaItems.set(items);
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
            }
        });
    }

    onSearch() {
        this.loadMedia();
    }

    setFilter(type: string) {
        this.filterType.set(type);
        this.loadMedia();
    }

    onFileUpload(event: any) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.type.startsWith('image/')) {
            this.currentUploadFile.set(file);
            const reader = new FileReader();
            reader.onload = (e: any) => {
                this.cropImageUrl.set(e.target.result);
                this.showCropper.set(true);
            };
            reader.readAsDataURL(file);
        } else {
            this.proceedWithUpload(file);
        }
    }

    onCropped(blob: Blob) {
        this.showCropper.set(false);
        const originalFile = this.currentUploadFile()!;
        const croppedFile = new File([blob], originalFile.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' });
        this.proceedWithUpload(croppedFile);
    }

    proceedWithUpload(file: File) {
        const tree = this.authService.currentTree();
        if (!tree) return;

        this.loading.set(true);
        this.gedcomService.uploadMedia(tree.id, file).subscribe({
            next: (res: any) => {
                if (res.duplicate) {
                    alert('Dieses Medium existiert bereits im System.');
                }
                this.loadMedia();
            },
            error: (err) => {
                console.error('Upload failed', err);
                this.loading.set(false);
            }
        });
    }

    deleteMedia(item: any) {
        if (!confirm(`Möchten Sie "${item.title || item.originalFileName}" wirklich löschen?`)) return;

        this.gedcomService.deleteMedia(item.id).subscribe(() => {
            this.loadMedia();
            if (this.selectedImage()?.id === item.id) {
                this.selectedImage.set(null);
            }
        });
    }

    openLightbox(item: any) {
        this.selectedImage.set({ ...item }); // create a copy for editing
        this.isEditing.set(false);
    }

    closeLightbox() {
        this.selectedImage.set(null);
        this.isEditing.set(false);
    }

    saveMedia() {
        const item = this.selectedImage();
        if (!item) return;

        this.gedcomService.updateMedia(item.id, { title: item.title, description: item.description }).subscribe({
            next: (res) => {
                if (res.success) {
                    this.isEditing.set(false);
                    this.loadMedia(); // refresh list
                }
            },
            error: (err) => console.error('Failed to update media', err)
        });
    }

    getMimeIcon(mime: string): string {
        if (mime?.startsWith('image/')) return 'image';
        if (mime === 'application/pdf') return 'description';
        return 'attachment';
    }

    formatSize(bytes: number): string {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
}
