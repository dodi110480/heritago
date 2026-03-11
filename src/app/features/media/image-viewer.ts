import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-image-viewer',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './image-viewer.html'
})
export class ImageViewer {
    @Input() url: string | null = null;
    @Input() title: string = '';
    @Output() closed = new EventEmitter<void>();

    zoom = signal(1);

    close() {
        this.zoom.set(1);
        this.closed.emit();
    }

    zoomIn() {
        this.zoom.update(z => Math.min(z + 0.2, 5));
    }

    zoomOut() {
        this.zoom.update(z => Math.max(z - 0.2, 0.5));
    }

    onWheel(event: WheelEvent) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.1 : 0.1;
        this.zoom.update(z => Math.min(Math.max(z + delta, 0.2), 10));
    }

    resetZoom() {
        this.zoom.set(1);
    }

    download() {
        if (!this.url) return;
        const link = document.createElement('a');
        link.href = this.url;
        link.download = this.title || 'image';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
