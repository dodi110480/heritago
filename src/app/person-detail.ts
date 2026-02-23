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
import { CanComponentDeactivate } from './unsaved-changes.guard';
import { firstValueFrom } from 'rxjs';

interface TimelineItem {
    originalType: 'event' | 'fact';
    originalIndex: number;
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
    imports: [CommonModule, FormsModule, CleanDatePipe, MediaSelector, PlaceModal, ImageViewer],
    templateUrl: './person-detail.html',
    styleUrl: './person-detail.css'
})
export class PersonDetail implements OnInit, CanComponentDeactivate {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private gedcomService = inject(GedcomService);
    private authService = inject(AuthService);

    personId = '';
    person = signal<Individual | null>(null);
    treeData = signal<TreeData | null>(null);
    loading = signal(true);
    isSaving = false;

    activeTab: 'basics' | 'timeline' | 'relations' | 'media' | 'notes' | 'citations' = 'basics';

    // Die verschmolzene Liste aus Events und Fakten
    timeline = signal<TimelineItem[]>([]);

    // Beziehungen
    relations = signal<{ type: string; personId: string; personName?: string }[]>([]);

    showMediaSelector = false;

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

    // New Person & Unsaved Changes Guard
    isNewPerson = false;
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

    ngOnInit() {
        this.route.queryParamMap.subscribe(qp => {
            this.isNewPerson = qp.get('new') === 'true';
        });
        this.route.paramMap.subscribe(params => {
            const id = params.get('id');
            if (id) {
                this.personId = id;
                this.loadPersonData();
            }
        });
    }

    canDeactivate(): boolean | Promise<boolean> {
        if (!this.isNewPerson || this.hasSaved) {
            return true;
        }
        // Show modal and wait for user decision
        this.showLeaveModal.set(true);
        return new Promise<boolean>((resolve) => {
            this.leaveResolver = resolve;
        });
    }

    async confirmSaveAndLeave() {
        this.savePerson();
        this.hasSaved = true;
        this.showLeaveModal.set(false);
        if (this.leaveResolver) {
            this.leaveResolver(true);
            this.leaveResolver = null;
        }
    }

    async confirmDiscardAndLeave() {
        // Delete the unsaved new person
        const data = this.treeData();
        const treeName = data?.meta?.tree || '';
        if (treeName && this.personId) {
            try {
                await firstValueFrom(this.gedcomService.deletePersonById(treeName, this.personId));
            } catch (e) {
                console.error('Failed to delete discarded person:', e);
            }
        }
        this.hasSaved = true; // Prevent re-triggering
        this.showLeaveModal.set(false);
        if (this.leaveResolver) {
            this.leaveResolver(true);
            this.leaveResolver = null;
        }
    }

    cancelLeave() {
        this.showLeaveModal.set(false);
        if (this.leaveResolver) {
            this.leaveResolver(false);
            this.leaveResolver = null;
        }
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

        // TODO: Könnte nach Datum sortiert werden, wenn Datums-Parse-Logik da ist.
        this.timeline.set(merged);
    }

    buildRelations() {
        const p = this.person();
        const data = this.treeData();
        if (!p || !data) return;

        const rels: { type: string; personId: string; personName?: string }[] = [];

        data.families.forEach(fam => {
            if (fam.children.includes(p.id)) {
                if (fam.husband) rels.push({ type: 'FATHER', personId: fam.husband });
                if (fam.wife) rels.push({ type: 'MOTHER', personId: fam.wife });
            }
            if (fam.husband === p.id || fam.wife === p.id) {
                const partner = fam.husband === p.id ? fam.wife : fam.husband;
                if (partner) rels.push({ type: 'SPOUSE', personId: partner });
                fam.children.forEach(child => {
                    rels.push({ type: 'CHILD', personId: child });
                });
            }
        });

        // Resolve names and set initial search query
        rels.forEach(r => r.personName = this.getPersonName(r.personId));
        this.relations.set(rels);
    }

    addRelation() {
        const current = this.relations();
        this.relations.set([...current, { type: 'CHILD', personId: '', personName: '' }]);
    }

    removeRelation(index: number) {
        const current = this.relations();
        current.splice(index, 1);
        this.relations.set([...current]);
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

    onMediaUpload(event: any) {
        const file = event.target.files[0];
        if (!file) return;

        const tree = this.authService.currentTree();
        if (!tree) return;

        this.gedcomService.uploadMedia(tree.id, file).subscribe({
            next: (res: any) => {
                if (res.success && res.media) {
                    const p = this.person();
                    if (p) {
                        p.media = p.media || [];
                        p.media.push({
                            id: res.media.id,
                            url: res.media.url,
                            title: res.media.title || res.media.originalFileName || '',
                            isPrimary: p.media.length === 0,
                            mimeType: res.media.mimeType
                        });
                        this.person.set({ ...p });
                    }
                }
            },
            error: (err) => {
                console.error('Upload failed', err);
                alert('Fehler beim Upload!');
            }
        });

        // Reset input so the same file could be selected again if needed
        event.target.value = '';
    }

    onEventMediaUpload(event: any, itemIndex: number) {
        const file = event.target.files[0];
        if (!file) return;

        const tree = this.authService.currentTree();
        if (!tree) return;

        this.gedcomService.uploadMedia(tree.id, file).subscribe({
            next: (res: any) => {
                if (res.success && res.media) {
                    const current = this.timeline();
                    current[itemIndex].media = current[itemIndex].media || [];
                    current[itemIndex].media!.push({
                        id: res.media.id,
                        url: res.media.url,
                        title: res.media.title || res.media.originalFileName || '',
                        isPrimary: false,
                        mimeType: res.media.mimeType
                    });
                    this.timeline.set([...current]);
                }
            }
        });
        event.target.value = '';
    }

    openMediaSelector(itemIndex?: number) {
        this.activeTimelineIndexForMedia = itemIndex !== undefined ? itemIndex : null;
        this.showMediaSelector = true;
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
                url: mediaObj.url,
                title: mediaObj.title || mediaObj.originalFileName || '',
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
                    url: mediaObj.url,
                    title: mediaObj.title || mediaObj.originalFileName || '',
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

    addEventMedia(index: number) {
        const current = this.timeline();
        if (!current[index].media) current[index].media = [];
        current[index].media!.push({ url: '', title: '', isPrimary: false });
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

        // Timeline wieder in Events und Facts aufsplitten
        const newEvents: any[] = [];
        const newFacts: any[] = [];

        this.timeline().forEach(t => {
            const isEventTag = ['BIRT', 'CHR', 'DEAT', 'BURI', 'CREM', 'EMIG', 'IMMI', 'BAPM'].includes(t.tag);

            // Wir könnten die Logik auch an t.originalType hängen, aber wenn der Nutzer den Typ ändert, wechseln wir
            if (isEventTag || t.originalType === 'event' && !['OCCU', 'EDUC', 'RELI', 'RESI', 'TITL', 'NATI', 'DSCR', 'FACT'].includes(t.tag)) {
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

        currentPerson.events = newEvents;
        currentPerson.facts = newFacts;

        const payload: any = {
            id: currentPerson.id,
            names: currentPerson.names, // Ensure backend logic still applies name properly or uses names array
            name: currentPerson.name,
            firstName: currentPerson.firstName,
            lastName: currentPerson.lastName,
            gender: currentPerson.gender,
            events: newEvents,
            facts: newFacts,
            relations: this.relations(),
            media: currentPerson.media,
            notes: currentPerson.notes,
            citations: currentPerson.citations
        };

        const data = this.treeData()!;
        const treeName = data.meta?.tree || '';

        this.gedcomService.savePerson(treeName, payload).subscribe({
            next: () => {
                this.isSaving = false;
                this.hasSaved = true;
                this.isNewPerson = false;
                // Toast oder ähnliches anzeigen
                this.loadPersonData(); // Reload
            },
            error: () => {
                this.isSaving = false;
                alert('Fehler beim Speichern');
            }
        });
    }
}
