import { Component, Input, Output, EventEmitter, signal, inject, computed } from '@angular/core';
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

@Component({
    selector: 'app-person-tab-relations',
    standalone: true,
    imports: [
        CommonModule, 
        FormsModule, 
        AppSectionHeaderComponent, 
        AppAvatarComponent, 
        AppModalShell, 
        AppEmptyStateComponent
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
                        (click)="!isEditingFamily() && rel.personId && goToPerson(rel.personId)"
                        [class.cursor-pointer]="rel.personId && !isEditingFamily()"
                        class="group relative glass-card !p-4 flex items-center gap-4 hover:bg-canvas-white/10 transition-all border-l-4"
                        [class.border-l-brand-500]="rel.type === 'SPOUSE'"
                        [class.border-l-indigo-500]="rel.type === 'FATHER' || rel.type === 'MOTHER'"
                        [class.border-l-emerald-500]="rel.type === 'CHILD'">

                        <div *ngIf="isEditingFamily(); else relRead"
                            class="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1">
                            <select [(ngModel)]="rel.type" (change)="onChanged()" class="form-input !w-32 !py-2">
                                <option value="SPOUSE">Partner</option>
                                <option value="FATHER">Vater</option>
                                <option value="MOTHER">Mutter</option>
                                <option value="CHILD">Kind</option>
                            </select>

                            <div class="relative flex-1 group/search">
                                <input type="text" [(ngModel)]="rel.personName"
                                    (input)="searchIndividuals(i, rel.personName!)"
                                    (focus)="searchIndividuals(i, rel.personName!)" placeholder="Person suchen..."
                                    class="form-input !py-2">

                                <div class="absolute top-full left-0 w-full mt-2 bg-surface-dark border border-canvas-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                                    *ngIf="showIndividualResults() === i && individualSearchResults().length > 0">
                                    <div *ngFor="let ind of individualSearchResults()"
                                        (click)="selectIndividual(i, ind)"
                                        class="px-4 py-2.5 text-sm text-neutral-300 hover:bg-brand-500/20 hover:text-neutral-800 dark:text-neutral-200 cursor-pointer border-b border-canvas-white/5 last:border-0 transition-colors">
                                        👤 {{ ind.firstName }} {{ ind.lastName }}
                                    </div>
                                </div>
                            </div>

                            <div *ngIf="rel.type === 'SPOUSE'" class="flex gap-2 flex-1 md:max-w-xs">
                                <input type="text" class="form-input !py-2 !text-xs"
                                    [ngModel]="getFamilyWeddingDate(rel.familyId)"
                                    (ngModelChange)="updateFamilyWeddingByFamilyId(rel.familyId, 'date', $event)"
                                    placeholder="💍 Datum">
                                <input type="text" class="form-input !py-2 !text-xs"
                                    [ngModel]="getFamilyWeddingPlace(rel.familyId)"
                                    (ngModelChange)="updateFamilyWeddingByFamilyId(rel.familyId, 'place', $event)"
                                    placeholder="📍 Ort">
                            </div>

                            <button (click)="removeRelation(i)"
                                class="p-2 ml-auto text-accent-danger-500 hover:bg-accent-danger-500/10 rounded-lg transition-colors">✕</button>
                        </div>

                        <ng-template #relRead>
                            <div class="flex items-center gap-3 flex-1">
                                <app-avatar 
                                    [imageUrl]="getPersonAvatarData(rel.personId).url" 
                                    [gender]="getPersonAvatarData(rel.personId).gender" 
                                    size="sm"
                                    class="shrink-0"
                                ></app-avatar>
                                <div class="w-24 text-[10px] font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest shrink-0">
                                    {{ getRelationLabel(rel.type) }}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-0.5 group-hover:text-brand-400 transition-colors truncate">
                                        {{ rel.personName }}
                                    </div>
                                    <div *ngIf="rel.type === 'SPOUSE' && getFamilyWedding(rel.familyId)"
                                        class="text-[10px] text-neutral-400 flex items-center gap-1.5 truncate">
                                        <span class="text-xs">💍</span> {{ getFamilyWedding(rel.familyId) }}
                                    </div>
                                </div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round"
                                class="text-neutral-600 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </ng-template>
                    </div>
                </div>

                <app-empty-state *ngIf="relations().length === 0"
                    icon="👨‍👩‍👧‍👦" 
                    title="Keine Beziehungen" 
                    message="Verknüpfe diese Person mit Eltern, Partnern oder Kindern, um den Stammbaum aufzubauen.">
                </app-empty-state>
            </div>
        </div>

        <!-- RELATION CREATE MODAL -->
        <app-modal-shell [visible]="showRelationCreateModal()" title="Beziehung hinzufügen" icon="👨‍👩‍👧‍👦" size="md"
            [showSave]="true" saveText="Beziehung hinzufügen" [showDelete]="false" (close)="closeRelationCreateModal()"
            (save)="confirmAddRelation()">
            <div class="space-y-4">
                <div class="form-group mb-0">
                    <label class="form-label">Beziehungstyp</label>
                    <select [ngModel]="newRelationDraft().type"
                        (ngModelChange)="newRelationDraft.update(v => ({ ...v, type: $event }))" class="form-input !py-2.5">
                        <option value="SPOUSE">Partner/in</option>
                        <option value="FATHER">Vater</option>
                        <option value="MOTHER">Mutter</option>
                        <option value="CHILD">Kind</option>
                    </select>
                </div>
                <div class="form-group mb-0">
                    <label class="form-label">Person</label>
                    <input type="text" [ngModel]="newRelationDraft().personInput"
                        (ngModelChange)="newRelationDraft.update(v => ({ ...v, personInput: $event }))"
                        list="relation-person-list" class="form-input" placeholder="Person auswählen...">
                    <datalist id="relation-person-list">
                        <option *ngFor="let opt of allPersonsOptions()" [value]="opt.displayName"></option>
                    </datalist>
                </div>
            </div>
        </app-modal-shell>
    `
})
export class PersonTabRelationsComponent {
    @Input({ required: true }) person!: Individual;
    @Input({ required: true }) treeData!: TreeData | null;
    @Input({ required: true }) relations = signal<{ type: string; personId: string; personName?: string; familyId?: string }[]>([]);
    @Output() changed = new EventEmitter<void>();

    private router = inject(Router);
    private personTimelineService = inject(PersonTimelineService);

    isEditingFamily = signal(false);
    showIndividualResults = signal<number | null>(null);
    individualSearchResults = signal<Individual[]>([]);
    
    showRelationCreateModal = signal(false);
    newRelationDraft = signal<{ type: 'SPOUSE' | 'FATHER' | 'MOTHER' | 'CHILD'; personInput: string }>({
        type: 'SPOUSE',
        personInput: ''
    });

    allPersonsOptions = computed(() => {
        const data = this.treeData;
        if (!data || !data.individuals) return [];
        return data.individuals.map(ind => ({
            id: ind.id,
            displayName: `${this.getPrimaryName(ind)} (${ind.id})`
        })).sort((a, b) => a.displayName.localeCompare(b.displayName));
    });

    getPrimaryName(person: Individual) {
        return this.personTimelineService.getPrimaryName(person);
    }

    getRelationLabel(type: string) {
        return this.personTimelineService.getRelationLabel(type);
    }

    getPersonAvatarData(personId: string | undefined) {
        return this.personTimelineService.getPersonAvatarData(this.treeData, personId);
    }

    getFamilyWedding(familyId: string | undefined) {
        return this.personTimelineService.getFamilyWedding(this.treeData, familyId);
    }

    getFamilyWeddingDate(familyId: string | undefined) {
        return this.personTimelineService.getFamilyWeddingDate(this.treeData, familyId);
    }

    getFamilyWeddingPlace(familyId: string | undefined) {
        return this.personTimelineService.getFamilyWeddingPlace(this.treeData, familyId);
    }

    toggleFamilyEdit() {
        this.isEditingFamily.update(v => !v);
    }

    goToPerson(id?: string) {
        if (!id || this.isEditingFamily()) return;
        this.router.navigate(['/person', id]);
    }

    searchIndividuals(index: number, query: string) {
        if (!query || query.length < 2) {
            this.individualSearchResults.set([]);
            this.showIndividualResults.set(null);
            return;
        }

        const data = this.treeData;
        if (!data) return;

        const results = data.individuals.filter(ind => {
            if (ind.id === this.person.id) return false;
            const isAlreadyRelated = this.relations().some(rel => rel.personId === ind.id);
            if (isAlreadyRelated) return false;

            const fullName = `${ind.firstName || ''} ${ind.lastName || ''}`.toLowerCase();
            return fullName.includes(query.toLowerCase()) || ind.id.toLowerCase().includes(query.toLowerCase());
        }).slice(0, 10);

        this.individualSearchResults.set(results);
        this.showIndividualResults.set(index);
    }

    selectIndividual(index: number, ind: Individual) {
        if (ind.id === this.person.id) return;
        const current = this.relations();
        current[index].personId = ind.id;
        current[index].personName = `${ind.firstName || ''} ${ind.lastName || ''}`.trim();
        this.relations.set([...current]);
        this.showIndividualResults.set(null);
        this.onChanged();
    }

    removeRelation(index: number) {
        const current = this.relations();
        current.splice(index, 1);
        this.relations.set([...current]);
        this.onChanged();
    }

    addRelation() {
        this.newRelationDraft.set({ type: 'SPOUSE', personInput: '' });
        this.showRelationCreateModal.set(true);
    }

    closeRelationCreateModal() {
        this.showRelationCreateModal.set(false);
    }

    confirmAddRelation() {
        const draft = this.newRelationDraft();
        const personInput = (draft.personInput || '').trim();
        if (!personInput) return;

        const match = this.allPersonsOptions().find(opt => opt.displayName === personInput);
        const personId = match?.id || '';
        const personName = match ? match.displayName.replace(` (${match.id})`, '') : personInput;
        
        if (!personId || personId === this.person.id) return;
        if (this.relations().some(r => r.personId === personId && r.type === draft.type)) return;

        this.relations.set([...this.relations(), { type: draft.type, personId, personName }]);
        this.showRelationCreateModal.set(false);
        this.onChanged();
    }

    updateFamilyWeddingByFamilyId(familyId: string | undefined, field: 'date' | 'place', val: string) {
        if (!familyId || !this.treeData) return;
        const fam = this.treeData.families.find(f => f.id === familyId);
        if (!fam) return;

        fam.events = fam.events || [];
        let marr = fam.events.find(e => e.type === 'MARR');
        if (!marr) {
            marr = { type: 'MARR', isPrimary: true };
            fam.events.push(marr);
        }

        if (field === 'date') marr.date = val;
        else marr.place = val;

        this.onChanged();
    }

    onChanged() {
        this.changed.emit();
    }
}
