import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin, of, switchMap, tap } from 'rxjs';
import { Individual, TreeData, Family, TimelineItem } from '../../core/models/models';
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
    readonly treeData = signal<TreeData | null>(null);
    readonly loading = signal<boolean>(false);
    readonly isSaving = signal<boolean>(false);
    readonly isDirty = signal<boolean>(false);
    readonly timeline = signal<TimelineItem[]>([]);
    readonly relations = signal<{ type: string; personId: string; personName?: string; familyId?: string }[]>([]);
    readonly activeTab = signal<'basics' | 'timeline' | 'relations' | 'media' | 'notes' | 'citations' | 'dna'>('basics');
    readonly availableSources = signal<any[]>([]);

    // --- Computed ---
    readonly profileImageUrl = computed(() => {
        const p = this.person();
        if (!p) return null;
        const rawUrl = (p.profileImageUrl && p.profileImageUrl.trim() !== '') 
            ? p.profileImageUrl 
            : (p.media && p.media.length > 0) 
                ? (p.media.find((m: any) => m.isPrimary)?.id || p.media[0].id)
                : null;
        if (!rawUrl) return null;
        if (rawUrl.startsWith('http') || rawUrl.startsWith('/') || rawUrl.startsWith('assets/')) return rawUrl;
        return this.mediaService.getMediaUrl(rawUrl, 'thumbs');
    });

    readonly participations = computed(() => {
        return this.personTimelineService.getParticipations(this.personId(), this.treeData());
    });

    readonly allPersonsOptions = computed(() => {
        const data = this.treeData();
        if (!data || !data.individuals) return [];
        return data.individuals.map(ind => ({
            id: ind.id,
            displayName: `${this.personTimelineService.getPrimaryName(ind)} (${ind.id})`
        })).sort((a, b) => a.displayName.localeCompare(b.displayName));
    });

    // --- Actions ---
    init(id: string) {
        this.personId.set(id);
        this.loadPersonData();
    }

    setActiveTab(tab: any) {
        this.activeTab.set(tab);
    }

    markDirty() {
        this.isDirty.set(true);
    }

    loadPersonData() {
        const id = this.personId();
        const treeName = this.authService.currentTree()?.name;
        if (!id || !treeName) return;

        this.loading.set(true);
        forkJoin({
            tree: this.treeService.getTreeData(treeName),
            children: this.personService.getChildren(treeName, id),
            spouses: this.personService.getSpouses(treeName, id),
            parents: this.personService.getParents(treeName, id)
        }).subscribe({
            next: (results: any) => {
                const data = results.tree;
                if (data) {
                    this.treeData.set(data);
                    this.loadAvailableSources();
                    const copy = this.personService.mapRawDataToIndividual(results, data, id);
                    if (copy) {
                        this.person.set(copy);
                        this.buildRelations();
                    } else {
                        this.router.navigate(['/persons']);
                    }
                }
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Error loading person data', err);
                this.loading.set(false);
                this.router.navigate(['/persons']);
            }
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

    private buildRelations() {
        const p = this.person();
        const data = this.treeData();
        if (!p || !data) return;

        const { relations, enrichedPerson } = this.personTimelineService.enrichPersonRelations(p, data);
        this.relations.set(relations);
        this.person.set(enrichedPerson);
        this.buildTimeline();
    }

    private buildTimeline() {
        const p = this.person();
        const data = this.treeData();
        if (!p || !data) return;
        const merged = this.personTimelineService.buildTimeline(p, data, (id: string) => this.personTimelineService.getPersonName(data, id));
        this.timeline.set(merged);
    }

    savePerson() {
        const p = this.person();
        const treeSnapshot = this.treeData();
        if (!p || !treeSnapshot) return;

        this.isSaving.set(true);
        const treeName = treeSnapshot.meta?.tree || '';
        
        // Prepare family events
        const changedFamilies = new Map<string, Family>();
        this.timeline().forEach((t) => {
            if (t.originalType !== 'family-event' || !t.familyId || t.originalIndex < 0) return;
            const sourceFamily = treeSnapshot.families.find(f => f.id === t.familyId);
            if (!sourceFamily) return;
            if (!changedFamilies.has(t.familyId)) changedFamilies.set(t.familyId, JSON.parse(JSON.stringify(sourceFamily)));
            const targetFamily = changedFamilies.get(t.familyId)!;
            targetFamily.events = targetFamily.events || [];
            const targetEvent = targetFamily.events[t.originalIndex];
            if (!targetEvent) return;
            targetEvent.date = t.date || '';
            targetEvent.place = t.place || '';
            targetEvent.description = t.description || '';
            (targetEvent as any).media = t.media || [];
            (targetEvent as any).notes = t.notes || [];
            (targetEvent as any).citations = t.citations || [];
        });

        const payload = this.personService.prepareSavePayload(p, this.timeline(), this.relations());
        const saveFamilies$ = changedFamilies.size > 0
            ? forkJoin(Array.from(changedFamilies.values()).map(f => this.familyService.saveFamily(treeName, f)))
            : of([]);

        saveFamilies$.pipe(
            switchMap(() => this.personService.savePerson(treeName, payload))
        ).subscribe({
            next: () => {
                this.isSaving.set(false);
                this.isDirty.set(false);
                this.loadPersonData();
            },
            error: (err) => {
                this.isSaving.set(false);
                console.error('Speicherfehler Details:', err);
                alert('Fehler beim Speichern: ' + (err.error?.message || 'Unbekannter Fehler'));
            }
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
