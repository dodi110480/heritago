import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin, of, tap, switchMap, catchError } from 'rxjs';
import { Family, Individual, TreeData } from '../../core/models/models';
import { FamilyService } from '../../core/services/family.service';
import { TreeService } from '../../core/services/tree.service';
import { MediaService } from '../../core/services/media.service';
import { AuthService } from '../../core/services/auth.service';
import { SourceService } from '../../core/services/source.service';

@Injectable()
export class FamilyFeatureStore {
    private familyService = inject(FamilyService);
    private treeService = inject(TreeService);
    private mediaService = inject(MediaService);
    private authService = inject(AuthService);
    private sourceService = inject(SourceService);
    private router = inject(Router);

    // --- State ---
    familyId = signal<string | null>(null);
    family = signal<Family | null>(null);
    individuals = signal<Individual[]>([]);
    loading = signal(true);
    isSaving = signal(false);
    isDirty = signal(false);
    activeTab = signal<'basics' | 'children' | 'events' | 'notes' | 'citations' | 'media'>('basics');
    availableSources = signal<any[]>([]);

    // --- Computed ---
    treeId = computed(() => this.authService.currentTree()?.name || '');
    
    familyChildren = computed(() => {
        const fam = this.family();
        if (!fam || !fam.children) return [];
        return fam.children
            .map(id => this.individuals().find(i => i.id === id))
            .filter((p): p is Individual => !!p);
    });

    // --- Methods ---
    init(id: string) {
        this.familyId.set(id);
        this.loadData();
    }

    loadData() {
        this.loading.set(true);
        this.treeService.getTreeData().subscribe({
            next: (data) => {
                if (data) {
                    this.individuals.set(data.individuals);
                    this.loadAvailableSources();
                    const fam = data.families.find(f => f.id === this.familyId());
                    if (fam) {
                        const clonedFam = JSON.parse(JSON.stringify(fam));
                        this.sanitizeFamilyData(clonedFam);
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

    loadAvailableSources() {
        const treeName = this.authService.currentTree()?.name;
        if (treeName) {
            this.sourceService.getSources(treeName).subscribe({
                next: (res: any) => {
                    if (res.success) this.availableSources.set(res.sources || []);
                }
            });
        }
    }

    private sanitizeFamilyData(fam: any) {
        if (fam.events) {
            fam.events.forEach((e: any) => {
                if (!e.dateText && e.date) e.dateText = e.date;
                if (!e.place && e.placeName) e.place = e.placeName;
                if (!e.subType && e.eventSubtype) e.subType = e.eventSubtype;
                if (!Array.isArray(e.media)) e.media = [];
                if (!Array.isArray(e.notes)) e.notes = [];
                if (!Array.isArray(e.citations)) e.citations = [];
                if (!e.associations) e.associations = [];
            });
        }
        if (!Array.isArray(fam.notes)) fam.notes = [];
        if (!Array.isArray(fam.media)) fam.media = [];
        if (!Array.isArray(fam.citations)) fam.citations = [];
        if (!Array.isArray(fam.children)) fam.children = [];
    }

    saveFamily() {
        const fam = this.family();
        const treeName = this.authService.currentTree()?.name;
        if (!fam || !treeName) return;

        this.isSaving.set(true);
        // We use the same saveFamily method in the service
        this.familyService.saveFamily(treeName, fam).subscribe({
            next: (res) => {
                if (res.success) {
                    this.isDirty.set(false);
                    // Reload to get potential server-side enrichments
                    this.loadData();
                }
                this.isSaving.set(false);
            },
            error: () => this.isSaving.set(false)
        });
    }

    deleteFamily() {
        // Implementation of delete logic if needed
        // For now, it seems FamilyDetail doesn't have a delete button in the UI shown in HTML, 
        // but PersonDetail did. I'll add it just in case.
    }

    setActiveTab(tab: any) {
        this.activeTab.set(tab);
    }

    markDirty() {
        this.isDirty.set(true);
    }

    // --- Data Helpers for Tabs ---
    getPersonById(id: string | undefined): Individual | undefined {
        if (!id) return undefined;
        return this.individuals().find(i => i.id === id);
    }

    getPersonName(id: string | undefined): string {
        const p = this.getPersonById(id);
        if (!p) return 'Unbekannt';
        return `${p.firstName} ${p.lastName}`;
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
}
