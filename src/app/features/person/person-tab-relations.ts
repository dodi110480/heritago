import { Component, Output, EventEmitter, signal, inject, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Individual, TreeData } from '../../core/models/models';
import { PersonTimelineService } from './person-timeline.service';
import { PlaceService } from '../../core/services/place.service';
import { AppSectionHeaderComponent } from '../../shared/components/ui/app-section-header';
import { AppAvatarComponent } from '../../shared/components/ui/app-avatar';
import { AppModalShell } from '../../shared/components/ui/app-modal-shell';
import { AppEmptyStateComponent } from '../../shared/components/ui/app-empty-state';
import { AppRelationModal, RelationDraft } from '../../shared/components/ui/app-relation-modal/app-relation-modal';
import { MediaSelector } from '../media/media-selector';
import { MediaAddModal } from '../media/media-add-modal';
import { ImageViewer } from '../media/image-viewer';
import { MediaService } from '../../core/services/media.service';
import { PersonFeatureStore } from './person-feature.store';

@Component({
    selector: 'app-person-tab-relations',
    standalone: true,
    imports: [
        CommonModule, 
        FormsModule, 
        AppSectionHeaderComponent, 
        AppAvatarComponent, 
        AppEmptyStateComponent,
        AppRelationModal,
        MediaSelector,
        MediaAddModal,
        ImageViewer
    ],
    template: `
        <div class="glass-card shadow-sm flex flex-col">
            <div class="p-0">
                <app-section-header title="Familie & Beziehungen" icon="👨‍👩‍👧‍👦" description="Verwalte Ehepartner, Eltern und Kinder.">
                    <div actions class="flex items-center gap-3">
                        <button (click)="toggleFamilyEdit()" [class.bg-brand-500]="isEditingFamily()"
                            [class.text-neutral-800]="isEditingFamily()" [class.bg-canvas-white/5]="!isEditingFamily()"
                            [class.text-neutral-400]="!isEditingFamily()"
                            class="p-2.5 rounded-xl transition-all hover:bg-brand-500/20" title="Bearbeiten">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button (click)="addRelation()" class="btn-primary !w-auto !py-2">
                            + Beziehung
                        </button>
                    </div>
                </app-section-header>

                <div *ngIf="relations().length > 0" class="space-y-3 p-4">
                    <div *ngFor="let rel of relations(); let i = index"
                        (click)="onCardClick(i, rel)"
                        class="group relative glass-card !p-4 flex items-center gap-4 hover:bg-canvas-white/10 transition-all border-l-4 cursor-pointer"
                        [class.border-l-brand-500]="rel.type === 'SPOUSE'"
                        [class.border-l-indigo-500]="rel.type === 'FATHER' || rel.type === 'MOTHER'"
                        [class.border-l-emerald-500]="rel.type === 'CHILD'">

                        <div class="flex items-center gap-3 flex-1">
                            <app-avatar 
                                [imageUrl]="rel.profileImageUrl ? mediaService.getMediaUrl(rel.profileImageUrl, 'thumbs') : null" 
                                [gender]="rel.gender" 
                                size="sm"
                                class="shrink-0"
                            ></app-avatar>
                            <div class="w-24 text-[10px] font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest shrink-0">
                                {{ getRelationLabel(rel) }}
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-0.5 group-hover:text-brand-400 transition-colors truncate flex items-center gap-2">
                                    {{ rel.personName }}
                                    <span *ngIf="rel.isPrimary" class="text-xs text-brand-500" title="Primär">⭐</span>
                                </div>
                                <div *ngIf="rel.type === 'SPOUSE' && rel.weddingInfo"
                                    class="text-[10px] text-neutral-400 flex items-center gap-1.5 truncate">
                                    <span class="text-xs">💍</span> {{ rel.weddingInfo }}
                                </div>
                            </div>
                        </div>

                        <div *ngIf="isEditingFamily()" class="flex items-center gap-2">
                             <button (click)="$event.stopPropagation(); removeRelation(i)"
                                 class="p-2 text-accent-danger-500 hover:bg-accent-danger-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                             </button>
                             <div class="text-brand-400 opacity-0 group-hover:opacity-100 transition-all">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                             </div>
                        </div>

                        <svg *ngIf="!isEditingFamily()" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                            stroke-linejoin="round"
                            class="text-neutral-600 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                </div>

                <app-empty-state *ngIf="relations().length === 0"
                    icon="👨‍👩‍👧‍👦" 
                    title="Keine Beziehungen" 
                    message="Verknüpfe diese Person mit Eltern, Partnern oder Kindern, um den Stammbaum aufzubauen.">
                </app-empty-state>
            </div>
        </div>

        <!-- RELATION EDIT/CREATE MODAL -->
        <app-relation-modal
            [visible]="showRelationModal()"
            [relation]="activeRelation()"
            [allPersonsOptions]="allPersonsSignal()"
            [availableSources]="availableSources()"
            [errorMessage]="relationErrorMessage()"
            (close)="closeRelationModal()"
            (search)="store.searchPersons($event)"
            (save)="onRelationSave($event)"
            (delete)="onRelationDeleteFromModal()"
            (navigateToPerson)="closeRelationModal(); goToPerson($event)"
            (openGallery)="showMediaSelector = true"
            (openUpload)="showMediaAddModal.set(true)"
            (openViewer)="onViewerRequested($event)"
        ></app-relation-modal>

        <app-media-selector [visible]="showMediaSelector" (selected)="onMediaSelected($event)"
            (closed)="showMediaSelector = false">
        </app-media-selector>

        <app-media-add-modal [visible]="showMediaAddModal()" [treeId]="person()?.treeId || ''"
            (closed)="showMediaAddModal.set(false)" 
            (saved)="onMediaAddUploaded($event)">
        </app-media-add-modal>

        <app-image-viewer [url]="viewerUrl()" [title]="viewerTitle()" (closed)="viewerUrl.set(null)">
        </app-image-viewer>
    `
})
export class PersonTabRelationsComponent {
    person = input.required<Individual>();
    relations = input.required<{ 
        type: string; 
        personId: string; 
        personName?: string; 
        familyId?: string;
        familyMemberId?: string;
        pedigreeType?: string;
        isPrimary?: boolean;
        profileImageUrl?: string;
        gender?: string;
        marriageType?: string;
        weddingInfo?: string;
        weddingEvent?: any;
        notes?: any[];
        citations?: any[];
        restrictionNotice?: string;
    }[]>();
    allPersonsSignal = input<any[]>([]);
    availableSources = input<any[]>([]);
    @Output() changed = new EventEmitter<any[]>();

    private router = inject(Router);
    private personTimelineService = inject(PersonTimelineService);
    protected mediaService = inject(MediaService);
    protected store = inject(PersonFeatureStore);

    isEditingFamily = signal(false);
    showRelationModal = signal(false);
    activeRelationIndex = signal<number | null>(null);
    activeRelation = signal<RelationDraft | null>(null);
    relationErrorMessage = signal<string | null>(null);

    // Media & Gallery support for Relation Modal
    showMediaAddModal = signal(false);
    showMediaSelector = false;
    viewerUrl = signal<string | null>(null);
    viewerTitle = signal<string>('');

    getPrimaryName(person: Individual) {
        return this.personTimelineService.getPrimaryName(person);
    }

    getRelationLabel(rel: any) {
        return rel.label || 'Verwandte(r)';
    }


    getFamilyWedding(weddingInfo: string | undefined) {
        return weddingInfo || ''; 
    }

    toggleFamilyEdit() {
        this.isEditingFamily.update(v => !v);
    }

    goToPerson(id?: string) {
        if (!id || this.isEditingFamily()) return;
        this.router.navigate(['/person', id]);
    }

    onCardClick(index: number, rel: any) {
        this.activeRelationIndex.set(index);
        this.activeRelation.set({
            ...rel,
            weddingEvent: rel.weddingEvent || { type: 'MARR', isPrimary: true }
        });
        console.log('[Relations] Opened card:', rel.personName, 'fmId:', rel.familyMemberId);
        this.showRelationModal.set(true);
    }

    addRelation() {
        this.activeRelationIndex.set(null);
        this.activeRelation.set(null);
        this.relationErrorMessage.set(null);
        this.showRelationModal.set(true);
    }

    closeRelationModal() {
        this.showRelationModal.set(false);
    }

    onRelationSave(draft: RelationDraft) {
        console.log('[Relations] Save requested for draft:', draft);
        const idx = this.activeRelationIndex();
        const current = [...this.relations()];

        // --- Genealogical Validation: Biological Parent Check ---
        // Consistent check for "biological" (BIRTH or not specified)
        const isBiological = (pt: any) => !pt || pt === 'BIRTH' || pt === 'null' || pt === null;
        
        const currentIsBio = isBiological(draft.pedigreeType);
        if ((draft.type === 'MOTHER' || draft.type === 'FATHER') && currentIsBio) {
            const conflict = current.find((r, i) => 
                i !== idx && 
                r.type === draft.type && 
                isBiological(r.pedigreeType)
            );
            
            if (conflict) {
                console.warn('[Relations] Conflict detected with biological parent:', conflict);
                const label = draft.type === 'MOTHER' ? 'Mutter' : 'Vater';
                const msg = `Diese Person hat bereits eine leibliche ${label} (${conflict.personName}). Genealogisch kann eine Person nur eine leibliche Mutter und einen leiblichen Vater haben. Bitte ändere den Abstammungstyp (z.B. auf Stiefeltern oder Adoptiert).`;
                this.relationErrorMessage.set(msg);
                return;
            }
        }
        
        this.relationErrorMessage.set(null);

        if (idx !== null) {
            const oldRel = current[idx];
            current[idx] = { 
                ...oldRel, 
                ...draft
            };
        } else {
            const newRel = { 
                ...draft
            } as any;
            const updated = [...current, newRel];
            this.onChanged(updated);
            this.showRelationModal.set(false);
            return;
        }
        
        this.showRelationModal.set(false);
        this.onChanged(current);
    }

    onRelationDeleteFromModal() {
        const idx = this.activeRelationIndex();
        const rel = this.activeRelation();
        console.log('[Relations] Delete requested for index:', idx, 'name:', rel?.personName);
        
        if (idx !== null) {
            this.removeRelation(idx);
        }
        this.showRelationModal.set(false);
    }

    removeRelation(index: number) {
        const current = [...this.relations()];
        current.splice(index, 1);
        this.onChanged(current);
    }

    onMediaSelected(media: any) {
        const draft = this.activeRelation();
        if (draft && draft.weddingEvent) {
            draft.weddingEvent.media = draft.weddingEvent.media || [];
            draft.weddingEvent.media.push(media);
            this.activeRelation.set({ ...draft });
            this.onChanged(this.relations());
        }
        this.showMediaSelector = false;
    }

    onMediaAddUploaded(media: any) {
        const draft = this.activeRelation();
        if (draft && draft.weddingEvent) {
            draft.weddingEvent.media = draft.weddingEvent.media || [];
            draft.weddingEvent.media.push(media);
            this.activeRelation.set({ ...draft });
            this.onChanged(this.relations());
        }
        this.showMediaAddModal.set(false);
    }

    onViewerRequested(media: any) {
        this.viewerTitle.set(media.title || 'Medium');
        this.viewerUrl.set(media.id ? `/api/media/file/${media.id}` : media.url);
    }

    updateFamilyDetails(familyId: string | undefined, draft: RelationDraft) {
        this.onChanged(this.relations());
    }

    onChanged(newRelations: any[]) {
        this.changed.emit(newRelations);
    }
}
