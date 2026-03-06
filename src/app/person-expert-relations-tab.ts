import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppCardComponent } from './ui/app-card';

@Component({
    selector: 'app-person-expert-relations-tab',
    standalone: true,
    imports: [CommonModule, FormsModule, AppCardComponent],
    template: `
        <app-card [contentClass]="'p-0'">
            <div class="p-0">
                <div class="flex justify-between items-center mb-8">
                    <div>
                        <h2 class="text-xl font-semibold text-canvas-white">Familie & Beziehungen</h2>
                        <p class="text-sm text-neutral-400 mt-1">Verwalte Ehepartner, Eltern und Kinder.</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <button (click)="toggleFamilyEdit()" [class.bg-brand-500]="isEditingFamily()"
                            [class.text-canvas-white]="isEditingFamily()" [class.bg-canvas-white/5]="!isEditingFamily()"
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
                            + Beziehung hinzufügen
                        </button>
                    </div>
                </div>

                <div *ngIf="relations().length > 0" class="space-y-3">
                    <div *ngFor="let rel of relations(); let i = index"
                        (click)="!isEditingFamily() && rel.personId && goToPerson(rel.personId)"
                        [class.cursor-pointer]="rel.personId && !isEditingFamily()"
                        class="group relative glass-card !p-4 flex items-center gap-4 hover:bg-canvas-white/10 transition-all border-l-4"
                        [class.border-l-brand-500]="rel.type === 'SPOUSE'"
                        [class.border-l-indigo-500]="rel.type === 'FATHER' || rel.type === 'MOTHER'"
                        [class.border-l-emerald-500]="rel.type === 'CHILD'">

                        <div *ngIf="isEditingFamily(); else relRead"
                            class="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1">
                            <select [(ngModel)]="rel.type" class="form-input !w-32 !py-2">
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
                                        class="px-4 py-2.5 text-sm text-neutral-300 hover:bg-brand-500/20 hover:text-canvas-white cursor-pointer border-b border-canvas-white/5 last:border-0 transition-colors">
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
                            <div class="w-24 text-[10px] font-bold text-neutral-950 uppercase tracking-widest">
                                {{ getRelationLabel(rel.type) }}
                            </div>
                            <div class="flex-1">
                                <div class="text-sm font-semibold text-canvas-white mb-1 group-hover:text-brand-400 transition-colors">
                                    {{ rel.personName }}
                                </div>
                                <div *ngIf="rel.type === 'SPOUSE' && getFamilyWedding(rel.familyId)"
                                    class="text-[10px] text-neutral-400 flex items-center gap-1.5">
                                    <span class="text-xs">💍</span> {{ getFamilyWedding(rel.familyId) }}
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

                <div *ngIf="relations().length === 0"
                    class="py-12 flex flex-col items-center justify-center border-2 border-dashed border-canvas-white/5 rounded-3xl text-neutral-950">
                    <span class="text-4xl mb-3 opacity-20">👨‍👩‍👧‍👦</span>
                    <p class="font-medium">Keine familiären Beziehungen hinterlegt.</p>
                </div>
            </div>
        </app-card>
    `
})
export class PersonExpertRelationsTabComponent {
    @Input({ required: true }) ctx!: any;

    relations() { return this.ctx.relations(); }
    isEditingFamily() { return this.ctx.isEditingFamily(); }
    toggleFamilyEdit() { this.ctx.toggleFamilyEdit(); }
    addRelation() { this.ctx.addRelation(); }
    goToPerson(id?: string) { this.ctx.goToPerson(id); }
    showIndividualResults() { return this.ctx.showIndividualResults(); }
    individualSearchResults() { return this.ctx.individualSearchResults(); }
    searchIndividuals(i: number, q: string) { this.ctx.searchIndividuals(i, q); }
    selectIndividual(i: number, ind: any) { this.ctx.selectIndividual(i, ind); }
    getFamilyWeddingDate(familyId?: string) { return this.ctx.getFamilyWeddingDate(familyId); }
    getFamilyWeddingPlace(familyId?: string) { return this.ctx.getFamilyWeddingPlace(familyId); }
    updateFamilyWeddingByFamilyId(familyId: string | undefined, field: 'date' | 'place', val: string) {
        this.ctx.updateFamilyWeddingByFamilyId(familyId, field, val);
    }
    removeRelation(i: number) { this.ctx.removeRelation(i); }
    getRelationLabel(type: string) { return this.ctx.getRelationLabel(type); }
    getFamilyWedding(familyId?: string) { return this.ctx.getFamilyWedding(familyId); }
}

