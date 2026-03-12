import { Component, Input, Output, EventEmitter, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Individual, TreeData } from '../../core/models/models';
import { PersonTimelineService } from './person-timeline.service';
import { AppSectionHeaderComponent } from '../../shared/components/ui/app-section-header';
import { AppModalShell } from '../../shared/components/ui/app-modal-shell';
import { CleanDatePipe } from '../../shared/pipes/clean-date.pipe';

@Component({
    selector: 'app-person-tab-basics',
    standalone: true,
    imports: [CommonModule, FormsModule, AppSectionHeaderComponent, AppModalShell],
    template: `
        <div class="space-y-6">
            <div class="glass-card !bg-canvas-white/3 !rounded-2xl !p-6 relative overflow-hidden animate-in zoom-in-95 duration-300">
                <div class="p-0 space-y-6">
                    <app-section-header title="Basisdaten" icon="🧾"></app-section-header>

                    <!-- Profile Image (Floating Top Right) -->
                    <div class="absolute top-4 right-4 w-32 h-32 md:w-40 md:h-40 group cursor-pointer"
                         (click)="mediaTabRequested.emit()">
                        <div class="w-full h-full border border-canvas-white/10 overflow-hidden bg-neutral-900/40 rounded-2xl shadow-lg transition-all duration-300 group-hover:shadow-brand-500/10 group-hover:border-brand-500/20">
                            <img *ngIf="profileImageUrl" [src]="profileImageUrl" 
                                 class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                 alt="Profilbild">
                            <div *ngIf="!profileImageUrl" class="w-full h-full flex flex-col items-center justify-center text-neutral-600 bg-neutral-100/5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-10">
                                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </div>
                            <!-- Edit Overlay -->
                            <div class="absolute inset-0 bg-brand-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                <span class="text-[9px] font-bold text-white uppercase tracking-widest bg-brand-600/80 px-2 py-1 rounded shadow-lg">Bearbeiten</span>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        <!-- Left: Data -->
                        <div class="lg:col-span-8 cursor-pointer hover:bg-canvas-white/5 transition-all p-4 rounded-xl border border-transparent hover:border-canvas-white/10"
                            (click)="openBasicsModal()">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <div>
                                    <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1 opacity-60">Vorname</div>
                                    <div class="text-base font-semibold text-neutral-800 dark:text-neutral-100">{{ person.firstName || '-' }}</div>
                                </div>
                                <div>
                                    <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1 opacity-60">Nachname</div>
                                    <div class="text-base font-semibold text-neutral-800 dark:text-neutral-100">{{ person.lastName || '-' }}</div>
                                </div>
                                <div>
                                    <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1 opacity-60">Geschlecht</div>
                                    <div class="text-sm font-medium text-neutral-800 dark:text-neutral-200">{{ genderLabel(person.gender) }}</div>
                                </div>
                                <div>
                                    <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1 opacity-60">Status</div>
                                    <div class="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-500/5 border border-neutral-500/10">
                                            <span class="w-1.5 h-1.5 rounded-full" [class]="person.isLiving ? 'bg-accent-success-500' : 'bg-neutral-400'"></span>
                                            {{ person.isLiving ? 'Lebend' : 'Verstorben' }}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1 opacity-60">Datenschutz</div>
                                    <div class="text-sm font-medium text-neutral-800 dark:text-neutral-200 text-brand-600 dark:text-brand-400">{{ privacyLabel(person.privacyLevel) }}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Participations -->
                    <div class="mt-8 border-t border-canvas-white/5 pt-8" *ngIf="participations && participations.length > 0">
                        <h3 class="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 text-neutral-500">
                            <span class="w-1 h-3 bg-brand-500 rounded-full"></span> Beteiligt als...
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div *ngFor="let part of participations" class="glass-card !bg-neutral-black/10 !p-4 !rounded-xl border !border-canvas-white/5 flex items-start gap-4 hover:bg-neutral-black/20 transition-all">
                                <div class="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-lg shadow-inner">
                                    {{ getRoleIcon(part.role) }}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-bold text-neutral-800 dark:text-neutral-200 truncate">
                                        {{ getRoleLabel(part.role) }}
                                    </p>
                                    <p class="text-[11px] text-neutral-500 font-medium">
                                        {{ getEventLabel(part.eventTag) }} • {{ part.subjectPersonName }} 
                                        <span *ngIf="part.eventDate" class="opacity-50 ml-1">({{ part.eventDate }})</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer with System Info and Delete Button -->
                    <div class="pt-8 flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-t border-canvas/5">
                        <div class="flex flex-wrap gap-x-8 gap-y-3 text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                            <div class="flex items-center gap-2">
                                <span class="opacity-40">Erstellt:</span>
                                <span class="text-neutral-600 dark:text-neutral-400 font-medium">{{ person.createdAt | date:'dd.MM.yyyy HH:mm' }}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="opacity-40">Geändert:</span>
                                <span class="text-neutral-600 dark:text-neutral-400 font-medium">{{ person.updatedAt | date:'dd.MM.yyyy HH:mm' }}</span>
                            </div>
                            <div class="flex items-center gap-2" *ngIf="person.exid">
                                <span class="opacity-40">Ex-ID:</span>
                                <span class="font-mono text-accent-highlight-500 font-semibold">{{ person.exid }}</span>
                            </div>
                        </div>

                        <button type="button" (click)="deleteRequested.emit()"
                            class="p-2.5 rounded-xl text-accent-danger-500/40 hover:text-accent-danger-500 hover:bg-accent-danger-500/10 transition-all border border-transparent hover:border-accent-danger-500/20 shadow-sm"
                            title="Person löschen">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
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
                            <input type="text" [(ngModel)]="basicsDraft.firstName" class="form-input">
                        </div>
                        <div class="form-group mb-0">
                            <label class="form-label">Nachname</label>
                            <input type="text" [(ngModel)]="basicsDraft.lastName" class="form-input">
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="form-group mb-0">
                            <label class="form-label">Geschlecht</label>
                            <select [(ngModel)]="basicsDraft.gender" class="form-input !py-2.5">
                                <option value="M">Männlich</option>
                                <option value="F">Weiblich</option>
                                <option value="X">Divers</option>
                                <option value="U">Unbekannt</option>
                            </select>
                        </div>
                        <div class="form-group mb-0">
                            <label class="form-label">Status</label>
                            <select [(ngModel)]="basicsDraft.isLiving" class="form-input !py-2.5">
                                <option [ngValue]="true">Lebend</option>
                                <option [ngValue]="false">Verstorben</option>
                            </select>
                        </div>
                        <div class="form-group mb-0">
                            <label class="form-label">Datenschutz</label>
                            <select [(ngModel)]="basicsDraft.privacyLevel" class="form-input !py-2.5">
                                <option value="PUBLIC">Öffentlich</option>
                                <option value="FAMILY">Familie</option>
                                <option value="PRIVATE">Privat</option>
                            </select>
                        </div>
                    </div>
                </div>
            </app-modal-shell>
        </div>
    `
})
export class PersonTabBasicsComponent {
    @Input({ required: true }) person!: any;
    @Input() profileImageUrl: string | null = null;
    @Input() participations: any[] = [];
    @Output() changed = new EventEmitter<void>();
    @Output() mediaTabRequested = new EventEmitter<void>();
    @Output() deleteRequested = new EventEmitter<void>();

    private personTimelineService = inject(PersonTimelineService);

    showBasicsModal = false;
    basicsDraft: any = {
        gender: 'U',
        isLiving: true,
        privacyLevel: 'PRIVATE',
        firstName: '',
        lastName: ''
    };

    genderLabel = (gender?: string) => this.personTimelineService.genderLabel(gender);
    privacyLabel = (level?: string) => this.personTimelineService.privacyLabel(level);
    getRoleLabel = (role: string) => this.personTimelineService.getRoleLabel(role);
    getRoleIcon = (role: string) => this.personTimelineService.getRoleIcon(role);
    getEventLabel = (tag: string) => this.personTimelineService.getEventLabel(tag);

    openBasicsModal() {
        this.basicsDraft.firstName = this.person.firstName || '';
        this.basicsDraft.lastName = this.person.lastName || '';
        this.basicsDraft.gender = this.person.gender || 'U';
        this.basicsDraft.isLiving = !!this.person.isLiving;
        this.basicsDraft.privacyLevel = this.person.privacyLevel || 'PRIVATE';
        this.showBasicsModal = true;
    }

    closeBasicsModal() {
        this.showBasicsModal = false;
    }

    saveBasicsModal() {
        this.person.firstName = this.basicsDraft.firstName || '';
        this.person.lastName = this.basicsDraft.lastName || '';
        this.person.gender = this.basicsDraft.gender;
        this.person.isLiving = this.basicsDraft.isLiving;
        this.person.privacyLevel = this.basicsDraft.privacyLevel;
        this.changed.emit();
        this.showBasicsModal = false;
    }
}
