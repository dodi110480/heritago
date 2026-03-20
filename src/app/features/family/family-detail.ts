import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Individual, Family, NoteCategory, DisplayNote } from '../../core/models/models';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';

import { FamilyService } from '../../core/services/family.service';
import { MediaService } from '../../core/services/media.service';

import { AppModalShell } from '../../shared/components/ui/app-modal-shell';
import { AppEmptyStateComponent } from '../../shared/components/ui/app-empty-state';
import { AppSectionHeaderComponent } from '../../shared/components/ui/app-section-header';
import { PlaceModal } from '../../shared/components/ui/place-modal/place-modal';
import { MediaSelector } from '../media/media-selector';
import { MediaAddModal } from '../media/media-add-modal';
import { EventModal } from '../../shared/components/ui/event-modal/event-modal';
import { ImageViewer } from '../media/image-viewer';
import { AppRelationModal, RelationDraft } from '../../shared/components/ui/app-relation-modal/app-relation-modal';

// Shared Tab Components
import { TabNotesComponent } from '../../shared/components/ui/tabs/tab-notes';
import { TabCitationsComponent } from '../../shared/components/ui/tabs/tab-citations';

// Sub Tab Components
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
        FamilyTabBasicsComponent,
        FamilyTabChildrenComponent,
        FamilyTabEventsComponent,
        AppRelationModal,
        TabNotesComponent,
        TabCitationsComponent
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
    showMediaModal = signal(false);
    showMediaAddModal = signal(false);
    showRelationModal = signal(false);
    activeRelation = signal<RelationDraft | null>(null);
    showPlaceModal = signal(false);
    showMediaSelector = false;

    // Drafts / Active Items
    activeEventIndex = signal<number | null>(null);
    eventDraft = signal<any>(null);

    activeMediaIndex = signal<number | null>(null);
    mediaDraft = signal<any>(null);

    // Image viewer for media previews
    viewerUrl = signal<string | null>(null);
    viewerTitle = signal<string>('');
    pendingReopenEventModal = false;

    private sub = new Subscription();

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
        this.store.saveFamily();
    }

    // --- Children ---
    openAddChildModal() {
        this.activeRelation.set({
            type: 'CHILD',
            personId: '',
            personName: '',
            pedigreeType: 'BIRTH',
            isPrimary: false
        });
        this.showRelationModal.set(true);
    }

    onRelationSave(draft: RelationDraft) {
        if (!draft.personId) return;
        
        const currentFam = this.store.family();
        if (!currentFam) return;

        this.store.family.update(fam => {
            if (fam) {
                if (draft.type === 'CHILD') {
                    if (!fam.children) fam.children = [];
                    if (!fam.children.includes(draft.personId)) {
                        fam.children.push(draft.personId);
                    }
                } else if (draft.type === 'FATHER') {
                    fam.husband = draft.personId;
                } else if (draft.type === 'MOTHER') {
                    fam.wife = draft.personId;
                }
            }
            return { ...fam } as Family;
        });
        
        this.showRelationModal.set(false);
        this.store.saveFamily();
    }

    removeChild(childId: string) {
        this.store.family.update(fam => {
            if (fam?.children) {
                fam.children = fam.children.filter(id => id !== childId);
            }
            return { ...fam } as Family;
        });
        this.store.saveFamily();
    }

    onRelationDeleteFromModal() {
        const rel = this.activeRelation();
        if (!rel) return;

        this.store.family.update(fam => {
            if (!fam) return fam;
            if (rel.type === 'CHILD' && rel.personId) {
                if (fam.children) {
                    fam.children = fam.children.filter(id => id !== rel.personId);
                }
            } else if (rel.type === 'FATHER') {
                fam.husband = undefined;
            } else if (rel.type === 'MOTHER') {
                fam.wife = undefined;
            }
            return { ...fam } as Family;
        });

        this.showRelationModal.set(false);
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
                this.store.saveFamily();
            }
        }
        this.showMediaSelector = false;
        if (this.pendingReopenEventModal) {
            this.showEventModal.set(true);
            this.pendingReopenEventModal = false;
        }
    }

    openMediaAddModal() {
        this.showMediaAddModal.set(true);
    }

    openEditMediaModal(index: number) {
        const fam = this.store.family();
        if (!fam || !fam.media?.[index]) return;
        this.activeMediaIndex.set(index);
        this.mediaDraft.set(JSON.parse(JSON.stringify(fam.media[index])));
        this.showMediaModal.set(true);
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
                this.store.saveFamily();
            }
        }
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
        this.showMediaModal.set(false);
        this.store.saveFamily();
    }

    removeMedia(index: number) {
        this.store.family.update(fam => {
            if (fam?.media) fam.media.splice(index, 1);
            return { ...fam } as Family;
        });
        this.showMediaModal.set(false);
        this.store.saveFamily();
    }

    // --- Helpers ---
    isImageUrl(url: string | undefined): boolean {
        if (!url) return false;
        return /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(url);
    }

    onPlaceSaved(place: any) {
        this.showPlaceModal.set(false);
    }
}
