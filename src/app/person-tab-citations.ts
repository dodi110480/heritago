import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppCardComponent } from './ui/app-card';
import { AppModalShell } from './ui/app-modal-shell';

@Component({
    selector: 'app-person-tab-citations',
    standalone: true,
    imports: [CommonModule, FormsModule, AppCardComponent, AppModalShell],
    template: `
        <app-card [contentClass]="'p-0'">
            <div class="p-0">
                <div class="flex justify-between items-center mb-8">
                    <div>
                        <h2 class="text-xl font-semibold text-neutral-900">Personenebene Quellen</h2>
                        <p class="text-xs text-neutral-950 mt-1">Allgemeine Quellenbelege zur Person
                            (nicht ereignis-spezifisch). Ereignis-Belege werden direkt am Ereignis gesetzt.</p>
                    </div>
                    <button (click)="addPersonCitation()" class="btn-primary !w-auto !py-2">
                        + Beleg
                    </button>
                </div>

                <div *ngIf="person?.citations && person.citations.length > 0" class="space-y-3">
                    <div *ngFor="let cit of person.citations; let i = index"
                        class="!p-4 glass-card !bg-brand-50 !rounded-2xl space-y-3 cursor-pointer hover:bg-neutral-100 transition-all"
                        (click)="openPersonCitationModal(i)">
                        <div class="flex items-center justify-between gap-3">
                            <div class="text-sm font-semibold text-neutral-900 truncate">{{ getSourceTitle(cit.sourceId) }}</div>
                            <span class="badge {{ getConfidenceColorClass(cit.confidence) }} text-xs">{{
                                getConfidenceLabel(cit.confidence) }}</span>
                        </div>
                        <div class="text-xs text-neutral-950">Fundstelle: {{ cit.page || '-' }}</div>
                    </div>
                </div>

                <div *ngIf="!person?.citations || person.citations.length === 0"
                    class="py-12 flex flex-col items-center justify-center border-2 border-dashed border-neutral-300/60 rounded-3xl text-neutral-950">
                    <span class="text-4xl mb-3 opacity-20">📖</span>
                    <p class="font-medium">Keine allgemeinen Quellen vorhanden.</p>
                    <p class="text-xs mt-1 text-neutral-600">Ereignis-spezifische Belege findest du direkt in der Timeline.</p>
                </div>
            </div>
        </app-card>

        <!-- CITATION CREATE MODAL -->
        <app-modal-shell [visible]="showCitationCreateModal()" title="Beleg hinzufügen" icon="📖" size="md"
            [showSave]="true" saveText="Beleg hinzufügen" [showDelete]="false" (close)="closeCitationModal()"
            (save)="confirmAddPersonCitation()">
            <div class="space-y-4">
                <div class="form-group mb-0">
                    <label class="form-label">Quelle</label>
                    <select [ngModel]="newCitationDraft().sourceId"
                        (ngModelChange)="newCitationDraft.update(v => ({ ...v, sourceId: $event }))"
                        class="form-input !py-2.5">
                        <option value="">— Quelle wählen —</option>
                        <option *ngFor="let s of availableSources" [value]="s.id">
                            {{ s.title }}{{ s.author ? ' · ' + s.author : '' }}
                        </option>
                    </select>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="form-group mb-0">
                        <label class="form-label">Fundstelle</label>
                        <input type="text" [ngModel]="newCitationDraft().page"
                            (ngModelChange)="newCitationDraft.update(v => ({ ...v, page: $event }))" class="form-input"
                            placeholder="z.B. Seite 42">
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label">Konfidenz</label>
                        <select [ngModel]="newCitationDraft().confidence"
                            (ngModelChange)="newCitationDraft.update(v => ({ ...v, confidence: $event }))"
                            class="form-input !py-2.5">
                            <option value="">Bitte wählen</option>
                            <option value="CERTAIN">✅ Sicher</option>
                            <option value="VERY_LIKELY">🟩 Sehr wahrscheinlich</option>
                            <option value="LIKELY">🟨 Wahrscheinlich</option>
                            <option value="POSSIBLE">🟧 Möglich</option>
                            <option value="UNLIKELY">🟥 Unwahrscheinlich</option>
                        </select>
                    </div>
                </div>
            </div>
        </app-modal-shell>

        <!-- CITATION EDIT MODAL -->
        <app-modal-shell [visible]="showCitationEditModal()" title="Beleg bearbeiten" icon="📖" size="md" [showSave]="true"
            saveText="Speichern" [showDelete]="true" deleteText="Beleg löschen" (close)="closePersonCitationModal()"
            (save)="savePersonCitationModal()" (delete)="removePersonCitationModal()">
            <div class="space-y-4">
                <div class="form-group mb-0">
                    <label class="form-label">Quelle</label>
                    <select [ngModel]="citationEditDraft().sourceId"
                        (ngModelChange)="citationEditDraft.update(v => ({ ...v, sourceId: $event }))"
                        class="form-input !py-2.5">
                        <option value="">— Quelle wählen —</option>
                        <option *ngFor="let s of availableSources" [value]="s.id">
                            {{ s.title }}{{ s.author ? ' · ' + s.author : '' }}
                        </option>
                    </select>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="form-group mb-0">
                        <label class="form-label">Fundstelle</label>
                        <input type="text" [ngModel]="citationEditDraft().page"
                            (ngModelChange)="citationEditDraft.update(v => ({ ...v, page: $event }))" class="form-input"
                            placeholder="z.B. Seite 42">
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label">Konfidenz</label>
                        <select [ngModel]="citationEditDraft().confidence"
                            (ngModelChange)="citationEditDraft.update(v => ({ ...v, confidence: $event }))"
                            class="form-input !py-2.5">
                            <option value="">Keine Angabe</option>
                            <option value="CERTAIN">Sicher</option>
                            <option value="VERY_LIKELY">Sehr wahrscheinlich</option>
                            <option value="LIKELY">Wahrscheinlich</option>
                            <option value="POSSIBLE">Möglich</option>
                            <option value="UNLIKELY">Unwahrscheinlich</option>
                        </select>
                    </div>
                </div>
                <div class="form-group mb-0">
                    <label class="form-label">Zitat</label>
                    <input type="text" [ngModel]="citationEditDraft().text"
                        (ngModelChange)="citationEditDraft.update(v => ({ ...v, text: $event }))" class="form-input"
                        placeholder="Zitierter Ausschnitt">
                </div>
            </div>
        </app-modal-shell>
    `
})
export class PersonTabCitationsComponent {
    @Input({ required: true }) person!: any;
    @Input() availableSources: any[] = [];
    @Output() changed = new EventEmitter<void>();

    showCitationCreateModal = signal(false);
    showCitationEditModal = signal(false);
    newCitationDraft = signal<{ sourceId: string; confidence?: string; page?: string; dateText?: string }>({ sourceId: '' });
    citationEditDraft = signal<{ index?: number; sourceId: string; confidence?: string; page?: string; text?: string; dateText?: string }>({ sourceId: '' });
    activePersonCitationIndex = signal<number | null>(null);

    getSourceTitle(sourceId?: string): string {
        if (!sourceId) return 'Ohne Quelle';
        const src = this.availableSources.find((s: any) => s.id === sourceId);
        return src ? src.title : sourceId;
    }

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

    getConfidenceColorClass(conf: string): string {
        switch (conf) {
            case 'CERTAIN': return 'badge-success';
            case 'VERY_LIKELY': return 'bg-emerald-500/10 text-emerald-500';
            case 'LIKELY': return 'badge-highlight';
            case 'POSSIBLE': return 'badge-warn';
            case 'UNLIKELY': return 'badge-danger';
            default: return 'bg-neutral-950/10 text-neutral-400';
        }
    }

    addPersonCitation() {
        this.newCitationDraft.set({ sourceId: '', page: '', confidence: '', dateText: '' });
        this.showCitationCreateModal.set(true);
    }

    closeCitationModal() {
        this.showCitationCreateModal.set(false);
    }

    confirmAddPersonCitation() {
        const p = this.person;
        if (p) {
            const draft = this.newCitationDraft();
            if (!draft.sourceId) {
                alert('Bitte wählen Sie eine gültige Quelle aus.');
                return;
            }
            p.citations = p.citations || [];
            p.citations.push({
                sourceId: draft.sourceId,
                confidence: draft.confidence || '',
                page: draft.page || '',
                dateText: draft.dateText || ''
            } as any);
            this.changed.emit();
            this.showCitationCreateModal.set(false);
        }
    }

    openPersonCitationModal(index: number) {
        const p = this.person;
        if (!p || !p.citations || !p.citations[index]) return;
        const cit = p.citations[index] as any;
        this.citationEditDraft.set({
            index,
            sourceId: cit.sourceId,
            confidence: cit.confidence || '',
            page: cit.page || '',
            text: cit.text || '',
            dateText: cit.dateText || ''
        });
        this.activePersonCitationIndex.set(index);
        this.showCitationEditModal.set(true);
    }

    closePersonCitationModal() {
        this.showCitationEditModal.set(false);
        this.activePersonCitationIndex.set(null);
    }

    savePersonCitationModal() {
        const p = this.person;
        const idx = this.activePersonCitationIndex();
        if (!p || idx === null || !p.citations || !p.citations[idx]) return;
        const draft = this.citationEditDraft();
        if (!draft.sourceId) {
            alert('Bitte wählen Sie eine gültige Quelle aus.');
            return;
        }
        p.citations[idx] = {
            ...(p.citations[idx] as any),
            sourceId: draft.sourceId || '',
            page: draft.page || '',
            confidence: draft.confidence || '',
            text: draft.text || '',
            dateText: draft.dateText || ''
        } as any;
        this.changed.emit();
        this.closePersonCitationModal();
    }

    removePersonCitationModal() {
        const idx = this.activePersonCitationIndex();
        if (idx === null) return;
        const p = this.person;
        if (p) {
            p.citations!.splice(idx, 1);
            this.changed.emit();
        }
        this.closePersonCitationModal();
    }
}
