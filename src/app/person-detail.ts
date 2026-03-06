import { Component, inject, signal, computed, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { AuthService } from './auth.service';
import { Individual, TreeData, Family } from './models';
import { CleanDatePipe } from './clean-date.pipe';
import { PlaceModal } from './place-modal';
import { PersonCreateModal } from './person-create-modal';
import { CanComponentDeactivate } from './unsaved-changes.guard';
import { forkJoin, of, switchMap } from 'rxjs';

import { AppPageContainerComponent } from './ui/app-page-container';
import { AppPageHeaderComponent } from './ui/app-page-header';
import { AppModalShell } from './ui/app-modal-shell';
import { PersonExpertBasicsTabComponent } from './person-expert-basics-tab';
import { PersonExpertTimelineTabComponent } from './person-expert-timeline-tab';
import { PersonExpertRelationsTabComponent } from './person-expert-relations-tab';
import { PersonTabMediaComponent } from './person-tab-media';
import { PersonTabNotesComponent } from './person-tab-notes';
import { PersonTabCitationsComponent } from './person-tab-citations';
import { PersonTabNamesComponent } from './person-tab-names';
import { PersonTabAssociationsComponent } from './person-tab-associations';
import { PersonTabDnaComponent } from './person-tab-dna';

interface TimelineItem {
    originalType: 'event' | 'fact' | 'family-event';
    originalIndex: number;
    familyId?: string;
    sourcePersonId?: string;
    sourcePersonName?: string;
    tag: string;
    date?: string;
    place?: string;
    description?: string; // Für Events
    value?: string; // Für Fakten
    // Erweitert für Gramps-Style:
    media?: any[];
    notes?: string[];
    citations?: any[];
    expanded?: boolean;
    editing?: boolean;
}

@Component({
    selector: 'app-person-detail',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CleanDatePipe,
        PlaceModal,
        PersonCreateModal,
        AppPageContainerComponent,
        AppPageHeaderComponent,
        AppModalShell,
        PersonExpertBasicsTabComponent,
        PersonExpertTimelineTabComponent,
        PersonExpertRelationsTabComponent,
        PersonTabMediaComponent,
        PersonTabNotesComponent,
        PersonTabCitationsComponent,
        PersonTabNamesComponent,
        PersonTabAssociationsComponent,
        PersonTabDnaComponent
    ],
    templateUrl: './person-detail.html',
    encapsulation: ViewEncapsulation.None
})
export class PersonDetail implements OnInit, CanComponentDeactivate {
    private readonly FOCUS_PERSON_KEY = 'heritago_last_focus_person';
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private gedcomService = inject(GedcomService);
    private authService = inject(AuthService);
    readonly self = this;

    personId = '';
    person = signal<Individual | null>(null);
    treeData = signal<TreeData | null>(null);
    loading = signal(true);
    isSaving = false;
    allPersonsOptions = computed(() => {
        const data = this.treeData();
        if (!data || !data.individuals) return [];
        return data.individuals.map(ind => ({
            id: ind.id,
            displayName: `${this.getPrimaryName(ind)} (${ind.id})`
        })).sort((a, b) => a.displayName.localeCompare(b.displayName));
    });
    isEventSectionOpen = false;
    showDeleteModal = signal(false);
    mediaDeletePendingIndex = signal<number | null>(null);
    get isDeleting(): boolean {
        return this.isSaving;
    }

    activeTab: 'basics' | 'timeline' | 'relations' | 'media' | 'notes' | 'citations' | 'names' | 'associations' | 'dna' = 'basics';

    // --- Relation Modal State ---
    showRelationModal = signal(false);
    relationModalType: 'child' | 'partner' | 'father' | 'mother' = 'child';
    relationModalFamilyIndex: number | null = null;
    newPersonData = signal({ firstName: '', lastName: '', gender: 'U' as 'M' | 'F' | 'X' | 'U' });

    updateNewPersonField(field: string, value: any) {
        this.newPersonData.update(prev => ({ ...prev, [field]: value }));
    }

    // Die verschmolzene Liste aus Events und Fakten
    timeline = signal<TimelineItem[]>([]);

    // Beziehungen
    relations = signal<{ type: string; personId: string; personName?: string; familyId?: string }[]>([]);

    // Media Modal State
    showMediaAddModal = signal(false);
    showMediaEditModal = signal(false);
    activeMediaIndex = signal<number | null>(null);
    editMediaDraft = signal<any>({});
    activeTimelineIndexForMediaAdd: number | null = null;

    showMediaSelector = false;
    isEditingFamily = signal(false);
    showNameCreateModal = signal(false);
    showNameEditModal = signal(false);
    activeNameIndex = signal<number | null>(null);
    editNameDraft = signal<any>({});
    newNameDraft = signal<{ given: string; surname: string; type: 'BIRTH' | 'MARRIED' | 'AKA'; isPrimary: boolean }>({
        given: '',
        surname: '',
        type: 'AKA',
        isPrimary: false
    });
    showRelationCreateModal = signal(false);
    newRelationDraft = signal<{ type: 'SPOUSE' | 'FATHER' | 'MOTHER' | 'CHILD'; personInput: string }>({
        type: 'SPOUSE',
        personInput: ''
    });
    showNoteCreateModal = signal(false);
    newNoteDraft = signal<{ text: string; noteType: string; researchStatus: string; privacyLevel: string }>({
        text: '',
        noteType: 'GENERAL',
        researchStatus: 'OPEN',
        privacyLevel: 'PRIVATE'
    });
    showCitationCreateModal = signal(false);
    newCitationDraft = signal<{ sourceId: string, confidence?: string, page?: string, dateText?: string }>({ sourceId: '' });
    citationEditDraft = signal<{ index?: number, sourceId: string, confidence?: string, page?: string, dateText?: string }>({ sourceId: '' });
    showAssociationCreateModal = signal(false);
    showAssociationEditModal = signal(false);
    activeAssociationIndex = signal<number | null>(null);
    editAssociationDraft = signal<any>({});
    newAssociationDraft = signal<{ role: string; personInput: string; relationText: string; dateText: string; confidence: string; notes: string }>({
        role: 'OTHER',
        personInput: '',
        relationText: '',
        dateText: '',
        confidence: '',
        notes: ''
    });
    showDnaMatchCreateModal = signal(false);
    showDnaMatchEditModal = signal(false);
    activeDnaMatchIndex = signal<number | null>(null);
    editDnaMatchDraft = signal<any>({});
    newDnaMatchDraft = signal<{ provider: string; matchPersonId: string; totalCm: number | null }>({
        provider: '',
        matchPersonId: '',
        totalCm: null
    });
    showTimelineCreateModal = signal(false);
    newTimelineDraft = signal<{
        itemKind: 'event' | 'fact';
        tag: string;
        date: string;
        place: string;
        description: string;
    }>({
        itemKind: 'event',
        tag: 'DEAT',
        date: '',
        place: '',
        description: ''
    });
    showTimelineItemModal = signal(false);
    activeTimelineItemIndex = signal<number | null>(null);
    showNoteEditModal = signal(false);
    activePersonNoteIndex = signal<number | null>(null);
    noteEditDraft = signal<{ text: string; noteType: string; researchStatus: string; privacyLevel: string }>({
        text: '',
        noteType: 'GENERAL',
        researchStatus: 'OPEN',
        privacyLevel: 'PRIVATE'
    });
    showCitationEditModal = signal(false);
    activePersonCitationIndex = signal<number | null>(null);
    // This signal is now defined above with the new type
    // citationEditDraft = signal<{ sourceId: string; page: string; confidence: string; dateText: string }>({
    //     sourceId: '',
    //     page: '',
    //     confidence: '',
    //     dateText: ''
    // });

    // Individual Search results for families
    familySearchResults = signal<Individual[]>([]);
    showFamilyResults = signal<string | null>(null); // 'father', 'mother', 'partner', 'child-fIdx-cIdx'

    // Viewer
    viewerUrl = signal<string | null>(null);
    viewerTitle = signal<string>('');

    // Place Management
    showPlaceModal = false;
    placeModalMode: 'add' | 'edit' = 'add';
    selectedPlaceForModal: any = null;
    activeTimelineIndexForPlace: number | null = null;
    activeTimelineIndexForMedia: number | null = null;

    placeSearchResults = signal<string[]>([]);
    showPlaceResults = signal<number | null>(null);

    individualSearchResults = signal<Individual[]>([]);
    showIndividualResults = signal<number | null>(null);

    // Available sources for citation dropdowns
    availableSources = signal<any[]>([]);

    // Unsaved Changes Guard
    isDirty = false;
    hasSaved = false;
    showLeaveModal = signal(false);
    private leaveResolver: ((value: boolean) => void) | null = null;

    getTagLabel(tag: string): string {
        const labels: { [key: string]: string } = {
            'BIRT': 'Geburt',
            'CHR': 'Taufe',
            'DEAT': 'Tod',
            'BURI': 'Begräbnis',
            'CREM': 'Einäscherung',
            'EMIG': 'Auswanderung',
            'IMMI': 'Einwanderung',
            'OCCU': 'Beruf',
            'RELI': 'Religion',
            'EDUC': 'Bildung',
            'RESI': 'Wohnsitz',
            'TITL': 'Titel',
            'NATI': 'Nationalität',
            'DSCR': 'Körperl. Merkmale',
            'FACT': 'Fakt'
        };
        return labels[tag] || tag;
    }

    getPersonName(id: string | undefined): string {
        if (!id) return '';
        const data = this.treeData();
        if (!data) return id;
        const p = data.individuals.find(i => i.id === id);
        if (!p) return id;
        const given = p.names?.[0]?.given || p.firstName || '';
        const sur = p.names?.[0]?.surname || p.lastName || '';
        return `${given} ${sur}`.trim() || id;
    }

    getPrimaryName(person: Individual): string {
        if (!person) return '';
        const primaryName = person.names?.find(n => n.isPrimary);
        if (primaryName) {
            return `${primaryName.given || ''} ${primaryName.surname || ''}`.trim();
        }
        return `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.id;
    }

    getProfileImage(person: Individual): string | null {
        if (!person.media || person.media.length === 0) return null;
        const primary = person.media.find(m => m.isPrimary) || person.media[0];
        return primary?.url ? this.gedcomService.getMediaUrl(primary.url) : null;
    }

    getFamilyWedding(familyId: string | undefined): string {
        if (!familyId) return '';
        const fam = this.treeData()?.families.find(f => f.id === familyId);
        if (!fam || !fam.events) return '';
        const marr = fam.events.find(e => e.type === 'MARR');
        if (!marr) return '';
        const date = marr.date || (marr as any).dateText || '';
        const place = marr.place || (marr as any).placeName || '';
        return date + (place ? ` in ${place}` : '');
    }

    getFamilyWeddingDate(familyId: string | undefined): string {
        if (!familyId) return '';
        const fam = this.treeData()?.families.find(f => f.id === familyId);
        const marr = fam?.events?.find(e => e.type === 'MARR');
        return marr?.date || (marr as any)?.dateText || '';
    }

    getFamilyWeddingPlace(familyId: string | undefined): string {
        if (!familyId) return '';
        const fam = this.treeData()?.families.find(f => f.id === familyId);
        const marr = fam?.events?.find(e => e.type === 'MARR');
        return marr?.place || (marr as any)?.placeName || '';
    }

    updateFamilyWedding(fIdx: number, field: 'date' | 'place', val: string) {
        const p = this.person();
        if (!p || !p.familiesAsSpouse || !p.familiesAsSpouse[fIdx]) return;
        const familyId = p.familiesAsSpouse[fIdx].familyId;
        const tree = this.treeData();
        if (!tree || !familyId) return;

        const fam = tree.families.find(f => f.id === familyId);
        if (!fam) return;

        if (!fam.events) fam.events = [];
        let marr = fam.events.find(e => e.type === 'MARR');
        if (!marr) {
            marr = { type: 'MARR', isPrimary: true };
            fam.events.push(marr);
        }

        if (field === 'date') marr.date = val;
        else marr.place = val;

        this.markDirty();
        this.buildTimeline();
    }

    updateFamilyWeddingByFamilyId(familyId: string | undefined, field: 'date' | 'place', val: string) {
        if (!familyId) return;
        const tree = this.treeData();
        if (!tree) return;

        const fam = tree.families.find(f => f.id === familyId);
        if (!fam) return;

        if (!fam.events) fam.events = [];
        let marr = fam.events.find(e => e.type === 'MARR');
        if (!marr) {
            marr = { type: 'MARR', isPrimary: true };
            fam.events.push(marr);
        }

        if (field === 'date') marr.date = val;
        else marr.place = val;

        this.markDirty();
        this.buildTimeline();
    }

    markDirty() {
        this.isDirty = true;
    }

    ngOnInit() {
        this.route.paramMap.subscribe(params => {
            const id = params.get('id');
            if (id) {
                this.personId = id;
                localStorage.setItem(this.FOCUS_PERSON_KEY, id);
                this.loadPersonData();
            }
        });
    }

    canDeactivate(): boolean | Promise<boolean> {
        return true;
    }

    openDeleteModal() {
        this.showDeleteModal.set(true);
    }

    closeDeleteModal() {
        this.showDeleteModal.set(false);
    }

    confirmDeletePerson() {
        if (this.isSaving) return; // Changed from isDeleting to isSaving based on instruction snippet
        const tree = this.authService.currentTree();
        if (!tree) {
            alert('Kein aktiver Stammbaum gefunden.');
            return;
        }

        this.isSaving = true; // Changed from isDeleting to isSaving
        this.gedcomService.deletePerson(tree.name, this.personId).subscribe({
            next: (res) => {
                this.isSaving = false; // Changed from isDeleting to isSaving
                if (res?.success) {
                    this.showDeleteModal.set(false);
                    this.router.navigate(['/persons']);
                } else {
                    alert('Löschen fehlgeschlagen.');
                }
            },
            error: (err) => {
                this.isSaving = false; // Changed from isDeleting to isSaving
                alert('Fehler beim Löschen: ' + (err.error?.message || 'Unbekannter Fehler'));
            }
        });
    }

    loadPersonData() {
        this.loading.set(true);
        this.gedcomService.getTreeData().subscribe({
            next: (data) => {
                if (data) {
                    this.treeData.set(data);
                    // Load available sources for citation dropdowns
                    const treeName = data.meta?.tree;
                    if (treeName) {
                        this.gedcomService.getSources(treeName).subscribe({
                            next: (res: any) => {
                                if (res.success) this.availableSources.set(res.sources || []);
                            }
                        });
                    }
                    const found = data.individuals.find(i => i.id === this.personId);
                    if (found) {
                        // Deep copy to avoid direct mutation before save
                        const copy = JSON.parse(JSON.stringify(found));
                        if (!copy.media) copy.media = [];
                        if (!copy.notes) copy.notes = [];
                        if (!copy.citations) copy.citations = [];
                        if (!copy.names || copy.names.length === 0) {
                            copy.names = [{ isPrimary: true, type: 'BIRTH', given: copy.firstName || '', surname: copy.lastName || '', full: copy.name || '' }];
                        }
                        if (!copy.privacyLevel) copy.privacyLevel = 'PRIVATE';

                        // Initialisiere temporäres Feld für Typeahead-Suche bei Assoziationen
                        if (!copy.associations) copy.associations = [];
                        copy.associations.forEach((a: any) => {
                            if (a.associatedPersonId) {
                                a._tempTargetName = this.getPersonName(a.associatedPersonId) + ` (${a.associatedPersonId})`;
                                a.associatedPersonName = this.getPersonName(a.associatedPersonId);
                            } else if (a.associatedPersonName) {
                                a._tempTargetName = a.associatedPersonName;
                            }
                        });

                        this.person.set(copy);
                        // Build relations first because timeline depends on familiesAsSpouse
                        // for family events (e.g. marriage, child births).
                        this.buildRelations();
                        this.buildTimeline();
                    } else {
                        // Person not found
                        this.router.navigate(['/persons']);
                    }
                }
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
                this.router.navigate(['/persons']);
            }
        });
    }

    // --- Helpers for Simple Mode ---
    getSimpleEvent(tag: string): TimelineItem | undefined {
        return this.timeline().find(t => t.tag === tag);
    }

    updateSimpleEvent(tag: string, field: 'date' | 'place', value: string) {
        const current = this.timeline();
        let item = current.find(t => t.tag === tag);
        if (!item) {
            // Create if not exists
            item = {
                originalType: 'event',
                originalIndex: -1,
                tag: tag,
                date: '',
                place: '',
                editing: false,
                expanded: false,
                media: [],
                notes: [],
                citations: []
            };
            current.push(item);
        }
        item[field] = value;
        item.editing = false; // Ensure it's not in "Expert" editing mode
        this.timeline.set([...current]);
        this.markDirty();
    }

    buildTimeline() {
        const p = this.person();
        if (!p) return;

        let merged: TimelineItem[] = [];

        // Events hinzufügen
        if (p.events) {
            p.events.forEach((ev, i) => {
                merged.push({
                    originalType: 'event',
                    originalIndex: i,
                    tag: ev.type,
                    date: ev.date || (ev as any).dateText,
                    place: ev.place,
                    description: ev.description,
                    media: (ev as any).media || [],
                    notes: (ev as any).notes || [],
                    citations: (ev as any).citations || [],
                    editing: false
                });
            });
        }

        // Fakten hinzufügen
        if (p.facts) {
            p.facts.forEach((fact, i) => {
                merged.push({
                    originalType: 'fact',
                    originalIndex: i,
                    tag: fact.type,
                    date: (fact as any).date || fact.dateText,
                    place: (fact as any).place || fact.placeName,
                    value: fact.value,
                    media: (fact as any).media || [],
                    notes: (fact as any).notes || [],
                    citations: (fact as any).citations || [],
                    editing: false
                });
            });
        }
        // Familien-Events (Heirat, etc.) hinzufügen
        if (p.familiesAsSpouse) {
            const childBirthSeen = new Set<string>();
            p.familiesAsSpouse.forEach((famLink) => {
                const fullFam = this.treeData()?.families.find(f => f.id === famLink.familyId);
                if (fullFam && fullFam.events) {
                    fullFam.events.forEach((ef, idx) => {
                        merged.push({
                            originalType: 'family-event',
                            originalIndex: idx,
                            familyId: famLink.familyId,
                            tag: ef.type,
                            date: ef.date || (ef as any).dateText,
                            place: ef.place || (ef as any).placeName,
                            description: ef.description || (ef.type === 'MARR' ? `Heirat mit ${famLink.spouseName}` : ''),
                            media: (ef as any).media || [],
                            notes: (ef as any).notes || [],
                            citations: (ef as any).citations || [],
                            editing: false
                        });
                    });
                }

                // Abgeleitete Eltern-Ereignisse: Geburt/Heirat/Tod des Kindes
                if (famLink.children && famLink.children.length > 0) {
                    famLink.children.forEach((childRef) => {
                        const child = this.treeData()?.individuals.find(i => i.id === childRef.id);
                        if (!child || !child.events) return;

                        const derivedChildEvents = [
                            { tag: 'BIRT', label: 'Geburt' },
                            { tag: 'MARR', label: 'Heirat' },
                            { tag: 'DEAT', label: 'Tod' }
                        ];

                        derivedChildEvents.forEach((spec) => {
                            const ev = child.events!.find(e => e.type === spec.tag);
                            if (!ev) return;

                            const childDate = ev.date || (ev as any).dateText;
                            const childPlace = ev.place || (ev as any).placeName;
                            const key = `${famLink.familyId || ''}:${child.id}:${spec.tag}:${childDate || ''}:${childPlace || ''}`;
                            if (childBirthSeen.has(key)) return;
                            childBirthSeen.add(key);

                            merged.push({
                                originalType: 'family-event',
                                originalIndex: -1,
                                familyId: famLink.familyId,
                                sourcePersonId: child.id,
                                sourcePersonName: childRef.name || this.getPersonName(child.id) || 'Person',
                                tag: spec.tag,
                                date: childDate,
                                place: childPlace,
                                description: `${spec.label} von ${childRef.name || this.getPersonName(child.id) || 'Kind'}`,
                                media: [],
                                notes: [],
                                citations: [],
                                editing: false
                            });
                        });
                    });
                }
            });
        }

        // Sort timeline by date
        merged.sort((a, b) => {
            const dateA = this.parseToComparableDate(a.date);
            const dateB = this.parseToComparableDate(b.date);
            return dateA.getTime() - dateB.getTime();
        });

        this.timeline.set(merged);
    }

    private parseToComparableDate(dateStr: string | undefined): Date {
        if (!dateStr) return new Date(9999, 11, 31); // No date -> last

        const months: { [key: string]: number } = {
            'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
            'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
        };

        // Try "DD MMM YYYY"
        const dmy = dateStr.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i);
        if (dmy) {
            const day = parseInt(dmy[1]);
            const month = months[dmy[2].toUpperCase()] || 0;
            const year = parseInt(dmy[3]);
            return new Date(year, month, day);
        }

        // Try "MMM YYYY"
        const my = dateStr.match(/([A-Z]{3})\s+(\d{4})/i);
        if (my) {
            const month = months[my[1].toUpperCase()] || 0;
            const year = parseInt(my[2]);
            return new Date(year, month, 1);
        }

        // Try "YYYY"
        const y = dateStr.match(/(\d{4})/);
        if (y) {
            return new Date(parseInt(y[1]), 0, 1);
        }

        return new Date(9999, 11, 31);
    }

    buildRelations() {
        const p = this.person();
        const data = this.treeData();
        if (!p || !data) return;

        const rels: { type: string; personId: string; personName?: string; familyId?: string }[] = [];
        const relSeen = new Set<string>();

        data.families.forEach(fam => {
            if (fam.children.includes(p.id)) {
                if (fam.husband) {
                    const key = `FATHER:${fam.husband}`;
                    if (!relSeen.has(key)) {
                        relSeen.add(key);
                        rels.push({ type: 'FATHER', personId: fam.husband });
                    }
                }
                if (fam.wife) {
                    const key = `MOTHER:${fam.wife}`;
                    if (!relSeen.has(key)) {
                        relSeen.add(key);
                        rels.push({ type: 'MOTHER', personId: fam.wife });
                    }
                }
            }
            if (fam.husband === p.id || fam.wife === p.id) {
                const partner = fam.husband === p.id ? fam.wife : fam.husband;
                if (partner) {
                    const key = `SPOUSE:${partner}`;
                    if (!relSeen.has(key)) {
                        relSeen.add(key);
                        rels.push({ type: 'SPOUSE', personId: partner, familyId: fam.id });
                    }
                }
                fam.children.forEach(child => {
                    const key = `CHILD:${child}`;
                    if (!relSeen.has(key)) {
                        relSeen.add(key);
                        rels.push({ type: 'CHILD', personId: child, familyId: fam.id });
                    }
                });
            }
        });

        // Resolve names and set initial search query
        // Resolve names and set initial search query
        rels.forEach(r => r.personName = this.getPersonName(r.personId));
        this.relations.set(rels);

        // Populate Simple Mode specialized fields on the person object
        const pVal = this.person();
        if (pVal) {
            const updatedPerson = { ...pVal };
            updatedPerson.familiesAsSpouse = [];

            // A map to keep track of unique families to avoid duplicates
            // Especially when a person is husband/wife in multiple families
            const seenFamilyKeys = new Set<string>();

            data.families.forEach(fam => {
                // Parents (Child in this family)
                if (fam.children.includes(pVal.id)) {
                    if (fam.husband) {
                        updatedPerson.fatherId = fam.husband;
                        updatedPerson.fatherName = this.getPersonName(fam.husband);
                    }
                    if (fam.wife) {
                        updatedPerson.motherId = fam.wife;
                        updatedPerson.motherName = this.getPersonName(fam.wife);
                    }
                }

                // Partners & Children (Spouse in this family)
                if (fam.husband === pVal.id || fam.wife === pVal.id) {
                    const familyKey = [fam.husband || '', fam.wife || '', ...(fam.children || []).slice().sort()].join('|');
                    if (seenFamilyKeys.has(familyKey)) return;
                    seenFamilyKeys.add(familyKey);

                    const spouseId = fam.husband === pVal.id ? fam.wife : fam.husband;

                    if (!updatedPerson.familiesAsSpouse) updatedPerson.familiesAsSpouse = [];

                    updatedPerson.familiesAsSpouse.push({
                        familyId: fam.id, // Storing familyId for deletion
                        spouseId: spouseId,
                        spouseName: spouseId ? this.getPersonName(spouseId) : 'Unbekannt',
                        children: Array.from(new Set(fam.children || [])).map(childId => ({
                            id: childId,
                            name: this.getPersonName(childId)
                        }))
                    });
                }
            });
            this.person.set(updatedPerson);
            // Rebuild timeline after relation-derived fields were refreshed.
            this.buildTimeline();
        }
    }

    goToPerson(id?: string) {
        if (!id || this.isEditingFamily()) return;
        this.router.navigate(['/person', id]);
    }


    addRelationSimple(type: 'child' | 'partner' | 'father' | 'mother', familyIdx: number | null = null) {
        this.relationModalType = type;
        this.relationModalFamilyIndex = familyIdx;
        this.newPersonData.set({
            firstName: '',
            lastName: type === 'child' ? (this.person()?.lastName || '') : '',
            gender: type === 'father' ? 'M' : (type === 'mother' ? 'F' : 'U')
        });
        this.showRelationModal.set(true);
    }

    toggleFamilyEdit() {
        this.isEditingFamily.update(v => !v);
    }

    searchFamilyIndividual(type: string, query: string) {
        if (!query || query.length < 2) {
            this.familySearchResults.set([]);
            this.showFamilyResults.set(null);
            return;
        }

        const data = this.treeData();
        if (!data) return;

        const results = data.individuals.filter(ind => {
            if (ind.id === this.personId) return false;
            const fullName = `${ind.firstName || ''} ${ind.lastName || ''}`.toLowerCase();
            return fullName.includes(query.toLowerCase()) || ind.id.toLowerCase().includes(query.toLowerCase());
        }).slice(0, 10);

        this.familySearchResults.set(results);
        this.showFamilyResults.set(type);
    }

    selectFamilyIndividual(type: string, ind: Individual, fIdx?: number) {
        const p = this.person();
        if (!p) return;

        if (type === 'father') {
            p.fatherId = ind.id;
            p.fatherName = `${ind.firstName || ''} ${ind.lastName || ''}`.trim();
        } else if (type === 'mother') {
            p.motherId = ind.id;
            p.motherName = `${ind.firstName || ''} ${ind.lastName || ''}`.trim();
        } else if (type === 'partner') {
            p.familiesAsSpouse = p.familiesAsSpouse || [];
            p.familiesAsSpouse.push({
                spouseId: ind.id,
                spouseName: `${ind.firstName || ''} ${ind.lastName || ''}`.trim(),
                children: []
            });
        } else if (type === 'child' && fIdx !== undefined) {
            p.familiesAsSpouse![fIdx].children = p.familiesAsSpouse![fIdx].children || [];
            p.familiesAsSpouse![fIdx].children!.push({
                id: ind.id,
                name: `${ind.firstName || ''} ${ind.lastName || ''}`.trim()
            });
        }

        this.person.set({ ...p });
        this.showFamilyResults.set(null);
        this.markDirty();
    }

    removeParent(type: 'father' | 'mother') {
        const p = this.person();
        if (!p) return;
        if (type === 'father') {
            p.fatherId = undefined;
            p.fatherName = undefined;
        } else {
            p.motherId = undefined;
            p.motherName = undefined;
        }
        this.person.set({ ...p });
        this.markDirty();
    }

    removeFamily(index: number) {
        const p = this.person();
        if (!p) return;
        p.familiesAsSpouse!.splice(index, 1);
        this.person.set({ ...p });
        this.markDirty();
    }

    removeChildFromFamily(familyIdx: number, childIdx: number) {
        const p = this.person();
        if (!p) return;
        p.familiesAsSpouse![familyIdx].children.splice(childIdx, 1);
        this.person.set({ ...p });
        this.markDirty();
    }

    removeRelation(index: number) {
        const current = this.relations();
        current.splice(index, 1);
        this.relations.set([...current]);
        this.markDirty();
    }

    addRelation() {
        this.newRelationDraft.set({ type: 'SPOUSE', personInput: '' });
        this.showRelationCreateModal.set(true);
    }

    closeRelationCreateModal() {
        this.showRelationCreateModal.set(false);
    }

    confirmAddRelation() {
        const draft = this.newRelationDraft();
        const personInput = (draft.personInput || '').trim();
        if (!personInput) return;

        const match = this.allPersonsOptions().find(opt => opt.displayName === personInput);
        const personId = match?.id || '';
        const personName = match ? match.displayName.replace(` (${match.id})`, '') : personInput;
        if (!personId) return;
        if (personId === this.personId) return;
        if (this.relations().some(r => r.personId === personId && r.type === draft.type)) return;

        this.relations.set([...this.relations(), { type: draft.type, personId, personName }]);
        this.markDirty();
        this.showRelationCreateModal.set(false);
        this.savePerson();
    }

    getMediaUrlExt(url: string | undefined): string | null {
        if (!url) return null;
        return this.gedcomService.getMediaUrl(url);
    }

    isImage(m: any): boolean {
        if (m.mimeType) return m.mimeType.startsWith('image/');
        if (m.url) return m.url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) !== null;
        return false;
    }

    getMediaUrl(url: string | undefined): string {
        return this.gedcomService.getMediaUrl(url);
    }

    openViewer(media: any) {
        this.viewerUrl.set(this.getMediaUrl(media.url));
        this.viewerTitle.set(media.title || 'Bild');
    }

    // --- Media Add Modal Integration ---
    openMediaAddModal(index?: number) {
        this.activeTimelineIndexForMediaAdd = index !== undefined ? index : null;
        this.showMediaAddModal.set(true);
    }

    onMediaAddUploaded(media: any) {
        if (!media) return;

        if (this.activeTimelineIndexForMediaAdd !== null) {
            // Event media
            const current = this.timeline();
            const idx = this.activeTimelineIndexForMediaAdd;
            current[idx].media = current[idx].media || [];
            current[idx].media!.push({
                id: media.id,
                url: media.remoteUrl || (media.filePath ? `/uploads/${media.filePath}` : media.url),
                title: media.title || media.filePath || '',
                isPrimary: false,
                mimeType: media.mimeType
            });
            this.timeline.set([...current]);
        } else {
            // Person media
            const p = this.person();
            if (p) {
                p.media = p.media || [];
                p.media.push({
                    id: media.id,
                    url: media.remoteUrl || (media.filePath ? `/uploads/${media.filePath}` : media.url),
                    title: media.title || media.filePath || '',
                    isPrimary: p.media.length === 0,
                    mimeType: media.mimeType
                });
                this.person.set({ ...p });
            }
        }
        this.markDirty();
        this.showMediaAddModal.set(false);
    }

    openMediaEditModal(index: number) {
        const p = this.person();
        if (!p || !p.media) return;
        this.activeMediaIndex.set(index);
        this.editMediaDraft.set({ ...p.media[index] });
        this.showMediaEditModal.set(true);
    }

    closeMediaEditModal() {
        this.showMediaEditModal.set(false);
        this.activeMediaIndex.set(null);
    }

    saveMediaEditModal() {
        const p = this.person();
        const idx = this.activeMediaIndex();
        if (!p || !p.media || idx === null) return;

        const draft = this.editMediaDraft();
        const wasPrimary = p.media[idx].isPrimary;
        const isNowPrimary = draft.isPrimary;

        p.media[idx] = {
            ...p.media[idx],
            ...draft
        };

        if (isNowPrimary && !wasPrimary) {
            p.media.forEach((m, i) => m.isPrimary = i === idx);
            p.profileImageUrl = p.media[idx].url || '';
        }

        this.person.set({ ...p });
        this.markDirty();
        this.closeMediaEditModal();
        this.savePerson();
    }

    openMediaSelector(itemIndex?: number) {
        this.activeTimelineIndexForMedia = itemIndex !== undefined ? itemIndex : null;
        this.showMediaSelector = true;
    }

    getRelationLabel(type: string): string {
        const map: any = {
            'SPOUSE': 'Partner/in',
            'FATHER': 'Vater',
            'MOTHER': 'Mutter',
            'CHILD': 'Kind',
            'SON': 'Sohn',
            'DAUGHTER': 'Tochter',
            'HUSBAND': 'Ehemann',
            'WIFE': 'Ehefrau'
        };
        return map[type] || type;
    }

    onMediaSelected(mediaObj: any) {
        if (!mediaObj) return;

        if (this.activeTimelineIndexForMedia !== null) {
            // Event media
            const current = this.timeline();
            const idx = this.activeTimelineIndexForMedia;
            current[idx].media = current[idx].media || [];
            current[idx].media!.push({
                id: mediaObj.id,
                url: mediaObj.remoteUrl || (mediaObj.filePath ? `/uploads/${mediaObj.filePath}` : mediaObj.url),
                title: mediaObj.title || mediaObj.filePath || '',
                isPrimary: false,
                mimeType: mediaObj.mimeType
            });
            this.timeline.set([...current]);
        } else {
            // Person media
            const p = this.person();
            if (p) {
                p.media = p.media || [];
                p.media.push({
                    id: mediaObj.id,
                    url: mediaObj.remoteUrl || (mediaObj.filePath ? `/uploads/${mediaObj.filePath}` : mediaObj.url),
                    title: mediaObj.title || mediaObj.filePath || '',
                    isPrimary: p.media.length === 0,
                    mimeType: mediaObj.mimeType
                });
                this.person.set({ ...p });
            }
        }
        this.showMediaSelector = false;
    }

    addPersonMedia() {
        const p = this.person();
        if (p) {
            p.media!.push({ url: '', title: '', isPrimary: false });
            this.person.set({ ...p });
        }
    }

    removePersonMedia(index: number) {
        const p = this.person();
        if (p) {
            p.media!.splice(index, 1);
            this.person.set({ ...p });
            this.markDirty();
            this.savePerson();
        }
    }

    requestDeletePersonMedia(index: number) {
        this.mediaDeletePendingIndex.set(index);
    }

    confirmDeletePersonMedia() {
        const idx = this.mediaDeletePendingIndex();
        if (idx !== null) {
            this.removePersonMedia(idx);
        }
        this.mediaDeletePendingIndex.set(null);
    }

    cancelDeletePersonMedia() {
        this.mediaDeletePendingIndex.set(null);
    }

    setPrimaryMedia(index: number) {
        const p = this.person();
        if (p) {
            p.media!.forEach(m => m.isPrimary = false);
            p.media![index].isPrimary = true;
            this.person.set({ ...p });
        }
    }

    addPersonNote() {
        this.newNoteDraft.set({ text: '', noteType: 'GENERAL', researchStatus: 'OPEN', privacyLevel: 'PRIVATE' });
        this.showNoteCreateModal.set(true);
    }

    closeNoteModal() {
        this.showNoteCreateModal.set(false);
    }

    confirmAddPersonNote() {
        const p = this.person();
        if (p) {
            const draft = this.newNoteDraft();
            const text = (draft.text || '').trim();
            if (!text) return;
            p.notes!.push({
                text,
                noteType: draft.noteType || 'GENERAL',
                researchStatus: draft.researchStatus || 'OPEN',
                privacyLevel: draft.privacyLevel || 'PRIVATE'
            } as any);
            this.person.set({ ...p });
            this.markDirty();
            this.showNoteCreateModal.set(false);
            this.savePerson();
        }
    }

    removePersonNote(index: number) {
        const p = this.person();
        if (p) {
            p.notes!.splice(index, 1);
            this.person.set({ ...p });
        }
    }

    openPersonNoteModal(index: number) {
        const p = this.person();
        if (!p || !p.notes || !p.notes[index]) return;
        const note = p.notes[index] as any;
        this.noteEditDraft.set({
            text: note.text || '',
            noteType: note.noteType || 'GENERAL',
            researchStatus: note.researchStatus || 'OPEN',
            privacyLevel: note.privacyLevel || 'PRIVATE'
        });
        this.activePersonNoteIndex.set(index);
        this.showNoteEditModal.set(true);
    }

    closePersonNoteModal() {
        this.showNoteEditModal.set(false);
        this.activePersonNoteIndex.set(null);
    }

    savePersonNoteModal() {
        const p = this.person();
        const idx = this.activePersonNoteIndex();
        if (!p || idx === null || !p.notes || !p.notes[idx]) return;
        const draft = this.noteEditDraft();
        p.notes[idx] = {
            ...(p.notes[idx] as any),
            text: draft.text || '',
            noteType: draft.noteType || 'GENERAL',
            researchStatus: draft.researchStatus || 'OPEN',
            privacyLevel: draft.privacyLevel || 'PRIVATE'
        } as any;
        this.person.set({ ...p });
        this.markDirty();
        this.closePersonNoteModal();
        this.savePerson();
    }

    removePersonNoteModal() {
        const idx = this.activePersonNoteIndex();
        if (idx === null) return;
        this.removePersonNote(idx);
        this.markDirty();
        this.closePersonNoteModal();
        this.savePerson();
    }

    // --- Association Management ---
    addAssociation() {
        this.newAssociationDraft.set({
            role: 'OTHER',
            personInput: '',
            relationText: '',
            dateText: '',
            confidence: '',
            notes: ''
        });
        this.showAssociationCreateModal.set(true);
    }

    closeAssociationModal() {
        this.showAssociationCreateModal.set(false);
    }

    openAssociationEditModal(index: number) {
        const p = this.person();
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
        const p = this.person();
        const idx = this.activeAssociationIndex();
        if (!p || !p.associations || idx === null) return;

        const draft = this.editAssociationDraft();
        const personInput = (draft._tempTargetName || draft.associatedPersonName || '').trim();
        const match = this.allPersonsOptions().find(opt => opt.displayName === personInput);
        const associatedPersonId = match?.id || null;
        const associatedPersonName = match
            ? match.displayName.replace(` (${match.id})`, '')
            : personInput;

        p.associations[idx] = {
            ...p.associations[idx],
            ...draft,
            associatedPersonId,
            associatedPersonName,
            _tempTargetName: personInput
        };

        this.person.set({ ...p });
        this.markDirty();
        this.closeAssociationEditModal();
        this.savePerson();
    }

    confirmAddAssociation() {
        const p = this.person();
        if (p) {
            const draft = this.newAssociationDraft();
            const personInput = (draft.personInput || '').trim();
            const match = this.allPersonsOptions().find(opt => opt.displayName === personInput);
            const associatedPersonId = match?.id || null;
            const associatedPersonName = match
                ? match.displayName.replace(` (${match.id})`, '')
                : (personInput || '');

            if (!p.associations) p.associations = [];
            p.associations.push({
                role: draft.role || 'OTHER',
                associatedPersonId,
                associatedPersonName,
                _tempTargetName: personInput,
                relationText: draft.relationText || '',
                dateText: draft.dateText || '',
                confidence: draft.confidence || '',
                notes: draft.notes || ''
            } as any);
            this.person.set({ ...p });
            this.markDirty();
            this.showAssociationCreateModal.set(false);
            this.savePerson();
        }
    }

    removeAssociation(index: number) {
        const p = this.person();
        if (p) {
            p.associations!.splice(index, 1);
            this.person.set({ ...p });
            this.markDirty();
        }
    }

    updateAssociatedPerson(assoc: any, text: string) {
        if (!text) {
            assoc.associatedPersonId = null;
            assoc.associatedPersonName = null;
            this.markDirty();
            return;
        }

        const list = this.allPersonsOptions();
        const match = list.find(opt => opt.displayName === text);

        if (match) {
            assoc.associatedPersonId = match.id;
            assoc.associatedPersonName = match.displayName.replace(` (${match.id})`, '');
        } else {
            // Freitext-Eingabe (Achtung: Prisma speichert dies nur, 
            // wenn das Backend freie Namensverknüpfungen zulässt. 
            // Falls nicht, wird es als relationText gespeichert/übertragen.
            assoc.associatedPersonId = null;
            assoc.associatedPersonName = text;
            assoc.relationText = assoc.relationText ? assoc.relationText : text;
        }

        this.markDirty();
    }

    // updatePersonNote kept for backward compat but notes are now objects
    updatePersonNote(index: number, val: string) {
        const p = this.person();
        if (p) {
            const note = p.notes![index] as any;
            if (typeof note === 'object') {
                note.text = val;
            } else {
                p.notes![index] = { text: val, noteType: 'GENERAL', researchStatus: 'OPEN', privacyLevel: 'PRIVATE' } as any;
            }
            this.person.set({ ...p });
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
        const p = this.person();
        if (p) {
            const draft = this.newCitationDraft();
            if (!draft.sourceId) {
                alert('Bitte wählen Sie eine gültige Quelle aus.');
                return;
            }
            p.citations!.push({
                sourceId: draft.sourceId,
                confidence: draft.confidence || '',
                page: draft.page || '',
                dateText: draft.dateText || ''
            } as any);
            this.person.set({ ...p });
            this.markDirty();
            this.showCitationCreateModal.set(false);
            this.savePerson();
        }
    }

    removePersonCitation(index: number) {
        const p = this.person();
        if (p) {
            p.citations!.splice(index, 1);
            this.person.set({ ...p });
        }
    }

    openPersonCitationModal(index: number) {
        const p = this.person();
        if (!p || !p.citations || !p.citations[index]) return;
        const cit = p.citations[index] as any;
        this.citationEditDraft.set({
            index,
            sourceId: cit.sourceId,
            confidence: cit.confidence || '',
            page: cit.page || '',
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
        const p = this.person();
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
            dateText: draft.dateText || ''
        } as any;
        this.person.set({ ...p });
        this.markDirty();
        this.closePersonCitationModal();
        this.savePerson();
    }

    removePersonCitationModal() {
        const idx = this.activePersonCitationIndex();
        if (idx === null) return;
        this.removePersonCitation(idx);
        this.markDirty();
        this.closePersonCitationModal();
        this.savePerson();
    }

    getSourceTitle(sourceId?: string): string {
        if (!sourceId) return 'Ohne Quelle';
        const src = this.availableSources().find((s: any) => s.id === sourceId);
        return src ? src.title : sourceId;
    }

    getNoteTypeLabel(type?: string): string {
        const map: Record<string, string> = {
            GENERAL: 'Allgemein',
            RESEARCH: 'Recherche',
            TRANSCRIPTION: 'Transkript',
            ANALYSIS: 'Analyse',
            TODO: 'ToDo'
        };
        return map[type || ''] || (type || 'Allgemein');
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
            case 'VERY_LIKELY': return 'bg-emerald-500/10 text-emerald-500'; // Success, but slightly different
            case 'LIKELY': return 'badge-highlight';
            case 'POSSIBLE': return 'badge-warn';
            case 'UNLIKELY': return 'badge-danger';
            default: return 'bg-neutral-950/10 text-neutral-400';
        }
    }

    addName() {
        this.openNameModal();
    }

    openNameModal() {
        const p = this.person();
        this.newNameDraft.set({
            given: '',
            surname: '',
            type: 'AKA',
            isPrimary: !p?.names?.length
        });
        this.showNameCreateModal.set(true);
    }

    closeNameModal() {
        this.showNameCreateModal.set(false);
    }

    openNameEditModal(index: number) {
        const p = this.person();
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
        const p = this.person();
        const idx = this.activeNameIndex();
        if (!p || !p.names || idx === null) return;

        const draft = this.editNameDraft();
        const given = (draft.given || '').trim();
        const surname = (draft.surname || '').trim();
        if (!given && !surname) return;

        const isNowPrimary = draft.isPrimary;

        if (isNowPrimary) {
            p.names.forEach(n => n.isPrimary = false);
        }

        p.names[idx] = {
            ...p.names[idx],
            ...draft,
            given,
            surname,
            full: `${given} ${surname}`.trim()
        };

        if (p.names[idx].isPrimary) {
            p.firstName = given;
            p.lastName = surname;
            p.name = `${given} ${surname}`.trim();
        }

        this.person.set({ ...p });
        this.markDirty();
        this.closeNameEditModal();
        this.savePerson();
    }

    confirmAddName() {
        const p = this.person();
        if (!p) return;
        const draft = this.newNameDraft();

        const given = (draft.given || '').trim();
        const surname = (draft.surname || '').trim();
        if (!given && !surname) return;

        p.names = p.names || [];
        const shouldBePrimary = draft.isPrimary || p.names.length === 0;
        if (shouldBePrimary) {
            p.names.forEach(n => n.isPrimary = false);
        }

        p.names.push({
            isPrimary: shouldBePrimary,
            type: draft.type,
            given,
            surname,
            full: `${given} ${surname}`.trim()
        });

        if (shouldBePrimary) {
            p.firstName = given;
            p.lastName = surname;
            p.name = `${given} ${surname}`.trim();
        }

        this.person.set({ ...p });
        this.markDirty();
        this.showNameCreateModal.set(false);
        this.savePerson();
    }

    removeName(index: number) {
        const p = this.person();
        if (!p) return;
        p.names.splice(index, 1);
        if (p.names.length > 0 && !p.names.some(n => n.isPrimary)) p.names[0].isPrimary = true;
        this.person.set({ ...p });
    }

    setPrimaryName(index: number) {
        const p = this.person();
        if (!p) return;
        p.names.forEach((n, i) => n.isPrimary = i === index);
        const primary = p.names[index];
        p.firstName = primary.given || '';
        p.lastName = primary.surname || '';
        p.name = `${p.firstName} ${p.lastName}`.trim();
        this.person.set({ ...p });
    }



    addDnaMatch() {
        this.newDnaMatchDraft.set({ provider: '', matchPersonId: '', totalCm: null });
        this.showDnaMatchCreateModal.set(true);
    }

    closeDnaMatchModal() {
        this.showDnaMatchCreateModal.set(false);
    }

    openDnaMatchEditModal(index: number) {
        const p = this.person();
        if (!p || !p.dnaMatches) return;
        this.activeDnaMatchIndex.set(index);
        this.editDnaMatchDraft.set({ ...p.dnaMatches[index] });
        this.showDnaMatchEditModal.set(true);
    }

    closeDnaMatchEditModal() {
        this.showDnaMatchEditModal.set(false);
        this.activeDnaMatchIndex.set(null);
    }

    saveDnaMatchEditModal() {
        const p = this.person();
        const idx = this.activeDnaMatchIndex();
        if (!p || !p.dnaMatches || idx === null) return;

        const draft = this.editDnaMatchDraft();
        const matchPersonId = draft.matchPersonId;
        const matchPerson = this.allPersonsOptions().find(opt => opt.id === matchPersonId);

        p.dnaMatches[idx] = {
            ...p.dnaMatches[idx],
            ...draft,
            matchPersonName: matchPerson ? matchPerson.displayName.replace(` (${matchPerson.id})`, '') : undefined
        };

        this.person.set({ ...p });
        this.markDirty();
        this.closeDnaMatchEditModal();
        this.savePerson();
    }

    confirmAddDnaMatch() {
        const p = this.person();
        if (!p) return;
        p.dnaMatches = p.dnaMatches || [];
        const draft = this.newDnaMatchDraft();
        p.dnaMatches.push({
            provider: draft.provider || '',
            matchPersonId: draft.matchPersonId || '',
            totalCm: draft.totalCm ?? undefined,
            segments: []
        });
        this.person.set({ ...p });
        this.markDirty();
        this.showDnaMatchCreateModal.set(false);
        this.savePerson();
    }

    removeDnaMatch(index: number) {
        const p = this.person();
        if (!p || !p.dnaMatches) return;
        p.dnaMatches.splice(index, 1);
        this.person.set({ ...p });
    }

    addDnaSegment(matchIndex: number) {
        const p = this.person();
        if (!p || !p.dnaMatches) return;
        const match = p.dnaMatches[matchIndex];
        match.segments = match.segments || [];
        match.segments.push({ chromosome: '1', startPosition: 0, endPosition: 0, cm: 0 });
        this.person.set({ ...p });
    }

    addDnaSegmentDraft() {
        const draft = this.editDnaMatchDraft();
        draft.segments = draft.segments || [];
        draft.segments.push({ chromosome: '1', startPosition: 0, endPosition: 0, cm: 0 });
        this.editDnaMatchDraft.set({ ...draft });
    }

    removeDnaSegmentDraft(index: number) {
        const draft = this.editDnaMatchDraft();
        if (!draft.segments) return;
        draft.segments.splice(index, 1);
        this.editDnaMatchDraft.set({ ...draft });
    }

    removeDnaSegment(matchIndex: number, segmentIndex: number) {
        const p = this.person();
        if (!p || !p.dnaMatches) return;
        p.dnaMatches[matchIndex].segments?.splice(segmentIndex, 1);
        this.person.set({ ...p });
    }

    addTimelineItem() {
        this.newTimelineDraft.set({
            itemKind: 'event',
            tag: 'DEAT',
            date: '',
            place: '',
            description: ''
        });
        this.showTimelineCreateModal.set(true);
    }

    closeTimelineCreateModal() {
        this.showTimelineCreateModal.set(false);
    }

    confirmAddTimelineItem() {
        const draft = this.newTimelineDraft();
        const isFact = draft.itemKind === 'fact';
        const text = (draft.description || '').trim();

        const current = this.timeline();
        this.timeline.set([...current, {
            originalType: isFact ? 'fact' : 'event',
            originalIndex: -1,
            tag: draft.tag,
            date: draft.date || '',
            place: draft.place || '',
            description: isFact ? '' : text,
            value: isFact ? text : '',
            media: [],
            notes: [],
            citations: [],
            editing: false,
            expanded: true
        }]);
        this.markDirty();
        this.showTimelineCreateModal.set(false);
        this.savePerson();
    }

    isTimelineItemLocked(item: TimelineItem): boolean {
        return item.originalType === 'family-event';
    }

    hasTimelineItemSource(item: TimelineItem): boolean {
        return !!item.sourcePersonId || !!item.familyId;
    }

    getTimelineItemSourceLabel(item: TimelineItem): string {
        if (item.sourcePersonId) return `Zu ${item.sourcePersonName || 'Person'}`;
        if (item.familyId) return 'Zur Familie';
        return 'Zum Ursprung';
    }

    goToTimelineItemSource(item: TimelineItem) {
        if (item.sourcePersonId) {
            this.closeTimelineItemModal();
            this.router.navigate(['/person', item.sourcePersonId]);
            return;
        }
        if (item.familyId) {
            this.closeTimelineItemModal();
            this.router.navigate(['/family', item.familyId]);
        }
    }

    openTimelineItemModal(index: number) {
        const current = this.timeline();
        if (!current[index]) return;
        current[index].editing = false;
        this.timeline.set([...current]);
        this.activeTimelineItemIndex.set(index);
        this.showTimelineItemModal.set(true);
    }

    closeTimelineItemModal() {
        this.showTimelineItemModal.set(false);
        this.activeTimelineItemIndex.set(null);
    }

    activeTimelineItem(): TimelineItem | null {
        const idx = this.activeTimelineItemIndex();
        if (idx === null) return null;
        return this.timeline()[idx] || null;
    }

    saveTimelineItemModal() {
        const idx = this.activeTimelineItemIndex();
        if (idx === null) return;
        const current = this.timeline();
        if (!current[idx]) return;
        current[idx].editing = false;
        this.timeline.set([...current]);
        this.markDirty();
        this.closeTimelineItemModal();
        this.savePerson();
    }

    removeTimelineItemModal() {
        const idx = this.activeTimelineItemIndex();
        if (idx === null) return;
        const current = this.timeline();
        if (!current[idx] || this.isTimelineItemLocked(current[idx])) return;
        current.splice(idx, 1);
        this.timeline.set([...current]);
        this.markDirty();
        this.closeTimelineItemModal();
        this.savePerson();
    }

    editTimelineItem(index: number) {
        const current = this.timeline();
        if (!current[index] || this.isTimelineItemLocked(current[index])) return;
        current[index].editing = true;
        this.timeline.set([...current]);
    }

    saveTimelineItem(index: number) {
        const current = this.timeline();
        current[index].editing = false;
        this.timeline.set([...current]);
        // Also trigger general save if you want it persistent immediately
        // Actually, the user wants the card smaller. Global save is already there via "Speichern" button at the top.
        // But let's keep local state consistent.
    }

    removeTimelineItem(index: number) {
        const current = this.timeline();
        if (!current[index] || this.isTimelineItemLocked(current[index])) return;
        current.splice(index, 1);
        this.timeline.set([...current]);
    }

    toggleExpand(index: number) {
        const current = this.timeline();
        current[index].expanded = !current[index].expanded;
        this.timeline.set([...current]);
    }

    addEventCitation(index: number) {
        const current = this.timeline();
        if (!current[index].citations) current[index].citations = [];
        current[index].citations!.push({ sourceId: '', confidence: '', page: '', text: '' });
        this.timeline.set([...current]);
    }

    removeEventCitation(itemIndex: number, citIndex: number) {
        const current = this.timeline();
        current[itemIndex].citations!.splice(citIndex, 1);
        this.timeline.set([...current]);
    }

    removeEventMedia(itemIndex: number, mediaIndex: number) {
        const current = this.timeline();
        current[itemIndex].media!.splice(mediaIndex, 1);
        this.timeline.set([...current]);
    }

    addEventNote(index: number) {
        const current = this.timeline();
        if (!current[index].notes) current[index].notes = [];
        current[index].notes!.push('');
        this.timeline.set([...current]);
    }

    removeEventNote(itemIndex: number, noteIndex: number) {
        const current = this.timeline();
        current[itemIndex].notes!.splice(noteIndex, 1);
        this.timeline.set([...current]);
    }

    // Für die Event Notes, since Angular doesn't track basic string arrays well with ngModel without index mapping
    updateEventNote(itemIndex: number, noteIndex: number, value: string) {
        const current = this.timeline();
        current[itemIndex].notes![noteIndex] = value;
        this.timeline.set([...current]);
    }

    trackByIndex(index: number, obj: any): any {
        return index;
    }

    // --- Place Search & Modal ---
    searchPlaces(index: number, query: string) {
        if (!query || query.length < 2) {
            this.placeSearchResults.set([]);
            this.showPlaceResults.set(null);
            return;
        }

        const data = this.treeData();
        const treeName = data?.meta?.tree || '';

        this.gedcomService.searchPlaces(treeName, query).subscribe(res => {
            this.placeSearchResults.set(res.results || []);
            this.showPlaceResults.set(index);
        });
    }

    selectPlace(index: number, placeName: string) {
        const current = this.timeline();
        current[index].place = placeName;
        this.timeline.set([...current]);
        this.showPlaceResults.set(null);
    }

    openPlaceModal(index: number) {
        const current = this.timeline();
        const placeName = current[index].place || '';

        this.activeTimelineIndexForPlace = index;
        this.selectedPlaceForModal = placeName;
        this.placeModalMode = 'add'; // Always add from here
        this.showPlaceModal = true;
    }

    onPlaceModalSaved(placeData: any) {
        if (this.activeTimelineIndexForPlace !== null) {
            const current = this.timeline();
            current[this.activeTimelineIndexForPlace].place = placeData.name;
            this.timeline.set([...current]);
        }
        this.showPlaceModal = false;
    }

    // --- Individual Search for Relations ---
    searchIndividuals(index: number, query: string) {
        if (!query || query.length < 2) {
            this.individualSearchResults.set([]);
            this.showIndividualResults.set(null);
            return;
        }

        const data = this.treeData();
        if (!data) return;

        const results = data.individuals.filter(ind => {
            // 1. Don't show the person themselves
            if (ind.id === this.personId) return false;

            // 2. Don't show people who are already in the relations list
            const isAlreadyRelated = this.relations().some(rel => rel.personId === ind.id);
            if (isAlreadyRelated) return false;

            const fullName = `${ind.firstName || ''} ${ind.lastName || ''}`.toLowerCase();
            return fullName.includes(query.toLowerCase()) || ind.id.toLowerCase().includes(query.toLowerCase());
        }).slice(0, 10);

        this.individualSearchResults.set(results);
        this.showIndividualResults.set(index);
    }

    selectIndividual(index: number, ind: Individual) {
        // Double check even if filtered in search
        if (ind.id === this.personId) return;
        if (this.relations().some((rel, i) => i !== index && rel.personId === ind.id)) return;

        const current = this.relations();
        current[index].personId = ind.id;
        current[index].personName = `${ind.firstName || ''} ${ind.lastName || ''}`.trim();
        this.relations.set([...current]);
        this.showIndividualResults.set(null);
    }

    goBack() {
        this.router.navigate(['/persons']);
    }

    savePerson() {
        if (!this.person() || !this.treeData()) return;
        this.isSaving = true;

        const currentPerson = this.person()!;

        // 1. Zuerst alle Roh-Relationen sammeln
        let rawRelations = [...this.relations()];

        // Vater aus Simple-Mode hinzufügen
        if (currentPerson.fatherId) {
            rawRelations.push({ type: 'FATHER', personId: currentPerson.fatherId });
        }
        // Mutter aus Simple-Mode hinzufügen
        if (currentPerson.motherId) {
            rawRelations.push({ type: 'MOTHER', personId: currentPerson.motherId });
        }

        // Partner und Kinder aus familiesAsSpouse hinzufügen
        if (currentPerson.familiesAsSpouse) {
            currentPerson.familiesAsSpouse.forEach(fam => {
                if (fam.spouseId) {
                    rawRelations.push({ type: 'SPOUSE', personId: fam.spouseId });
                }
                if (fam.children) {
                    fam.children.forEach(child => {
                        rawRelations.push({ type: 'CHILD', personId: child.id });
                    });
                }
            });
        }

        // 2. DUPLIKATE ENTFERNEN (Entscheidender Fix für den Prisma-Fehler)
        // Wir filtern die Liste so, dass jede Kombination aus personId und type nur einmal vorkommt.
        const relationsPayload = rawRelations.filter((rel, index, self) =>
            index === self.findIndex((t) => (
                t.personId === rel.personId && t.type === rel.type
            ))
        );

        // 3. Family-Events aus Timeline separat vorbereiten (nicht als Personen-Event speichern)
        const treeSnapshot = this.treeData()!;
        const changedFamilies = new Map<string, Family>();
        this.timeline().forEach((t) => {
            if (t.originalType !== 'family-event' || !t.familyId || t.originalIndex < 0) return;

            const sourceFamily = treeSnapshot.families.find(f => f.id === t.familyId);
            if (!sourceFamily) return;

            if (!changedFamilies.has(t.familyId)) {
                changedFamilies.set(t.familyId, JSON.parse(JSON.stringify(sourceFamily)));
            }

            const targetFamily = changedFamilies.get(t.familyId)!;
            targetFamily.events = targetFamily.events || [];
            const targetEvent = targetFamily.events[t.originalIndex];
            if (!targetEvent) return;

            // Family-event bleibt Family-event: nur Event-Felder aktualisieren
            targetEvent.date = t.date || '';
            targetEvent.place = t.place || '';
            targetEvent.description = t.description || '';
            (targetEvent as any).media = t.media || [];
            (targetEvent as any).notes = t.notes || [];
            (targetEvent as any).citations = t.citations || [];
        });

        // 4. Timeline wie bisher verarbeiten (ohne Family-Events)
        const newEvents: any[] = [];
        const newFacts: any[] = [];

        this.timeline().forEach(t => {
            if (t.originalType === 'family-event') return;
            const isEventTag = ['BIRT', 'CHR', 'DEAT', 'BURI', 'CREM', 'EMIG', 'IMMI', 'BAPM'].includes(t.tag);
            if (isEventTag || (t.originalType === 'event' && !['OCCU', 'EDUC', 'RELI', 'RESI', 'TITL', 'NATI', 'DSCR', 'FACT'].includes(t.tag))) {
                newEvents.push({
                    type: t.tag,
                    date: t.date,
                    place: t.place,
                    description: t.description || t.value,
                    media: t.media,
                    notes: t.notes,
                    citations: (t.citations || []).map((c: any) => ({
                        sourceId: c.sourceId || null,
                        page: c.page || null,
                        dateText: c.dateText || null,
                        confidence: c.confidence || null,
                        text: c.text || null
                    }))
                });
            } else {
                newFacts.push({
                    type: t.tag,
                    date: t.date,
                    place: t.place,
                    value: t.value || t.description,
                    media: t.media,
                    notes: t.notes,
                    citations: (t.citations || []).map((c: any) => ({
                        sourceId: c.sourceId || null,
                        page: c.page || null,
                        dateText: c.dateText || null,
                        confidence: c.confidence || null,
                        text: c.text || null
                    }))
                });
            }
        });

        // 5. Namen synchronisieren (firstName/lastName -> names array)
        if (!currentPerson.names) currentPerson.names = [];
        let primaryName = currentPerson.names.find(n => n.isPrimary);
        if (!primaryName) {
            primaryName = { isPrimary: true, type: 'BIRTH' };
            currentPerson.names.push(primaryName);
        }
        primaryName.given = currentPerson.firstName || '';
        primaryName.surname = currentPerson.lastName || '';
        primaryName.full = `${primaryName.given} /${primaryName.surname}/`.trim();

        // Auch das top-level 'name' Feld für Abwärtskompatibilität/Suche aktualisieren
        currentPerson.name = `${primaryName.given} ${primaryName.surname}`.trim();

        // 6. Den Payload final zusammenbauen
        const payload: any = {
            id: currentPerson.id,
            firstName: currentPerson.firstName,
            lastName: currentPerson.lastName,
            gender: currentPerson.gender,
            isLiving: currentPerson.isLiving,
            privacyLevel: currentPerson.privacyLevel,
            exid: currentPerson.exid,
            name: currentPerson.name,
            names: (currentPerson.names || []).map(n => ({
                type: n.type || 'BIRTH',
                full: n.full || `${n.given || ''} /${n.surname || ''}/`.trim(),
                given: n.given || '',
                surname: n.surname || '',
                prefix: n.prefix || '',
                suffix: n.suffix || '',
                isPrimary: !!n.isPrimary,
                sortOrder: n.sortOrder || 0
            })),
            events: newEvents,
            facts: newFacts,
            relations: relationsPayload, // Die gefilterte Liste
            families: currentPerson.familiesAsSpouse || [],
            media: (currentPerson.media || []).map((m: any) => ({
                id: m.id || null,
                url: m.url || m.remoteUrl || m.filePath || '',
                title: m.title || '',
                isPrimary: m.isPrimary || false,
                role: m.role || '',
                caption: m.caption || '',
                mimeType: m.mimeType || ''
            })),
            notes: currentPerson.notes,
            citations: (currentPerson.citations || []).map((c: any) => ({
                sourceId: c.sourceId || c.source?.id || '',
                page: c.page || c.whereInSource || '',
                dateText: c.dateText || c.date || '',
                confidence: c.confidence || null
            })),
            associations: (currentPerson.associations || []).map((a: any) => ({
                role: a.role || 'OTHER',
                associatedPersonId: a.associatedPersonId || '',
                relationText: a.relationText || '',
                dateText: a.dateText || '',
                confidence: a.confidence || null,
                notes: a.notes || ''
            })),
            dnaMatches: (currentPerson.dnaMatches || []).map((m: any) => ({
                provider: m.provider || null,
                matchPersonId: m.matchPersonId || null,
                totalCm: m.totalCm === '' ? null : m.totalCm,
                largestSegmentCm: m.largestSegmentCm === '' ? null : m.largestSegmentCm,
                segmentCount: m.segmentCount === '' ? null : m.segmentCount,
                predictedRelationship: m.predictedRelationship || null,
                confidence: m.confidence || null,
                testDate: m.testDate || null,
                kitId: m.kitId || null,
                segments: (m.segments || []).map((s: any) => ({
                    chromosome: s.chromosome,
                    startPosition: Number(s.startPosition),
                    endPosition: Number(s.endPosition),
                    cm: Number(s.cm),
                    snpCount: s.snpCount === '' ? null : s.snpCount,
                    provider: s.provider || null,
                    build: s.build || null,
                    isTriangulated: !!s.isTriangulated
                }))
            }))
        };

        const treeName = treeSnapshot.meta?.tree || '';
        const saveFamilies$ = changedFamilies.size > 0
            ? forkJoin(Array.from(changedFamilies.values()).map(f => this.gedcomService.saveFamily(treeName, f)))
            : of([]);

        saveFamilies$.pipe(
            switchMap(() => this.gedcomService.savePerson(treeName, payload))
        ).subscribe({
            next: () => {
                this.isSaving = false;
                this.hasSaved = true;
                this.isDirty = false;
                this.loadPersonData(); // Daten neu laden, um IDs zu synchronisieren
            },
            error: (err) => {
                this.isSaving = false;
                console.error('Speicherfehler Details:', err);
                alert('Fehler beim Speichern: ' + (err.error?.message || 'Unbekannter Fehler'));
            }
        });
    }
}
