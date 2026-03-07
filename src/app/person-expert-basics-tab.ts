import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppSectionHeaderComponent } from './ui/app-section-header';

import { AppModalShell } from './ui/app-modal-shell';

@Component({
    selector: 'app-person-expert-basics-tab',
    standalone: true,
    imports: [CommonModule, FormsModule, AppModalShell, AppSectionHeaderComponent],
    template: `
        <div class="glass-card shadow-sm flex flex-col">
            <div class="p-0 space-y-6">
                <div class="glass-card !bg-canvas-white/3 !rounded-2xl !p-5 cursor-pointer hover:bg-canvas-white/5 transition-all"
                    (click)="openBasicsModal()">
                    <app-section-header title="Basisdaten" icon="🧾">
                        <span actions class="text-[10px] uppercase tracking-widest text-neutral-800 dark:text-neutral-200">Klick zum Bearbeiten</span>
                    </app-section-header>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <div class="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest mb-1">Vorname</div>
                            <div class="text-sm text-neutral-800 dark:text-neutral-200">{{ person?.firstName || '-' }}</div>
                        </div>
                        <div>
                            <div class="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest mb-1">Nachname</div>
                            <div class="text-sm text-neutral-800 dark:text-neutral-200">{{ person?.lastName || '-' }}</div>
                        </div>
                        <div>
                            <div class="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest mb-1">Geschlecht</div>
                            <div class="text-sm text-neutral-800 dark:text-neutral-200">{{ genderLabel(person?.gender) }}</div>
                        </div>
                        <div>
                            <div class="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest mb-1">Status</div>
                            <div class="text-sm text-neutral-800 dark:text-neutral-200">{{ person?.isLiving ? 'Lebend' : 'Verstorben' }}</div>
                        </div>
                        <div>
                            <div class="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest mb-1">Datenschutz</div>
                            <div class="text-sm text-neutral-800 dark:text-neutral-200">{{ privacyLabel(person?.privacyLevel) }}</div>
                        </div>
                    </div>

                    <div class="mt-8 border-t border-canvas-white/5 pt-8">
                        <h3 class="text-sm font-semibold mb-3 flex items-center gap-2 text-neutral-800 dark:text-neutral-200">
                            <span class="w-1.5 h-4 bg-canvas-white rounded-full"></span> System-Info
                        </h3>
                        <div class="glass-card !bg-neutral-black/20 p-4 space-y-3 !rounded-xl border !border-canvas-white/5 max-w-2xl">
                            <div class="space-y-2 text-xs text-neutral-400">
                                <div class="flex justify-between items-center" *ngIf="person.createdAt">
                                    <span>Erstellt:</span>
                                    <span class="text-neutral-800 dark:text-neutral-200">{{ person.createdAt | date:'dd.MM.yyyy HH:mm' }}</span>
                                </div>
                                <div class="flex justify-between items-center" *ngIf="person.updatedAt">
                                    <span>Zuletzt geändert:</span>
                                    <span class="text-neutral-800 dark:text-neutral-200">{{ person.updatedAt | date:'dd.MM.yyyy HH:mm' }}</span>
                                </div>
                                <div class="flex justify-between items-center" *ngIf="person.chanDate">
                                    <span>Letzte GEDCOM Änd.:</span>
                                    <span class="text-neutral-800 dark:text-neutral-200">{{ person.chanDate | date:'dd.MM.yyyy' }}</span>
                                </div>
                                <div class="flex justify-between items-center pt-2 mt-2 border-t border-canvas-white/5">
                                    <span>Ex-ID:</span>
                                    <span class="font-mono text-accent-highlight-400">{{ person.exid || '-' }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="pt-2 flex justify-end">
                    <button type="button" (click)="requestDelete($event)"
                        class="p-2 rounded-lg text-accent-danger-400 hover:bg-accent-danger-500/10 transition-all"
                        title="Person löschen">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>

        <app-modal-shell [visible]="showBasicsModal" title="Basisdaten bearbeiten" icon="🧾" size="md"
            [showSave]="true" saveText="Speichern" [showDelete]="false"
            (close)="closeBasicsModal()" (save)="saveBasicsModal()">
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="form-group mb-0">
                        <label class="form-label">Vorname</label>
                        <input type="text" [(ngModel)]="draft.firstName" class="form-input">
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label">Nachname</label>
                        <input type="text" [(ngModel)]="draft.lastName" class="form-input">
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="form-group mb-0">
                        <label class="form-label">Geschlecht</label>
                        <select [(ngModel)]="draft.gender" class="form-input !py-2.5">
                            <option value="M">Männlich</option>
                            <option value="F">Weiblich</option>
                            <option value="X">Divers</option>
                            <option value="U">Unbekannt</option>
                        </select>
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label">Status</label>
                        <select [(ngModel)]="draft.isLiving" class="form-input !py-2.5">
                            <option [ngValue]="true">Lebend</option>
                            <option [ngValue]="false">Verstorben</option>
                        </select>
                    </div>
                    <div class="form-group mb-0">
                        <label class="form-label">Datenschutz</label>
                        <select [(ngModel)]="draft.privacyLevel" class="form-input !py-2.5">
                            <option value="PUBLIC">Öffentlich</option>
                            <option value="FAMILY">Familie</option>
                            <option value="PRIVATE">Privat</option>
                        </select>
                    </div>
                </div>
            </div>
        </app-modal-shell>
    `
})
export class PersonExpertBasicsTabComponent {
    @Input({ required: true }) person!: any;
    @Output() changed = new EventEmitter<void>();
    @Output() deleteRequested = new EventEmitter<void>();

    showBasicsModal = false;
    draft: any = {
        gender: 'U',
        isLiving: true,
        privacyLevel: 'PRIVATE',
        firstName: '',
        lastName: ''
    };

    genderLabel(gender?: string): string {
        if (gender === 'M') return 'Männlich';
        if (gender === 'F') return 'Weiblich';
        if (gender === 'X') return 'Divers';
        return 'Unbekannt';
    }

    privacyLabel(level?: string): string {
        if (level === 'PUBLIC') return 'Öffentlich';
        if (level === 'FAMILY') return 'Familie';
        return 'Privat';
    }

    openBasicsModal() {
        this.draft.firstName = this.person?.firstName || '';
        this.draft.lastName = this.person?.lastName || '';
        this.draft.gender = this.person?.gender || 'U';
        this.draft.isLiving = !!this.person?.isLiving;
        this.draft.privacyLevel = this.person?.privacyLevel || 'PRIVATE';
        this.showBasicsModal = true;
    }

    closeBasicsModal() {
        this.showBasicsModal = false;
    }

    saveBasicsModal() {
        this.person.firstName = this.draft.firstName || '';
        this.person.lastName = this.draft.lastName || '';
        this.person.gender = this.draft.gender;
        this.person.isLiving = this.draft.isLiving;
        this.person.privacyLevel = this.draft.privacyLevel;
        this.changed.emit();
        this.showBasicsModal = false;
    }

    requestDelete(event: MouseEvent) {
        event.stopPropagation();
        this.deleteRequested.emit();
    }
}
