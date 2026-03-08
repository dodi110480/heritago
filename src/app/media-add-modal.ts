import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GedcomService } from './gedcom.service';
import { AuthService } from './auth.service';
import { ImageCropper } from './image-cropper';
import { AppModalShell } from './ui/app-modal-shell';
import { AppNotesList } from './ui/app-notes-list';
import { DisplayNote, NoteCategory } from './models';

@Component({
    selector: 'app-media-add-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, ImageCropper, AppModalShell, AppNotesList],
    templateUrl: './media-add-modal.html'
})
export class MediaAddModal {
    private gedcomService = inject(GedcomService);

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
            this.currentFileUrl.set(this.gedcomService.getMediaUrl(val.id || val.path));
            this.previewUrl.set(this.gedcomService.getMediaUrl(val.id || val.path, 'medium'));
            this.loadOptions();
        } else {
            this.reset();
        }
    }

    @Output() closed = new EventEmitter<void>();
    @Output() saved = new EventEmitter<any>();

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
        if (!mid) return;

        this.uploading.set(true);
        this.gedcomService.updateCrop(mid, coords).subscribe({
            next: (res) => {
                this.uploading.set(false);
                // Update internal crop state
                const m = res.media;
                this.cropX.set(m.cropX);
                this.cropY.set(m.cropY);
                this.cropWidth.set(m.cropWidth);
                this.cropHeight.set(m.cropHeight);

                // Refresh preview
                this.previewUrl.set(this.gedcomService.getMediaUrl(mid, 'medium') + '?t=' + Date.now());
                this.saved.emit(res.media);
            },
            error: () => this.uploading.set(false)
        });
    }

    startCropping() {
        if (!this.id()) return;
        this.cropImageUrl.set(this.gedcomService.getMediaUrl(this.id())); // Use original for cropping
        this.showCropper.set(true);
    }

    close() {
        this.reset();
        this.closed.emit();
    }

    submit() {
        if (!this.treeId()) return;
        this.uploading.set(true);

        const file = this.selectedFile();
        const data = {
            title: this.title(),
            mediaType: this.mediaType(),
            identifiers: this.identifiers(),
            notes: this.notes(),
            citations: this.citations(),
        };

        if (!this.treeId()) {
            console.error('[MediaAddModal] Cannot upload: No treeId active.');
            this.uploading.set(false);
            return;
        }

        if (file) {
            this.gedcomService.uploadMedia(this.treeId(), this.userId(), file, this.title(), this.mediaType()).subscribe({
                next: (res) => {
                    const newMedia = res.media;
                    this.id.set(newMedia.id);
                    this.isEditing.set(true);
                    this.selectedFile.set(null);
                    this.previewUrl.set(this.gedcomService.getMediaUrl(newMedia.id, 'medium'));

                    // Update metadata (notes, identifiers, citations) right after upload
                    this.gedcomService.updateMedia(newMedia.id, data).subscribe({
                        next: (updRes) => {
                            if (this.mediaType() === 'PHOTO') {
                                this.startCropping();
                            } else {
                                this.syncLinks(newMedia.id).then(() => {
                                    this.uploading.set(false);
                                    this.saved.emit(updRes.media || newMedia);
                                    this.close();
                                });
                            }
                        },
                        error: (err) => {
                            console.error('Metadata update after upload failed:', err);
                            // Still allow cropping if it's a photo
                            if (this.mediaType() === 'PHOTO') {
                                this.startCropping();
                            } else {
                                this.syncLinks(newMedia.id).then(() => {
                                    this.uploading.set(false);
                                    this.saved.emit(newMedia);
                                    this.close();
                                });
                            }
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
            this.updateMetadata(this.id(), data);
        } else {
            this.uploading.set(false);
        }
    }

    private loadedOptionsTreeId = '';
    private loadOptions() {
        if (!this.treeId() || this.treeId() === this.loadedOptionsTreeId) return;
        this.loadedOptionsTreeId = this.treeId();
        this.gedcomService.getSources(this.treeId()).subscribe(res => {
            if (res.success) this.sourceOptions.set(res.sources || []);
        });
        this.gedcomService.getTreeData().subscribe(data => {
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

    private updateMetadata(id: string, data: any) {
        this.gedcomService.updateMedia(id, data).subscribe({
            next: (res) => {
                // Ensure any pending (local) links are persisted
                this.syncLinks(id).then(() => {
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

    private syncLinks(mediaId: string): Promise<void> {
        const pending = this.links().filter(l => !l.id);
        if (pending.length === 0) return Promise.resolve();

        return new Promise((resolve) => {
            let remaining = pending.length;
            pending.forEach(l => {
                const payload: any = { treeId: this.treeId() };
                if (l.person?.id) payload.personId = l.person.id;
                if (l.family?.id) payload.familyId = l.family.id;
                if (l.sourceId) payload.sourceId = l.sourceId;
                if (l.isPrimary) payload.isPrimary = l.isPrimary;

                this.gedcomService.linkMedia(mediaId, payload).subscribe({
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
        if ((!this.id() && !this.isOrphan()) || !confirm('Medium wirklich löschen?')) return;
        this.uploading.set(true);

        const obs = this.isOrphan() 
            ? this.gedcomService.deleteOrphanFile(this.currentPath())
            : this.gedcomService.deleteMedia(this.id());

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

    addCitation() { this.citations.set([...this.citations(), { sourceId: '', page: '' }]); }
    updateCitation(i: number, field: 'sourceId' | 'page', val: string) {
        const cits = [...this.citations()];
        cits[i][field] = val;
        this.citations.set(cits);
    }
    removeCitation(i: number) { this.citations.set(this.citations().filter((_, idx) => idx !== i)); }

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
            const payload: any = { treeId: this.treeId() };
            if (person) payload.personId = person.id;
            if (family) payload.familyId = family.id;

            this.gedcomService.linkMedia(this.id(), payload).subscribe({
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
            this.gedcomService.unlinkMedia(l.id).subscribe({
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
