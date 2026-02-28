import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { AuthService } from './auth.service';
import { Individual, TreeData, Family } from './models';
import { CleanDatePipe } from './clean-date.pipe';
import { MediaSelector } from './media-selector';
import { PlaceModal } from './place-modal';
import { ImageViewer } from './image-viewer';
import { PersonCreateModal } from './person-create-modal';
import { MediaAddModal } from './media-add-modal';
import { CanComponentDeactivate } from './unsaved-changes.guard';
import { firstValueFrom } from 'rxjs';

interface TimelineItem {
    originalType: 'event' | 'fact' | 'family-event';
    originalIndex: number;
    familyId?: string;
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
    imports: [CommonModule, FormsModule, CleanDatePipe, MediaSelector, PlaceModal, ImageViewer, PersonCreateModal, MediaAddModal],
    templateUrl: './person-detail.html',
    styleUrl: './person-detail.css'
})
export class PersonDetail implements OnInit, CanComponentDeactivate {
    private readonly FOCUS_PERSON_KEY = 'heritago_last_focus_person';
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private gedcomService = inject(GedcomService);
    private authService = inject(AuthService);

    personId = '';
    person = signal<Individual | null>(null);
    treeData = signal<TreeData | null>(null);
    loading = signal(true);
    isSaving = false;
    isDeleting = false;
    showDeleteModal = signal(false);

    activeTab: 'basics' | 'timeline' | 'relations' | 'media' | 'notes' | 'citations' | 'names' | 'associations' | 'dna' = 'basics';
    isExpertMode = signal<boolean>(localStorage.getItem('heritago_expert_mode') === 'true');
    openSections = new Set<string>(); // Only timeline open by default

    // --- Relation Modal State ---
    showRelationModal = signal(false);
    relationModalType: 'child' | 'partner' | 'father' | 'mother' = 'child';
    relationModalFamilyIndex: number | null = null;
    newPersonData = signal({ firstName: '', lastName: '', gender: 'U' as 'M' | 'F' | 'X' | 'U' });

    toggleSection(section: string) {
        if (this.openSections.has(section)) {
            this.openSections.delete(section);
        } else {
            this.openSections.add(section);
        }
    }

    updateNewPersonField(field: string, value: any) {
        this.newPersonData.update(prev => ({ ...prev, [field]: value }));
    }

    isSectionOpen(section: string): boolean {
        return this.openSections.has(section);
    }

    toggleMode() {
        const newVal = !this.isExpertMode();
        this.isExpertMode.set(newVal);
        localStorage.setItem('heritago_expert_mode', newVal ? 'true' : 'false');
    }

    // Die verschmolzene Liste aus Events und Fakten
    timeline = signal<TimelineItem[]>([]);

    // Beziehungen
    relations = signal<{ type: string; personId: string; personName?: string; familyId?: string }[]>([]);

    // Media Modal State
    showMediaAddModal = signal(false);
    activeTimelineIndexForMediaAdd: number | null = null;

    showMediaSelector = false;
    isEditingFamily = signal(false);

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
        if (this.isDeleting) return;
        const tree = this.authService.currentTree();
        if (!tree) {
            alert('Kein aktiver Stammbaum gefunden.');
            return;
        }

        this.isDeleting = true;
        this.gedcomService.deletePerson(tree.name, this.personId).subscribe({
            next: (res) => {
                this.isDeleting = false;
                if (res?.success) {
                    this.showDeleteModal.set(false);
                    this.router.navigate(['/persons']);
                } else {
                    alert('Löschen fehlgeschlagen.');
                }
            },
            error: (err) => {
                this.isDeleting = false;
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
                        if (!copy.associations) copy.associations = [];
                        if (!copy.dnaMatches) copy.dnaMatches = [];
                        if (!copy.privacyLevel) copy.privacyLevel = 'PRIVATE';
                        this.person.set(copy);
                        this.buildTimeline();
                        this.buildRelations();
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
        }
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
        const p = this.person();
        if (p) {
            p.notes!.push('');
            this.person.set({ ...p });
        }
    }

    removePersonNote(index: number) {
        const p = this.person();
        if (p) {
            p.notes!.splice(index, 1);
            this.person.set({ ...p });
        }
    }

    updatePersonNote(index: number, val: string) {
        const p = this.person();
        if (p) {
            p.notes![index] = val;
            this.person.set({ ...p });
        }
    }

    addPersonCitation() {
        const p = this.person();
        if (p) {
            p.citations!.push({ sourceId: '', sourceTitle: '', quality: 2, whereInSource: '', text: '' } as any);
            this.person.set({ ...p });
        }
    }

    removePersonCitation(index: number) {
        const p = this.person();
        if (p) {
            p.citations!.splice(index, 1);
            this.person.set({ ...p });
        }
    }

    addName() {
        const p = this.person();
        if (!p) return;
        p.names = p.names || [];
        p.names.push({ isPrimary: p.names.length === 0, type: 'AKA', given: '', surname: '', full: '' });
        this.person.set({ ...p });
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

    addAssociation() {
        const p = this.person();
        if (!p) return;
        p.associations = p.associations || [];
        p.associations.push({ role: 'OTHER', associatedPersonId: '', associatedPersonName: '', relationText: '', dateText: '', notes: '' });
        this.person.set({ ...p });
    }

    removeAssociation(index: number) {
        const p = this.person();
        if (!p || !p.associations) return;
        p.associations.splice(index, 1);
        this.person.set({ ...p });
    }

    addDnaMatch() {
        const p = this.person();
        if (!p) return;
        p.dnaMatches = p.dnaMatches || [];
        p.dnaMatches.push({ provider: '', matchPersonId: '', segments: [] });
        this.person.set({ ...p });
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

    removeDnaSegment(matchIndex: number, segmentIndex: number) {
        const p = this.person();
        if (!p || !p.dnaMatches) return;
        p.dnaMatches[matchIndex].segments?.splice(segmentIndex, 1);
        this.person.set({ ...p });
    }

    addTimelineItem() {
        // Standardmäßig als Ereignis 'BIRT' oder Fakt 'OCCU' hinzufügen.
        const current = this.timeline();
        this.timeline.set([...current, {
            originalType: 'event', // Standard
            originalIndex: -1, // Neu
            tag: 'DEAT', // Irgendwas als Standard
            date: '',
            place: '',
            description: '',
            media: [],
            notes: [],
            citations: [],
            editing: true,
            expanded: true
        }]);
    }

    editTimelineItem(index: number) {
        const current = this.timeline();
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
        current[index].citations!.push({ source: '', quality: 2, page: '', text: '' });
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

        // 3. Timeline wie bisher verarbeiten
        const newEvents: any[] = [];
        const newFacts: any[] = [];

        this.timeline().forEach(t => {
            const isEventTag = ['BIRT', 'CHR', 'DEAT', 'BURI', 'CREM', 'EMIG', 'IMMI', 'BAPM'].includes(t.tag);
            if (isEventTag || (t.originalType === 'event' && !['OCCU', 'EDUC', 'RELI', 'RESI', 'TITL', 'NATI', 'DSCR', 'FACT'].includes(t.tag))) {
                newEvents.push({
                    type: t.tag,
                    date: t.date,
                    place: t.place,
                    description: t.description || t.value,
                    media: t.media,
                    notes: t.notes,
                    citations: t.citations
                });
            } else {
                newFacts.push({
                    type: t.tag,
                    date: t.date,
                    place: t.place,
                    value: t.value || t.description,
                    media: t.media,
                    notes: t.notes,
                    citations: t.citations
                });
            }
        });

        // 4. Den Payload final zusammenbauen
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
            media: currentPerson.media,
            notes: currentPerson.notes,
            citations: (currentPerson.citations || []).map((c: any) => ({
                source: c.source || c.sourceTitle || '',
                page: c.page || c.whereInSource || '',
                dateText: c.dateText || c.date || '',
                quality: c.quality ?? null,
                text: c.text || ''
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

        const data = this.treeData()!;
        const treeName = data.meta?.tree || '';

        this.gedcomService.savePerson(treeName, payload).subscribe({
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
