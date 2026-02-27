import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GedcomService } from './gedcom.service';
import { ImageCropper } from './image-cropper';

@Component({
    selector: 'app-media-add-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, ImageCropper],
    templateUrl: './media-add-modal.html',
    styleUrl: './media-add-modal.css'
})
export class MediaAddModal {
    private gedcomService = inject(GedcomService);

    @Input() visible = false;
    @Input() treeId = '';
    @Input() defaultFirstName = '';
    @Input() defaultLastName = '';

    @Output() closed = new EventEmitter<void>();
    @Output() uploaded = new EventEmitter<any>();

    selectedFile = signal<File | null>(null);
    kind = signal<'Picture' | 'Dokument'>('Picture');
    mediaType = signal<'PHOTO' | 'DOCUMENT' | 'RECORD' | 'OTHER'>('PHOTO');
    title = signal('');
    hint = signal('');
    uploading = signal(false);

    showCropper = signal(false);
    cropImageUrl = signal<string | null>(null);
    rawImageFile = signal<File | null>(null);
    mediaTypeOptions: Array<'PHOTO' | 'DOCUMENT' | 'RECORD' | 'OTHER'> = ['PHOTO', 'DOCUMENT', 'RECORD', 'OTHER'];

    onFilePicked(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0] || null;
        if (!file) return;

        this.selectedFile.set(file);
        this.kind.set(file.type.startsWith('image/') ? 'Picture' : 'Dokument');
        this.mediaType.set(file.type.startsWith('image/') ? 'PHOTO' : 'DOCUMENT');

        if (!this.title().trim()) {
            this.title.set(this.suggestedTitle(file));
        }

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e: any) => {
                this.rawImageFile.set(file);
                this.cropImageUrl.set(e.target.result || null);
                this.showCropper.set(true);
            };
            reader.readAsDataURL(file);
        }
    }

    onCropped(blob: Blob) {
        this.showCropper.set(false);
        const original = this.rawImageFile();
        if (!original) return;

        const base = original.name.replace(/\.[^/.]+$/, '');
        const cropped = new File([blob], `${base}.webp`, { type: 'image/webp' });
        this.selectedFile.set(cropped);
    }

    close() {
        this.reset();
        this.closed.emit();
    }

    submit() {
        const file = this.selectedFile();
        if (!file || !this.treeId) return;

        const resolvedTitle = (this.title().trim() || this.suggestedTitle(file)).trim();
        this.uploading.set(true);

        this.gedcomService.uploadMedia(this.treeId, file, resolvedTitle, this.mediaType()).subscribe({
            next: (res) => {
                this.uploading.set(false);
                this.uploaded.emit(res?.media);
                this.close();
            },
            error: (err) => {
                console.error('Media upload failed:', err);
                this.uploading.set(false);
            }
        });
    }

    refreshTitle() {
        const file = this.selectedFile();
        if (!file) return;
        this.title.set(this.suggestedTitle(file));
    }

    private suggestedTitle(file: File): string {
        const first = this.cleanName(this.defaultFirstName) || 'Unknown';
        const last = this.cleanName(this.defaultLastName) || 'Person';
        const hint = this.cleanName(this.hint());
        const kind = file.type.startsWith('image/') ? 'Picture' : 'Dokument';

        return hint ? `${kind}_${first}_${last}_${hint}` : `${kind}_${first}_${last}`;
    }

    private cleanName(value: string): string {
        return (value || '')
            .trim()
            .replace(/\s+/g, '_')
            .replace(/[^A-Za-z0-9_\-]/g, '');
    }

    private reset() {
        this.selectedFile.set(null);
        this.kind.set('Picture');
        this.mediaType.set('PHOTO');
        this.title.set('');
        this.hint.set('');
        this.uploading.set(false);
        this.showCropper.set(false);
        this.cropImageUrl.set(null);
        this.rawImageFile.set(null);
    }
}
