import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin, of, switchMap, tap } from 'rxjs';
import { Individual, TreeData, Family, TimelineItem } from '../../core/models/models';
import { personOptionLabel } from '../../shared/utils/person-autocomplete';
import { PersonService } from '../../core/services/person.service';
import { FamilyService } from '../../core/services/family.service';
import { TreeService } from '../../core/services/tree.service';
import { PersonTimelineService } from './person-timeline.service';
import { MediaService } from '../../core/services/media.service';
import { AuthService } from '../../core/services/auth.service';
import { SourceService } from '../../core/services/source.service';

@Injectable()
export class PersonFeatureStore {
    private personService = inject(PersonService);
    private familyService = inject(FamilyService);
    private treeService = inject(TreeService);
    private personTimelineService = inject(PersonTimelineService);
    private mediaService = inject(MediaService);
    private authService = inject(AuthService);
    private sourceService = inject(SourceService);
    private router = inject(Router);

    // --- State ---
    readonly personId = signal<string>('');
    readonly person = signal<Individual | null>(null);
    readonly loading = signal<boolean>(false);
    readonly isSaving = signal<boolean>(false);
    readonly timeline = signal<TimelineItem[]>([]);
    readonly relations = signal<{ 
        type: string; 
        personId: string; 
        personName?: string; 
        familyId?: string; 
        familyMemberId?: string;
        pedigreeType?: string;
        isPrimary?: boolean;
        marriageType?: string;
        weddingInfo?: string;
        weddingEvent?: any;
        notes?: any[];
        citations?: any[];
        restrictionNotice?: string;
    }[]>([]);
    readonly activeTab = signal<'basics' | 'timeline' | 'relations' | 'media' | 'notes' | 'citations' | 'dna'>('basics');
    readonly availableSources = signal<any[]>([]);
    readonly minimalIndividuals = signal<any[]>([]);
    readonly searchResults = signal<any[]>([]);
    readonly saveError = signal<string | null>(null);
    readonly validationIssues = signal<any[]>([]);

    // --- Computed ---
    readonly profileImageUrl = computed(() => {
        const p = this.person();
        if (!p || !p.profileImageUrl) return null;
        if (p.profileImageUrl.startsWith('http') || p.profileImageUrl.startsWith('/') || p.profileImageUrl.startsWith('assets/')) return p.profileImageUrl;
        return this.mediaService.getMediaUrl(p.profileImageUrl, 'thumbs');
    });

    readonly participations = computed(() => {
        return this.timeline().filter(t => t.originalType === 'participation');
    });

    readonly isSearching = signal<boolean>(false);

    readonly allPersonsSignal = computed(() => {
        const results = this.searchResults();
        console.log('[Store] allPersonsSignal updating. Results:', results.length, 'isSearching:', this.isSearching());

        // If we are searching or have results, use results (even if empty)
        // Otherwise, show minimalIndividuals as a starting point
        const base = (this.isSearching() || results.length > 0) ? results : this.minimalIndividuals();

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
        }).sort((a: any, b: any) => String(a.displayName || '').localeCompare(String(b.displayName || '')));
    });

    // --- Actions ---
    init(id: string) {
        this.personId.set(id);
        this.loadPersonData();
    }

    setActiveTab(tab: any) {
        this.activeTab.set(tab);
    }

    searchPersons(query: string) {
        const treeName = this.authService.currentTree()?.name;
        if (!treeName || !query || query.length < 2) {
            this.searchResults.set([]);
            this.isSearching.set(false);
            return;
        }

        this.isSearching.set(true);
        this.treeService.searchIndividuals(treeName, query).subscribe(results => {
            this.searchResults.set(results);
            // We keep isSearching true so that we continue to show results (even if empty) 
            // until the query is cleared
        });
    }

    loadPersonData() {
        const id = this.personId();
        const treeName = this.authService.currentTree()?.name;
        if (!id || !treeName) return;

        this.loading.set(true);
        this.personService.getFullProfile(treeName, id).subscribe({
            next: (data: any) => {
                if (data) {
                    this.person.set(data.person);
                    this.timeline.set(data.timeline);
                    this.relations.set(data.relations);
                    this.validationIssues.set(Array.isArray(data.validationIssues) ? data.validationIssues : []);
                    
                    // Populate minimalIndividuals fallback with current relations
                    // so they appear in dropdowns even before searching
                    const initialInds = (data.relations || []).map((r: any) => ({
                        id: r.personId,
                        name: r.personName || 'Unbekannt',
                        gender: r.gender
                    }));
                    this.minimalIndividuals.set(initialInds);

                    // Only load sources; minimal individuals is now handled by on-demand search
                    this.treeService.getMinimalSources(treeName).subscribe(sources => {
                        this.availableSources.set(sources);
                    });
                } else {
                    this.router.navigate(['/persons']);
                }
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Error loading person data', err);
                this.validationIssues.set([]);
                this.loading.set(false);
                this.router.navigate(['/persons']);
            }
        });
    }
    updateTimeline(nextTimeline: TimelineItem[]) {
        this.timeline.set(nextTimeline);

        const syncedRelations = this.relations().map((relation: any) => {
            if (relation.type !== "SPOUSE" || !relation.familyId) return relation;
            const match = nextTimeline.find((item: any) => item.originalType === "family-event" && item.familyId === relation.familyId && item.tag === "MARR");
            if (!match) {
                return { ...relation, weddingEvent: undefined, weddingInfo: undefined };
            }

            const weddingInfo = `${match.dateText || match.date || ""}${match.place ? " in " + match.place : ""}`.trim() || undefined;
            return {
                ...relation,
                weddingEvent: {
                    ...(relation.weddingEvent || {}),
                    id: match.id,
                    type: match.tag,
                    dateText: match.dateText || match.date || null,
                    place: match.place || null,
                    placeId: match.placeId || null,
                    description: match.description || null,
                    notes: match.notes || [],
                    citations: match.citations || [],
                    media: match.media || [],
                    showInTimeline: true
                },
                weddingInfo
            };
        });

        this.relations.set(syncedRelations);
    }

    updateRelations(nextRelations: any[]) {
        this.relations.set(nextRelations);

        const currentTimeline = this.timeline();
        const nonWeddingTimeline = currentTimeline.filter((item: any) => !(item.originalType === "family-event" && item.tag === "MARR"));
        const spouseWeddingItems: TimelineItem[] = nextRelations
            .filter((relation: any) => relation.type === "SPOUSE" && relation.familyId)
            .flatMap((relation: any): TimelineItem[] => {
                const weddingEvent = relation.weddingEvent;
                if (!weddingEvent?.showInTimeline && !weddingEvent?.dateText && !weddingEvent?.place && !weddingEvent?.description && !(weddingEvent?.notes?.length) && !(weddingEvent?.citations?.length) && !(weddingEvent?.media?.length)) {
                    return [];
                }

                return [{
                    id: weddingEvent?.id,
                    itemKind: "event",
                    originalType: "family-event",
                    originalIndex: -1,
                    familyId: relation.familyId,
                    tag: "MARR",
                    label: "Heirat",
                    date: weddingEvent?.dateText || null,
                    dateText: weddingEvent?.dateText || null,
                    place: weddingEvent?.place || null,
                    placeId: weddingEvent?.placeId || null,
                    description: weddingEvent?.description || null,
                    age: null,
                    media: weddingEvent?.media || [],
                    notes: weddingEvent?.notes || [],
                    citations: weddingEvent?.citations || [],
                    associations: []
                } as TimelineItem];
            });

        this.timeline.set([...nonWeddingTimeline, ...spouseWeddingItems]);
    }

    savePerson() {
        const p = this.person();
        if (!p) return;

        this.isSaving.set(true);
        this.saveError.set(null);
        const treeName = this.authService.currentTree()?.name || '';

        const payload = {
            ...p,
            id: p.id || this.personId(),
            treeId: p.treeId || this.authService.currentTree()?.id || '',
            timeline: this.timeline(),
            relations: this.relations()
        };

        this.personService.savePerson(treeName, payload).subscribe({
            next: (data: any) => {
                this.isSaving.set(false);
                // Trigger immediate UI refresh by setting a new reference if we have data back,
                // or just call loadPersonData. Backend savePerson returns the updated record.
                if (data) {
                    // Update the local state with the returned full profile
                    this.person.set(data.person);
                    this.timeline.set(data.timeline);
                    this.relations.set(data.relations);
                }
                this.loadPersonData();
            },
            error: (err) => {
                this.isSaving.set(false);
                const msg = err.error?.message || 'Unbekannter Fehler beim Speichern.';
                console.error('Speicherfehler Details:', err);
                this.saveError.set(msg);
                // We keep the alert as a fallback for now, but the UI should show it better
            }
        });
    }

    updatePersonCitations(update: { notes?: any[]; citations?: any[] }) {
        const current = this.person();
        if (!current) return;

        this.person.set({
            ...current,
            notes: update.notes ?? current.notes ?? [],
            citations: update.citations ?? current.citations ?? [],
            formattedCitations: (update.citations ?? current.citations ?? []).map((citation: any) => ({
                ...citation,
                title: citation.sourceTitle || citation.title || "Unbekannte Quelle",
                description: citation.whereInSource || citation.page ? 'Fundstelle: ' + (citation.whereInSource || citation.page) : ''
            }))
        });
    }

    deletePerson(onSuccess: () => void) {
        const tree = this.authService.currentTree();
        const id = this.personId();
        if (!tree || !id) return;

        this.isSaving.set(true);
        this.personService.deletePerson(tree.name, id).subscribe({
            next: (res) => {
                this.isSaving.set(false);
                if (res?.success) onSuccess();
                else alert('Löschen fehlgeschlagen.');
            },
            error: (err) => {
                this.isSaving.set(false);
                alert('Fehler beim Löschen: ' + (err.error?.message || 'Unbekannter Fehler'));
            }
        });
    }
}
