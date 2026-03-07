import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppModalShell } from './ui/app-modal-shell';
import { AppEmptyStateComponent } from './ui/app-empty-state';
import { AppSectionHeaderComponent } from './ui/app-section-header';

@Component({
    selector: 'app-person-tab-associations',
    standalone: true,
    imports: [CommonModule, FormsModule, AppModalShell, AppEmptyStateComponent, AppSectionHeaderComponent],
    template: `
        <div class="glass-card shadow-sm flex flex-col">
            <div class="p-0">
                <app-section-header title="Assoziationen" icon="🤝" description="Soziale Beziehungen wie Taufpaten, Zeugen, Arbeitgeber">
                    <button actions (click)="addAssociation()" class="btn-primary !w-auto !py-2">
                        + Assoziation
                    </button>
                </app-section-header>

                <div class="space-y-4" *ngIf="person?.associations && person.associations.length > 0">
                    <div *ngFor="let a of person.associations; let i = index"
                        class="glass-card !bg-brand-50 !rounded-2xl !p-5 space-y-3 group relative cursor-pointer hover:bg-neutral-100 transition-colors"
                        (click)="openAssociationEditModal(i)">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="font-bold text-lg text-neutral-900 flex items-center gap-2">
                                    <span class="text-xl">{{ a.role === 'GODPARENT' ? '🕊️' : a.role === 'WITNESS' ?
                                        '📜' : a.role === 'CLERGY' ? '⛪' : a.role === 'EMPLOYER' ? '💼' : a.role ===
                                        'FRIEND' ? '🤝' : '👤' }}</span>
                                    <span *ngIf="a.associatedPersonName">{{ a.associatedPersonName }}</span>
                                    <span *ngIf="!a.associatedPersonName" class="text-neutral-800 dark:text-neutral-200 italic">Unbekannte Person</span>
                                </h3>
                                <p class="text-sm text-neutral-800 dark:text-neutral-200 mt-1">
                                    <span class="font-semibold">{{ a.role === 'GODPARENT' ? 'Taufpate/in' : a.role ===
                                        'WITNESS' ? 'Zeuge/in' : a.role === 'CLERGY' ? 'Geistliche/r' : a.role ===
                                        'EMPLOYER' ? 'Arbeitgeber' : a.role === 'FRIEND' ? 'Freund/in' :
                                        'Sonstige' }}</span>
                                    <span *ngIf="a.relationText"> • {{ a.relationText }}</span>
                                    <span *ngIf="a.dateText"> • {{ a.dateText }}</span>
                                </p>
                            </div>
                            <button (click)="$event.stopPropagation(); removeAssociation(i)"
                                class="p-1.5 text-neutral-800 dark:text-neutral-200 hover:text-accent-danger-500 hover:bg-accent-danger-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                    fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18"></path>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                        <div *ngIf="a.notes"
                            class="mt-2 text-xs text-neutral-700 bg-brand-100/50 p-2 rounded-lg border border-neutral-300/30">
                            📝 {{ a.notes }}
                        </div>
                        <div *ngIf="a.confidence" class="mt-1 flex items-center gap-1 text-[10px] text-neutral-800 dark:text-neutral-200">
                            <span class="uppercase tracking-widest font-bold">Konfidenz:</span>
                            <span>{{ getConfidenceLabel(a.confidence) }}</span>
                        </div>
                    </div>
                </div>

                <app-empty-state *ngIf="!person?.associations || person.associations.length === 0"
                    icon="🤝" 
                    title="Keine Assoziationen" 
                    message="Taufpaten, Trauzeugen oder enge Freunde sind oft der Schlüssel zu neuen Erkenntnissen. Erfasse sie hier.">
                    <button actions (click)="addAssociation()" class="btn-secondary !py-2 !px-4 text-xs">Assoziation hinzufügen</button>
                </app-empty-state>
            </div>
        </div>

        <!-- ASSOCIATION CREATE MODAL -->
        <app-modal-shell [visible]="showAssociationCreateModal()" title="Assoziation hinzufügen" icon="🤝" size="md"
            [showSave]="true" saveText="Assoziation hinzufügen" [showDelete]="false" (close)="closeAssociationModal()"
            (save)="confirmAddAssociation()">
            <div class="space-y-4">
                <div class="form-group mb-0">
                    <label class="form-label">Rolle</label>
                    <select [ngModel]="newAssociationDraft().role"
                        (ngModelChange)="newAssociationDraft.update(v => ({ ...v, role: $event }))"
                        class="form-input !py-2.5">
                        <option value="GODPARENT">Taufpate / Taufpatin</option>
                        <option value="WITNESS">Zeuge / Zeugin</option>
                        <option value="CLERGY">Geistliche/r</option>
                        <option value="EMPLOYER">Arbeitgeber/in</option>
                        <option value="FRIEND">Freund/in</option>
                        <option value="OTHER">Sonstige</option>
                    </select>
                </div>
                <div class="form-group mb-0">
                    <label class="form-label">Person</label>
                    <input type="text" [ngModel]="newAssociationDraft().personInput"
                        (ngModelChange)="newAssociationDraft.update(v => ({ ...v, personInput: $event }))"
                        list="association-person-list-new" class="form-input" placeholder="Person auswählen oder eingeben...">
                    <datalist id="association-person-list-new">
                        <option *ngFor="let opt of allPersonsOptions" [value]="opt.displayName"></option>
                    </datalist>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="form-group mb-0">
                        <label class="form-label">Beschreibung</label>
                        <input type="text" [ngModel]="newAssociationDraft().relationText"
                            (ngModelChange)="newAssociationDraft.update(v => ({ ...v, relationText: $event }))"
                            class="form-input" placeholder="z.B. Taufpate bei der Geburt 1894">
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label">Datum</label>
                        <input type="text" [ngModel]="newAssociationDraft().dateText"
                            (ngModelChange)="newAssociationDraft.update(v => ({ ...v, dateText: $event }))"
                            class="form-input" placeholder="z.B. 12 MAR 1894">
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="form-group mb-0">
                        <label class="form-label">Konfidenz</label>
                        <select [ngModel]="newAssociationDraft().confidence"
                            (ngModelChange)="newAssociationDraft.update(v => ({ ...v, confidence: $event }))"
                            class="form-input !py-2.5">
                            <option value="">Bitte wählen</option>
                            <option value="CERTAIN">✅ Sicher</option>
                            <option value="VERY_LIKELY">🟩 Sehr wahrscheinlich</option>
                            <option value="LIKELY">🟨 Wahrscheinlich</option>
                            <option value="POSSIBLE">🟧 Möglich</option>
                            <option value="UNLIKELY">🟥 Unwahrscheinlich</option>
                        </select>
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label">Notiz</label>
                        <input type="text" [ngModel]="newAssociationDraft().notes"
                            (ngModelChange)="newAssociationDraft.update(v => ({ ...v, notes: $event }))" class="form-input"
                            placeholder="Zusätzliche Notizen">
                    </div>
                </div>
            </div>
        </app-modal-shell>

        <!-- ASSOCIATION EDIT MODAL -->
        <app-modal-shell [visible]="showAssociationEditModal()" title="Assoziation bearbeiten" icon="🤝" size="md"
            [showSave]="true" saveText="Speichern" [showDelete]="false" (close)="closeAssociationEditModal()"
            (save)="saveAssociationEditModal()">
            <div class="space-y-4">
                <div class="grid grid-cols-1 gap-4 items-end">
                    <div>
                        <label class="form-label">Rolle</label>
                        <select [ngModel]="editAssociationDraft()?.role"
                            (ngModelChange)="editAssociationDraft.set({ ...editAssociationDraft(), role: $event })"
                            class="form-input form-input-sm !py-2.5">
                            <option value="GODPARENT">🕊️ Taufpate / Taufpatin</option>
                            <option value="WITNESS">📜 Zeuge / Zeugin</option>
                            <option value="CLERGY">⛪ Geistliche/r</option>
                            <option value="EMPLOYER">💼 Arbeitgeber/in</option>
                            <option value="FRIEND">🤝 Freund/in</option>
                            <option value="OTHER">👤 Sonstige</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Person <span
                                *ngIf="editAssociationDraft()?._tempTargetName || editAssociationDraft()?.associatedPersonName"
                                class="text-brand-400 normal-case font-normal ml-1">— {{
                                editAssociationDraft()?._tempTargetName || editAssociationDraft()?.associatedPersonName
                                }}</span></label>
                        <input type="text"
                            [ngModel]="editAssociationDraft()?._tempTargetName || editAssociationDraft()?.associatedPersonName"
                            (ngModelChange)="editAssociationDraft.set({ ...editAssociationDraft(), _tempTargetName: $event })"
                            list="all-persons-list-edit" placeholder="Name eingeben oder auswählen..."
                            class="form-input form-input-sm !py-2.5">
                        <datalist id="all-persons-list-edit">
                            <option *ngFor="let opt of allPersonsOptions" [value]="opt.displayName"></option>
                        </datalist>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Beschreibung</label>
                        <input type="text" [ngModel]="editAssociationDraft()?.relationText"
                            (ngModelChange)="editAssociationDraft.set({ ...editAssociationDraft(), relationText: $event })"
                            placeholder="z.B. Taufpate bei der Geburt 1894" class="form-input form-input-sm !py-2.5">
                    </div>
                    <div>
                        <label class="form-label">Datum</label>
                        <input type="text" [ngModel]="editAssociationDraft()?.dateText"
                            (ngModelChange)="editAssociationDraft.set({ ...editAssociationDraft(), dateText: $event })"
                            placeholder="z.B. 12 MAR 1894" class="form-input form-input-sm !py-2.5">
                    </div>
                </div>
                <div class="grid grid-cols-1 gap-4">
                    <div>
                        <label class="form-label">Konfidenz</label>
                        <select [ngModel]="editAssociationDraft()?.confidence"
                            (ngModelChange)="editAssociationDraft.set({ ...editAssociationDraft(), confidence: $event })"
                            class="form-select form-input-xs !py-2.5">
                            <option value="">— Keine Angabe —</option>
                            <option value="CERTAIN">✅ Sicher</option>
                            <option value="VERY_LIKELY">🟩 Sehr wahrscheinlich</option>
                            <option value="LIKELY">🟨 Wahrscheinlich</option>
                            <option value="POSSIBLE">🟧 Möglich</option>
                            <option value="UNLIKELY">🟥 Unwahrscheinlich</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Notiz</label>
                        <input type="text" [ngModel]="editAssociationDraft()?.notes"
                            (ngModelChange)="editAssociationDraft.set({ ...editAssociationDraft(), notes: $event })"
                            placeholder="Anmerkungen zur Assoziation..." class="form-input form-input-sm !py-2.5">
                    </div>
                </div>
            </div>
        </app-modal-shell>
    `
})
export class PersonTabAssociationsComponent {
    @Input({ required: true }) person!: any;
    @Input() allPersonsOptions: any[] = [];
    @Output() changed = new EventEmitter<void>();

    showAssociationCreateModal = signal(false);
    showAssociationEditModal = signal(false);
    activeAssociationIndex = signal<number | null>(null);
    editAssociationDraft = signal<any>({});
    newAssociationDraft = signal<{ role: string; personInput: string; relationText: string; dateText: string; confidence: string; notes: string }>({
        role: 'OTHER', personInput: '', relationText: '', dateText: '', confidence: '', notes: ''
    });

    getConfidenceLabel(conf: string): string {
        switch (conf) {
            case 'CERTAIN': return 'Sicher';
            case 'VERY_LIKELY': return 'Sehr wahrscheinlich';
            case 'LIKELY': return 'Wahrscheinlich';
            case 'POSSIBLE': return 'Möglich';
            case 'UNLIKELY': return 'Unwahrscheinlich';
            default: return 'Keine Angabe';
        }
    }

    addAssociation() {
        this.newAssociationDraft.set({ role: 'OTHER', personInput: '', relationText: '', dateText: '', confidence: '', notes: '' });
        this.showAssociationCreateModal.set(true);
    }

    closeAssociationModal() {
        this.showAssociationCreateModal.set(false);
    }

    openAssociationEditModal(index: number) {
        const p = this.person;
        if (!p || !p.associations) return;
        this.activeAssociationIndex.set(index);
        this.editAssociationDraft.set({ ...p.associations[index] });
        this.showAssociationEditModal.set(true);
    }

    closeAssociationEditModal() {
        this.showAssociationEditModal.set(false);
        this.activeAssociationIndex.set(null);
    }

    saveAssociationEditModal() {
        const p = this.person;
        const idx = this.activeAssociationIndex();
        if (!p || !p.associations || idx === null) return;

        const draft = this.editAssociationDraft();
        const personInput = (draft._tempTargetName || draft.associatedPersonName || '').trim();
        const match = this.allPersonsOptions.find((opt: any) => opt.displayName === personInput);
        const associatedPersonId = match?.id || null;
        const associatedPersonName = match
            ? match.displayName.replace(` (${match.id})`, '')
            : personInput;

        p.associations[idx] = {
            ...p.associations[idx], ...draft,
            associatedPersonId, associatedPersonName,
            _tempTargetName: personInput
        };

        this.changed.emit();
        this.closeAssociationEditModal();
    }

    confirmAddAssociation() {
        const p = this.person;
        if (p) {
            const draft = this.newAssociationDraft();
            const personInput = (draft.personInput || '').trim();
            const match = this.allPersonsOptions.find((opt: any) => opt.displayName === personInput);
            const associatedPersonId = match?.id || null;
            const associatedPersonName = match
                ? match.displayName.replace(` (${match.id})`, '')
                : (personInput || '');

            p.associations = p.associations || [];
            p.associations.push({
                role: draft.role || 'OTHER',
                associatedPersonId, associatedPersonName,
                _tempTargetName: personInput,
                relationText: draft.relationText || '',
                dateText: draft.dateText || '',
                confidence: draft.confidence || '',
                notes: draft.notes || ''
            } as any);
            this.changed.emit();
            this.showAssociationCreateModal.set(false);
        }
    }

    removeAssociation(index: number) {
        const p = this.person;
        if (p) {
            p.associations!.splice(index, 1);
            this.changed.emit();
        }
    }
}
