import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { Individual, Family } from './models';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { AppPageHeaderComponent } from './ui/app-page-header';
import { AppAvatarComponent } from './ui/app-avatar';

import { AppModalShell } from './ui/app-modal-shell';
import { AppEmptyStateComponent } from './ui/app-empty-state';
import { AppSectionHeaderComponent } from './ui/app-section-header';
import { PlaceModal } from './place-modal';
import { MediaSelector } from './media-selector';
import { MediaAddModal } from './media-add-modal';
import { EventModal } from './event-modal';
import { ImageViewer } from './image-viewer';

@Component({
    selector: 'app-family-detail',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        AppPageHeaderComponent,
        AppModalShell,
        AppAvatarComponent,
        AppEmptyStateComponent,
        AppSectionHeaderComponent,
        PlaceModal,
        MediaSelector,
        MediaAddModal,
        EventModal,
        ImageViewer
    ],
    templateUrl: './family-detail.html'
})
export class FamilyDetail implements OnInit, OnDestroy {
    private gedcomService = inject(GedcomService);
    public authService = inject(AuthService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    familyId = signal<string | null>(null);
    family = signal<Family | null>(null);
    individuals = signal<Individual[]>([]);
    loading = signal(true);
    isDirty = signal(false);
    isSaving = signal(false);
    availableSources = signal<any[]>([]);

    activeTab = signal<'basics' | 'children' | 'events' | 'notes' | 'citations' | 'media'>('basics');

    // Modal States
    showEventModal = signal(false);
    showNoteModal = signal(false);
    showCitationModal = signal(false);
    showMediaModal = signal(false);
    showMediaAddModal = signal(false);
    showAddChildModal = signal(false);
    showCancelConfirmModal = signal(false);
    showPlaceModal = signal(false);
    showMediaSelector = false;

    // Drafts / Active Items
    activeEventIndex = signal<number | null>(null);
    eventDraft = signal<any>(null);

    activeNoteIndex = signal<number | null>(null);
    noteDraft = signal<any>(null);

    activeCitationIndex = signal<number | null>(null);
    citationDraft = signal<any>(null);

    activeMediaIndex = signal<number | null>(null);
    mediaDraft = signal<any>(null);

    // Kind hinzufügen State
    addChildQuery = '';
    addChildResults = signal<Individual[]>([]);
    selectedChildId = signal<string | null>(null);
    addChildError = signal<string | null>(null);

    // Place Search State
    placeSearchResults = signal<any[]>([]);
    showPlaceSuggestions = signal(false);
    eventModalTab = signal<'basics' | 'citations' | 'media' | 'notes'>('basics');

    // Image viewer for media previews
    viewerUrl = signal<string | null>(null);
    viewerTitle = signal<string>('');
    // If media dialogs are opened from the event modal, hide the event modal and reopen later
    pendingReopenEventModal = false;

    private sub = new Subscription();

    // Helper for easier access in template
    get self() { return this; }

    ngOnInit() {
        this.sub.add(
            this.route.params.subscribe(params => {
                this.familyId.set(params['id']);
                this.loadData();
            })
        );
    }

    ngOnDestroy() {
        this.sub.unsubscribe();
    }

    openViewer(media: any) {
        if (!media) return;
        const url = media.id ? this.gedcomService.getMediaUrl(media.id) : (media.url ? this.gedcomService.getMediaUrl(media.url) : null);
        if (!url) return;
        this.viewerUrl.set(url);
        this.viewerTitle.set(media.title || 'Bild');
    }

    loadData() {
        this.loading.set(true);
        this.gedcomService.getTreeData().subscribe({
            next: (data) => {
                if (data) {
                    this.individuals.set(data.individuals);
                    const treeName = data.meta?.tree;
                    if (treeName) {
                        this.gedcomService.getSources(treeName).subscribe({
                            next: (res: any) => {
                                if (res.success) this.availableSources.set(res.sources || []);
                            }
                        });
                    }
                    const fam = data.families.find(f => f.id === this.familyId());
                    if (fam) {
                        const clonedFam = JSON.parse(JSON.stringify(fam));
                        if (clonedFam.events) {
                            clonedFam.events.forEach((e: any) => {
                                if (!e.dateText && e.date) e.dateText = e.date;
                                if (!e.place && e.placeName) e.place = e.placeName;
                                if (!e.subType && e.eventSubtype) e.subType = e.eventSubtype;
                                if (!Array.isArray(e.media)) e.media = [];
                                if (!Array.isArray(e.notes)) e.notes = [];
                                if (!Array.isArray(e.citations)) e.citations = [];
                            });
                        }
                        if (!Array.isArray(clonedFam.notes)) clonedFam.notes = [];
                        this.family.set(clonedFam);
                    } else {
                        this.router.navigate(['/families']);
                    }
                }
                this.loading.set(false);
            },
            error: () => this.loading.set(false)
        });
    }

    getPersonById(id: string | undefined): Individual | undefined {
        if (!id) return undefined;
        return this.individuals().find(i => i.id === id);
    }

    getPersonName(id: string | undefined): string {
        const p = this.getPersonById(id);
        if (!p) return 'Unbekannt';
        return `${p.firstName} ${p.lastName}`;
    }

    getPersonImage(id: string | undefined): string {
        const p = this.getPersonById(id);
        if (!p) return 'assets/avatars/unknown.svg';
        if (p.media && p.media.length > 0) {
            const primary = p.media.find(m => m.isPrimary) || p.media[0];
        if (primary?.id) return this.gedcomService.getMediaUrl(primary.id, 'thumbs');
        if (primary?.url) return this.gedcomService.getMediaUrl(primary.url, 'thumbs');
        }
        const gender = p.gender === 'M' ? 'male' : (p.gender === 'F' ? 'female' : 'unknown');
        return `assets/avatars/${gender}.svg`;
    }

    getPersonGender(id: string | undefined): string {
        const p = this.getPersonById(id);
        return p?.gender || 'U';
    }

    getMarriageInfo(): string {
        const fam = this.family();
        if (!fam || !fam.events) return '';
        const marr = fam.events.find(e => e.type === 'MARR');
        if (!marr) return '';
        const date = marr.date || (marr as any).dateText || '';
        const place = marr.place || (marr as any).placeName || '';
        return date + (place ? ` in ${place}` : '');
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
            citations: [] 
        });
        this.eventModalTab.set('basics');
        this.showEventModal.set(true);
    }

    openEditEventModal(index: number) {
        const fam = this.family();
        if (!fam || !fam.events?.[index]) return;
        this.activeEventIndex.set(index);
        const event = JSON.parse(JSON.stringify(fam.events[index]));
        // Ensure arrays exist
        if (!event.media) event.media = [];
        if (!event.notes) event.notes = [];
        if (!event.citations) event.citations = [];
        this.eventDraft.set(event);
        this.eventModalTab.set('basics');
        this.showEventModal.set(true);
    }

    confirmSaveEvent() {
        const draft = this.eventDraft();
        if (!draft) return;

        this.family.update(fam => {
            if (!fam) return fam;
            if (!fam.events) fam.events = [];
            const idx = this.activeEventIndex();
            if (idx !== null) {
                fam.events[idx] = draft;
            } else {
                fam.events.push(draft);
            }
            return { ...fam }; // Return new reference for change detection
        });

        this.isDirty.set(true);
        this.showEventModal.set(false);
        this.eventDraft.set(null);
        this.save();
    }

    removeEvent(index: number) {
        this.family.update(fam => {
            if (fam?.events) {
                fam.events.splice(index, 1);
            }
            return { ...fam } as Family;
        });
        this.isDirty.set(true);
        this.showEventModal.set(false);
        this.save();
    }

    // --- Event Detail Management ---
    addEventCitation() {
        const draft = this.eventDraft();
        if (draft) {
            draft.citations.push({ sourceId: '', page: '', confidence: '', dateText: '' });
            this.eventDraft.set({ ...draft });
        }
    }

    removeEventCitation(idx: number) {
        const draft = this.eventDraft();
        if (draft) {
            draft.citations.splice(idx, 1);
            this.eventDraft.set({ ...draft });
        }
    }

    addEventMedia() {
        const draft = this.eventDraft();
        if (draft) {
            draft.media.push({ url: '', title: '', isPrimary: false });
            this.eventDraft.set({ ...draft });
        }
    }

    removeEventMedia(idx: number) {
        const draft = this.eventDraft();
        if (draft) {
            draft.media.splice(idx, 1);
            this.eventDraft.set({ ...draft });
        }
    }

    addEventNote() {
        const draft = this.eventDraft();
        if (draft) {
            draft.notes.push('');
            this.eventDraft.set({ ...draft });
        }
    }

    updateEventNote(idx: number, value: string) {
        const draft = this.eventDraft();
        if (draft) {
            draft.notes[idx] = value;
            this.eventDraft.set({ ...draft });
        }
    }

    removeEventNote(idx: number) {
        const draft = this.eventDraft();
        if (draft) {
            draft.notes.splice(idx, 1);
            this.eventDraft.set({ ...draft });
        }
    }

    // --- Place Management ---
    searchPlaces(query: string) {
        const tree = this.authService.currentTree();
        if (!tree || !query || query.length < 2) {
            this.placeSearchResults.set([]);
            this.showPlaceSuggestions.set(false);
            return;
        }

        this.gedcomService.searchPlaces(tree.name, query).subscribe({
            next: (res: any) => {
                this.placeSearchResults.set(res.places || []);
                this.showPlaceSuggestions.set(true);
            }
        });
    }

    selectPlace(place: any) {
        const draft = this.eventDraft();
        if (draft) {
            draft.place = place.name;
            this.eventDraft.set({ ...draft });
        }
        this.showPlaceSuggestions.set(false);
    }

    openPlaceModal() {
        this.showPlaceModal.set(true);
    }

    onPlaceSaved(place: any) {
        const draft = this.eventDraft();
        if (draft) {
            draft.place = place.name;
            this.eventDraft.set({ ...draft });
        }
        this.showPlaceModal.set(false);
    }

    // --- Notes (Modal based) ---
    openAddNoteModal() {
        this.activeNoteIndex.set(null);
        this.noteDraft.set({ text: '', noteType: 'GENERAL', researchStatus: 'OPEN', privacyLevel: 'PRIVATE' });
        this.showNoteModal.set(true);
    }

    openEditNoteModal(index: number) {
        const fam = this.family() as any;
        if (!fam || !fam.notes?.[index]) return;
        this.activeNoteIndex.set(index);
        this.noteDraft.set(JSON.parse(JSON.stringify(fam.notes[index])));
        this.showNoteModal.set(true);
    }

    confirmSaveNote() {
        const draft = this.noteDraft();
        if (!draft) return;

        this.family.update(fam => {
            const f = fam as any;
            if (!f) return fam;
            if (!f.notes) f.notes = [];
            const idx = this.activeNoteIndex();
            if (idx !== null) {
                f.notes[idx] = draft;
            } else {
                f.notes.push(draft);
            }
            return { ...f };
        });

        this.isDirty.set(true);
        this.showNoteModal.set(false);
        this.noteDraft.set(null);
        this.save();
    }

    removeNote(index: number) {
        this.family.update(fam => {
            const f = fam as any;
            if (f?.notes) {
                f.notes.splice(index, 1);
            }
            return { ...f };
        });
        this.isDirty.set(true);
        this.showNoteModal.set(false);
        this.save();
    }

    // --- Citations (Modal based) ---
    openAddCitationModal() {
        this.activeCitationIndex.set(null);
        this.citationDraft.set({ sourceId: '', page: '', confidence: '', dateText: '' });
        this.showCitationModal.set(true);
    }

    openEditCitationModal(index: number) {
        const fam = this.family() as any;
        if (!fam || !fam.citations?.[index]) return;
        this.activeCitationIndex.set(index);
        this.citationDraft.set(JSON.parse(JSON.stringify(fam.citations[index])));
        this.showCitationModal.set(true);
    }

    confirmSaveCitation() {
        const draft = this.citationDraft();
        if (!draft) return;

        this.family.update(fam => {
            const f = fam as any;
            if (!f) return fam;
            if (!f.citations) f.citations = [];
            const idx = this.activeCitationIndex();
            if (idx !== null) {
                f.citations[idx] = draft;
            } else {
                f.citations.push(draft);
            }
            return { ...f };
        });

        this.isDirty.set(true);
        this.showCitationModal.set(false);
        this.citationDraft.set(null);
        this.save();
    }

    removeCitation(index: number) {
        this.family.update(fam => {
            const f = fam as any;
            if (f?.citations) {
                f.citations.splice(index, 1);
            }
            return { ...f };
        });
        this.isDirty.set(true);
        this.showCitationModal.set(false);
        this.save();
    }

    // --- Media (Modal based) ---
    openAddMediaModal() {
        this.activeMediaIndex.set(null);
        this.mediaDraft.set({ url: '', title: '', isPrimary: false });
        this.showMediaModal.set(true);
    }

    openEditMediaModal(index: number) {
        const fam = this.family();
        if (!fam || !fam.media?.[index]) return;
        this.activeMediaIndex.set(index);
        this.mediaDraft.set(JSON.parse(JSON.stringify(fam.media[index])));
        this.showMediaModal.set(true);
    }

    openMediaSelector() {
        if (this.showEventModal && this.showEventModal()) {
            this.pendingReopenEventModal = true;
            this.showEventModal.set(false);
        }
        this.showMediaSelector = true;
    }

    onMediaSelected(mediaObj: any) {
        if (!mediaObj) return;
        // If the selector was opened from an event modal, add media to the event draft
        if (this.pendingReopenEventModal && this.eventDraft()) {
            const draft = this.eventDraft();
            draft.media = draft.media || [];
            draft.media.push({
                id: mediaObj.id,
                url: this.gedcomService.getMediaUrl(mediaObj.id),
                title: mediaObj.title || mediaObj.path || '',
                isPrimary: draft.media.length === 0,
                mimeType: mediaObj.mimeType
            });
            this.eventDraft.set({ ...draft });
        } else {
            const f = this.family();
            if (f) {
                f.media = f.media || [];
                f.media.push({
                    id: mediaObj.id,
                    title: mediaObj.title || mediaObj.path || '',
                    isPrimary: f.media.length === 0,
                    mimeType: mediaObj.mimeType,
                    url: this.gedcomService.getMediaUrl(mediaObj.id)
                });
                this.family.set({ ...f });
            }
        }
        this.showMediaSelector = false;
        this.isDirty.set(true);
        if (this.pendingReopenEventModal) {
            this.showEventModal.set(true);
            this.pendingReopenEventModal = false;
        }
    }

    openMediaAddModal() {
        if (this.showEventModal && this.showEventModal()) {
            this.pendingReopenEventModal = true;
            this.showEventModal.set(false);
        }
        this.showMediaAddModal.set(true);
    }

    onMediaAddUploaded(media: any) {
        if (!media) return;
        // If the add dialog was opened from an event modal, add media to event draft
        if (this.pendingReopenEventModal && this.eventDraft()) {
            const draft = this.eventDraft();
            draft.media = draft.media || [];
            draft.media.push({ id: media.id, url: this.gedcomService.getMediaUrl(media.id), title: media.title || media.path || '', isPrimary: draft.media.length === 0, mimeType: media.mimeType });
            this.eventDraft.set({ ...draft });
            this.isDirty.set(true);
        } else {
            const f = this.family();
            if (f) {
                f.media = f.media || [];
                f.media.push({ id: media.id, title: media.title || media.path || '', isPrimary: f.media.length === 0, mimeType: media.mimeType, url: this.gedcomService.getMediaUrl(media.id) });
                this.family.set({ ...f });
                this.isDirty.set(true);
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

        this.family.update(fam => {
            if (!fam) return fam;
            if (!fam.media) fam.media = [];
            const idx = this.activeMediaIndex();
            if (idx !== null) {
                fam.media[idx] = draft;
            } else {
                fam.media.push(draft);
            }
            return { ...fam };
        });

        this.isDirty.set(true);
        this.showMediaModal.set(false);
        this.mediaDraft.set(null);
        this.save();
    }

    removeMedia(index: number) {
        this.family.update(fam => {
            if (fam?.media) {
                fam.media.splice(index, 1);
            }
            return { ...fam } as Family;
        });
        this.isDirty.set(true);
        this.showMediaModal.set(false);
        this.save();
    }

    isImageUrl(url: string | undefined): boolean {
        if (!url) return false;
        return /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(url);
    }


    getSourceTitle(sourceId: string): string {
        const source = this.availableSources().find(s => s.id === sourceId);
        return source?.title || sourceId || 'Unbekannte Quelle';
    }

    // ── Kind hinzufügen (Modal-Pattern) ──────────────────────────────────────
    openAddChildModal() {
        this.addChildQuery = '';
        this.addChildResults.set([]);
        this.selectedChildId.set(null);
        this.addChildError.set(null);
        this.showAddChildModal.set(true);
    }

    selectChildCandidate(person: Individual) {
        this.selectedChildId.set(person.id);
    }

    confirmAddChild() {
        this.addChildError.set(null);
        const currentFam = this.family();
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

        const candidates = this.individuals().filter(p => {
            const id = (p.id || '').toLowerCase();
            const name = `${p.firstName || ''} ${p.lastName || ''}`.trim().toLowerCase();
            return id === query || name.includes(query);
        });

        if (candidates.length === 0) {
            this.addChildResults.set([]);
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

        this.family.update(fam => {
            if (fam) {
                if (!fam.children) fam.children = [];
                fam.children.push(selected.id);
            }
            return { ...fam } as Family;
        });
        
        this.isDirty.set(true);
        this.showAddChildModal.set(false);
        this.save();
    }

    removeChild(childId: string) {
        this.family.update(fam => {
            if (fam?.children) {
                fam.children = fam.children.filter(id => id !== childId);
            }
            return { ...fam } as Family;
        });
        this.isDirty.set(true);
        this.save();
    }

    // ── Speichern / Abbrechen ─────────────────────────────────────────────────
    save() {
        const fam = this.family();
        const tree = this.authService.currentTree();
        if (!fam || !tree || this.isSaving()) return;

        this.isSaving.set(true);
        this.gedcomService.saveFamily(tree.name, fam).subscribe({
            next: (res) => {
                this.isDirty.set(false);
                this.isSaving.set(false);
                if (res.family?.deleted) {
                    this.router.navigate(['/families']);
                } else {
                    this.loadData();
                }
            },
            error: (err) => {
                this.isSaving.set(false);
                // TODO: Fehlermeldung via Toast
                console.error('Speichern fehlgeschlagen:', err?.error?.message);
            }
        });
    }

    requestCancel() {
        if (this.isDirty()) {
            this.showCancelConfirmModal.set(true);
        } else {
            this.router.navigate(['/families']);
        }
    }

    confirmCancel() {
        this.router.navigate(['/families']);
    }
}
