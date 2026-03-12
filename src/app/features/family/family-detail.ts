import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Individual, Family } from '../../core/models/models';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';

import { FamilyService } from '../../core/services/family.service';
import { PlaceService } from '../../core/services/place.service';
import { MediaService } from '../../core/services/media.service';
import { SourceService } from '../../core/services/source.service';

import { AppModalShell } from '../../shared/components/ui/app-modal-shell';
import { AppEmptyStateComponent } from '../../shared/components/ui/app-empty-state';
import { AppSectionHeaderComponent } from '../../shared/components/ui/app-section-header';
import { PlaceModal } from '../../shared/components/ui/place-modal/place-modal';
import { MediaSelector } from '../media/media-selector';
import { MediaAddModal } from '../media/media-add-modal';
import { EventModal } from '../../shared/components/ui/event-modal/event-modal';
import { ImageViewer } from '../media/image-viewer';
import { AppNotesList } from '../../shared/components/ui/app-notes-list/app-notes-list';
import { DisplayNote, NoteCategory, DisplaySource } from '../../core/models/models';
import { AppSourcesListComponent } from '../../shared/components/ui/app-sources-list/app-sources-list';

// New Tab Components
import { FamilyTabBasicsComponent } from './family-tab-basics';
import { FamilyTabChildrenComponent } from './family-tab-children';
import { FamilyTabEventsComponent } from './family-tab-events';
import { FamilyFeatureStore } from './family-feature.store';

@Component({
    selector: 'app-family-detail',
    standalone: true,
    providers: [FamilyFeatureStore],
    imports: [
        CommonModule,
        FormsModule,
        AppPageHeaderComponent,
        AppModalShell,
        AppEmptyStateComponent,
        AppSectionHeaderComponent,
        PlaceModal,
        MediaSelector,
        MediaAddModal,
        EventModal,
        ImageViewer,
        AppNotesList,
        AppSourcesListComponent,
        FamilyTabBasicsComponent,
        FamilyTabChildrenComponent,
        FamilyTabEventsComponent
    ],
    templateUrl: './family-detail.html'
})
export class FamilyDetail implements OnInit, OnDestroy {
    public store = inject(FamilyFeatureStore);
    public mediaService = inject(MediaService);
    public authService = inject(AuthService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    // Modal States
    showEventModal = signal(false);
    showNoteModal = signal(false);
    showMediaModal = signal(false);
    showMediaAddModal = signal(false);
    showSourceModal = signal(false);
    showAddChildModal = signal(false);
    showCancelConfirmModal = signal(false);
    showPlaceModal = signal(false);
    showMediaSelector = false;

    // Drafts / Active Items
    activeEventIndex = signal<number | null>(null);
    eventDraft = signal<any>(null);

    activeNoteIndex = signal<number | null>(null);
    noteDraft = signal<any>({
        id: '',
        text: '',
        noteType: 'COMMENT' as NoteCategory,
        createdAt: new Date(),
        isPrivate: false
    });

    activeSourceIndex = signal<number | null>(null);
    sourceSearchQuery = signal('');
    noteSearchQuery = signal('');
    sourceDraft = signal<{ sourceId: string; confidence?: string; whereInSource?: string; text?: string; date?: string }>({ sourceId: '' });

    activeMediaIndex = signal<number | null>(null);
    mediaDraft = signal<any>(null);

    // Kind hinzufügen State
    addChildQuery = '';
    addChildResults = signal<Individual[]>([]);
    selectedChildId = signal<string | null>(null);
    addChildError = signal<string | null>(null);

    // Image viewer for media previews
    viewerUrl = signal<string | null>(null);
    viewerTitle = signal<string>('');
    pendingReopenEventModal = false;

    private sub = new Subscription();

    allPersonsOptions = computed(() => {
        return this.store.individuals().map(ind => ({
            id: ind.id,
            displayName: `${ind.firstName || ''} ${ind.lastName || ''} (${ind.id})`
        }));
    });

    ngOnInit() {
        this.sub.add(
            this.route.params.subscribe(params => {
                this.store.init(params['id']);
            })
        );
    }

    ngOnDestroy() {
        this.sub.unsubscribe();
    }

    // --- Modal Orchestration ---
    openViewer(media: any) {
        if (!media) return;
        const url = media.id ? this.mediaService.getMediaUrl(media.id) : (media.url ? this.mediaService.getMediaUrl(media.url) : null);
        if (!url) return;
        this.viewerUrl.set(url);
        this.viewerTitle.set(media.title || 'Bild');
    }

    // --- Events (Modal based) ---
    openAddEventModal() {
        this.activeEventIndex.set(null);
        this.eventDraft.set({ 
            type: 'MARR', 
            subType: '', 
            dateText: '', 
            place: '', 
            isPrimary: false, 
            media: [], 
            notes: [], 
            citations: [],
            associations: []
        });
        this.showEventModal.set(true);
    }

    openEditEventModal(index: number) {
        const fam = this.store.family();
        if (!fam || !fam.events?.[index]) return;
        this.activeEventIndex.set(index);
        this.eventDraft.set(JSON.parse(JSON.stringify(fam.events[index])));
        this.showEventModal.set(true);
    }

    confirmSaveEvent() {
        const draft = this.eventDraft();
        if (!draft) return;

        this.store.family.update(fam => {
            if (!fam) return fam;
            if (!fam.events) fam.events = [];
            const idx = this.activeEventIndex();
            if (idx !== null) {
                fam.events[idx] = draft;
            } else {
                fam.events.push(draft);
            }
            return { ...fam };
        });

        this.store.markDirty();
        this.showEventModal.set(false);
        this.store.saveFamily();
    }

    removeEvent(index: number) {
        this.store.family.update(fam => {
            if (fam?.events) {
                fam.events.splice(index, 1);
            }
            return { ...fam } as Family;
        });
        this.store.markDirty();
        this.store.saveFamily();
    }

    // --- Notes ---
    onNoteCreateRequested() {
        this.activeNoteIndex.set(null);
        this.noteDraft.set({
            id: 'note-' + Date.now(),
            text: '',
            noteType: 'COMMENT' as NoteCategory,
            createdAt: new Date(),
            isPrivate: false
        });
        this.showNoteModal.set(true);
    }

    onNoteEditRequested(note: DisplayNote) {
        const fam = this.store.family();
        if (!fam || !fam.notes) return;
        const index = fam.notes.findIndex(n => n.id === note.id);
        if (index !== -1) {
            this.activeNoteIndex.set(index);
            this.noteDraft.set({ ...note });
            this.showNoteModal.set(true);
        }
    }

    onNoteSave() {
        const draft = this.noteDraft();
        if (!draft?.text?.trim()) return;

        this.store.family.update(fam => {
            if (!fam) return fam;
            const notes = [...(fam.notes || [])];
            const index = this.activeNoteIndex();
            if (index !== null) {
                notes[index] = draft;
            } else {
                notes.push(draft);
            }
            return { ...fam, notes };
        });

        this.store.markDirty();
        this.showNoteModal.set(false);
        this.store.saveFamily();
    }

    onNoteDeletedFamily(noteId: string) {
        if (!confirm('Möchtest du diese Notiz wirklich löschen?')) return;
        
        this.store.family.update(fam => {
            if (!fam) return fam;
            return {
                ...fam,
                notes: (fam.notes || []).filter(n => n.id !== noteId)
            };
        });
        this.store.markDirty();
        this.store.saveFamily();
    }

    onNoteDeleteFromModal() {
        const idx = this.activeNoteIndex();
        if (idx !== null) {
            this.store.family.update(fam => {
                if (!fam || !fam.notes) return fam;
                const notes = [...fam.notes];
                notes.splice(idx, 1);
                return { ...fam, notes };
            });
            this.store.markDirty();
            this.showNoteModal.set(false);
            this.store.saveFamily();
        }
    }

    // --- Sources ---
    mappedSources = computed(() => {
        const fam = this.store.family() as any;
        if (!fam || !fam.citations) return [];
        return fam.citations.map((cit: any, i: number) => {
            const rawSource = this.store.availableSources().find(s => s.id === cit.sourceId);
            return {
                id: cit.id || `cit-${i}`,
                title: rawSource ? rawSource.title : 'Unbekannte Quelle',
                author: rawSource ? rawSource.author : undefined,
                publication: rawSource ? rawSource.publication : undefined,
                confidence: cit.confidence as any,
                whereInSource: cit.whereInSource || cit.page,
                date: cit.date || cit.dateText,
                description: (cit.whereInSource || cit.page) ? `Fundstelle: ${cit.whereInSource || cit.page}` : '',
                text: cit.text,
                createdAt: (cit.date || cit.dateText) ? new Date(cit.date || cit.dateText) : new Date(),
                _originalIndex: i
            } as any;
        });
    });

    onSourceCreateRequested() {
        this.sourceDraft.set({ sourceId: '', whereInSource: '', text: '', confidence: '', date: '' });
        this.activeSourceIndex.set(null);
        this.showSourceModal.set(true);
    }

    onSourceEditRequested(source: any) {
        const index = source._originalIndex;
        if (index === undefined) return;
        const fam = this.store.family() as any;
        if (!fam || !fam.citations || !fam.citations[index]) return;
        
        const cit = fam.citations[index];
        this.sourceDraft.set({
            sourceId: cit.sourceId || '',
            whereInSource: cit.whereInSource || cit.page || '',
            confidence: cit.confidence || '',
            text: cit.text || '',
            date: cit.date || cit.dateText || ''
        });
        this.activeSourceIndex.set(index);
        this.showSourceModal.set(true);
    }

    onSourceSave() {
        const draft = this.sourceDraft();
        if (!draft.sourceId) {
            alert('Bitte wählen Sie eine gültige Quelle aus.');
            return;
        }

        this.store.family.update(fam => {
            if (!fam) return fam;
            const f = { ...fam } as any;
            if (!f.citations) f.citations = [];
            
            const citation = {
                sourceId: draft.sourceId,
                whereInSource: draft.whereInSource || '',
                confidence: draft.confidence || '',
                text: draft.text || '',
                date: draft.date || ''
            };

            const index = this.activeSourceIndex();
            if (index !== null) f.citations[index] = citation;
            else f.citations.push(citation);
            return f;
        });

        this.store.markDirty();
        this.showSourceModal.set(false);
        this.store.saveFamily();
    }

    onSourceDeleteFromModal() {
        const index = this.activeSourceIndex();
        if (index === null) return;
        
        if (confirm('Möchtest du diesen Beleg wirklich löschen?')) {
            this.store.family.update(fam => {
                if (!fam || !fam.citations) return fam;
                const f = { ...fam } as any;
                f.citations.splice(index, 1);
                return f;
            });
            this.store.markDirty();
            this.showSourceModal.set(false);
            this.store.saveFamily();
        }
    }

    // --- Children ---
    openAddChildModal() {
        this.addChildQuery = '';
        this.addChildResults.set([]);
        this.selectedChildId.set(null);
        this.addChildError.set(null);
        this.showAddChildModal.set(true);
    }

    confirmAddChild() {
        this.addChildError.set(null);
        const currentFam = this.store.family();
        if (!currentFam) return;
        
        const query = (this.addChildQuery || '').trim().toLowerCase();
        if (!query) {
            this.addChildError.set('Bitte einen Namen oder eine ID eingeben.');
            return;
        }

        const existing = new Set<string>([
            ...(currentFam.children || []),
            currentFam.husband || '',
            currentFam.wife || ''
        ].filter(Boolean));

        const candidates = this.store.individuals().filter(p => {
            const id = (p.id || '').toLowerCase();
            const name = `${p.firstName || ''} ${p.lastName || ''}`.trim().toLowerCase();
            return id === query || name.includes(query);
        });

        if (candidates.length === 0) {
            this.addChildError.set('Keine passende Person gefunden.');
            return;
        }

        if (candidates.length > 1 && !this.selectedChildId()) {
            this.addChildResults.set(candidates.slice(0, 10));
            return;
        }

        const selected = this.selectedChildId()
            ? candidates.find(c => c.id === this.selectedChildId()) || candidates[0]
            : candidates[0];

        if (existing.has(selected.id)) {
            this.addChildError.set('Diese Person ist bereits in der Familie verknüpft.');
            return;
        }

        this.store.family.update(fam => {
            if (fam) {
                if (!fam.children) fam.children = [];
                fam.children.push(selected.id);
            }
            return { ...fam } as Family;
        });
        
        this.store.markDirty();
        this.showAddChildModal.set(false);
        this.store.saveFamily();
    }

    removeChild(childId: string) {
        this.store.family.update(fam => {
            if (fam?.children) {
                fam.children = fam.children.filter(id => id !== childId);
            }
            return { ...fam } as Family;
        });
        this.store.markDirty();
        this.store.saveFamily();
    }

    // --- Media ---
    openMediaSelector() {
        if (this.showEventModal()) {
            this.pendingReopenEventModal = true;
            this.showEventModal.set(false);
        }
        this.showMediaSelector = true;
    }

    onMediaSelected(mediaObj: any) {
        if (!mediaObj) return;
        if (this.pendingReopenEventModal && this.eventDraft()) {
            const draft = this.eventDraft();
            draft.media = draft.media || [];
            draft.media.push({
                id: mediaObj.id,
                url: this.mediaService.getMediaUrl(mediaObj.id),
                title: mediaObj.title || mediaObj.path || '',
                isPrimary: draft.media.length === 0,
                mimeType: mediaObj.mimeType
            });
            this.eventDraft.set({ ...draft });
        } else {
            const f = this.store.family();
            if (f) {
                f.media = f.media || [];
                f.media.push({
                    id: mediaObj.id,
                    title: mediaObj.title || mediaObj.path || '',
                    isPrimary: f.media.length === 0,
                    mimeType: mediaObj.mimeType,
                    url: this.mediaService.getMediaUrl(mediaObj.id)
                });
                this.store.family.set({ ...f });
            }
        }
        this.showMediaSelector = false;
        this.store.markDirty();
        if (this.pendingReopenEventModal) {
            this.showEventModal.set(true);
            this.pendingReopenEventModal = false;
        }
    }

    onMediaAddUploaded(media: any) {
        if (!media) return;
        if (this.pendingReopenEventModal && this.eventDraft()) {
            const draft = this.eventDraft();
            draft.media = draft.media || [];
            draft.media.push({ id: media.id, url: this.mediaService.getMediaUrl(media.id), title: media.title || media.path || '', isPrimary: draft.media.length === 0, mimeType: media.mimeType });
            this.eventDraft.set({ ...draft });
        } else {
            const f = this.store.family();
            if (f) {
                f.media = f.media || [];
                f.media.push({ id: media.id, title: media.title || media.path || '', isPrimary: f.media.length === 0, mimeType: media.mimeType, url: this.mediaService.getMediaUrl(media.id) });
                this.store.family.set({ ...f });
            }
        }
        this.store.markDirty();
        this.showMediaAddModal.set(false);
        if (this.pendingReopenEventModal) {
            this.showEventModal.set(true);
            this.pendingReopenEventModal = false;
        }
    }

    confirmSaveMedia() {
        const draft = this.mediaDraft();
        if (!draft) return;
        this.store.family.update(fam => {
            if (!fam) return fam;
            if (!fam.media) fam.media = [];
            const idx = this.activeMediaIndex();
            if (idx !== null) fam.media[idx] = draft;
            else fam.media.push(draft);
            return { ...fam };
        });
        this.store.markDirty();
        this.showMediaModal.set(false);
        this.store.saveFamily();
    }

    removeMedia(index: number) {
        this.store.family.update(fam => {
            if (fam?.media) fam.media.splice(index, 1);
            return { ...fam } as Family;
        });
        this.store.markDirty();
        this.showMediaModal.set(false);
        this.store.saveFamily();
    }

    // --- Helpers ---
    isImageUrl(url: string | undefined): boolean {
        if (!url) return false;
        return /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(url);
    }
}
