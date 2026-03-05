import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppCardComponent } from './ui/app-card';
import { AppModalShell } from './ui/app-modal-shell';
import { MediaSelector } from './media-selector';
import { ImageViewer } from './image-viewer';
import { MediaAddModal } from './media-add-modal';
import { GedcomService } from './gedcom.service';
import { inject } from '@angular/core';

@Component({
    selector: 'app-person-tab-media',
    standalone: true,
    imports: [CommonModule, FormsModule, AppCardComponent, AppModalShell, MediaSelector, ImageViewer, MediaAddModal],
    template: `
        <app-card [contentClass]="'p-0'">
            <div class="p-0">
                <div class="flex justify-between items-center mb-8">
                    <div>
                        <h2 class="text-xl font-semibold text-ui-text">Medien &amp; Galerie</h2>
                        <p class="text-sm text-ui-textMuted mt-1">Bilder und Dokumente der Person.</p>
                    </div>
                    <div class="flex gap-2">
                        <button (click)="openMediaAddModal()" class="btn-primary !w-auto !py-2">
                            + Upload
                        </button>
                        <button (click)="openMediaSelector()" class="btn-secondary !w-auto !py-2">
                            Galerie
                        </button>
                        <button (click)="addPersonMedia()" class="btn-ghost !w-auto !p-2" title="URL verlinken">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <div *ngIf="person?.media && person.media.length > 0" class="grid grid-cols-1 gap-4">
                    <div *ngFor="let m of person.media; let i = index"
                        class="glass-card !p-0 overflow-hidden flex h-24 hover:bg-ui-cardHover transition-all group">
                        <!-- Thumbnail -->
                        <div (click)="openViewer(m)"
                            class="w-32 bg-ui-panel flex items-center justify-center cursor-pointer relative overflow-hidden">
                            <img *ngIf="isImage(m) && getMediaUrlExt(m.url)" [src]="getMediaUrlExt(m.url)"
                                class="w-full h-full object-cover transition-transform group-hover:scale-110"
                                alt="Vorschau" />
                            <div *ngIf="!isImage(m) || !getMediaUrlExt(m.url)" class="text-neutral-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
                                    fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                                    <polyline points="13 2 13 9 20 9"></polyline>
                                </svg>
                            </div>
                            <div *ngIf="m.isPrimary"
                                class="absolute top-1 left-1 bg-brand-500 text-canvas-white p-1 rounded-md shadow-lg"
                                title="Hauptbild">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                                    fill="currentColor">
                                    <polygon
                                        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2">
                                    </polygon>
                                </svg>
                            </div>
                        </div>

                        <!-- Details -->
                        <div class="flex-1 p-4 flex flex-col justify-center gap-2 cursor-pointer transition-colors"
                            (click)="openMediaEditModal(i)">
                            <div class="flex items-center gap-3">
                                <h3 class="font-bold text-sm text-ui-text flex-1">{{ m.title || 'Ohne Titel' }}</h3>
                                <button (click)="$event.stopPropagation(); setPrimaryMedia(i)"
                                    [class.text-brand-400]="m.isPrimary" [class.text-neutral-600]="!m.isPrimary"
                                    class="badge badge-neutral hover:badge-primary cursor-pointer transition-colors">
                                    <span class="text-xs">{{ m.isPrimary ? '★' : '☆' }}</span> Profilbild
                                </button>
                            </div>
                            <div class="flex items-center gap-2 text-[10px] sm:text-xs">
                                <span class="badge badge-neutral">{{ m.role === 'PORTRAIT' ? 'Portrait' : m.role ===
                                    'DOCUMENT' ? 'Dokument' : m.role === 'CERTIFICATE' ? 'Urkunde' : m.role ===
                                    'GRAVESTONE' ? 'Grabstein' : m.role === 'SIGNATURE' ? 'Unterschrift' : m.role
                                    === 'OTHER' ? 'Sonstiges' : 'Medium' }}</span>
                                <span *ngIf="m.caption" class="text-ui-textSoft truncate">{{ m.caption }}</span>
                            </div>
                            <div class="flex items-center gap-2 mt-1">
                                <span
                                    class="text-[10px] font-mono text-ui-textMuted select-all truncate max-w-[200px]">{{
                                    m.url }}</span>
                            </div>
                        </div>

                        <!-- Delete -->
                        <button (click)="requestDeletePersonMedia(i)"
                            class="w-12 flex items-center justify-center text-ui-textMuted hover:text-accent-danger-500 hover:bg-accent-danger-500/10 transition-all border-l border-ui-border/60">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path
                                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2">
                                </path>
                            </svg>
                        </button>
                    </div>
                </div>

                <div *ngIf="!person?.media || person.media.length === 0"
                    class="py-12 flex flex-col items-center justify-center border-2 border-dashed border-ui-border/60 rounded-3xl text-ui-textMuted">
                    <span class="text-4xl mb-3 opacity-20">🖼️</span>
                    <p class="font-medium">Keine Medien vorhanden.</p>
                </div>
            </div>
        </app-card>

        <!-- MEDIA DELETE CONFIRM MODAL -->
        <app-modal-shell [visible]="mediaDeletePendingIndex() !== null" title="Medium löschen" icon="🗑️" size="sm"
            [showSave]="false" [showDelete]="true" deleteText="Ja, löschen" (close)="cancelDeletePersonMedia()"
            (delete)="confirmDeletePersonMedia()">
            <div class="p-4 text-neutral-500 text-center">
                <div
                    class="w-14 h-14 bg-accent-danger-500/10 text-accent-danger-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </div>
                <p class="text-sm">Möchtest du dieses Medium wirklich entfernen?<br>
                    <span class="text-xs text-neutral-600 mt-1 block">Die Datei in der Galerie bleibt erhalten.</span>
                </p>
            </div>
        </app-modal-shell>

        <!-- MEDIA EDIT MODAL -->
        <app-modal-shell [visible]="showMediaEditModal()" title="Medium bearbeiten" icon="🖼️" size="md" [showSave]="true"
            saveText="Speichern" [showDelete]="false" (close)="closeMediaEditModal()" (save)="saveMediaEditModal()">
            <div class="space-y-4">
                <div class="form-group mb-0">
                    <label class="form-label">Titel</label>
                    <input type="text" [ngModel]="editMediaDraft()?.title"
                        (ngModelChange)="editMediaDraft.set({ ...editMediaDraft(), title: $event })" class="form-input"
                        placeholder="Titel des Mediums...">
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="form-group mb-0">
                        <label class="form-label">Rolle</label>
                        <select [ngModel]="editMediaDraft()?.role"
                            (ngModelChange)="editMediaDraft.set({ ...editMediaDraft(), role: $event })"
                            class="form-input !py-2.5">
                            <option value="">(Keine Rolle)</option>
                            <option value="PORTRAIT">Portrait</option>
                            <option value="DOCUMENT">Dokument</option>
                            <option value="CERTIFICATE">Urkunde</option>
                            <option value="GRAVESTONE">Grabstein</option>
                            <option value="SIGNATURE">Unterschrift</option>
                            <option value="OTHER">Sonstiges</option>
                        </select>
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label">Bildunterschrift</label>
                        <input type="text" [ngModel]="editMediaDraft()?.caption"
                            (ngModelChange)="editMediaDraft.set({ ...editMediaDraft(), caption: $event })"
                            class="form-input" placeholder="Quelle, Datum, etc...">
                    </div>
                </div>

                <div class="form-group mb-0">
                    <label class="form-label">URL / Dateipfad</label>
                    <input type="text" [ngModel]="editMediaDraft()?.url"
                        (ngModelChange)="editMediaDraft.set({ ...editMediaDraft(), url: $event })" class="form-input"
                        placeholder="Dateiname oder URL">
                </div>

                <label
                    class="flex items-center gap-2 cursor-pointer text-sm text-neutral-300 pt-2 border-t border-canvas-white/10">
                    <input type="checkbox" [ngModel]="editMediaDraft()?.isPrimary"
                        (ngModelChange)="editMediaDraft.set({ ...editMediaDraft(), isPrimary: $event })"
                        class="w-4 h-4 rounded border-canvas-white/10 bg-ui-surfaceDark text-brand-500 focus:ring-brand-500 focus:ring-offset-neutral-900">
                    Als Profilbild verwenden
                </label>
            </div>
        </app-modal-shell>

        <app-media-selector [visible]="showMediaSelector" (selected)="onMediaSelected($event)"
            (closed)="showMediaSelector = false">
        </app-media-selector>

        <app-media-add-modal [visible]="showMediaAddModal()" [treeId]="treeId"
            [defaultFirstName]="person?.firstName || ''" [defaultLastName]="person?.lastName || ''"
            (closed)="showMediaAddModal.set(false)" (uploaded)="onMediaAddUploaded($event)">
        </app-media-add-modal>

        <app-image-viewer [url]="viewerUrl()" [title]="viewerTitle()" (closed)="viewerUrl.set(null)">
        </app-image-viewer>
    `
})
export class PersonTabMediaComponent {
    @Input({ required: true }) person!: any;
    @Input() treeId: string = '';
    @Output() changed = new EventEmitter<void>();

    private gedcomService = inject(GedcomService);

    showMediaAddModal = signal(false);
    showMediaEditModal = signal(false);
    activeMediaIndex = signal<number | null>(null);
    editMediaDraft = signal<any>({});
    mediaDeletePendingIndex = signal<number | null>(null);
    showMediaSelector = false;
    viewerUrl = signal<string | null>(null);
    viewerTitle = signal<string>('');

    getMediaUrlExt(url: string | undefined): string | null {
        if (!url) return null;
        return this.gedcomService.getMediaUrl(url);
    }

    isImage(m: any): boolean {
        if (m.mimeType) return m.mimeType.startsWith('image/');
        if (m.url) return m.url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) !== null;
        return false;
    }

    openViewer(media: any) {
        this.viewerUrl.set(this.gedcomService.getMediaUrl(media.url));
        this.viewerTitle.set(media.title || 'Bild');
    }

    openMediaAddModal() {
        this.showMediaAddModal.set(true);
    }

    onMediaAddUploaded(media: any) {
        if (!media) return;
        const p = this.person;
        if (p) {
            p.media = p.media || [];
            p.media.push({
                id: media.id,
                url: media.remoteUrl || (media.filePath ? `/uploads/${media.filePath}` : media.url),
                title: media.title || media.filePath || '',
                isPrimary: p.media.length === 0,
                mimeType: media.mimeType
            });
        }
        this.changed.emit();
        this.showMediaAddModal.set(false);
    }

    openMediaEditModal(index: number) {
        const p = this.person;
        if (!p || !p.media) return;
        this.activeMediaIndex.set(index);
        this.editMediaDraft.set({ ...p.media[index] });
        this.showMediaEditModal.set(true);
    }

    closeMediaEditModal() {
        this.showMediaEditModal.set(false);
        this.activeMediaIndex.set(null);
    }

    saveMediaEditModal() {
        const p = this.person;
        const idx = this.activeMediaIndex();
        if (!p || !p.media || idx === null) return;

        const draft = this.editMediaDraft();
        const wasPrimary = p.media[idx].isPrimary;
        const isNowPrimary = draft.isPrimary;

        p.media[idx] = { ...p.media[idx], ...draft };

        if (isNowPrimary && !wasPrimary) {
            p.media.forEach((m: any, i: number) => m.isPrimary = i === idx);
            p.profileImageUrl = p.media[idx].url || '';
        }

        this.changed.emit();
        this.closeMediaEditModal();
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
                url: mediaObj.remoteUrl || (mediaObj.filePath ? `/uploads/${mediaObj.filePath}` : mediaObj.url),
                title: mediaObj.title || mediaObj.filePath || '',
                isPrimary: p.media.length === 0,
                mimeType: mediaObj.mimeType
            });
        }
        this.showMediaSelector = false;
        this.changed.emit();
    }

    addPersonMedia() {
        const p = this.person;
        if (p) {
            p.media = p.media || [];
            p.media.push({ url: '', title: '', isPrimary: false });
            this.changed.emit();
        }
    }

    requestDeletePersonMedia(index: number) {
        this.mediaDeletePendingIndex.set(index);
    }

    confirmDeletePersonMedia() {
        const idx = this.mediaDeletePendingIndex();
        if (idx !== null) {
            const p = this.person;
            if (p) {
                p.media!.splice(idx, 1);
                this.changed.emit();
            }
        }
        this.mediaDeletePendingIndex.set(null);
    }

    cancelDeletePersonMedia() {
        this.mediaDeletePendingIndex.set(null);
    }

    setPrimaryMedia(index: number) {
        const p = this.person;
        if (p) {
            p.media!.forEach((m: any) => m.isPrimary = false);
            p.media![index].isPrimary = true;
            this.changed.emit();
        }
    }
}
