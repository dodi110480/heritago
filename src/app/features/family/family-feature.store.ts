import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin, of, tap, switchMap, catchError } from 'rxjs';
import { Family, Individual, TreeData } from '../../core/models/models';
import { personOptionLabel } from '../../shared/utils/person-autocomplete';
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
    allIndividuals = signal<any[]>([]);
    searchResults = signal<any[]>([]);
    loading = signal(true);
    isSaving = signal(false);
    activeTab = signal<'basics' | 'children' | 'events' | 'notes' | 'citations' | 'media'>('basics');
    availableSources = signal<any[]>([]);

    // --- Computed ---
    treeId = computed(() => this.authService.currentTree()?.name || '');
    
    familyChildren = computed(() => {
        const fam = this.family();
        if (!fam) return [];
        return this.individuals().filter(ind => fam.children?.includes(ind.id));
    });

    allPersonsSignal = computed(() => {
        const base = this.searchResults().length > 0 ? this.searchResults() : this.allIndividuals();
        return base.map((ind: any) => {
            const opt = {
                id: ind.id,
                gedcomId: ind.gedcomId,
                name: ind.name,
                gender: ind.gender,
                birthDate: ind.birthDate,
                deathDate: ind.deathDate
            };

            return {
                ...opt,
                displayName: personOptionLabel({
                    id: opt.id,
                    displayName: opt.name,
                    birthDate: opt.birthDate,
                    deathDate: opt.deathDate
                })
            };
        });
    });

    // --- Methods ---
    init(id: string) {
        this.familyId.set(id);
        this.loadData();
    }

    loadData() {
        const treeName = this.authService.currentTree()?.name;
        if (!treeName || !this.familyId()) return;

        this.loading.set(true);
        this.familyService.getFullProfile(treeName, this.familyId()!).subscribe({
            next: (data) => {
                if (data && data.family) {
                    this.individuals.set(data.members || []);
                    const fam = data.family;
                    this.family.set(fam);
                    this.loadAvailableSources();

                    // Load all individuals for search
                    this.treeService.getMinimalIndividuals(treeName).subscribe(inds => {
                        this.allIndividuals.set(inds);
                    });
                } else {
                    this.router.navigate(['/families']);
                }
                this.loading.set(false);
            },
            error: () => this.loading.set(false)
        });
    }

    searchPersons(query: string) {
        const treeName = this.authService.currentTree()?.name;
        if (!treeName || !query || query.length < 2) {
            this.searchResults.set([]);
            return;
        }

        this.treeService.searchIndividuals(treeName, query).subscribe(results => {
            this.searchResults.set(results);
        });
    }

    loadAvailableSources() {
        const treeName = this.authService.currentTree()?.name;
        if (treeName) {
            this.sourceService.getSources(treeName).subscribe({
                next: (res: any) => {
                    const sources = res.success ? (res.sources || res.data || []) : [];
                    this.availableSources.set(sources);
                }
            });
        }
    }


    saveFamily() {
        const fam = this.family();
        const treeName = this.authService.currentTree()?.name;
        if (!fam || !treeName) return;

        this.isSaving.set(true);
        this.familyService.saveFamily(treeName, fam).subscribe({
            next: (res) => {
                if (res) {
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
    }

    setActiveTab(tab: any) {
        this.activeTab.set(tab);
    }

    // --- Data Helpers for Tabs ---
    getPersonById(id: string | undefined): Individual | undefined {
        if (!id) return undefined;
        return this.individuals().find(i => i.id === id);
    }

    getPersonName(id: string | undefined): string {
        const p = this.getPersonById(id);
        if (!p) return 'Unbekannt';
        return p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unbekannt';
    }

    getPersonGender(id: string | undefined): string {
        const p = this.getPersonById(id);
        return p?.gender || 'U';
    }
}
