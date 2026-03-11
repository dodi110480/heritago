import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppModalShell } from '../../shared/components/ui/app-modal-shell';
import { AppEmptyStateComponent } from '../../shared/components/ui/app-empty-state';
import { AppSectionHeaderComponent } from '../../shared/components/ui/app-section-header';

@Component({
    selector: 'app-person-tab-dna',
    standalone: true,
    imports: [CommonModule, FormsModule, AppModalShell, AppEmptyStateComponent, AppSectionHeaderComponent],
    template: `
        <div class="glass-card shadow-sm flex flex-col">
            <div class="p-0">
                <app-section-header title="DNA-Matches" icon="🧬">
                    <button actions (click)="addDnaMatch()" class="btn-primary !w-auto !py-2">
                        + Match
                    </button>
                </app-section-header>

                <div class="space-y-6" *ngIf="person?.dnaMatches && person.dnaMatches.length > 0">
                    <div *ngFor="let m of person.dnaMatches; let i = index"
                        class="!p-6 glass-card !bg-brand-50 !rounded-2xl space-y-4 group relative cursor-pointer hover:bg-neutral-100 transition-colors"
                        (click)="openDnaMatchEditModal(i)">
                        <div class="flex justify-between items-start">
                            <div>
                                <div class="flex items-center gap-3">
                                    <h3 class="font-bold text-lg text-neutral-900">Match: <span class="text-brand-400">{{
                                            m.matchPersonName || m.matchPersonId || 'Unbekannt' }}</span></h3>
                                    <span class="badge badge-primary py-0.5 px-2">{{ m.totalCm ? m.totalCm + ' cM' :
                                        'unbekannt' }}</span>
                                </div>
                                <p class="text-sm text-neutral-800 dark:text-neutral-200 mt-1">Provider: <span class="font-semibold text-neutral-900">{{
                                        m.provider || 'Unbekannt' }}</span></p>
                            </div>
                            <button (click)="$event.stopPropagation(); removeDnaMatch(i)"
                                class="p-1.5 text-neutral-800 dark:text-neutral-200 hover:text-accent-danger-500 hover:bg-accent-danger-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                    fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18"></path>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>

                        <div *ngIf="m.segments && m.segments.length > 0" class="mt-4 pt-4 border-t border-neutral-300/50">
                            <h4 class="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest mb-2">Segmente
                                ({{ m.segments.length }})</h4>
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                <div *ngFor="let s of m.segments"
                                    class="bg-brand-100/50 p-2 rounded-lg border border-neutral-300/30 text-xs text-neutral-800 dark:text-neutral-200">
                                    <span class="font-bold text-neutral-900">Chr {{ s.chromosome }}</span>: {{
                                    s.startPosition }} - {{ s.endPosition }} ({{ s.cm }} cM)
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <app-empty-state *ngIf="!person?.dnaMatches || person.dnaMatches.length === 0"
                    icon="🧬" 
                    title="Keine DNA-Matches" 
                    message="Verknüpfe DNA-Testergebnisse von Anbietern wie Ancestry oder MyHeritage, um verwandtschaftliche Beziehungen genetisch zu belegen.">
                </app-empty-state>
            </div>
        </div>

        <!-- DNA CREATE MODAL -->
        <app-modal-shell [visible]="showDnaMatchCreateModal()" title="DNA-Match hinzufügen" icon="🧬" size="md"
            [showSave]="true" saveText="Match hinzufügen" [showDelete]="false" (close)="closeDnaMatchModal()"
            (save)="confirmAddDnaMatch()">
            <div class="space-y-4">
                <div class="form-group mb-0">
                    <label class="form-label">Provider</label>
                    <select [ngModel]="newDnaMatchDraft().provider"
                        (ngModelChange)="newDnaMatchDraft.update(v => ({ ...v, provider: $event }))"
                        class="form-input !py-2.5">
                        <option value="">Wählen...</option>
                        <option value="ANCESTRY">Ancestry</option>
                        <option value="MYHERITAGE">MyHeritage</option>
                        <option value="GEDMATCH">GEDmatch</option>
                        <option value="FAMILY_TREE_DNA">FTDNA</option>
                    </select>
                </div>
                <div class="form-group mb-0">
                    <label class="form-label">Match Person ID</label>
                    <input type="text" [ngModel]="newDnaMatchDraft().matchPersonId"
                        (ngModelChange)="newDnaMatchDraft.update(v => ({ ...v, matchPersonId: $event }))" class="form-input"
                        placeholder="Personen-ID">
                </div>
                <div class="form-group mb-0">
                    <label class="form-label">cM Wert</label>
                    <input type="number" [ngModel]="newDnaMatchDraft().totalCm"
                        (ngModelChange)="newDnaMatchDraft.update(v => ({ ...v, totalCm: $event }))" class="form-input"
                        placeholder="z.B. 125">
                </div>
            </div>
        </app-modal-shell>

        <!-- DNA EDIT MODAL -->
        <app-modal-shell [visible]="showDnaMatchEditModal()" title="DNA-Match bearbeiten" icon="🧬" size="lg"
            [showSave]="true" saveText="Speichern" [showDelete]="false" (close)="closeDnaMatchEditModal()"
            (save)="saveDnaMatchEditModal()">
            <div class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label class="form-label">Provider</label>
                        <select [ngModel]="editDnaMatchDraft()?.provider"
                            (ngModelChange)="editDnaMatchDraft.set({ ...editDnaMatchDraft(), provider: $event })"
                            class="form-input form-input-sm !py-2.5">
                            <option value="">Wählen...</option>
                            <option value="ANCESTRY">Ancestry</option>
                            <option value="MYHERITAGE">MyHeritage</option>
                            <option value="GEDMATCH">GEDmatch</option>
                            <option value="FAMILY_TREE_DNA">FTDNA</option>
                        </select>
                    </div>
                    <div class="md:col-span-2 space-y-1">
                        <label class="form-label">Match Person (ID)</label>
                        <div class="flex items-center gap-3">
                            <input type="text" [ngModel]="editDnaMatchDraft()?.matchPersonId"
                                (ngModelChange)="editDnaMatchDraft.set({ ...editDnaMatchDraft(), matchPersonId: $event })"
                                placeholder="ID suchen..." class="flex-1 form-input form-input-sm !py-2.5">
                            <span class="text-lg font-bold text-brand-400 whitespace-nowrap">{{ editDnaMatchDraft()?.totalCm }} cM</span>
                        </div>
                    </div>
                    <div>
                        <label class="form-label">cM Wert</label>
                        <input type="number" [ngModel]="editDnaMatchDraft()?.totalCm"
                            (ngModelChange)="editDnaMatchDraft.set({ ...editDnaMatchDraft(), totalCm: $event })"
                            class="form-input form-input-sm !py-2.5">
                    </div>
                </div>

                <div class="space-y-4 p-4 bg-brand-100 rounded-xl">
                    <div class="flex justify-between items-center">
                        <h4 class="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest">Segmente</h4>
                        <button (click)="addDnaSegmentDraft()"
                            class="text-[10px] font-bold text-brand-400 hover:text-brand-300 uppercase">+ Segment</button>
                    </div>
                    <div class="grid grid-cols-1 gap-2">
                        <div *ngFor="let s of editDnaMatchDraft()?.segments; let si = index"
                            class="grid grid-cols-5 gap-2 items-center">
                            <input type="text" [ngModel]="s.chromosome"
                                (ngModelChange)="s.chromosome = $event; editDnaMatchDraft.set(editDnaMatchDraft())"
                                placeholder="Chr"
                                class="form-input form-input-xs border-neutral-300/70 !rounded-lg text-center">
                            <input type="number" [ngModel]="s.startPosition"
                                (ngModelChange)="s.startPosition = $event; editDnaMatchDraft.set(editDnaMatchDraft())"
                                placeholder="Start" class="form-input form-input-xs border-neutral-300/70 !rounded-lg">
                            <input type="number" [ngModel]="s.endPosition"
                                (ngModelChange)="s.endPosition = $event; editDnaMatchDraft.set(editDnaMatchDraft())"
                                placeholder="Ende" class="form-input form-input-xs border-neutral-300/70 !rounded-lg">
                            <input type="number" [ngModel]="s.cm"
                                (ngModelChange)="s.cm = $event; editDnaMatchDraft.set(editDnaMatchDraft())" placeholder="cM"
                                class="form-input form-input-xs border-neutral-300/70 !rounded-lg text-center">
                            <button (click)="removeDnaSegmentDraft(si)"
                                class="opacity-70 hover:opacity-100 text-accent-danger-500 hover:bg-accent-danger-500/10 rounded-full w-6 h-6 flex items-center justify-center transition-all ml-auto">✕</button>
                        </div>
                    </div>
                </div>
            </div>
        </app-modal-shell>
    `
})
export class PersonTabDnaComponent {
    @Input({ required: true }) person!: any;
    @Output() changed = new EventEmitter<void>();

    showDnaMatchCreateModal = signal(false);
    showDnaMatchEditModal = signal(false);
    activeDnaMatchIndex = signal<number | null>(null);
    editDnaMatchDraft = signal<any>({});
    newDnaMatchDraft = signal<{ provider: string; matchPersonId: string; totalCm: number | null }>({
        provider: '', matchPersonId: '', totalCm: null
    });

    addDnaMatch() {
        this.newDnaMatchDraft.set({ provider: '', matchPersonId: '', totalCm: null });
        this.showDnaMatchCreateModal.set(true);
    }

    closeDnaMatchModal() {
        this.showDnaMatchCreateModal.set(false);
    }

    openDnaMatchEditModal(index: number) {
        const p = this.person;
        if (!p || !p.dnaMatches) return;
        this.activeDnaMatchIndex.set(index);
        this.editDnaMatchDraft.set({ ...p.dnaMatches[index] });
        this.showDnaMatchEditModal.set(true);
    }

    closeDnaMatchEditModal() {
        this.showDnaMatchEditModal.set(false);
        this.activeDnaMatchIndex.set(null);
    }

    saveDnaMatchEditModal() {
        const p = this.person;
        const idx = this.activeDnaMatchIndex();
        if (!p || !p.dnaMatches || idx === null) return;

        const draft = this.editDnaMatchDraft();
        p.dnaMatches[idx] = { ...p.dnaMatches[idx], ...draft };

        this.changed.emit();
        this.closeDnaMatchEditModal();
    }

    confirmAddDnaMatch() {
        const p = this.person;
        if (!p) return;
        p.dnaMatches = p.dnaMatches || [];
        const draft = this.newDnaMatchDraft();
        p.dnaMatches.push({
            provider: draft.provider || '',
            matchPersonId: draft.matchPersonId || '',
            totalCm: draft.totalCm ?? undefined,
            segments: []
        });
        this.changed.emit();
        this.showDnaMatchCreateModal.set(false);
    }

    removeDnaMatch(index: number) {
        const p = this.person;
        if (!p || !p.dnaMatches) return;
        p.dnaMatches.splice(index, 1);
        this.changed.emit();
    }

    addDnaSegmentDraft() {
        const draft = this.editDnaMatchDraft();
        draft.segments = draft.segments || [];
        draft.segments.push({ chromosome: '1', startPosition: 0, endPosition: 0, cm: 0 });
        this.editDnaMatchDraft.set({ ...draft });
    }

    removeDnaSegmentDraft(index: number) {
        const draft = this.editDnaMatchDraft();
        if (!draft.segments) return;
        draft.segments.splice(index, 1);
        this.editDnaMatchDraft.set({ ...draft });
    }
}
