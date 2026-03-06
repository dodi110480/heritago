import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { Individual, Family } from './models';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { AppPageHeaderComponent } from './ui/app-page-header';
import { AppAvatarComponent } from './ui/app-avatar';

import { AppModalShell } from './ui/app-modal-shell';
import { FamilyEventCardComponent } from './family-event-card';
import { AppEmptyStateComponent } from './ui/app-empty-state';
import { AppSectionHeaderComponent } from './ui/app-section-header';

@Component({
    selector: 'app-family-detail',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        AppPageHeaderComponent,
        AppModalShell,
        FamilyEventCardComponent,
        AppAvatarComponent,
        AppEmptyStateComponent,
        AppSectionHeaderComponent
    ],
    templateUrl: './family-detail.html'
})
export class FamilyDetail implements OnInit, OnDestroy {
    private gedcomService = inject(GedcomService);
    private authService = inject(AuthService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    familyId = signal<string | null>(null);
    family = signal<Family | null>(null);
    individuals = signal<Individual[]>([]);
    loading = signal(true);
    isDirty = signal(false);
    isSaving = signal(false);
    availableSources = signal<any[]>([]);

    // Modal: Kind hinzufügen
    showAddChildModal = signal(false);
    addChildQuery = '';
    addChildResults = signal<Individual[]>([]);
    selectedChildId = signal<string | null>(null);
    addChildError = signal<string | null>(null);

    // Modal: Abbrechen bestätigen
    showCancelConfirmModal = signal(false);

    private sub = new Subscription();

    ngOnInit() {
        this.sub.add(
            this.route.params.subscribe(params => {
                this.familyId.set(params['id']);
                this.loadData();
            })
        );
    }

    ngOnDestroy() {
        this.sub.unsubscribe();
    }

    loadData() {
        this.loading.set(true);
        this.gedcomService.getTreeData().subscribe({
            next: (data) => {
                if (data) {
                    this.individuals.set(data.individuals);
                    const treeName = data.meta?.tree;
                    if (treeName) {
                        this.gedcomService.getSources(treeName).subscribe({
                            next: (res: any) => {
                                if (res.success) this.availableSources.set(res.sources || []);
                            }
                        });
                    }
                    const fam = data.families.find(f => f.id === this.familyId());
                    if (fam) {
                        const clonedFam = JSON.parse(JSON.stringify(fam));
                        if (clonedFam.events) {
                            clonedFam.events.forEach((e: any) => {
                                if (!e.dateText && e.date) e.dateText = e.date;
                                if (!e.place && e.placeName) e.place = e.placeName;
                                if (!e.subType && e.eventSubtype) e.subType = e.eventSubtype;
                                if (!Array.isArray(e.media)) e.media = [];
                                if (!Array.isArray(e.notes)) e.notes = [];
                                if (!Array.isArray(e.citations)) e.citations = [];
                            });
                        }
                        if (!Array.isArray(clonedFam.notes)) clonedFam.notes = [];
                        this.family.set(clonedFam);
                    } else {
                        this.router.navigate(['/families']);
                    }
                }
                this.loading.set(false);
            },
            error: () => this.loading.set(false)
        });
    }

    getPersonById(id: string | undefined): Individual | undefined {
        if (!id) return undefined;
        return this.individuals().find(i => i.id === id);
    }

    getPersonName(id: string | undefined): string {
        const p = this.getPersonById(id);
        if (!p) return 'Unbekannt';
        return `${p.firstName} ${p.lastName}`;
    }

    getPersonImage(id: string | undefined): string {
        const p = this.getPersonById(id);
        if (!p) return 'assets/avatars/unknown.svg';
        if (p.media && p.media.length > 0) {
            const primary = p.media.find(m => m.isPrimary) || p.media[0];
            if (primary?.url) return this.gedcomService.getMediaUrl(primary.url);
        }
        const gender = p.gender === 'M' ? 'male' : (p.gender === 'F' ? 'female' : 'unknown');
        return `assets/avatars/${gender}.svg`;
    }

    getPersonGender(id: string | undefined): string {
        const p = this.getPersonById(id);
        return p?.gender || 'U';
    }

    getMarriageInfo(): string {
        const fam = this.family();
        if (!fam || !fam.events) return '';
        const marr = fam.events.find(e => e.type === 'MARR');
        if (!marr) return '';
        const date = marr.date || (marr as any).dateText || '';
        const place = marr.place || (marr as any).placeName || '';
        return date + (place ? ` in ${place}` : '');
    }

    addEvent() {
        const fam = this.family();
        if (!fam) return;
        if (!fam.events) fam.events = [];
        fam.events.push({ type: 'MARR', subType: '', dateText: '', place: '', isPrimary: false });
        this.isDirty.set(true);
    }

    removeEvent(index: number) {
        const fam = this.family();
        if (!fam || !fam.events) return;
        fam.events.splice(index, 1);
        this.isDirty.set(true);
    }

    updateEvent() {
        const fam = this.family();
        if (fam?.events) {
            for (const ev of fam.events) {
                if (ev.type !== 'MARR') ev.subType = '';
                if (!ev.media) ev.media = [];
                if (!ev.notes) ev.notes = [];
                if (!ev.citations) ev.citations = [];
            }
        }
        this.isDirty.set(true);
    }

    addNote() {
        const fam = this.family() as any;
        if (!fam) return;
        if (!Array.isArray(fam.notes)) fam.notes = [];
        fam.notes.push({ text: '', noteType: 'GENERAL', researchStatus: 'OPEN', privacyLevel: 'PRIVATE' });
        this.isDirty.set(true);
    }

    removeNote(index: number) {
        const fam = this.family() as any;
        if (!fam?.notes) return;
        fam.notes.splice(index, 1);
        this.isDirty.set(true);
    }

    // ── Kind hinzufügen (Modal-Pattern) ──────────────────────────────────────
    openAddChildModal() {
        this.addChildQuery = '';
        this.addChildResults.set([]);
        this.selectedChildId.set(null);
        this.addChildError.set(null);
        this.showAddChildModal.set(true);
    }

    selectChildCandidate(person: Individual) {
        this.selectedChildId.set(person.id);
    }

    confirmAddChild() {
        this.addChildError.set(null);
        const fam = this.family();
        if (!fam) return;
        if (!fam.children) fam.children = [];

        const query = (this.addChildQuery || '').trim().toLowerCase();
        if (!query) {
            this.addChildError.set('Bitte einen Namen oder eine ID eingeben.');
            return;
        }

        const existing = new Set<string>([
            ...(fam.children || []),
            fam.husband || '',
            fam.wife || ''
        ].filter(Boolean));

        const candidates = this.individuals().filter(p => {
            const id = (p.id || '').toLowerCase();
            const name = `${p.firstName || ''} ${p.lastName || ''}`.trim().toLowerCase();
            return id === query || name.includes(query);
        });

        if (candidates.length === 0) {
            this.addChildResults.set([]);
            this.addChildError.set('Keine passende Person gefunden.');
            return;
        }

        // Wenn mehrere Treffer: anzeigen und warten
        if (candidates.length > 1 && !this.selectedChildId()) {
            this.addChildResults.set(candidates.slice(0, 10));
            return;
        }

        const selected = this.selectedChildId()
            ? candidates.find(c => c.id === this.selectedChildId()) || candidates[0]
            : candidates[0];

        if (existing.has(selected.id)) {
            this.addChildError.set('Diese Person ist bereits in der Familie verknüpft.');
            return;
        }

        fam.children.push(selected.id);
        this.isDirty.set(true);
        this.showAddChildModal.set(false);
    }

    removeChild(childId: string) {
        const fam = this.family();
        if (!fam || !fam.children) return;
        fam.children = fam.children.filter(id => id !== childId);
        this.isDirty.set(true);
    }

    // ── Speichern / Abbrechen ─────────────────────────────────────────────────
    save() {
        const fam = this.family();
        const tree = this.authService.currentTree();
        if (!fam || !tree || this.isSaving()) return;

        this.isSaving.set(true);
        this.gedcomService.saveFamily(tree.name, fam).subscribe({
            next: (res) => {
                this.isDirty.set(false);
                this.isSaving.set(false);
                if (res.family?.deleted) {
                    this.router.navigate(['/families']);
                } else {
                    this.loadData();
                }
            },
            error: (err) => {
                this.isSaving.set(false);
                // TODO: Fehlermeldung via Toast
                console.error('Speichern fehlgeschlagen:', err?.error?.message);
            }
        });
    }

    requestCancel() {
        if (this.isDirty()) {
            this.showCancelConfirmModal.set(true);
        } else {
            this.router.navigate(['/families']);
        }
    }

    confirmCancel() {
        this.router.navigate(['/families']);
    }
}
