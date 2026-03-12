import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TreeService } from '../../core/services/tree.service';
import { AuthService } from '../../core/services/auth.service';
import { ImageCropper } from './image-cropper';
import { AppModalShell } from '../../shared/components/ui/app-modal-shell';
import { AppNotesList } from '../../shared/components/ui/app-notes-list/app-notes-list';
import { AppSourcesListComponent } from '../../shared/components/ui/app-sources-list/app-sources-list';

import { DisplayNote, NoteCategory, DisplaySource } from '../../core/models/models';


import { MediaService } from '../../core/services/media.service';
import { SourceService } from '../../core/services/source.service';
@Component({
    selector: 'app-media-add-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, ImageCropper, AppModalShell, AppNotesList, AppSourcesListComponent],
    templateUrl: './media-add-modal.html'
})
export class MediaAddModal {
    public mediaService = inject(MediaService);
    public sourceService = inject(SourceService);
    private treeService = inject(TreeService);

    @Input() visible = false;
    treeId = signal('');
    @Input('treeId') set _treeId(val: string) { this.treeId.set(val); }
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
            this.notes.set(Array.isArray(val.noteLinks) ? val.noteLinks.map((nl: any) => ({
                id: nl.note?.id || `note-${Math.random()}`,
                text: nl.note?.text || '',
                noteType: nl.note?.noteType || 'OTHER',
                createdAt: nl.note?.createdAt || new Date(),
                isPrivate: nl.note?.privacyLevel === 'PRIVATE'
            })) : []);
            this.citations.set(Array.isArray(val.citations) ? val.citations.map((c: any) => ({ sourceId: c.sourceId, page: c.page })) : []);
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

    private authService = inject(AuthService);
    private router = inject(Router);
    isEditing = signal(false);
    isOrphan = signal(false);
    id = signal('');
    currentPath = signal('');
    selectedFile = signal<File | null>(null);
    userId = computed(() => this.authService.currentUser()?.id || '');
    mediaType = signal<'PHOTO' | 'DOCUMENT' | 'RECORD' | 'OTHER'>('PHOTO');
    title = signal(''); // This is the "Namens-Hinweis"
    previewUrl = signal('');
    currentFileUrl = signal('');
    uploading = signal(false);

    // Advanced Data (Standardized)
    notes = signal<DisplayNote[]>([]);
    identifiers = signal<any[]>([]);
    citations = signal<any[]>([]);
    links = signal<any[]>([]);
    usages = signal<any[]>([]);
    isLoadingUsage = signal(false);

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
                if (res.success) this.usages.set(res.usage || []);
            },
            error: () => this.isLoadingUsage.set(false)
        });
    }
    
    // Note Management
    showNoteSubModal = signal(false);
    activeNoteIndex = signal<number | null>(null);
    noteDraft = signal<{ text: string, noteType: NoteCategory, isPrivate: boolean }>({
        text: '',
        noteType: 'OTHER',
        isPrivate: false
    });

    onNoteCreateRequested() {
        this.activeNoteIndex.set(null);
        this.noteDraft.set({ text: '', noteType: 'OTHER', isPrivate: false });
        this.showNoteSubModal.set(true);
    }

    onNoteEditRequested(note: DisplayNote) {
        const idx = this.notes().findIndex(n => n.id === note.id);
        if (idx !== -1) {
            this.activeNoteIndex.set(idx);
            this.noteDraft.set({
                text: note.text,
                noteType: note.noteType || 'OTHER',
                isPrivate: !!note.isPrivate
            });
            this.showNoteSubModal.set(true);
        }
    }

    onNoteSave() {
        const draft = this.noteDraft();
        if (!draft.text.trim()) return;

        const currentNotes = [...this.notes()];
        const idx = this.activeNoteIndex();

        if (idx !== null) {
            currentNotes[idx] = {
                ...currentNotes[idx],
                text: draft.text.trim(),
                noteType: draft.noteType,
                isPrivate: draft.isPrivate,
                updatedAt: new Date()
            };
        } else {
            currentNotes.push({
                id: `note-${Date.now()}`,
                text: draft.text.trim(),
                noteType: draft.noteType,
                isPrivate: draft.isPrivate,
                createdAt: new Date()
            });
        }

        this.notes.set(currentNotes);
        this.showNoteSubModal.set(false);
    }

    onNoteDeleted(noteId: string) {
        if (confirm('Möchtest du diese Notiz wirklich löschen?')) {
            this.notes.set(this.notes().filter(n => n.id !== noteId));
        }
    }

    onNoteDeleteFromModal() {
        const idx = this.activeNoteIndex();
        if (idx !== null) {
            const currentNotes = [...this.notes()];
            currentNotes.splice(idx, 1);
            this.notes.set(currentNotes);
            this.showNoteSubModal.set(false);
        }
    }

    // Source Management
    showSourceSubModal = signal(false);
    activeSourceIndex = signal<number | null>(null);
    sourceDraft = signal<{ sourceId: string; page: string; confidence: string; dateText: string; text: string }>({
        sourceId: '', page: '', confidence: '', dateText: '', text: ''
    });

    onSourceCreateRequested() {
        this.sourceDraft.set({ sourceId: '', page: '', confidence: '', dateText: '', text: '' });
        this.activeSourceIndex.set(null);
        this.showSourceSubModal.set(true);
    }

    onSourceEditRequested(source: DisplaySource & { _originalIndex?: number }) {
        if (source._originalIndex === undefined) return;
        const cit = this.citations()[source._originalIndex];
        if (cit) {
            this.sourceDraft.set({
                sourceId: cit.sourceId || '',
                page: cit.page || '',
                confidence: cit.confidence || '',
                dateText: cit.dateText || '',
                text: cit.text || ''
            });
            this.activeSourceIndex.set(source._originalIndex);
            this.showSourceSubModal.set(true);
        }
    }

    onSourceSave() {
        const draft = this.sourceDraft();
        if (!draft.sourceId) {
            alert('Bitte wählen Sie eine gültige Quelle aus.');
            return;
        }

        const currentCitations = [...this.citations()];
        const newCit = {
            sourceId: draft.sourceId,
            page: draft.page || '',
            confidence: draft.confidence || '',
            dateText: draft.dateText || '',
            text: draft.text || ''
        };

        const idx = this.activeSourceIndex();
        if (idx !== null) {
            currentCitations[idx] = { ...currentCitations[idx], ...newCit };
        } else {
            currentCitations.push(newCit);
        }

        this.citations.set(currentCitations);
        this.showSourceSubModal.set(false);
    }

    normalizedSources(): (DisplaySource & { _originalIndex?: number })[] {
        const cits = this.citations();
        if (!cits) return [];
        return cits.map((c: any, i: number) => {
            const rawSource = this.sourceOptions().find(s => s.id === c.sourceId);
            return {
                id: c.id || `cit-${i}`,
                title: rawSource ? rawSource.title : 'Unbekannte Quelle',
                author: rawSource ? rawSource.author : undefined,
                publication: rawSource ? rawSource.publication : undefined,
                confidence: c.confidence as any,
                description: c.page ? `Fundstelle: ${c.page}` : '',
                createdAt: c.dateText ? new Date(c.dateText) : new Date(),
                _originalIndex: i
            };
        });
    }

    onSourceDeleted(sourceId: string) {
        const idx = this.citations().findIndex((c: any, i: number) => (c.id || `cit-${i}`) === sourceId);
        if (idx !== -1) {
            if (confirm('Möchtest du diesen Beleg wirklich löschen?')) {
                const currentCitations = [...this.citations()];
                currentCitations.splice(idx, 1);
                this.citations.set(currentCitations);
            }
        }
    }

    onSourceDeleteFromModal() {
        const idx = this.activeSourceIndex();
        if (idx !== null) {
            const currentCitations = [...this.citations()];
            currentCitations.splice(idx, 1);
            this.citations.set(currentCitations);
            this.showSourceSubModal.set(false);
        }
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
    // UI Tab state for modal (single-column, tabbed layout)
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

        // We no longer show the cropper BEFORE upload. 
        // We will show it AFTER upload once we have the original on the server.
        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            this.previewUrl.set(url);
        }
    }

    onCropped(coords: any) {
        // coords is { x, y, width, height } from the cropper
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
                // Update internal crop state
                const m = res.media;
                this.cropX.set(m.cropX);
                this.cropY.set(m.cropY);
                this.cropWidth.set(m.cropWidth);
                this.cropHeight.set(m.cropHeight);

                // Refresh preview
                this.previewUrl.set(this.mediaService.getMediaUrl(mid, 'medium') + '?t=' + Date.now());
                this.saved.emit(res.media);
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
            // Already uploaded but crop was cancelled.
            this.saved.emit({ id: this.id() });
            this.close();
        }
    }

    startCropping() {
        console.log('[MediaAddModal] startCropping called, id:', this.id());
        if (!this.id()) return;
        this.cropImageUrl.set(this.mediaService.getMediaUrl(this.id())); // Use original for cropping
        this.showCropper.set(true);
        console.log('[MediaAddModal] showCropper set to true');
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
            notes: this.notes(),
            citations: this.citations(),
        };

        if (file) {
            this.mediaService.uploadMedia(tree.name, this.userId(), file, this.title(), this.mediaType()).subscribe({
                next: (res) => {
                    const newMedia = res.media;
                    this.id.set(newMedia.id);
                    this.isEditing.set(true);
                    this.selectedFile.set(null);
                    this.previewUrl.set(this.mediaService.getMediaUrl(newMedia.id, 'medium'));

                    // Update metadata (notes, identifiers, citations) right after upload
                    this.mediaService.updateMedia(tree.name, newMedia.id, data).subscribe({
                        next: (updRes) => {
                            console.log('[MediaAddModal] Metadata updated, syncing links...');
                            this.syncLinks(tree.name, newMedia.id).then(() => {
                                console.log('[MediaAddModal] Links synced, uploading=false');
                                this.uploading.set(false);
                                if (this.mediaType() === 'PHOTO') {
                                    this.startCropping();
                                } else {
                                    this.saved.emit(updRes.media || newMedia);
                                    this.close();
                                }
                            });
                        },
                        error: (err) => {
                            console.error('[MediaAddModal] Metadata update failed:', err);
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
                    console.error('Media upload failed:', err);
                    this.uploading.set(false);
                }
            });
        } else if (this.isEditing() && this.id()) {
            // Pure metadata update
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
                // Enrich any existing links with resolved person/family objects
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

    navigateToLink(link: any) {
        const pid = link.person?.id || link.personId || link.person?.xref;
        const fid = link.family?.id || link.familyId || link.family?.xref;
        if (pid) {
            this.router.navigate(['/person', pid]);
            return;
        }
        if (fid) {
            this.router.navigate(['/family', fid]);
            return;
        }
        if (link.sourceId) {
            // No dedicated source detail route; navigate to sources list for now
            this.router.navigate(['/sources']);
        }
    }

    formatLinkLabel(link: any): string {
        if (!link) return 'Unbekannt';

        // Person resolved
        const p = link.person || this.personOptions().find((x: any) => x.id === link.personId || x.xref === link.personId);
        if (p) {
            const given = (p.names && p.names[0] && (p.names[0].given || '')) || p.firstName || '';
            const sur = (p.names && p.names[0] && (p.names[0].surname || '')) || p.lastName || '';
            const life = (p.birthYear || p.birth?.year ? `, geb. ${p.birthYear || p.birth?.year}` : '') + (p.deathYear || p.death?.year ? `–${p.deathYear || p.death?.year}` : '');
            const name = `${given} ${sur}`.trim() || p.displayName || p.name || p.id;
            return `Person: ${name}${life}`;
        }

        // Family resolved
        const f = link.family || this.familyOptions().find((x: any) => x.id === link.familyId || x.xref === link.familyId);
        if (f) {
            const label = f.label || f.name || f.id;
            return `Familie: ${label}`;
        }

        // Source fallback
        if (link.sourceId) {
            return `Quelle: ${link.sourceTitle || link.sourceId}`;
        }

        return 'Unbekannt';
    }

    private updateMetadata(treeName: string, id: string, data: any) {
        this.mediaService.updateMedia(treeName, id, data).subscribe({
            next: (res) => {
                // Ensure any pending (local) links are persisted
                this.syncLinks(treeName, id).then(() => {
                    this.uploading.set(false);
                    this.saved.emit(res?.media || { ...data, id });
                    this.close();
                });
            },
            error: (err) => {
                console.error('Update failed:', err);
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
                        // Replace the first non-persisted entry with the returned link
                        const current = [...this.links()];
                        const idx = current.findIndex(x => !x.id);
                        if (idx >= 0) {
                            current.splice(idx, 1, link);
                            this.links.set(current);
                        } else {
                            this.links.set([...current, link]);
                        }
                    },
                    error: () => {
                        // ignore errors for individual links
                    },
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
                console.error('Delete failed:', err);
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
        // Try to add a person link first, otherwise a family link
        const pid = this.selectedPersonId();
        const fid = this.selectedFamilyId();

        if (!pid && !fid) return;

        const person = this.personOptions().find(p => p.id === pid);
        const family = this.familyOptions().find(f => f.id === fid);

        // If this media already exists on the server, create link immediately
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
            // Otherwise add a local placeholder that will be synced when saving metadata
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
            // Local placeholder, just remove
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
        this.notes.set([]);
        this.citations.set([]);
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
