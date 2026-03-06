import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppModalShell } from './ui/app-modal-shell';
import { AppEmptyStateComponent } from './ui/app-empty-state';
import { AppSectionHeaderComponent } from './ui/app-section-header';

@Component({
    selector: 'app-person-tab-names',
    standalone: true,
    imports: [CommonModule, FormsModule, AppModalShell, AppEmptyStateComponent, AppSectionHeaderComponent],
    template: `
        <div class="glass-card shadow-sm flex flex-col">
            <div class="p-0">
                <app-section-header title="Namen" icon="🧾">
                    <button actions (click)="openNameModal()" class="btn-primary !w-auto !py-2">
                        + Name
                    </button>
                </app-section-header>

                <div class="space-y-4">
                    <div *ngFor="let n of person?.names; let i = index"
                        class="!p-5 glass-card !bg-brand-50 !rounded-2xl space-y-4 group relative cursor-pointer hover:bg-neutral-100 transition-colors"
                        (click)="openNameEditModal(i)">
                        <div class="flex justify-between items-start">
                            <div>
                                <div class="flex items-center gap-2 mb-1">
                                    <h3 class="font-bold text-lg text-neutral-900">{{ n.given }} {{ n.surname }}</h3>
                                    <span *ngIf="n.isPrimary" class="badge badge-primary text-[10px] py-0.5 px-2">Primär</span>
                                </div>
                                <p class="text-sm text-neutral-950 flex items-center gap-1">
                                    <span class="text-xs font-mono bg-brand-100 px-1.5 py-0.5 rounded text-neutral-950">{{
                                        n.type === 'BIRTH' ? 'Geburtsname' : n.type === 'MARRIED' ? 'Ehename' : 'Alias' }}</span>
                                </p>
                            </div>
                            <button (click)="$event.stopPropagation(); removeName(i)"
                                class="p-1.5 text-neutral-950 hover:text-accent-danger-500 hover:bg-accent-danger-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                    fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18"></path>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <app-empty-state *ngIf="!person?.names || person.names.length === 0"
                        icon="🧾" 
                        title="Keine weiteren Namen" 
                        message="Neben dem Primärnamen können hier Alias-Namen, Geburtsnamen oder religiöse Namen erfasst werden.">
                        <button actions (click)="openNameModal()" class="btn-secondary !py-2 !px-4 text-xs">Name hinzufügen</button>
                    </app-empty-state>
                </div>
            </div>
        </div>

        <!-- NAME CREATE MODAL -->
        <app-modal-shell [visible]="showNameCreateModal()" title="Name hinzufügen" icon="🧾" size="md" [showSave]="true"
            saveText="Name hinzufügen" [showDelete]="false" (close)="closeNameModal()" (save)="confirmAddName()">
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="form-group mb-0">
                        <label class="form-label">Vorname</label>
                        <input type="text" [ngModel]="newNameDraft().given"
                            (ngModelChange)="newNameDraft.update(v => ({ ...v, given: $event }))" class="form-input"
                            placeholder="Vorname">
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label">Nachname</label>
                        <input type="text" [ngModel]="newNameDraft().surname"
                            (ngModelChange)="newNameDraft.update(v => ({ ...v, surname: $event }))" class="form-input"
                            placeholder="Nachname">
                    </div>
                </div>

                <div class="form-group mb-0">
                    <label class="form-label">Typ</label>
                    <select [ngModel]="newNameDraft().type"
                        (ngModelChange)="newNameDraft.update(v => ({ ...v, type: $event }))" class="form-input !py-2.5">
                        <option value="BIRTH">Geburtsname</option>
                        <option value="MARRIED">Ehename</option>
                        <option value="AKA">Alias / AKA</option>
                    </select>
                </div>

                <label class="flex items-center gap-2 cursor-pointer text-sm text-neutral-300">
                    <input type="checkbox" [ngModel]="newNameDraft().isPrimary"
                        (ngModelChange)="newNameDraft.update(v => ({ ...v, isPrimary: $event }))"
                        class="w-4 h-4 rounded border-canvas-white/10 bg-brand-900 text-brand-500 focus:ring-brand-500 focus:ring-offset-neutral-900">
                    Als Primärname setzen
                </label>
            </div>
        </app-modal-shell>

        <!-- NAME EDIT MODAL -->
        <app-modal-shell [visible]="showNameEditModal()" title="Name bearbeiten" icon="✏️" size="md" [showSave]="true"
            saveText="Speichern" [showDelete]="false" (close)="closeNameEditModal()" (save)="saveNameEditModal()">
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="form-group mb-0">
                        <label class="form-label">Vorname</label>
                        <input type="text" [ngModel]="editNameDraft()?.given"
                            (ngModelChange)="editNameDraft.set({ ...editNameDraft(), given: $event })" class="form-input"
                            placeholder="Vorname">
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label">Nachname</label>
                        <input type="text" [ngModel]="editNameDraft()?.surname"
                            (ngModelChange)="editNameDraft.set({ ...editNameDraft(), surname: $event })" class="form-input"
                            placeholder="Nachname">
                    </div>
                </div>

                <div class="form-group mb-0">
                    <label class="form-label">Typ</label>
                    <select [ngModel]="editNameDraft()?.type"
                        (ngModelChange)="editNameDraft.set({ ...editNameDraft(), type: $event })"
                        class="form-input !py-2.5">
                        <option value="BIRTH">Geburtsname</option>
                        <option value="MARRIED">Ehename</option>
                        <option value="AKA">Alias / AKA</option>
                    </select>
                </div>

                <label class="flex items-center gap-2 cursor-pointer text-sm text-neutral-300">
                    <input type="checkbox" [ngModel]="editNameDraft()?.isPrimary"
                        (ngModelChange)="editNameDraft.set({ ...editNameDraft(), isPrimary: $event })"
                        class="w-4 h-4 rounded border-canvas-white/10 bg-brand-900 text-brand-500 focus:ring-brand-500 focus:ring-offset-neutral-900">
                    Als Primärname setzen
                </label>
            </div>
        </app-modal-shell>
    `
})
export class PersonTabNamesComponent {
    @Input({ required: true }) person!: any;
    @Output() changed = new EventEmitter<void>();

    showNameCreateModal = signal(false);
    showNameEditModal = signal(false);
    activeNameIndex = signal<number | null>(null);
    editNameDraft = signal<any>({});
    newNameDraft = signal<{ given: string; surname: string; type: 'BIRTH' | 'MARRIED' | 'AKA'; isPrimary: boolean }>({
        given: '', surname: '', type: 'AKA', isPrimary: false
    });

    openNameModal() {
        const p = this.person;
        this.newNameDraft.set({
            given: '', surname: '', type: 'AKA',
            isPrimary: !p?.names?.length
        });
        this.showNameCreateModal.set(true);
    }

    closeNameModal() {
        this.showNameCreateModal.set(false);
    }

    openNameEditModal(index: number) {
        const p = this.person;
        if (!p || !p.names) return;
        this.activeNameIndex.set(index);
        this.editNameDraft.set({ ...p.names[index] });
        this.showNameEditModal.set(true);
    }

    closeNameEditModal() {
        this.showNameEditModal.set(false);
        this.activeNameIndex.set(null);
    }

    saveNameEditModal() {
        const p = this.person;
        const idx = this.activeNameIndex();
        if (!p || !p.names || idx === null) return;

        const draft = this.editNameDraft();
        const given = (draft.given || '').trim();
        const surname = (draft.surname || '').trim();
        if (!given && !surname) return;

        const isNowPrimary = draft.isPrimary;
        if (isNowPrimary) {
            p.names.forEach((n: any) => n.isPrimary = false);
        }

        p.names[idx] = {
            ...p.names[idx], ...draft, given, surname,
            full: `${given} ${surname}`.trim()
        };

        if (p.names[idx].isPrimary) {
            p.firstName = given;
            p.lastName = surname;
            p.name = `${given} ${surname}`.trim();
        }

        this.changed.emit();
        this.closeNameEditModal();
    }

    confirmAddName() {
        const p = this.person;
        if (!p) return;
        const draft = this.newNameDraft();
        const given = (draft.given || '').trim();
        const surname = (draft.surname || '').trim();
        if (!given && !surname) return;

        p.names = p.names || [];
        const shouldBePrimary = draft.isPrimary || p.names.length === 0;
        if (shouldBePrimary) {
            p.names.forEach((n: any) => n.isPrimary = false);
        }

        p.names.push({ isPrimary: shouldBePrimary, type: draft.type, given, surname, full: `${given} ${surname}`.trim() });

        if (shouldBePrimary) {
            p.firstName = given;
            p.lastName = surname;
            p.name = `${given} ${surname}`.trim();
        }

        this.changed.emit();
        this.showNameCreateModal.set(false);
    }

    removeName(index: number) {
        const p = this.person;
        if (!p) return;
        p.names.splice(index, 1);
        if (p.names.length > 0 && !p.names.some((n: any) => n.isPrimary)) p.names[0].isPrimary = true;
        this.changed.emit();
    }
}
