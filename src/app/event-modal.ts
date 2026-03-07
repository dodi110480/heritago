import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppModalShell } from './ui/app-modal-shell';
import { GedcomService } from './gedcom.service';

@Component({
    selector: 'app-event-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, AppModalShell],
    templateUrl: './event-modal.html'
})
export class EventModal {
    @Input() visible = false;
    @Input() item: any = null; // draft
    @Input() isNew = false;
    @Input() showDelete = false;

    @Output() close = new EventEmitter<void>();
    @Output() save = new EventEmitter<void>();
    @Output() delete = new EventEmitter<void>();

    // action outputs for citations/media/notes
    @Output() addCitation = new EventEmitter<void>();
    @Output() removeCitation = new EventEmitter<number>();

    @Output() addMedia = new EventEmitter<void>();
    @Output() removeMedia = new EventEmitter<number>();

    @Output() addNote = new EventEmitter<void>();
    @Output() removeNote = new EventEmitter<number>();

    @Output() openUpload = new EventEmitter<void>();
    @Output() openGallery = new EventEmitter<void>();
    @Output() openViewer = new EventEmitter<any>();

    activeTab = signal<'basics' | 'citations' | 'media' | 'notes'>('basics');

    private gedcomService = inject(GedcomService);

    getMediaUrl(idOrUrl: string | undefined, variant?: string) {
        if (!idOrUrl) return null;
        return this.gedcomService.getMediaUrl(idOrUrl, variant || 'thumbs');
    }

    emitClose() { this.close.emit(); }
    emitSave() { this.save.emit(); }
    emitDelete() { this.delete.emit(); }

    emitAddCitation() { this.addCitation.emit(); }
    emitRemoveCitation(i: number) { this.removeCitation.emit(i); }

    emitAddMedia() { this.addMedia.emit(); }
    emitRemoveMedia(i: number) { this.removeMedia.emit(i); }

    emitAddNote() { this.addNote.emit(); }
    emitRemoveNote(i: number) { this.removeNote.emit(i); }

    emitOpenUpload() { this.openUpload.emit(); }
    emitOpenGallery() { this.openGallery.emit(); }
    emitOpenViewer(m: any) { this.openViewer.emit(m); }
}
