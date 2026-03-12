import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, map } from 'rxjs';
import { environment } from '../../environment';

@Injectable({
    providedIn: 'root'
})
export class PersonService {
    private http = inject(HttpClient);
    private baseApiUrl = `${environment.apiUrl}/tree/`;

    searchIndividuals(treeName: string, query: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/search`, {
            params: { q: query },
            withCredentials: true
        }).pipe(map(res => res?.data ?? res));
    }

    getTimeline(treeName: string, xref: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/timeline/${xref}`, { withCredentials: true });
    }

    savePerson(treeName: string, data: any): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/person`, data, { withCredentials: true }).pipe(
            map(res => res?.data ?? res),
            tap({
                error: (err) => console.error('[PersonService] savePerson error', err)
            }),
            catchError(err => { throw err; })
        );
    }

    deletePerson(treeName: string, id: string): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/person`, { mode: 'delete', id }, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    deletePersonById(treeName: string, id: string): Observable<any> {
        return this.http.delete<any>(`${this.baseApiUrl}${treeName}/person/${id}`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getChildren(treeName: string, personId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/person/${personId}/children`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getSpouses(treeName: string, personId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/person/${personId}/spouses`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getParents(treeName: string, personId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/person/${personId}/parents`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getSiblings(treeName: string, personId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/person/${personId}/siblings`, { withCredentials: true });
    }

    getFamilyOverview(treeName: string, personId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/person/${personId}/family-overview`, { withCredentials: true });
    }

    getFamiliesOfPerson(treeName: string, personId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/person/${personId}/families`, { withCredentials: true });
    }

    getFamilyById(treeName: string, familyId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/family/${familyId}`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    /**
     * Maps raw API results (forkJoin from person details) into a structured Individual object.
     */
    mapRawDataToIndividual(results: any, treeData: any, personId: string): any {
        const found = treeData.individuals.find((i: any) => i.id === personId);
        if (!found) return null;

        const copy = JSON.parse(JSON.stringify(found));
        
        // Children
        copy.children = results.children.map((fm: any) => ({
            id: fm.person.id,
            gedcomId: fm.person.gedcomId,
            name: `${fm.person.names[0]?.given || ''} ${fm.person.names[0]?.surname || ''}`.trim(),
            familyId: fm.familyId
        }));

        // Spouses and their children
        copy.familiesAsSpouse = results.spouses.map((fm: any) => {
            const otherSpouse = fm.family.familyMembers.find((m: any) => m.personId !== personId && m.role === 'SPOUSE');
            return {
                familyId: fm.family.id,
                spouseId: otherSpouse?.personId,
                spouseGedcomId: otherSpouse?.person.gedcomId,
                spouseName: otherSpouse ? `${otherSpouse.person.names[0]?.given || ''} ${otherSpouse.person.names[0]?.surname || ''}`.trim() : 'Unbekannt',
                children: fm.family.familyMembers.filter((m: any) => m.role === 'CHILD').map((m: any) => ({
                    id: m.personId,
                    gedcomId: m.person.gedcomId,
                    name: `${m.person.names[0]?.given || ''} ${m.person.names[0]?.surname || ''}`.trim()
                }))
            };
        });

        // Parents
        const fatherFm = results.parents.find((fm: any) => fm.family.familyMembers.some((m: any) => m.role === 'SPOUSE' && m.person.sex === 'M'));
        const motherFm = results.parents.find((fm: any) => fm.family.familyMembers.some((m: any) => m.role === 'SPOUSE' && m.person.sex === 'F'));

        if (fatherFm) {
            const father = fatherFm.family.familyMembers.find((m: any) => m.role === 'SPOUSE' && m.person.sex === 'M')?.person;
            copy.fatherId = father.id;
            copy.fatherGedcomId = father.gedcomId;
            copy.fatherName = `${father.names[0]?.given || ''} ${father.names[0]?.surname || ''}`.trim();
        }
        if (motherFm) {
            const mother = motherFm.family.familyMembers.find((m: any) => m.role === 'SPOUSE' && m.person.sex === 'F')?.person;
            copy.motherId = mother.id;
            copy.motherGedcomId = mother.gedcomId;
            copy.motherName = `${mother.names[0]?.given || ''} ${mother.names[0]?.surname || ''}`.trim();
        }

        if (!copy.media) copy.media = [];
        if (!copy.notes) copy.notes = [];
        if (!copy.citations) copy.citations = [];
        if (!copy.names || copy.names.length === 0) {
            copy.names = [{ isPrimary: true, type: 'BIRTH', given: copy.firstName || '', surname: copy.lastName || '', full: copy.name || '' }];
        }
        if (!copy.privacyLevel) copy.privacyLevel = 'PRIVATE';

        // Initialisiere Assoziationsnamen
        if (!copy.associations) copy.associations = [];
        copy.associations.forEach((a: any) => {
            if (a.associatedPersonId) {
                const pId = a.associatedPersonId;
                const p = treeData.individuals.find((i: any) => i.id === pId);
                if (p) {
                    const primaryName = p.names?.find((n: any) => n.isPrimary) || p.names?.[0];
                    const name = primaryName ? `${primaryName.given || ''} ${primaryName.surname || ''}`.trim() : (p.name || 'Unbekannt');
                    a.associatedPersonName = name;
                    a._tempTargetName = `${name} (${pId})`;
                }
            } else if (a.associatedPersonName) {
                a._tempTargetName = a.associatedPersonName;
            }
        });
        
        return copy;
    }

    /**
     * Prepares the payload for savePerson based on the current individual state, 
     * timeline items, and relations.
     */
    prepareSavePayload(currentPerson: any, timeline: any[], relations: any[]): any {
        // Collect all raw relations
        let rawRelations = [...relations];

        if (currentPerson.fatherId) {
            rawRelations.push({ type: 'FATHER', personId: currentPerson.fatherId });
        }
        if (currentPerson.motherId) {
            rawRelations.push({ type: 'MOTHER', personId: currentPerson.motherId });
        }

        if (currentPerson.familiesAsSpouse) {
            currentPerson.familiesAsSpouse.forEach((fam: any) => {
                if (fam.spouseId) {
                    rawRelations.push({ type: 'SPOUSE', personId: fam.spouseId });
                }
                if (fam.children) {
                    fam.children.forEach((child: any) => {
                        rawRelations.push({ type: 'CHILD', personId: child.id });
                    });
                }
            });
        }

        // Remove duplicates
        const relationsPayload = rawRelations.filter((rel, index, self) =>
            index === self.findIndex((t) => (
                t.personId === rel.personId && t.type === rel.type
            ))
        );

        const newEvents: any[] = [];
        const newFacts: any[] = [];

        timeline.forEach(t => {
            if (t.originalType === 'family-event') return;
            const isEventTag = ['BIRT', 'CHR', 'DEAT', 'BURI', 'CREM', 'EMIG', 'IMMI', 'BAPM'].includes(t.tag);
            
            const eventData = {
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
                })),
                associations: (t.associations || []).map((a: any) => ({
                    role: a.role || 'OTHER',
                    associatedPersonId: a.associatedPersonId || null,
                    relationText: a.relationText || '',
                    dateText: a.dateText || '',
                    confidence: a.confidence || null,
                    notes: a.notes || ''
                }))
            };

            if (isEventTag || (t.originalType === 'event' && !['OCCU', 'EDUC', 'RELI', 'RESI', 'TITL', 'NATI', 'DSCR', 'FACT'].includes(t.tag))) {
                newEvents.push(eventData);
            } else {
                let factType = t.tag;
                const mapping: { [key: string]: string } = {
                    'RELI': 'RELIGION', 'OCCU': 'OCCUPATION', 'EDUC': 'EDUCATION',
                    'RESI': 'RESIDENCE', 'TITL': 'TITLE', 'NATI': 'NATIONALITY',
                    'PROP': 'PROPERTY', 'MILI': 'MILITARY_SERVICE',
                    'DSCR': 'DESCRIPTION', 'FACT': 'OTHER'
                };
                if (mapping[factType]) factType = mapping[factType];

                newFacts.push({
                    ...eventData,
                    type: factType,
                    value: t.value || t.description
                });
            }
        });

        // Sync names
        if (!currentPerson.names) currentPerson.names = [];
        let primaryName = currentPerson.names.find((n: any) => n.isPrimary);
        if (!primaryName) {
            primaryName = { isPrimary: true, type: 'BIRTH' };
            currentPerson.names.push(primaryName);
        }
        primaryName.given = currentPerson.firstName || '';
        primaryName.surname = currentPerson.lastName || '';
        primaryName.full = `${primaryName.given} /${primaryName.surname}/`.trim();
        currentPerson.name = `${primaryName.given} ${primaryName.surname}`.trim();

        return {
            id: currentPerson.id,
            firstName: currentPerson.firstName,
            lastName: currentPerson.lastName,
            gender: currentPerson.gender,
            isLiving: currentPerson.isLiving,
            privacyLevel: currentPerson.privacyLevel,
            exid: currentPerson.exid,
            name: currentPerson.name,
            names: (currentPerson.names || []).map((n: any) => ({
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
            relations: relationsPayload,
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
    }
}
