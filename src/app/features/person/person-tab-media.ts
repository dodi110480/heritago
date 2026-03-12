import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MediaService } from '../../core/services/media.service';
import { TreeService } from '../../core/services/tree.service';

import { MediaSelector } from '../media/media-selector';
import { ImageViewer } from '../media/image-viewer';
import { MediaAddModal } from '../media/media-add-modal';
import { AppSectionHeaderComponent } from '../../shared/components/ui/app-section-header';
import { AppMediaList } from '../../shared/components/ui/app-media-list/app-media-list';
import { DisplayMedia } from '../../core/models/models';

@Component({
    selector: 'app-person-tab-media',
    standalone: true,
    imports: [CommonModule, FormsModule, MediaSelector, ImageViewer, MediaAddModal, AppSectionHeaderComponent, AppMediaList],
    template: `
        <div class="glass-card shadow-sm flex flex-col">
            <div class="p-0">
                <app-section-header title="Medien & Galerie" icon="🖼️" description="Bilder und Dokumente der Person.">
                    <div actions class="flex items-center gap-3">
                        <div class="relative hidden md:block w-64">
                            <input 
                                type="text" 
                                [(ngModel)]="searchText"
                                placeholder="Medien durchsuchen..."
                                class="w-full bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-btn pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all font-medium"
                            >
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </span>
                        </div>
                        <button (click)="openMediaAddModal()" class="btn-primary !w-auto !py-2">+ Upload</button>
                        <button (click)="openMediaSelector()" class="btn-secondary !w-auto !py-2">Galerie</button>
                    </div>
                </app-section-header>

                <app-media-list
                    [entityId]="person?.id || ''"
                    [entityType]="'PERSON'"
                    [mediaDisplay]="displayMedia"
                    [allowCreate]="true"
                    [allowEdit]="true"
                    [showHeader]="false"
                    [showPrimaryToggle]="true"
                    [searchTerm]="searchText"
                    (mediaEditRequested)="onMediaEditRequested($event)"
                    (mediaUploadRequested)="openMediaAddModal()"
                    (mediaGalleryRequested)="openMediaSelector()"
                    (mediaDeleted)="onMediaDeleted($event)"
                    (primaryChanged)="onPrimaryChanged($event)"
                    (viewerRequested)="onViewerRequested($event)"
                ></app-media-list>
            </div>
        </div>

        <app-media-selector [visible]="showMediaSelector" (selected)="onMediaSelected($event)"
            (closed)="showMediaSelector = false">
        </app-media-selector>

        <app-media-add-modal [visible]="showMediaAddModal() || activeMediaIndex() !== null" [treeId]="treeId"
            [item]="activeMediaIndex() !== null ? person.media[activeMediaIndex()!] : undefined"
            (closed)="showMediaAddModal.set(false); activeMediaIndex.set(null)" 
            (saved)="onMediaAddUploaded($event)">
        </app-media-add-modal>

        <app-image-viewer [url]="viewerUrl()" [title]="viewerTitle()" (closed)="viewerUrl.set(null)">
        </app-image-viewer>
    `
})
export class PersonTabMediaComponent {
    public mediaService = inject(MediaService);
    @Input({ required: true }) person!: any;
    @Input() treeId: string = '';
    @Output() changed = new EventEmitter<void>();

    private treeService = inject(TreeService);

    showMediaAddModal = signal(false);
    activeMediaIndex = signal<number | null>(null);
    showMediaSelector = false;
    viewerUrl = signal<string | null>(null);
    viewerTitle = signal<string>('');
    searchText = '';

    get displayMedia(): DisplayMedia[] {
        if (!this.person?.media) return [];
        return this.person.media.map((m: any, i: number) => ({
            id: m.id || `media-${i}`,
            title: m.title || '',
            mimeType: m.mimeType,
            isPrimary: !!m.isPrimary,
            role: m.role,
            caption: m.caption,
            url: m.url,
            previewUrl: m.id ? this.mediaService.getMediaUrl(m.id, 'thumbs') : undefined
        }));
    }

    onMediaEditRequested(displayMedia: DisplayMedia) {
        const idx = this.person?.media?.findIndex((m: any, i: number) => (m.id || `media-${i}`) === displayMedia.id);
        if (idx !== undefined && idx !== -1) {
            this.activeMediaIndex.set(idx);
        }
    }

    onMediaDeleted(mediaId: string) {
        const p = this.person;
        if (!p || !p.media) return;
        const idx = p.media.findIndex((m: any, i: number) => (m.id || `media-${i}`) === mediaId);
        if (idx !== -1) {
            p.media.splice(idx, 1);
            this.changed.emit();
        }
    }

    onPrimaryChanged(mediaId: string) {
        const p = this.person;
        if (!p || !p.media) return;
        const idx = p.media.findIndex((m: any, i: number) => (m.id || `media-${i}`) === mediaId);
        if (idx !== -1) {
            p.media.forEach((m: any) => m.isPrimary = false);
            p.media[idx].isPrimary = true;
            this.changed.emit();
        }
    }

    onViewerRequested(media: DisplayMedia) {
        this.viewerUrl.set(this.mediaService.getMediaUrl(media.id));
        this.viewerTitle.set(media.title || 'Bild');
    }

    openMediaAddModal() {
        this.showMediaAddModal.set(true);
    }

    onMediaAddUploaded(media: any) {
        if (!media) {
             const idx = this.activeMediaIndex();
             if (idx !== null) {
                 this.person.media.splice(idx, 1);
                 this.changed.emit();
             }
             this.showMediaAddModal.set(false);
             this.activeMediaIndex.set(null);
             return;
        }
        
        const p = this.person;
        const idx = this.activeMediaIndex();
        if (idx !== null && p.media[idx]) {
            p.media[idx] = { 
                ...p.media[idx], 
                id: media.id,
                title: media.title || media.path || '',
                mimeType: media.mimeType
            };
        } else if (p) {
            p.media = p.media || [];
            p.media.push({
                id: media.id,
                title: media.title || media.path || '',
                isPrimary: p.media.length === 0,
                mimeType: media.mimeType
            });
        }
        this.changed.emit();
        this.showMediaAddModal.set(false);
        this.activeMediaIndex.set(null);
    }

    openMediaSelector() {
        this.showMediaSelector = true;
    }

    onMediaSelected(mediaObj: any) {
        if (!mediaObj) return;
        const p = this.person;
        if (p) {
            p.media = p.media || [];
            p.media.push({
                id: mediaObj.id,
                title: mediaObj.title || mediaObj.path || '',
                isPrimary: p.media.length === 0,
                mimeType: mediaObj.mimeType
            });
        }
        this.showMediaSelector = false;
        this.changed.emit();
    }
}
