import { Component, Output, EventEmitter, signal, inject, computed, ChangeDetectorRef, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Individual, TreeData, TimelineItem } from '../../core/models/models';
import { PersonTimelineService } from './person-timeline.service';
import { PlaceService } from '../../core/services/place.service';
import { AuthService } from '../../core/services/auth.service';
import { MediaService } from '../../core/services/media.service';
import { AppSectionHeaderComponent } from '../../shared/components/ui/app-section-header';
import { AppEmptyStateComponent } from '../../shared/components/ui/app-empty-state';
import { EventModal } from '../../shared/components/ui/event-modal/event-modal';
import { PlaceModal } from '../../shared/components/ui/place-modal/place-modal';
import { MediaAddModal } from '../media/media-add-modal';
import { MediaSelector } from '../media/media-selector';
import { ImageViewer } from '../media/image-viewer';
import { CleanDatePipe } from '../../shared/pipes/clean-date.pipe';
import { PersonFeatureStore } from './person-feature.store';

@Component({
    selector: 'app-person-tab-timeline',
    standalone: true,
    imports: [
        CommonModule, 
        FormsModule, 
        AppSectionHeaderComponent, 
        AppEmptyStateComponent,
        EventModal,
        PlaceModal,
        MediaAddModal,
        MediaSelector,
        ImageViewer
    ],
    template: `
        <div class="glass-card flex flex-col">
            <div class="p-4 md:p-5">
                <app-section-header title="Lebenslauf" icon="⏳">
                    <button actions (click)="addTimelineItem()" class="btn-primary !w-auto !py-1.5 !px-3 text-xs">
                        + Ereignis/Fakt
                    </button>
                </app-section-header>

                <div
                    class="relative pl-6 space-y-4 before:absolute before:left-2 before:top-1 before:bottom-1 before:w-0.5 before:bg-canvas-white/10">
                    <div *ngFor="let item of timeline(); let i = index" class="relative group/item">
                        <div
                            class="absolute -left-[20px] top-1.5 w-3 h-3 rounded-full bg-brand-500 border-2 border-neutral-900 z-10 transition-transform group-hover/item:scale-125">
                        </div>

                        <div class="glass-card !p-3 transition-all cursor-pointer hover:bg-canvas-white/5"
                            (click)="!isTimelineItemLocked(item) && openTimelineItemModal(i)"
                            [class.ring-2]="item.editing" [class.ring-brand-500/50]="item.editing">
                            <div *ngIf="!item.editing" class="space-y-2">
                                <div class="flex justify-between items-start">
                                    <div class="space-y-1">
                                        <div class="text-[10px] font-bold text-neutral-800 uppercase tracking-widest">
                                            {{ item.label || item.tag }}
                                        </div>
                                        <div class="flex items-baseline gap-2">
                                            <div class="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                                                {{ item.date || 'Kein Datum' }}
                                            </div>
                                            <div *ngIf="item.age !== undefined && item.age !== null" class="text-[10px] font-medium text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                                                {{ item.age }} Jahre
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex flex-wrap gap-2" *ngIf="item.place">
                                    <span
                                        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-canvas-white/5 text-neutral-600 text-xs border border-canvas-white/5">
                                        <span class="text-xs">📍</span> {{ item.place }}
                                    </span>
                                </div>
                                <div class="text-xs text-neutral-800 leading-relaxed"
                                    *ngIf="item.value || item.description">
                                    {{ item.value || item.description }}
                                </div>

                                <div class="flex flex-wrap gap-2" *ngIf="item.media?.length">
                                    <div *ngFor="let med of item.media" (click)="$event.stopPropagation(); openViewer(med)"
                                        class="w-12 h-12 rounded-lg overflow-hidden cursor-pointer ring-1 ring-white/10 hover:ring-brand-500 transition-all hover:scale-105 active:scale-95">
                                        <img [src]="getMediaUrl(med.id || med.url, 'thumbs')" [alt]="med.title"
                                            class="w-full h-full object-cover">
                                    </div>
                                </div>

                                <div class="flex flex-wrap gap-2">
                                    <span *ngIf="isTimelineItemLocked(item)" class="badge badge-primary">🔒 Nur lesen</span>
                                    <span *ngIf="item.media?.length" class="badge badge-primary">🖼 {{
                                        item.media?.length }}</span>
                                    <span *ngIf="item.citations?.length" class="badge badge-success">📖 {{
                                        item.citations?.length }}</span>
                                    <span *ngIf="item.notes?.length" class="badge badge-highlight">📝 {{
                                        item.notes?.length }}</span>
                                    <span *ngIf="item.associations?.length" class="badge badge-info">👥 {{
                                        item.associations?.length }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <app-empty-state *ngIf="timeline().length === 0"
                    icon="⏳" 
                    title="Lebenslauf leer" 
                    message="Anhand von Daten und Fakten entsteht ein Bild der Person. Füge das erste Ereignis hinzu.">
                </app-empty-state>
            </div>
        </div>

        <!-- TIMELINE MODALS -->
        <app-event-modal 
            [visible]="showTimelineCreateModal()" 
            [item]="newTimelineDraft()" 
            [isNew]="true"
            [itemKind]="newTimelineDraft().itemKind"
            (itemKindChange)="newTimelineDraft.update(v => ({ ...v, itemKind: $event }))"
                [availableSources]="availableSources()"
                [allPersonsOptions]="allPersonsSignal()"
                (close)="closeTimelineCreateModal()" 
                (search)="store.searchPersons($event)"
                (save)="confirmAddTimelineItem()"
                (openUpload)="openNewTimelineMediaAdd()"
                (openGallery)="openNewTimelineMediaSelector()"
                (addNote)="addNewTimelineNote()"
                (removeNote)="removeNewTimelineNote($event)"
                (openViewer)="openViewer($event)">
        </app-event-modal>

        <app-event-modal 
            [visible]="showTimelineItemModal()" 
            [item]="editTimelineDraft()" 
            [isNew]="false"
            [itemKind]="editTimelineDraft()?.itemKind"
            (itemKindChange)="editTimelineDraft() && editTimelineDraft.update(v => ({ ...v, itemKind: $event }))"
            [availableSources]="availableSources()"
            [allPersonsOptions]="allPersonsSignal()"
            [showDelete]="!!editTimelineDraft() && !isTimelineItemLocked(activeTimelineItem()!)"
            (close)="closeTimelineItemModal()"
            (search)="store.searchPersons($event)"
            (save)="saveTimelineItemModal()"
            (delete)="removeTimelineItemModal()"
            (openUpload)="openTimelineMediaAdd()"
            (openGallery)="openTimelineMediaSelector()"
            (addNote)="addTimelineItemNote()"
            (removeNote)="removeTimelineItemNote($event)"
            (openViewer)="openViewer($event)">
        </app-event-modal>

        <app-place-modal [visible]="showPlaceModal" [mode]="placeModalMode" [initialData]="selectedPlaceForModal"
            (saved)="onPlaceModalSaved($event)" (closed)="showPlaceModal = false">
        </app-place-modal>

        <app-media-add-modal 
            *ngIf="showMediaAddModal()" 
            [visible]="true"
            [treeId]="person()?.treeId || ''"
            (closed)="showMediaAddModal.set(false)" 
            (saved)="onMediaAddUploaded($event)">
        </app-media-add-modal>

        <app-media-selector 
            *ngIf="showMediaSelector()" 
            [visible]="true"
            (closed)="showMediaSelector.set(false)" 
            (selected)="onMediaSelected($event)">
        </app-media-selector>

        <app-image-viewer [url]="viewerUrl()" [title]="viewerTitle()" (closed)="viewerUrl.set(null)"></app-image-viewer>
    `
})
export class PersonTabTimelineComponent {
    person = input.required<Individual>();
    timeline = input.required<TimelineItem[]>();
    availableSources = input<any[]>([]);
    allPersonsSignal = input<{id: string, displayName: string}[]>([]);
    @Output() changed = new EventEmitter<TimelineItem[]>();

    private router = inject(Router);
    private personTimelineService = inject(PersonTimelineService);
    public authService = inject(AuthService);
    public mediaService = inject(MediaService);
    public placeService = inject(PlaceService);
    private cdr = inject(ChangeDetectorRef);
    protected store = inject(PersonFeatureStore);

    showTimelineCreateModal = signal(false);
    showTimelineItemModal = signal(false);
    activeTimelineItemIndex = signal<number | null>(null);
    timelineModalTab = signal<'basics' | 'media' | 'citations' | 'notes'>('basics');
    
    newTimelineDraft = signal<{
        itemKind: 'event' | 'fact';
        tag: string;
        date: string;
        place: string;
        description: string;
        media: any[];
        citations: any[];
        notes: string[];
    }>({
        itemKind: 'event',
        tag: 'DEAT',
        date: '',
        place: '',
        description: '',
        media: [],
        citations: [],
        notes: []
    });

    editTimelineDraft = signal<any>(null);
    
    showPlaceModal = false;
    placeModalMode: 'add' | 'edit' = 'add';
    selectedPlaceForModal: any = null;
    activeTimelineIndexForPlace: number | null = null;
    
    showMediaAddModal = signal(false);
    showMediaSelector = signal(false);
    isMediaForNewTimelineItem = false;
    activeTimelineIndexForMedia: number | null = null;
    activeTimelineIndexForMediaAdd: number | null = null;
    pendingReopenTimelineModal: 'create' | 'item' | null = null;

    viewerUrl = signal<string | null>(null);
    viewerTitle = signal<string>('');

    isTimelineItemLocked(item: TimelineItem): boolean {
        return item.originalType === 'family-event' && item.originalIndex === -1;
    }

    addTimelineItem() {
        this.newTimelineDraft.set({
            itemKind: 'event',
            type: 'BIRT',
            subType: '',
            value: '',
            dateText: '',
            place: '',
            description: '',
            media: [],
            citations: [],
            notes: [],
            associations: []
        } as any);
        this.timelineModalTab.set('basics');
        this.showTimelineCreateModal.set(true);
    }

    closeTimelineCreateModal() {
        this.showTimelineCreateModal.set(false);
    }

    confirmAddTimelineItem() {
        const draft = this.newTimelineDraft() as any;
        const isFact = draft.itemKind === 'fact';
        const text = (draft.description || '').trim();

        const newItem: TimelineItem = {
            originalType: isFact ? 'fact' : 'event',
            originalIndex: -1,
            tag: draft.type || 'EVEN',
            date: draft.dateText || '',
            place: draft.place || '',
            description: isFact ? text : (draft.subType ? draft.subType + (text ? ' - ' + text : '') : text),
            value: isFact ? (draft.value || text) : '',
            media: draft.media || [],
            notes: draft.notes || [],
            citations: draft.citations || [],
            associations: draft.associations || [],
            editing: false,
            expanded: true
        };

        const currentTimeline = [...this.timeline(), newItem];
        this.newTimelineDraft.set({} as any);
        this.showTimelineCreateModal.set(false);
        this.onChanged(currentTimeline);
    }

    openTimelineItemModal(index: number) {
        const current = this.timeline();
        if (!current[index]) return;
        
        const item = current[index];
        item.editing = false;
        this.activeTimelineItemIndex.set(index);

        const factTags = ['OCCU', 'EDUC', 'RELI', 'RESI', 'TITL', 'NATI', 'PROP', 'MILI', 'DSCR', 'CAST', 'FACT'];
        const isFact = item.originalType === 'fact' || factTags.includes(item.tag);
        let value = '';

        if (isFact) {
            value = item.value || item.description || '';
        }

        this.editTimelineDraft.set({
            itemKind: isFact ? 'fact' : 'event',
            type: item.tag,
            subType: '',
            value: value,
            dateText: item.date || '',
            place: item.place || '',
            description: isFact ? '' : (item.description || ''),
            media: JSON.parse(JSON.stringify(item.media || [])),
            citations: JSON.parse(JSON.stringify(item.citations || [])),
            notes: JSON.parse(JSON.stringify(item.notes || [])),
            associations: JSON.parse(JSON.stringify(item.associations || []))
        });

        this.showTimelineItemModal.set(true);
    }

    closeTimelineItemModal() {
        this.showTimelineItemModal.set(false);
        this.activeTimelineItemIndex.set(null);
        this.editTimelineDraft.set(null);
    }

    activeTimelineItem(): TimelineItem | null {
        const idx = this.activeTimelineItemIndex();
        if (idx === null) return null;
        return this.timeline()[idx] || null;
    }

    saveTimelineItemModal() {
        const idx = this.activeTimelineItemIndex();
        const draft = this.editTimelineDraft();

        const isFact = draft.itemKind === 'fact';
        const text = (draft.description || '').trim();

        const updatedTimeline = this.timeline().map((item, i) => {
            if (i !== idx) return item;
            
            return {
                ...item,
                tag: draft.type || 'EVEN',
                date: draft.dateText || '',
                place: draft.place || '',
                value: isFact ? (draft.value || text) : '',
                description: isFact ? text : (draft.subType ? draft.subType + (text ? ' - ' + text : '') : text),
                media: draft.media || [],
                notes: draft.notes || [],
                citations: draft.citations || [],
                associations: draft.associations || [],
                editing: false
            };
        });

        this.closeTimelineItemModal();
        this.onChanged(updatedTimeline);
    }

    removeTimelineItemModal() {
        const idx = this.activeTimelineItemIndex();
        if (idx === null) return;
        const current = this.timeline();
        if (!current[idx] || this.isTimelineItemLocked(current[idx])) return;
        
        current.splice(idx, 1);
        this.closeTimelineItemModal();
        this.onChanged(current);
    }

    openNewTimelineMediaAdd() {
        if (this.showTimelineCreateModal()) {
            this.pendingReopenTimelineModal = 'create';
            this.showTimelineCreateModal.set(false);
        }
        this.isMediaForNewTimelineItem = true;
        this.showMediaAddModal.set(true);
    }

    openNewTimelineMediaSelector() {
        if (this.showTimelineCreateModal()) {
            this.pendingReopenTimelineModal = 'create';
            this.showTimelineCreateModal.set(false);
        }
        this.isMediaForNewTimelineItem = true;
        this.showMediaSelector.set(true);
    }

    addNewTimelineNote() {
        this.newTimelineDraft.update(v => ({
            ...v,
            notes: [...v.notes, '']
        }));
    }

    removeNewTimelineNote(idx: number) {
        this.newTimelineDraft.update(v => {
            const notes = [...v.notes];
            notes.splice(idx, 1);
            return { ...v, notes };
        });
    }

    openTimelineMediaAdd() {
        if (this.showTimelineItemModal()) {
            this.pendingReopenTimelineModal = 'item';
            this.showTimelineItemModal.set(false);
        }
        this.activeTimelineIndexForMediaAdd = this.activeTimelineItemIndex();
        this.isMediaForNewTimelineItem = false;
        this.showMediaAddModal.set(true);
    }

    openTimelineMediaSelector() {
        if (this.showTimelineItemModal()) {
            this.pendingReopenTimelineModal = 'item';
            this.showTimelineItemModal.set(false);
        }
        this.activeTimelineIndexForMedia = this.activeTimelineItemIndex();
        this.isMediaForNewTimelineItem = false;
        this.showMediaSelector.set(true);
    }

    addTimelineItemNote() {
        this.editTimelineDraft.update(v => {
            if (!v) return v;
            return { ...v, notes: [...(v.notes || []), ''] };
        });
    }

    removeTimelineItemNote(idx: number) {
        this.editTimelineDraft.update(v => {
            if (!v) return v;
            const notes = [...v.notes];
            notes.splice(idx, 1);
            return { ...v, notes };
        });
    }

    onMediaAddUploaded(media: any) {
        if (!media) return;

        if (this.isMediaForNewTimelineItem) {
            this.newTimelineDraft.update(v => ({
                ...v,
                media: [...(v.media || []), this.mapMedia(media)]
            }));
        } else if (this.activeTimelineItemIndex() !== null) {
            this.editTimelineDraft.update(v => {
                if (!v) return v;
                return { ...v, media: [...(v.media || []), this.mapMedia(media)] };
            });
        }
        
        this.showMediaAddModal.set(false);
        this.reopenModals();
    }

    onMediaSelected(mediaObj: any) {
        if (!mediaObj) return;

        if (this.isMediaForNewTimelineItem) {
            this.newTimelineDraft.update(v => ({
                ...v,
                media: [...(v.media || []), this.mapMedia(mediaObj)]
            }));
        } else if (this.activeTimelineItemIndex() !== null) {
            this.editTimelineDraft.update(v => {
                if (!v) return v;
                return { ...v, media: [...(v.media || []), this.mapMedia(mediaObj)] };
            });
        }
        
        this.showMediaSelector.set(false);
        this.reopenModals();
    }

    private mapMedia(media: any) {
        return {
            id: media.id,
            url: media.remoteUrl || (media.filePath ? `/uploads/${media.filePath}` : media.url),
            title: media.title || media.filePath || '',
            isPrimary: false,
            mimeType: media.mimeType
        };
    }

    private reopenModals() {
        if (this.pendingReopenTimelineModal === 'create') {
            this.showTimelineCreateModal.set(true);
        } else if (this.pendingReopenTimelineModal === 'item') {
            this.showTimelineItemModal.set(true);
        }
        this.pendingReopenTimelineModal = null;
        this.isMediaForNewTimelineItem = false;
    }

    getMediaUrl(idOrUrl: string | undefined, variant?: string): string {
        return this.mediaService.getMediaUrl(idOrUrl, variant);
    }

    openViewer(media: any) {
        this.viewerUrl.set(this.getMediaUrl(media.url || media.id));
        this.viewerTitle.set(media.title || 'Bild');
    }

    onPlaceModalSaved(placeData: any) {
        if (this.activeTimelineIndexForPlace !== null) {
            const current = [...this.timeline()];
            current[this.activeTimelineIndexForPlace] = { ...current[this.activeTimelineIndexForPlace], place: placeData.name };
            this.showPlaceModal = false;
            this.onChanged(current);
        } else {
            this.showPlaceModal = false;
        }
    }

    onChanged(newTimeline: TimelineItem[]) {
        const p = this.person();
        const updatedTimeline = newTimeline.map(item => ({
            ...item,
            personId: p?.id || (this.store ? this.store.personId() : null)
        }));
        this.changed.emit(updatedTimeline);
    }
}
