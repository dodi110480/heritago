import { Injectable } from '@angular/core';
import { Individual, TimelineItem, TreeData } from '../../models';
import { GedcomService } from '../../gedcom.service';

@Injectable({
    providedIn: 'root'
})
export class PersonTimelineService {

    constructor(private gedcomService: GedcomService) {}

    // --- Core Computation Logic ---

    buildTimeline(person: Individual, treeData: TreeData | null, getPersonName: (id: string) => string): TimelineItem[] {
        if (!person) return [];

        let merged: TimelineItem[] = [];

        if (person.events) {
            person.events.forEach((ev, i) => {
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
                    associations: (ev as any).associations || [],
                    editing: false
                });
            });
        }

        if (person.facts) {
            person.facts.forEach((fact, i) => {
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
                    associations: (fact as any).associations || [],
                    editing: false
                });
            });
        }

        if (person.familiesAsSpouse && treeData) {
            const childBirthSeen = new Set<string>();
            person.familiesAsSpouse.forEach((famLink) => {
                const fullFam = treeData.families.find(f => f.id === famLink.familyId);
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
                            associations: (ef as any).associations || [],
                            editing: false
                        });
                    });
                }

                if (famLink.children && famLink.children.length > 0) {
                    famLink.children.forEach((childRef) => {
                        const child = treeData.individuals.find(i => i.id === childRef.id);
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
                                sourcePersonName: childRef.name || getPersonName(child.id) || 'Person',
                                tag: spec.tag,
                                date: childDate,
                                place: childPlace,
                                description: `${spec.label} von ${childRef.name || getPersonName(child.id) || 'Kind'}`,
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

        merged.sort((a, b) => {
            const dateA = this.parseToComparableDate(a.date);
            const dateB = this.parseToComparableDate(b.date);
            return dateA.getTime() - dateB.getTime();
        });

        return merged;
    }

    enrichPersonRelations(person: Individual, treeData: TreeData | null): { 
        relations: { type: string; personId: string; personName?: string; familyId?: string }[], 
        enrichedPerson: Individual 
    } {
        if (!person || !treeData) return { relations: [], enrichedPerson: person };

        const rels: { type: string; personId: string; personName?: string; familyId?: string }[] = [];
        const relSeen = new Set<string>();

        treeData.families.forEach(fam => {
            if (fam.children.includes(person.id)) {
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
            if (fam.husband === person.id || fam.wife === person.id) {
                const partner = fam.husband === person.id ? fam.wife : fam.husband;
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

        rels.forEach(r => r.personName = this.getPersonName(treeData, r.personId));

        const enrichedPerson = { ...person };
        enrichedPerson.familiesAsSpouse = [];
        const seenFamilyKeys = new Set<string>();

        treeData.families.forEach(fam => {
            if (fam.children.includes(person.id)) {
                if (fam.husband) {
                    enrichedPerson.fatherId = fam.husband;
                    enrichedPerson.fatherName = this.getPersonName(treeData, fam.husband);
                }
                if (fam.wife) {
                    enrichedPerson.motherId = fam.wife;
                    enrichedPerson.motherName = this.getPersonName(treeData, fam.wife);
                }
            }

            if (fam.husband === person.id || fam.wife === person.id) {
                const familyKey = [fam.husband || '', fam.wife || '', ...(fam.children || []).slice().sort()].join('|');
                if (seenFamilyKeys.has(familyKey)) return;
                seenFamilyKeys.add(familyKey);

                const spouseId = fam.husband === person.id ? fam.wife : fam.husband;

                if (!enrichedPerson.familiesAsSpouse) enrichedPerson.familiesAsSpouse = [];

                enrichedPerson.familiesAsSpouse.push({
                    familyId: fam.id,
                    spouseId: spouseId,
                    spouseName: spouseId ? this.getPersonName(treeData, spouseId) : 'Unbekannt',
                    children: Array.from(new Set(fam.children || [])).map(childId => ({
                        id: childId,
                        name: this.getPersonName(treeData, childId)
                    }))
                });
            }
        });

        return { relations: rels, enrichedPerson };
    }

    getParticipations(personId: string, treeData: TreeData | null): any[] {
        if (!treeData || !personId) return [];
        const results: any[] = [];
        treeData.individuals.forEach(ind => {
            if (ind.events) {
                ind.events.forEach(ev => {
                    if (ev.associations) {
                        ev.associations.forEach(assoc => {
                            if (assoc.associatedPersonId === personId) {
                                results.push({
                                    role: assoc.role,
                                    eventTag: ev.type,
                                    eventDate: ev.date || (ev as any).dateText,
                                    subjectPersonId: ind.id,
                                    subjectPersonName: this.getPrimaryName(ind)
                                });
                            }
                        });
                    }
                });
            }
        });
        return results;
    }

    // --- UI Formatting Helpers ---

    getPersonName(treeData: TreeData | null, id: string | undefined): string {
        if (!id) return '';
        if (!treeData) return id;
        const p = treeData.individuals.find(i => i.id === id);
        if (!p) return id;
        const given = p.names?.[0]?.given || p.firstName || '';
        const sur = p.names?.[0]?.surname || p.lastName || '';
        return `${given} ${sur}`.trim() || id;
    }

    getPrimaryName(person: Individual | null): string {
        if (!person) return '';
        const primaryName = person.names?.find(n => n.isPrimary);
        if (primaryName) {
            return `${primaryName.given || ''} ${primaryName.surname || ''}`.trim();
        }
        return `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.id;
    }

    getProfileImage(person: Individual | null): string | null {
        if (!person || !person.media || person.media.length === 0) return null;
        const primary = person.media.find(m => m.isPrimary) || person.media[0];
        return primary?.id ? this.gedcomService.getMediaUrl(primary.id, 'thumbs') : null;
    }

    getPersonAvatarData(treeData: TreeData | null, personId: string | undefined): { url: string | null, gender: string } {
        if (!personId || !treeData) return { url: null, gender: 'U' };
        const p = treeData.individuals.find(i => i.id === personId);
        if (!p) return { url: null, gender: 'U' };
        const primaryMedia = p.media && p.media.length > 0 ? (p.media.find(m => m.isPrimary) || p.media[0]) : null;
        const url = primaryMedia?.id ? this.gedcomService.getMediaUrl(primaryMedia.id, 'thumbs') : null;
        return { url, gender: p.gender || 'U' };
    }

    getFamilyWedding(treeData: TreeData | null, familyId: string | undefined): string {
        if (!familyId || !treeData) return '';
        const fam = treeData.families.find(f => f.id === familyId);
        if (!fam || !fam.events) return '';
        const marr = fam.events.find(e => e.type === 'MARR');
        if (!marr) return '';
        const date = marr.date || (marr as any).dateText || '';
        const place = marr.place || (marr as any).placeName || '';
        return date + (place ? ` in ${place}` : '');
    }

    getFamilyWeddingDate(treeData: TreeData | null, familyId: string | undefined): string {
        if (!familyId || !treeData) return '';
        const fam = treeData.families.find(f => f.id === familyId);
        const marr = fam?.events?.find(e => e.type === 'MARR');
        return marr?.date || (marr as any)?.dateText || '';
    }

    getFamilyWeddingPlace(treeData: TreeData | null, familyId: string | undefined): string {
        if (!familyId || !treeData) return '';
        const fam = treeData.families.find(f => f.id === familyId);
        const marr = fam?.events?.find(e => e.type === 'MARR');
        return marr?.place || (marr as any)?.placeName || '';
    }

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

    getRoleLabel(role: string): string {
        switch (role) {
            case 'GODPARENT': return 'Pate / Gevatter';
            case 'WITNESS': return 'Zeuge';
            case 'CLERGY': return 'Pfarrer / Priester';
            case 'INFORMANT': return 'Informant';
            case 'MIDWIFE': return 'Hebamme';
            case 'DOCTOR': return 'Arzt';
            case 'UNDERTAKER': return 'Bestatter';
            case 'OTHER': return 'Andere / Beteiligter';
            default: return role;
        }
    }

    getRoleIcon(role: string): string {
        switch (role) {
            case 'GODPARENT': return '🕊️';
            case 'WITNESS': return '📜';
            case 'CLERGY': return '⛪';
            case 'INFORMANT': return '📢';
            case 'MIDWIFE': return '👶';
            case 'DOCTOR': return '🩺';
            case 'UNDERTAKER': return '⚰️';
            default: return '👤';
        }
    }

    getEventLabel(tag: string): string {
        const labels: { [key: string]: string } = {
            'BIRT': 'Geburt',
            'CHR': 'Taufe',
            'DEAT': 'Tod',
            'BURI': 'Begräbnis',
            'MARR': 'Heirat',
            'OCCU': 'Beruf',
            'ADOP': 'Adoption',
            'CENS': 'Volkszählung',
            'RELI': 'Religion',
            'EVEN': 'Ereignis',
            'DIV': 'Scheidung'
        };
        return labels[tag] || tag;
    }

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

    getSourceTitle(availableSources: any[], sourceId?: string): string {
        if (!sourceId) return 'Ohne Quelle';
        const src = availableSources.find((s: any) => s.id === sourceId);
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
            case 'VERY_LIKELY': return 'bg-emerald-500/10 text-emerald-500'; 
            case 'LIKELY': return 'badge-highlight';
            case 'POSSIBLE': return 'badge-warn';
            case 'UNLIKELY': return 'badge-danger';
            default: return 'bg-neutral-950/10 text-neutral-400';
        }
    }

    private parseToComparableDate(dateStr: string | undefined): Date {
        if (!dateStr) return new Date(9999, 11, 31);

        const months: { [key: string]: number } = {
            'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
            'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
        };

        const dmy = dateStr.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i);
        if (dmy) {
            const day = parseInt(dmy[1]);
            const month = months[dmy[2].toUpperCase()] || 0;
            const year = parseInt(dmy[3]);
            return new Date(year, month, day);
        }

        const my = dateStr.match(/([A-Z]{3})\s+(\d{4})/i);
        if (my) {
            const month = months[my[1].toUpperCase()] || 0;
            const year = parseInt(my[2]);
            return new Date(year, month, 1);
        }

        const y = dateStr.match(/(\d{4})/);
        if (y) {
            return new Date(parseInt(y[1]), 0, 1);
        }

        return new Date(9999, 11, 31);
    }
}
