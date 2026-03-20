import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TreeService } from '../../core/services/tree.service';
import { AuthService } from '../../core/services/auth.service';
import { ImageCropper } from './image-cropper';
import { AppModalShell } from '../../shared/components/ui/app-modal-shell';

import { DisplayNote, NoteCategory, DisplaySource } from '../../core/models/models';
import { MediaService } from '../../core/services/media.service';
import { SourceService } from '../../core/services/source.service';

// Shared Tab Components
import { TabNotesComponent } from '../../shared/components/ui/tabs/tab-notes';
import { TabCitationsComponent } from '../../shared/components/ui/tabs/tab-citations';

import { AppUsageList } from '../../shared/components/ui/app-usage-list/app-usage-list';

@Component({
    selector: 'app-media-add-modal',
    standalone: true,
    imports: [
        CommonModule, 
        FormsModule, 
        ImageCropper, 
        AppModalShell, 
        TabNotesComponent, 
        TabCitationsComponent,
        AppUsageList
    ],
    templateUrl: './media-add-modal.html'
})
export class MediaAddModal {
    public mediaService = inject(MediaService);
    public sourceService = inject(SourceService);
    private treeService = inject(TreeService);
    public authService = inject(AuthService);
    private router = inject(Router);

    @Input() visible = false;
    treeId = signal('');
    @Input('treeId') set _treeId(val: string) { this.treeId.set(val); }
    
    // Internal state for notes/citations (raw from API)
    rawNotes = signal<any[]>([]);
    rawCitations = signal<any[]>([]);
    formattedNotes = signal<any[]>([]);
    formattedCitations = signal<any[]>([]);

    @Input() set item(val: any) {
        if (val) {
            this.isEditing.set(true);
            this.isOrphan.set(!!val.orphanFile);
            this.id.set(val.id || '');
            this.currentPath.set(val.path || '');
            this.title.set(val.title || '');
            this.mediaType.set(val.mediaType || 'PHOTO');
            this.links.set(Array.isArray(val.links) ? [...val.links] : []);
            this.identifiers.set(Array.isArray(val.identifiers) ? val.identifiers.map((i: any) => ({ type: i.type, value: i.value })) : []);
            
            // Map raw data and formatted data
            this.rawNotes.set(val.notes || []);
            this.rawCitations.set(val.citations || []);
            this.formattedNotes.set(val.formattedNotes || []);
            this.formattedCitations.set(val.formattedCitations || []);

            this.cropX.set(val.cropX ?? null);
            this.cropY.set(val.cropY ?? null);
            this.cropWidth.set(val.cropWidth ?? null);
            this.cropHeight.set(val.cropHeight ?? null);
            this.currentFileUrl.set(this.mediaService.getMediaUrl(val.id || val.path));
            this.previewUrl.set(this.mediaService.getMediaUrl(val.id || val.path, 'medium'));
            this.loadOptions();
        } else {
            this.reset();
        }
    }

    @Output() closed = new EventEmitter<void>();
    @Output() saved = new EventEmitter<any>();
    @Output() masterSaved = new EventEmitter<void>();

    isEditing = signal(false);
    isOrphan = signal(false);
    id = signal('');
    currentPath = signal('');
    selectedFile = signal<File | null>(null);
    userId = computed(() => this.authService.currentUser()?.id || '');
    mediaType = signal<'PHOTO' | 'DOCUMENT' | 'RECORD' | 'OTHER'>('PHOTO');
    title = signal(''); 
    previewUrl = signal('');
    currentFileUrl = signal('');
    uploading = signal(false);

    // Identifiers
    identifiers = signal<any[]>([]);
    links = signal<any[]>([]);
    usages = signal<any[]>([]);
    isLoadingUsage = signal(false);

    // Helpers for shared tabs
    mediaAsEntity = computed(() => ({
        id: this.id(),
        notes: this.rawNotes(),
        citations: this.rawCitations(),
        formattedNotes: this.formattedNotes(),
        formattedCitations: this.formattedCitations()
    }));

    onEntityChanged(event: { notes: any[], citations: any[] }) {
        this.rawNotes.set(event.notes || []);
        this.rawCitations.set(event.citations || []);
    }

    setTab(tab: 'preview' | 'basics' | 'citations' | 'identifiers' | 'links' | 'notes') {
        this.activeTab.set(tab);
        if (tab === 'links') {
            this.fetchUsage();
        }
    }

    private fetchUsage() {
        const tree = this.authService.currentTree();
        if (!this.id() || !this.isEditing() || !tree) return;
        this.isLoadingUsage.set(true);
        this.mediaService.getMediaUsage(tree.name, this.id()).subscribe({
            next: (res) => {
                this.isLoadingUsage.set(false);
                this.usages.set(res.usage || res || []);
            },
            error: () => this.isLoadingUsage.set(false)
        });
    }

    cropX = signal<number | null>(null);
    cropY = signal<number | null>(null);
    cropWidth = signal<number | null>(null);
    cropHeight = signal<number | null>(null);

    currentCrop = computed(() => {
        const x = this.cropX();
        const y = this.cropY();
        const w = this.cropWidth();
        const h = this.cropHeight();
        if (x !== null && y !== null && w !== null && h !== null) {
            return { x, y, width: w, height: h };
        }
        return undefined;
    });

    // Options for links
    personOptions = signal<any[]>([]);
    familyOptions = signal<any[]>([]);
    sourceOptions = signal<any[]>([]);
    selectedPersonId = signal('');
    selectedFamilyId = signal('');

    showCropper = signal(false);
    cropImageUrl = signal<string | null>(null);
    rawImageFile = signal<File | null>(null);
    mediaTypeOptions: Array<'PHOTO' | 'DOCUMENT' | 'RECORD' | 'OTHER'> = ['PHOTO', 'DOCUMENT', 'RECORD', 'OTHER'];
    activeTab = signal<'preview'|'basics'|'citations'|'identifiers'|'links'|'notes'>('preview');

    onFilePicked(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0] || null;
        if (!file) return;

        this.selectedFile.set(file);
        this.mediaType.set(file.type.startsWith('image/') ? 'PHOTO' : 'DOCUMENT');

        if (!this.title().trim()) {
            this.title.set(file.name.replace(/\.[^/.]+$/, ''));
        }

        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            this.previewUrl.set(url);
        }
    }

    onCropped(coords: any) {
        this.showCropper.set(false);
        const mid = this.id();
        const tree = this.authService.currentTree();
        if (!mid || !tree) {
            this.saved.emit(null);
            this.close();
            return;
        }

        this.uploading.set(true);
        this.mediaService.updateCrop(tree.name, mid, coords).subscribe({
            next: (res) => {
                this.uploading.set(false);
                const m = res;
                this.cropX.set(m.cropX);
                this.cropY.set(m.cropY);
                this.cropWidth.set(m.cropWidth);
                this.cropHeight.set(m.cropHeight);

                this.previewUrl.set(this.mediaService.getMediaUrl(mid, 'medium') + '?t=' + Date.now());
                this.saved.emit(res);
                this.close();
            },
            error: () => {
                this.uploading.set(false);
                this.close();
            }
        });
    }

    onCropCancel() {
        this.showCropper.set(false);
        if (this.id() && !this.isEditing() && this.mediaType() === 'PHOTO') {
            this.saved.emit({ id: this.id() });
            this.close();
        }
    }

    startCropping() {
        if (!this.id()) return;
        this.cropImageUrl.set(this.mediaService.getMediaUrl(this.id())); 
        this.showCropper.set(true);
    }

    close() {
        this.reset();
        this.closed.emit();
    }

    submit() {
        const tree = this.authService.currentTree();
        if (!tree) return;
        this.uploading.set(true);

        const file = this.selectedFile();
        const data = {
            title: this.title(),
            mediaType: this.mediaType(),
            identifiers: this.identifiers(),
            notes: this.rawNotes(),
            citations: this.rawCitations(),
        };

        if (file) {
            this.mediaService.uploadMedia(tree.name, this.userId(), file, this.title(), this.mediaType()).subscribe({
                next: (newMedia) => {
                    this.id.set(newMedia.id);
                    this.isEditing.set(true);
                    this.selectedFile.set(null);
                    this.previewUrl.set(this.mediaService.getMediaUrl(newMedia.id, 'medium'));

                    this.mediaService.updateMedia(tree.name, newMedia.id, data).subscribe({
                        next: (updRes) => {
                            this.syncLinks(tree.name, newMedia.id).then(() => {
                                this.uploading.set(false);
                                if (this.mediaType() === 'PHOTO') {
                                    this.startCropping();
                                } else {
                                    this.saved.emit(updRes || newMedia);
                                    this.close();
                                }
                            });
                        },
                        error: (err) => {
                            this.syncLinks(tree.name, newMedia.id).then(() => {
                                this.uploading.set(false);
                                if (this.mediaType() === 'PHOTO') {
                                    this.startCropping();
                                } else {
                                    this.saved.emit(newMedia);
                                    this.close();
                                }
                            });
                        }
                    });
                },
                error: (err) => {
                    this.uploading.set(false);
                }
            });
        } else if (this.isEditing() && this.id()) {
            this.updateMetadata(tree.name, this.id(), data);
        } else {
            this.uploading.set(false);
        }
    }

    private loadedOptionsTreeId = '';
    private loadOptions() {
        if (!this.treeId() || this.treeId() === this.loadedOptionsTreeId) return;
        this.loadedOptionsTreeId = this.treeId();
        this.sourceService.getSources(this.treeId()).subscribe(res => {
            if (res.success) this.sourceOptions.set(res.sources || []);
        });
        this.treeService.getTreeData().subscribe(data => {
            if (data) {
                this.personOptions.set(data.individuals || []);
                this.familyOptions.set(data.families || []);
                this.enrichLinks();
            }
        });
    }

    private enrichLinks() {
        const persons = this.personOptions();
        const families = this.familyOptions();
        const updated = this.links().map((l: any) => {
            const copy: any = { ...l };
            if (!copy.person && copy.personId) {
                const p = persons.find((x: any) => x.id === copy.personId || x.xref === copy.personId);
                if (p) copy.person = p;
            }
            if (!copy.family && copy.familyId) {
                const f = families.find((x: any) => x.id === copy.familyId || x.xref === copy.familyId);
                if (f) copy.family = f;
            }
            return copy;
        });
        this.links.set(updated);
    }

    private updateMetadata(treeName: string, id: string, data: any) {
        this.mediaService.updateMedia(treeName, id, data).subscribe({
            next: (res) => {
                this.syncLinks(treeName, id).then(() => {
                    this.uploading.set(false);
                    this.saved.emit(res || { ...data, id });
                    this.close();
                });
            },
            error: (err) => {
                this.uploading.set(false);
            }
        });
    }

    private syncLinks(treeName: string, mediaId: string): Promise<void> {
        const pending = this.links().filter(l => !l.id);
        if (pending.length === 0) return Promise.resolve();

        return new Promise((resolve) => {
            let remaining = pending.length;
            pending.forEach(l => {
                const payload: any = { };
                if (l.person?.id) payload.personId = l.person.id;
                if (l.family?.id) payload.familyId = l.family.id;
                if (l.sourceId) payload.sourceId = l.sourceId;
                if (l.isPrimary) payload.isPrimary = l.isPrimary;

                this.mediaService.linkMedia(treeName, mediaId, payload).subscribe({
                    next: (res) => {
                        const link = res?.link || res;
                        const current = [...this.links()];
                        const idx = current.findIndex(x => !x.id);
                        if (idx >= 0) {
                            current.splice(idx, 1, link);
                            this.links.set(current);
                        } else {
                            this.links.set([...current, link]);
                        }
                    },
                    error: () => {},
                    complete: () => {
                        remaining -= 1;
                        if (remaining <= 0) resolve();
                    }
                });
            });
        });
    }

    deleteItem() {
        const tree = this.authService.currentTree();
        if (!tree || ((!this.id() && !this.isOrphan()) || !confirm('Medium wirklich löschen?'))) return;
        this.uploading.set(true);

        const obs = this.isOrphan() 
            ? this.mediaService.deleteOrphanFile(tree.name, this.currentPath())
            : this.mediaService.deleteMedia(tree.name, this.id());

        obs.subscribe({
            next: () => {
                this.uploading.set(false);
                this.saved.emit(null);
                this.close();
            },
            error: (err) => {
                this.uploading.set(false);
            }
        });
    }

    addIdentifier() { this.identifiers.set([...this.identifiers(), { type: '', value: '' }]); }
    updateIdentifier(i: number, field: 'type' | 'value', val: string) {
        const idens = [...this.identifiers()];
        idens[i][field] = val;
        this.identifiers.set(idens);
    }
    removeIdentifier(i: number) { this.identifiers.set(this.identifiers().filter((_, idx) => idx !== i)); }

    download() {
        const url = this.currentFileUrl();
        if (url) window.open(url, '_blank');
    }

    addLink() {
        const pid = this.selectedPersonId();
        const fid = this.selectedFamilyId();

        if (!pid && !fid) return;

        const person = this.personOptions().find(p => p.id === pid);
        const family = this.familyOptions().find(f => f.id === fid);

        if (this.isEditing() && this.id()) {
            const tree = this.authService.currentTree();
            if (!tree) return;
            const payload: any = { };
            if (person) payload.personId = person.id;
            if (family) payload.familyId = family.id;

            this.mediaService.linkMedia(tree.name, this.id(), payload).subscribe({
                next: (res) => {
                    const link = res?.link || res;
                    this.links.set([...this.links(), link]);
                    this.selectedPersonId.set('');
                    this.selectedFamilyId.set('');
                },
                error: (err) => console.error('Link create failed', err)
            });
        } else {
            const placeholder: any = {};
            if (person) placeholder.person = person;
            if (family) placeholder.family = family;
            this.links.set([...this.links(), placeholder]);
            this.selectedPersonId.set('');
            this.selectedFamilyId.set('');
        }
    }

    removeLink(i: number) {
        const l = this.links()[i];
        if (!l) return;

        if (l.id) {
            const tree = this.authService.currentTree();
            if (!tree) return;
            this.mediaService.unlinkMedia(tree.name, l.id).subscribe({
                next: () => {
                    this.links.set(this.links().filter((_, idx) => idx !== i));
                },
                error: (err) => console.error('Failed to remove link', err)
            });
        } else {
            this.links.set(this.links().filter((_, idx) => idx !== i));
        }
    }

    private reset() {
        this.isEditing.set(false);
        this.isOrphan.set(false);
        this.id.set('');
        this.currentPath.set('');
        this.selectedFile.set(null);
        this.mediaType.set('PHOTO');
        this.title.set('');
        this.previewUrl.set('');
        this.currentFileUrl.set('');
        this.identifiers.set([]);
        this.rawNotes.set([]);
        this.rawCitations.set([]);
        this.formattedNotes.set([]);
        this.formattedCitations.set([]);
        this.links.set([]);
        this.cropX.set(null);
        this.cropY.set(null);
        this.cropWidth.set(null);
        this.cropHeight.set(null);
        this.uploading.set(false);
        this.showCropper.set(false);
        this.cropImageUrl.set(null);
        this.rawImageFile.set(null);
    }
}
