import { PrismaClient } from '@prisma/client';
import { DateUtils } from '../shared/date.utils';
import { NotesService } from './notes.service';
import { GedcomService } from './gedcom.service';
import { AuditService } from './audit.service';
import { GenealogyValidator } from '../shared/validator.utils';

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export class PersonService {
    private notesService: NotesService;
    private gedcomService: GedcomService;
    private auditService: AuditService;

    constructor(private prisma: PrismaClient) {
        this.notesService = new NotesService(prisma);
        this.gedcomService = new GedcomService(prisma);
        this.auditService = new AuditService(prisma);
    }

    /**
     * Recursive check to prevent ancestry cycles (e.g., A is father of B, B is father of A)
     * Returns true if targetId is an ancestor of personId
     */
    private async isAncestor(tx: any, targetId: string, personId: string, visited = new Set<string>()): Promise<boolean> {
        if (targetId === personId) return true;
        if (visited.has(personId)) return false;
        visited.add(personId);

        // Find all parents of 'personId'
        const parentLinks = await tx.familyMember.findMany({
            where: { personId, role: 'CHILD' },
            include: {
                family: {
                    include: {
                        familyMembers: { where: { role: 'SPOUSE' } }
                    }
                }
            }
        });

        for (const link of parentLinks) {
            const parents = link.family?.familyMembers || [];
            for (const p of parents) {
                if (p.personId === targetId) return true;
                if (await this.isAncestor(tx, targetId, p.personId, visited)) return true;
            }
        }
        return false;
    }

    private parseYear(dateText: string): number | null {
        if (!dateText) return null;
        const match = dateText.match(/\d{4}/);
        return match ? parseInt(match[0], 10) : null;
    }

    async getFullProfile(personId: string, treeId: string) {
        const person = await this.prisma.person.findUnique({
            where: { id: personId, treeId },
            include: {
                names: true,
                events: {
                    include: {
                        place: true,
                        citations: { include: { source: true, citationTexts: true, noteLinks: { include: { note: { include: { createdBy: true } } } } } },
                        noteLinks: { include: { note: { include: { createdBy: true } } } },
                        mediaLinks: { include: { media: true } },
                        associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } }
                    }
                },
                facts: {
                    include: {
                        place: true,
                        citations: { include: { source: true, citationTexts: true, noteLinks: { include: { note: { include: { createdBy: true } } } } } },
                        noteLinks: { include: { note: { include: { createdBy: true } } } },
                        mediaLinks: { include: { media: true } },
                        associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } }
                    }
                },
                mediaLinks: { include: { media: true } },
                citations: { include: { source: true, citationTexts: true, noteLinks: { include: { note: { include: { createdBy: true } } } } } },
                noteLinks: {
                    include: {
                        note: {
                            include: { createdBy: true }
                        }
                    }
                },
                dnaMatches: {
                    include: {
                        segments: true
                    }
                },
                familyMembers: {
                    include: {
                        family: {
                            include: {
                                events: {
                                    include: {
                                        place: true,
                                        citations: { include: { source: true, citationTexts: true, noteLinks: { include: { note: { include: { createdBy: true } } } } } },
                                        noteLinks: { include: { note: { include: { createdBy: true } } } },
                                        mediaLinks: { include: { media: true } },
                                        associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } }
                                    }
                                },
                                familyMembers: {
                                    include: {
                                        person: {
                                            include: {
                                                names: { where: { isPrimary: true } },
                                                mediaLinks: { include: { media: true }, where: { isPrimary: true } },
                                                events: {
                                                    include: {
                                                        place: true,
                                                        citations: { include: { source: true, citationTexts: true, noteLinks: { include: { note: { include: { createdBy: true } } } } } },
                                                        noteLinks: { include: { note: { include: { createdBy: true } } } },
                                                        mediaLinks: { include: { media: true } }
                                                    }
                                                },
                                                facts: {
                                                    include: {
                                                        place: true,
                                                        citations: { include: { source: true, citationTexts: true, noteLinks: { include: { note: { include: { createdBy: true } } } } } },
                                                        noteLinks: { include: { note: { include: { createdBy: true } } } },
                                                        mediaLinks: { include: { media: true } }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                noteLinks: { include: { note: { include: { createdBy: true } } } },
                                citations: { include: { source: true, citationTexts: true, noteLinks: { include: { note: { include: { createdBy: true } } } } } },
                                mediaLinks: { include: { media: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!person) return null;

        const timeline: any[] = [];
        const relations: any[] = [];
        const relSeen = new Set<string>();

        const birthEvent = (person.events || []).find((e: any) => e.type === 'BIRT');
        const birthDate = birthEvent?.dateText;

        // 1. Process Person's own events & facts
        (person.events || []).forEach((ev: any) => {
            timeline.push({
                id: ev.id,
                itemKind: 'event',
                originalType: 'event',
                tag: ev.type,
                label: this.getEventLabel(ev.type),
                date: ev.dateText,
                dateText: ev.dateText,
                place: ev.place?.name,
                description: ev.description,
                age: this.calculateAge(birthDate, ev.dateText),
                isPrimary: ev.type === 'BIRT' || ev.type === 'DEAT',
                media: (ev.mediaLinks || []).map((ml: any) => ({
                    id: ml.media?.id,
                    url: ml.media?.remoteUrl || (ml.media?.filePath ? `/uploads/${ml.media?.filePath}` : null),
                    title: ml.media?.title || ml.caption || '',
                    isPrimary: ml.isPrimary
                })),
                notes: (ev.noteLinks || []).map((nl: any) => ({
                    id: nl.note?.id,
                    text: nl.note?.text,
                    noteType: nl.note?.noteType || 'OTHER',
                    isPrivate: nl.note?.privacyLevel === 'PRIVATE'
                })),
                citations: (ev.citations || []).map((c: any) => ({
                    id: c.id,
                    sourceId: c.sourceId,
                    whereInSource: c.page,
                    confidence: c.confidence,
                    sourceTitle: c.source?.title
                })),
                associations: (ev.associations || []).map((a: any) => ({
                    id: a.id,
                    role: a.role,
                    associatedPersonId: a.associatedPersonId,
                    associatedPersonName: a.associated?.names?.find((n: any) => n.isPrimary)?.full || 'Unbekannt',
                    relationText: a.relationText,
                    dateText: a.dateText,
                    confidence: a.confidence,
                    notes: a.notes
                }))
            });
        });

        (person.facts || []).forEach((f: any) => {
            timeline.push({
                id: f.id,
                itemKind: 'fact',
                originalType: 'fact',
                tag: f.type,
                label: this.getTagLabel(f.type),
                date: f.dateText,
                dateText: f.dateText,
                place: f.place?.name,
                value: f.value,
                description: f.description,
                age: this.calculateAge(birthDate, f.dateText),
                media: (f.mediaLinks || []).map((ml: any) => ({
                    id: ml.media?.id,
                    url: ml.media?.remoteUrl || (ml.media?.filePath ? `/uploads/${ml.media?.filePath}` : null),
                    title: ml.media?.title || ml.caption || '',
                    isPrimary: ml.isPrimary
                })),
                notes: (f.noteLinks || []).map((nl: any) => ({
                    id: nl.note?.id,
                    text: nl.note?.text,
                    noteType: nl.note?.noteType || 'OTHER',
                    isPrivate: nl.note?.privacyLevel === 'PRIVATE'
                })),
                citations: (f.citations || []).map((c: any) => ({
                    id: c.id,
                    sourceId: c.sourceId,
                    whereInSource: c.page,
                    confidence: c.confidence,
                    sourceTitle: c.source?.title
                })),
                associations: (f.associations || []).map((a: any) => ({
                    id: a.id,
                    role: a.role,
                    associatedPersonId: a.associatedPersonId,
                    associatedPersonName: a.associated?.names?.find((n: any) => n.isPrimary)?.full || 'Unbekannt',
                    relationText: a.relationText,
                    dateText: a.dateText,
                    confidence: a.confidence,
                    notes: a.notes
                }))
            });
        });

        // 2. Process Families (Spouse / Child roles)
        person.familyMembers.forEach((fm: any) => {
            const fam = fm.family;
            if (!fam) return;

            if (fm.role === 'SPOUSE') {
                const partnerLink = fam.familyMembers.find((m: any) => m.role === 'SPOUSE' && m.personId !== personId);
                const partner = partnerLink?.person;
                const weddingEv = (fam.events || []).find((e: any) => e.type === 'MARR');
                const weddingInfo = weddingEv 
                    ? `${weddingEv.dateText || ''}${weddingEv.place?.name ? ' in ' + weddingEv.place.name : ''}`.trim()
                    : undefined;

                // Relation
                const relKey = `SPOUSE:${partner?.id || 'unknown'}-${fam.id}`;
                if (!relSeen.has(relKey)) {
                    relSeen.add(relKey);
                    
                    // Format family-level notes and citations
                    const famNotes = (fam.noteLinks || []).map((nl: any) => ({
                        id: nl.note?.id,
                        text: nl.note?.text || '',
                        noteType: nl.note?.noteType || 'OTHER',
                        isPrivate: nl.note?.privacyLevel === 'PRIVATE',
                        createdAt: nl.note?.createdAt
                    }));

                    const famCitations = (fam.citations || []).map((c: any) => ({
                        id: c.id,
                        sourceId: c.sourceId,
                        sourceTitle: c.source?.title,
                        whereInSource: c.page,
                        date: c.dateText,
                        confidence: c.confidence
                    }));

                    // Detailed Wedding Event
                    const fullWeddingEvent = weddingEv ? {
                        id: weddingEv.id,
                        type: weddingEv.type,
                        dateText: weddingEv.dateText,
                        dateStart: weddingEv.dateStart,
                        dateType: weddingEv.dateType,
                        place: weddingEv.place?.name,
                        placeId: weddingEv.placeId,
                        description: weddingEv.description,
                        notes: (weddingEv.noteLinks || []).map((nl: any) => ({
                            id: nl.note?.id,
                            text: nl.note?.text || '',
                            noteType: nl.note?.noteType || 'OTHER',
                            isPrivate: nl.note?.privacyLevel === 'PRIVATE'
                        })),
                        citations: (weddingEv.citations || []).map((c: any) => ({
                            id: c.id,
                            sourceId: c.sourceId,
                            sourceTitle: c.source?.title,
                            whereInSource: c.page,
                            date: c.dateText,
                            confidence: c.confidence
                        })),
                        media: (weddingEv.mediaLinks || []).map((ml: any) => ({
                            id: ml.media?.id,
                            title: ml.media?.title,
                            isPrimary: ml.isPrimary
                        })),
                        associations: (weddingEv.associations || []).map((a: any) => ({
                            id: a.id,
                            role: a.role,
                            associatedPersonId: a.associatedPersonId,
                            associatedPersonName: a.associated?.names?.find((n: any) => n.isPrimary)?.full || 'Unbekannt',
                            relationText: a.relationText,
                            dateText: a.dateText,
                            confidence: a.confidence,
                            notes: a.notes
                        }))
                    } : undefined;

                    relations.push({
                        type: 'SPOUSE',
                        label: this.getRelationLabel('SPOUSE', fm.pedigreeType, partner?.sex),
                        personId: partner?.id,
                        personName: partner ? this.getPrimaryName(partner) : 'Unbekannt',
                        familyId: fam.id,
                        familyMemberId: fm.id,
                        pedigreeType: fm.pedigreeType,
                        marriageType: fm.marriageType,
                        restrictionNotice: fam.restrictionNotice,
                        isPrimary: fm.isPrimary,
                        profileImageUrl: this.getProfileImageUrl(partner),
                        weddingInfo,
                        weddingEvent: fullWeddingEvent,
                        notes: famNotes,
                        citations: famCitations
                    });
                }

                (fam.events || []).forEach((fe: any) => {
                    timeline.push({
                        originalType: 'family-event',
                        tag: fe.type,
                        label: this.getEventLabel(fe.type),
                        date: fe.dateText,
                        place: fe.place?.name,
                        description: fe.description || (fe.type === 'MARR' ? `Heirat mit ${partner ? this.getPrimaryName(partner) : 'Unbekannt'}` : ''),
                        age: this.calculateAge(birthDate, fe.dateText),
                        media: (fe.mediaLinks || []).map((ml: any) => ({
                            id: ml.media.id,
                            title: ml.media.title,
                            isPrimary: ml.isPrimary
                        })),
                        notes: (fe.noteLinks || []).map((nl: any) => ({
                            id: nl.note.id,
                            text: nl.note.text
                        })),
                        citations: (fe.citations || []).map((c: any) => ({
                            id: c.id,
                            sourceId: c.sourceId,
                            sourceTitle: c.source?.title,
                            whereInSource: c.page,
                            confidence: c.confidence
                        })),
                        associations: (fe.associations || []).map((a: any) => ({
                            id: a.id,
                            role: a.role,
                            associatedPersonId: a.associatedPersonId,
                            associatedPersonName: a.associated?.names?.find((n: any) => n.isPrimary)?.full || 'Unbekannt',
                            relationText: a.relationText,
                            dateText: a.dateText,
                            confidence: a.confidence,
                            notes: a.notes
                        }))
                    });
                });

                // Children of this family
                fam.familyMembers.filter((m: any) => m.role === 'CHILD').forEach((cLink: any) => {
                    const child = cLink.person;
                    if (!child) return;

                    const childRelKey = `CHILD:${child.id}`;
                    if (!relSeen.has(childRelKey)) {
                        relSeen.add(childRelKey);
                        
                        const famNotes = (fam.noteLinks || []).map((nl: any) => ({
                            id: nl.note?.id,
                            text: nl.note?.text || '',
                            noteType: nl.note?.noteType || 'OTHER',
                            isPrivate: nl.note?.privacyLevel === 'PRIVATE'
                        }));

                        const famCitations = (fam.citations || []).map((c: any) => ({
                            id: c.id,
                            sourceId: c.sourceId,
                            sourceTitle: c.source?.title,
                            whereInSource: c.page,
                            date: c.dateText,
                            confidence: c.confidence
                        }));

                        relations.push({
                            type: 'CHILD',
                            label: this.getRelationLabel('CHILD', cLink.pedigreeType, child.sex),
                            personId: child.id,
                            personName: this.getPrimaryName(child),
                            familyId: fam.id,
                            familyMemberId: cLink.id,
                            pedigreeType: cLink.pedigreeType,
                            isPrimary: cLink.isPrimary,
                            profileImageUrl: this.getProfileImageUrl(child),
                            notes: famNotes,
                            citations: famCitations
                        });
                    }

                    const childEventKey = `CHILD_DERIVED:${child.id}`;
                    if (!relSeen.has(childEventKey)) {
                        relSeen.add(childEventKey);
                        
                        // Derived Child Events (BIRT, MARR, DEAT)
                        const interesting = ['BIRT', 'MARR', 'DEAT'];
                        const labels: any = { 'BIRT': 'Geburt', 'MARR': 'Heirat', 'DEAT': 'Tod' };
                        
                        (child.events || []).filter((e: any) => interesting.includes(e.type)).forEach((ce: any) => {
                            timeline.push({
                                originalType: 'family-event',
                                tag: ce.type,
                                label: labels[ce.type],
                                date: ce.dateText,
                                place: ce.place?.name,
                                description: `${labels[ce.type]} von Kind ${this.getPrimaryName(child)}`,
                                age: this.calculateAge(birthDate, ce.dateText),
                                sourcePersonId: child.id,
                                sourcePersonName: this.getPrimaryName(child),
                                originalIndex: -1
                            });
                        });
                    }
                });
            } else if (fm.role === 'CHILD') {
                // Family where person is child
                const parents = fam.familyMembers.filter((m: any) => m.role === 'SPOUSE');
                const siblings = fam.familyMembers.filter((m: any) => m.role === 'CHILD' && m.personId !== personId);

                // Parents Relation & Events
                parents.forEach((pLink: any) => {
                    const parent = pLink.person;
                    if (!parent) return;

                    const role = parent.sex === 'M' ? 'FATHER' : (parent.sex === 'F' ? 'MOTHER' : 'PARENT');
                    const relKey = `${role}:${parent.id}`;
                    if (!relSeen.has(relKey)) {
                        relSeen.add(relKey);

                        const famNotes = (fam.noteLinks || []).map((nl: any) => ({
                            id: nl.note?.id,
                            text: nl.note?.text || '',
                            noteType: nl.note?.noteType || 'OTHER',
                            isPrivate: nl.note?.privacyLevel === 'PRIVATE'
                        }));

                        const famCitations = (fam.citations || []).map((c: any) => ({
                            id: c.id,
                            sourceId: c.sourceId,
                            sourceTitle: c.source?.title,
                            whereInSource: c.page,
                            date: c.dateText,
                            confidence: c.confidence
                        }));

                        relations.push({
                            type: role,
                            label: this.getRelationLabel(role, fm.pedigreeType, parent.sex),
                            personId: parent.id,
                            personName: this.getPrimaryName(parent),
                            familyId: fam.id,
                            familyMemberId: fm.id,
                            pedigreeType: fm.pedigreeType,
                            isPrimary: fm.isPrimary,
                            profileImageUrl: this.getProfileImageUrl(parent),
                            notes: famNotes,
                            citations: famCitations
                        });
                    }
                    
                    const parentEventKey = `PARENT_DERIVED:${parent.id}`;
                    if (!relSeen.has(parentEventKey)) {
                        relSeen.add(parentEventKey);
                        
                        const interesting = ['DEAT', 'BURI'];
                        const labels: any = { 'DEAT': 'Tod', 'BURI': 'Begräbnis' };
                        
                        (parent.events || []).filter((e: any) => interesting.includes(e.type)).forEach((pe: any) => {
                            timeline.push({
                                originalType: 'family-event',
                                tag: pe.type,
                                label: labels[pe.type],
                                date: pe.dateText,
                                place: pe.place?.name,
                                description: `${labels[pe.type]} von ${this.getPrimaryName(parent)} (Elternteil)`,
                                age: this.calculateAge(birthDate, pe.dateText),
                                sourcePersonId: parent.id,
                                sourcePersonName: this.getPrimaryName(parent),
                                originalIndex: -1
                            });
                        });
                    }
                });

                // Siblings Relation & Events
                siblings.forEach((sLink: any) => {
                    const sibling = sLink.person;
                    if (!sibling) return;

                    const siblingKey = `SIBLING_DERIVED:${sibling.id}`;
                    if (!relSeen.has(siblingKey)) {
                        relSeen.add(siblingKey);

                        (sibling.events || []).filter((e: any) => e.type === 'BIRT').forEach((se: any) => {
                            timeline.push({
                                originalType: 'family-event',
                                tag: 'BIRT',
                                label: 'Geburt',
                                date: se.dateText,
                                place: se.place?.name,
                                description: `Geburt von Geschwister ${this.getPrimaryName(sibling)}`,
                                age: this.calculateAge(birthDate, se.dateText),
                                sourcePersonId: sibling.id,
                                sourcePersonName: this.getPrimaryName(sibling),
                                originalIndex: -1
                            });
                        });
                    }
                });
            }
        });

        // 3. Participations (GODPARENT etc.)
        const associations = await this.prisma.association.findMany({
            where: { associatedPersonId: personId },
            include: {
                event: {
                    include: {
                        person: {
                            include: { names: { where: { isPrimary: true } } }
                        }
                    }
                }
            }
        });

        associations.forEach((assoc: any) => {
            const ev = assoc.event;
            const subject = ev?.person;
            if (!ev || !subject) return;

            timeline.push({
                originalType: 'participation',
                tag: ev.type,
                label: this.getEventLabel(ev.type),
                date: ev.dateText,
                role: assoc.role,
                roleLabel: this.getRoleLabel(assoc.role),
                description: `Teilnahme als ${this.getRoleLabel(assoc.role)} bei ${ev.type === 'BIRT' ? 'Geburt' : this.getEventLabel(ev.type)} von ${this.getPrimaryName(subject)}`,
                age: this.calculateAge(birthDate, ev.dateText),
                subjectPersonId: subject.id,
                subjectPersonName: this.getPrimaryName(subject),
                eventTag: ev.type,
                eventDate: ev.dateText
            });
        });

        // 4. Sort Timeline
        timeline.sort((a, b) => DateUtils.compareTimelineItems(a, b));

        const personData = PersonService.formatPersonForClient(person);

        return {
            person: personData,
            timeline,
            relations
        };
    }

    private getTagLabel(tag: string): string {
        const labels: { [key: string]: string } = {
            'BIRT': 'Geburt', 'CHR': 'Taufe', 'DEAT': 'Tod', 'BURI': 'Begräbnis',
            'CREM': 'Einäscherung', 'EMIG': 'Auswanderung', 'IMMI': 'Einwanderung',
            'OCCU': 'Beruf', 'RELI': 'Religion', 'EDUC': 'Bildung', 'RESI': 'Wohnsitz',
            'TITL': 'Titel', 'NATI': 'Nationalität', 'DSCR': 'Körperl. Merkmale', 'FACT': 'Fakt'
        };
        return labels[tag] || tag;
    }

    private calculateAge(birthDate: string | null | undefined, eventDate: string | null | undefined): number | null {
        if (!birthDate || !eventDate) return null;
        
        const getYear = (s: string) => {
            const m = s.match(/(\d{4})/);
            return m ? parseInt(m[1]) : null;
        };
        const by = getYear(birthDate);
        const ey = getYear(eventDate);
        if (by === null || ey === null) return null;
        return ey - by;
    }

    private getRoleLabel(role: string): string {
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

    private getEventLabel(tag: string): string {
        const labels: { [key: string]: string } = {
            'BIRT': 'Geburt', 'CHR': 'Taufe', 'DEAT': 'Tod', 'BURI': 'Begräbnis',
            'MARR': 'Heirat', 'OCCU': 'Beruf', 'ADOP': 'Adoption', 'CENS': 'Volkszählung',
            'RELI': 'Religion', 'EVEN': 'Ereignis', 'DIV': 'Scheidung'
        };
        return labels[tag] || tag;
    }

    static getGenderLabel(gender?: string): string {
        if (gender === 'M') return 'Männlich';
        if (gender === 'F') return 'Weiblich';
        if (gender === 'X') return 'Divers';
        return 'Unbekannt';
    }

    static getPrivacyLabel(level?: string): string {
        if (level === 'PUBLIC') return 'Öffentlich';
        if (level === 'FAMILY') return 'Familie';
        return 'Privat';
    }

    private static formatCitationForClient(cit: any) {
        if (!cit) return null;
        
        const confidenceLabels: Record<string, string> = {
            'CERTAIN': 'Sicher',
            'VERY_LIKELY': 'Sehr wahrscheinlich',
            'LIKELY': 'Wahrscheinlich',
            'POSSIBLE': 'Möglich',
            'UNLIKELY': 'Unwahrscheinlich'
        };

        const confidenceColorClasses: Record<string, string> = {
            'CERTAIN': 'badge-success',
            'VERY_LIKELY': 'bg-emerald-500/10 text-emerald-500',
            'LIKELY': 'badge-highlight',
            'POSSIBLE': 'badge-warn',
            'UNLIKELY': 'badge-danger'
        };

        const dateVal = cit.date || cit.dateText || cit.dataDateText;
        let dateLabel = '';
        if (dateVal) {
            const d = new Date(dateVal);
            if (!isNaN(d.getTime())) {
                dateLabel = d.toLocaleDateString('de-DE');
            }
        }

        return {
            ...cit,
            confidenceLabel: confidenceLabels[cit.confidence || ''] || 'Keine Angabe',
            confidenceColorClass: confidenceColorClasses[cit.confidence || ''] || 'bg-neutral-950/10 text-neutral-400',
            dateLabel,
            description: (cit.whereInSource || cit.page) ? `Fundstelle: ${cit.whereInSource || cit.page}` : '',
            title: cit.source?.title || 'Unbekannte Quelle',
            author: cit.source?.author,
            publication: cit.source?.publication
        };
    }

    private static formatCitationsForClient(citations: any[] = []) {
        return (citations || []).map(cit => PersonService.formatCitationForClient(cit)).filter(Boolean);
    }

    private static formatNoteForClient(noteLink: any) {
        const n = noteLink.note;
        if (!n) return null;
        return {
            id: n.id,
            text: n.text || '',
            noteType: n.noteType || 'GENERAL',
            noteTypeLabel: PersonService.getNoteTypeLabel(n.noteType),
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
            isPrivate: n.privacyLevel === 'PRIVATE',
            createdBy: n.createdBy?.username || 'System',
            context: noteLink.context
        };
    }

    private static formatNotesForClient(noteLinks: any[] = []) {
        return (noteLinks || []).map(nl => PersonService.formatNoteForClient(nl)).filter(Boolean);
    }

    static getNoteTypeLabel(type?: string): string {
        const map: Record<string, string> = {
            GENERAL: 'Allgemein',
            RESEARCH: 'Recherche',
            TRANSCRIPTION: 'Transkript',
            ANALYSIS: 'Analyse',
            TODO: 'ToDo'
        };
        return map[type || ''] || (type || 'Allgemein');
    }

    static getConfidenceLabel(conf: string): string {
        switch (conf) {
            case 'CERTAIN': return 'Sicher';
            case 'VERY_LIKELY': return 'Sehr wahrscheinlich';
            case 'LIKELY': return 'Wahrscheinlich';
            case 'POSSIBLE': return 'Möglich';
            case 'UNLIKELY': return 'Unwahrscheinlich';
            default: return 'Keine Angabe';
        }
    }

    private getRelationLabel(type: string, pedigreeType?: string | null, gender?: 'M' | 'F' | 'X' | 'U'): string {
        let label = '';
        const g = gender || 'U';
        
        switch (type) {
            case 'SPOUSE': 
                label = g === 'M' ? 'Ehemann' : (g === 'F' ? 'Ehefrau' : 'Partner/in'); 
                break;
            case 'FATHER': label = 'Vater'; break;
            case 'MOTHER': label = 'Mutter'; break;
            case 'CHILD': 
                label = g === 'M' ? 'Sohn' : (g === 'F' ? 'Tochter' : 'Kind'); 
                break;
            case 'SON': label = 'Sohn'; break;
            case 'DAUGHTER': label = 'Tochter'; break;
            case 'HUSBAND': label = 'Ehemann'; break;
            case 'WIFE': label = 'Ehefrau'; break;
            default: label = 'Verwandte(r)';
        }

        if (pedigreeType === 'STEP') {
            if (type === 'MOTHER') label = 'Stiefmutter';
            else if (type === 'FATHER') label = 'Stiefvater';
            else if (type === 'CHILD') label = g === 'M' ? 'Stiefsohn' : (g === 'F' ? 'Stieftochter' : 'Stiefkind');
        } else if (pedigreeType === 'ADOPTED') {
            if (type === 'MOTHER') label = 'Adoptivmutter';
            else if (type === 'FATHER') label = 'Adoptivvater';
            else if (type === 'CHILD') label = g === 'M' ? 'Adoptivsohn' : (g === 'F' ? 'Adoptivtochter' : 'Adoptivkind');
        } else if (pedigreeType === 'FOSTER') {
            label = `Pflege-${label.toLowerCase()}`;
        }
        return label;
    }

    private getPrimaryName(person: any): string {
        const primary = person.names?.find((n: any) => n.isPrimary) || person.names?.[0];
        return primary ? `${primary.given || ''} ${primary.surname || ''}`.trim() : (person.gedcomId || 'Unbekannt');
    }

    private getProfileImageUrl(person: any): string | null {
        if (!person) return null;
        const primaryMedia = person.mediaLinks?.find((ml: any) => ml.isPrimary)?.media;
        return primaryMedia?.id || null;
    }

    // compareDates removed, use DateUtils

    async savePerson(treeId: string, data: any, currentUserId?: string) {
        console.log(`[PersonService] savePerson for tree ${treeId}, person ${data.id}`);
        if (data.relations) {
            console.log(`[PersonService] found ${data.relations.length} relations in payload`);
        }
        const isGedcomId = (val?: string) =>
            typeof val === 'string' && /^@I\d+@$/i.test(val.trim());
        const isUuid = (val?: string) =>
            typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

        const incomingGedcomId = isGedcomId(data.gedcomId) ? data.gedcomId : (isGedcomId(data.id) ? data.id : undefined);
        const incomingUuid = isUuid(data.id) ? data.id : undefined;

        let person;
        if (incomingUuid) {
            const existingById = await this.prisma.person.findUnique({ where: { id: incomingUuid } });
            if (existingById) {
                person = await this.prisma.person.update({
                    where: { id: incomingUuid },
                    data: { sex: data.gender || 'U', gedcomId: incomingGedcomId || existingById.gedcomId }
                });
            } else {
                const gedcomId = incomingGedcomId || `@I${Math.floor(Math.random() * 1000000)}@`;
                person = await this.prisma.person.create({
                    data: { id: incomingUuid, treeId, gedcomId, sex: data.gender || 'U' }
                });
            }
        } else {
            const gedcomId = incomingGedcomId || `@I${Date.now()}${Math.floor(Math.random() * 1000)}@`;
            person = await this.prisma.person.upsert({
                where: { treeId_gedcomId: { treeId, gedcomId } },
                update: { sex: data.gender || 'U' },
                create: { treeId, gedcomId, sex: data.gender || 'U' }
            });
        }

        return this.prisma.$transaction(async (tx) => {
            // 1. Basic Person Data & Primary Name
            // Sync names from UI if provided
            if (data.names && Array.isArray(data.names)) {
                // Ensure primary name is updated/created
                const primaryUI = data.names.find((n: any) => n.isPrimary) || data.names[0];
                if (primaryUI) {
                    const primaryName = await tx.name.findFirst({
                        where: { personId: person.id, isPrimary: true }
                    });
                    
                    const nameData = {
                        given: primaryUI.given || '',
                        surname: primaryUI.surname || '',
                        full: primaryUI.full || `${primaryUI.given || ''} ${primaryUI.surname || ''}`.trim(),
                        prefix: primaryUI.prefix || null,
                        suffix: primaryUI.suffix || null,
                        type: primaryUI.type || 'BIRTH'
                    };

                    if (primaryName) {
                        await tx.name.update({
                            where: { id: primaryName.id },
                            data: nameData
                        });
                    } else {
                        await tx.name.create({
                            data: {
                                ...nameData,
                                treeId,
                                personId: person.id,
                                isPrimary: true
                            }
                        });
                    }
                }
                
                // OPTIONAL: Sync other names if needed (but primary is usually enough for now)
            } else if (data.firstName !== undefined || data.lastName !== undefined) {
                // Legacy fallback
                const primaryName = await tx.name.findFirst({
                    where: { personId: person.id, isPrimary: true }
                });
                if (primaryName) {
                    await tx.name.update({
                        where: { id: primaryName.id },
                        data: {
                            given: data.firstName || '',
                            surname: data.lastName || '',
                            full: `${data.firstName || ''} ${data.lastName || ''}`.trim()
                        }
                    });
                } else {
                    await tx.name.create({
                        data: {
                            treeId,
                            personId: person.id,
                            given: data.firstName || '',
                            surname: data.lastName || '',
                            full: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
                            isPrimary: true
                        }
                    });
                }
            }

            // 2. Events & Facts (Identify removals and map from UI)
            const incomingEvents = data.events || [];
            const incomingFacts = data.facts || [];
            
            // If the UI sends a "mixed" timeline (like in Heritago's PersonDetail),
            // we should sort it here into Events and Facts if not already separated.
            const allTimelineItems = Array.isArray(data.timeline) ? data.timeline : [];
            if (allTimelineItems.length > 0) {
                // Clear and rebuild based on timeline items
                incomingEvents.length = 0;
                incomingFacts.length = 0;
                
                const EVENT_TAGS = ['BIRT', 'CHR', 'DEAT', 'BURI', 'CREM', 'EMIG', 'IMMI', 'BAPM', 'MARR', 'DIV', 'ANUL', 'ENGA', 'ADOP', 'EVEN', 'OTHER'];
                const FACT_TYPE_MAPPING: { [key: string]: string } = {
                    'OCCU': 'OCCUPATION', 'EDUC': 'EDUCATION', 'RELI': 'RELIGION',
                    'RESI': 'RESIDENCE', 'TITL': 'TITLE', 'NATI': 'NATIONALITY',
                    'PROP': 'PROPERTY', 'MILI': 'MILITARY_SERVICE',
                    'DSCR': 'DESCRIPTION', 'FACT': 'OTHER'
                };

                for (const t of allTimelineItems) {
                    if (t.originalType === 'family-event') continue;
                    
                    const isEvent = EVENT_TAGS.includes(t.tag) || t.type === 'event' || t.originalType === 'event';
                    const factType = FACT_TYPE_MAPPING[t.tag] || t.tag;

                    const baseData = {
                        id: t.id,
                        type: isEvent ? t.tag : factType,
                        dateText: t.dateText || t.date || null,
                        place: t.place || t.placeName || null,
                        placeId: t.placeId || null,
                        description: t.description || (isEvent ? null : t.value),
                        value: t.value || (!isEvent ? t.description : null),
                        media: t.media || [],
                        notes: t.notes || [],
                        citations: t.citations || [],
                        associations: t.associations || []
                    };

                    if (isEvent) {
                        incomingEvents.push(baseData);
                    } else {
                        incomingFacts.push(baseData);
                    }
                }
            }

            const incomingEventIds = incomingEvents.map((e: any) => e.id).filter(Boolean);
            const incomingFactIds = incomingFacts.map((f: any) => f.id).filter(Boolean);

            // Delete existing person-events/facts not in incoming payload
            await tx.citation.deleteMany({
                where: { event: { personId: person.id, id: { notIn: incomingEventIds } } }
            });
            await tx.mediaLink.deleteMany({
                where: { event: { personId: person.id, id: { notIn: incomingEventIds } } }
            });
            await tx.event.deleteMany({
                where: { personId: person.id, id: { notIn: incomingEventIds } }
            });

            await tx.fact.deleteMany({
                where: { personId: person.id, id: { notIn: incomingFactIds } }
            });

            // Process Events
            if (incomingEvents.length > 0) {
                for (const e of incomingEvents) {
                    const placeName = (e.place || '').trim();
                    let placeId = e.placeId || null;

                    if (placeName) {
                        const existingPlace = placeId ? await tx.place.findUnique({ where: { id: placeId } }) : null;
                        if (!existingPlace || existingPlace.name !== placeName) {
                            let place = await tx.place.findFirst({ where: { treeId, name: placeName, parentId: null } });
                            if (!place) {
                                place = await tx.place.create({ data: { treeId, name: placeName, historicNames: [] } });
                            }
                            placeId = place.id;
                        }
                    } else {
                        placeId = null;
                    }

                    const eventData = {
                        type: e.type,
                        dateText: e.dateText || null,
                        description: e.description || null,
                        placeId: placeId
                    };

                    const createdEvent = e.id && isUuid(e.id)
                        ? await tx.event.update({ where: { id: e.id }, data: eventData })
                        : await tx.event.create({
                            data: {
                                ...eventData,
                                treeId,
                                personId: person.id
                            }
                        });

                    if (e.notes) await this.notesService.processSharedNotes(tx, treeId, e.notes, { eventId: createdEvent.id }, currentUserId);

                    if (Array.isArray(e.media)) {
                        // Clear existing links to allow full sync (removals & additions)
                        await tx.mediaLink.deleteMany({ where: { eventId: createdEvent.id } });
                        for (const med of e.media) {
                            const mediaObj = await this.gedcomService.ensureMediaObject(treeId, med);
                            if (mediaObj) {
                                await tx.mediaLink.create({
                                    data: { 
                                        treeId, 
                                        eventId: createdEvent.id, 
                                        mediaId: mediaObj.id,
                                        isPrimary: !!med.isPrimary
                                    }
                                });
                            }
                        }
                    }

                    if (Array.isArray(e.citations)) {
                        for (const cit of e.citations) {
                            if (!cit.sourceId) continue;
                            const createdCitation = await tx.citation.create({
                                data: {
                                    treeId,
                                    eventId: createdEvent.id,
                                    sourceId: cit.sourceId,
                                    page: cit.page || cit.whereInSource || null,
                                    dateText: cit.dateText || cit.date || null,
                                    confidence: cit.confidence || null,
                                    citationTexts: (cit.text || cit.dataText) ? {
                                        create: [{ text: cit.text || cit.dataText }]
                                    } : undefined
                                }
                            });
                            if (cit.notes) await this.notesService.processSharedNotes(tx, treeId, cit.notes, { citationId: createdCitation.id }, currentUserId);
                        }
                    }

                    if (Array.isArray(e.associations)) {
                        // Clear existing associations to sync
                        await tx.association.deleteMany({ where: { eventId: createdEvent.id } });
                        for (const a of e.associations) {
                            await tx.association.create({
                                data: {
                                    treeId,
                                    eventId: createdEvent.id,
                                    role: a.role || 'OTHER',
                                    associatedPersonId: a.associatedPersonId || null,
                                    relationText: a.relationText || '',
                                    dateText: a.dateText || '',
                                    confidence: a.confidence || null,
                                    notes: a.notes || ''
                                }
                            });
                        }
                    }
                }
            }

            // Process Facts
            if (incomingFacts.length > 0) {
                for (const f of incomingFacts) {
                    const placeName = (f.place || f.placeName || '').trim();
                    let placeId = f.placeId || null;

                    if (placeName) {
                        const existingPlace = placeId ? await tx.place.findUnique({ where: { id: placeId } }) : null;
                        if (!existingPlace || existingPlace.name !== placeName) {
                            let place = await tx.place.findFirst({ where: { treeId, name: placeName, parentId: null } });
                            if (!place) {
                                place = await tx.place.create({ data: { treeId, name: placeName, historicNames: [] } });
                            }
                            placeId = place.id;
                        }
                    } else {
                        placeId = null;
                    }

                    const factData = {
                        type: f.type,
                        value: f.value || null,
                        dateText: f.dateText || null,
                        placeId: placeId
                    };

                    const createdFact = f.id && isUuid(f.id)
                        ? await tx.fact.update({ where: { id: f.id }, data: factData })
                        : await tx.fact.create({
                            data: {
                                ...factData,
                                treeId,
                                personId: person.id
                            }
                        });
                    if (f.notes) await this.notesService.processSharedNotes(tx, treeId, f.notes, { factId: createdFact.id }, currentUserId);

                    if (Array.isArray(f.media)) {
                        // Clear existing links to allow full sync
                        await tx.mediaLink.deleteMany({ where: { factId: createdFact.id } });
                        for (const med of f.media) {
                            const mediaObj = await this.gedcomService.ensureMediaObject(treeId, med);
                            if (mediaObj) {
                                await tx.mediaLink.create({
                                    data: { 
                                        treeId, 
                                        factId: createdFact.id, 
                                        mediaId: mediaObj.id,
                                        isPrimary: !!med.isPrimary
                                    }
                                });
                            }
                        }
                    }

                    if (Array.isArray(f.citations)) {
                        for (const cit of f.citations) {
                            if (!cit.sourceId) continue;
                            const createdCitation = await tx.citation.create({
                                data: {
                                    treeId,
                                    factId: createdFact.id,
                                    sourceId: cit.sourceId,
                                    page: cit.page || cit.whereInSource || null,
                                    dateText: cit.dateText || cit.date || null,
                                    confidence: cit.confidence || null,
                                    citationTexts: (cit.text || cit.dataText) ? {
                                        create: [{ text: cit.text || cit.dataText }]
                                    } : undefined
                                }
                            });
                            if (cit.notes) await this.notesService.processSharedNotes(tx, treeId, cit.notes, { citationId: createdCitation.id }, currentUserId);
                        }
                    }

                    if (Array.isArray(f.associations)) {
                        // Clear existing associations to sync
                        await tx.association.deleteMany({ where: { factId: createdFact.id } });
                        for (const a of f.associations) {
                            await tx.association.create({
                                data: {
                                    treeId,
                                    factId: createdFact.id,
                                    role: a.role || 'OTHER',
                                    associatedPersonId: a.associatedPersonId || null,
                                    relationText: a.relationText || '',
                                    dateText: a.dateText || '',
                                    confidence: a.confidence || null,
                                    notes: a.notes || ''
                                }
                            });
                        }
                    }
                }
            }

            // 3. Sync Relations (Extract from UI fields if explicitly provided, else sync from relations array)
            const incomingRelations = data.relations || [];
            
            // Extract from shortcut fields if present (this moves prepareSavePayload logic to backend)
            if (data.fatherId) incomingRelations.push({ type: 'FATHER', personId: data.fatherId });
            if (data.motherId) incomingRelations.push({ type: 'MOTHER', personId: data.motherId });
            
            if (Array.isArray(data.families)) {
                for (const fam of data.families) {
                    if (fam.spouseId) {
                        incomingRelations.push({ 
                            type: 'SPOUSE', 
                            personId: fam.spouseId, 
                            familyId: fam.familyId,
                            familyMemberId: fam.familyMemberId,
                            pedigreeType: fam.pedigreeType,
                            isPrimary: !!fam.isPrimary
                        });
                    }
                    if (Array.isArray(fam.children)) {
                        for (const child of fam.children) {
                            incomingRelations.push({ 
                                type: 'CHILD', 
                                personId: child.id, 
                                familyId: fam.familyId,
                                familyMemberId: child.familyMemberId,
                                pedigreeType: child.pedigreeType,
                                isPrimary: !!child.isPrimary
                            });
                        }
                    }
                }
            }

            // Remove duplicates
            const uniqueRelations = incomingRelations.filter((rel: any, index: number, self: any[]) =>
                index === self.findIndex((t: any) => (
                    t.personId === rel.personId && t.type === rel.type && t.familyId === rel.familyId
                ))
            );

            // --- Validation: Genetic Logic Check ---
            const bioMothers = uniqueRelations.filter((r: any) => r.type === 'MOTHER' && (r.pedigreeType === 'BIRTH' || r.pedigreeType === 'null' || !r.pedigreeType));
            if (bioMothers.length > 1) {
                console.warn(`[Validation] Person ${person.id} has ${bioMothers.length} biological mothers in payload.`);
                throw new Error('Genealogie-Konflikt: Eine Person kann nur EINE leibliche Mutter haben.');
            }

            const bioFathers = uniqueRelations.filter((r: any) => r.type === 'FATHER' && (r.pedigreeType === 'BIRTH' || r.pedigreeType === 'null' || !r.pedigreeType));
            if (bioFathers.length > 1) {
                console.warn(`[Validation] Person ${person.id} has ${bioFathers.length} biological fathers in payload.`);
                throw new Error('Genealogie-Konflikt: Eine Person kann nur EINEN leiblichen Vater haben.');
            }

            // --- Validation: Ancestry Cycles ---
            for (const rel of uniqueRelations) {
                if (rel.type === 'FATHER' || rel.type === 'MOTHER') {
                    // Add rel.personId as a parent of person.id
                    // Check if person.id is already an ancestor of rel.personId
                    const isCycle = await this.isAncestor(tx, person.id, rel.personId);
                    if (isCycle) {
                        const name = rel.personName || rel.personId;
                        throw new Error(`Zirkelschluss erkannt: ${name} kann nicht als Elternteil hinzugefügt werden, da diese Person bereits ein Nachfahre von dir ist.`);
                    }
                }
            }

            // --- Validation: Chronological Check (Basic Years) ---
            const timelineItems = Array.isArray(data.timeline) ? data.timeline : [];
            const birthEvent = data.events?.find((e: any) => e.type === 'BIRT') || timelineItems.find((t: any) => t.tag === 'BIRT');
            const deathEvent = data.events?.find((e: any) => e.type === 'DEAT') || timelineItems.find((t: any) => t.tag === 'DEAT');
            
            const currentBirthYear = this.parseYear(data.birthDate || birthEvent?.dateText || birthEvent?.date || '');
            const currentDeathYear = this.parseYear(data.deathDate || deathEvent?.dateText || deathEvent?.date || '');

            if (currentBirthYear && currentDeathYear && currentDeathYear < currentBirthYear) {
                throw new Error('Chronologie-Konflikt: Das Sterbedatum liegt vor dem Geburtsdatum.');
            }

            for (const rel of uniqueRelations) {
                if (rel.type === 'FATHER' || rel.type === 'MOTHER') {
                    const parent = await tx.person.findUnique({
                        where: { id: rel.personId },
                        include: { events: { where: { type: { in: ['BIRT', 'DEAT'] } } } }
                    });
                    if (parent && currentBirthYear) {
                        const pBirth = this.parseYear(parent.events.find((e: any) => e.type === 'BIRT')?.dateText || '');
                        const pDeath = this.parseYear(parent.events.find((e: any) => e.type === 'DEAT')?.dateText || '');
                        
                        if (pBirth && currentBirthYear < pBirth + 12) {
                            throw new Error(`Chronologie-Konflikt: ${rel.personName || 'Elternteil'} ist zu jung, um ein Kind in diesem Jahr zu haben.`);
                        }
                        if (pDeath && currentBirthYear > pDeath + 1) { // 1 year grace for father/gestation
                             throw new Error(`Chronologie-Konflikt: ${rel.personName || 'Elternteil'} war zum Zeitpunkt der Geburt bereits verstorben.`);
                        }
                    }
                }
            }

            // --- Intelligent Relationship Management ---
            console.log('[Backend] Processing relations. Unique count:', uniqueRelations.length);
            
            // Fetch ALL family members where this person is involved (SPOUSE or CHILD)
            const currentFms = await tx.familyMember.findMany({
                where: {
                    OR: [
                        { personId: person.id },
                        {
                            role: 'CHILD',
                            family: { familyMembers: { some: { personId: person.id, role: 'SPOUSE' } } }
                        }
                    ]
                }
            });

            const incomingFmIds = uniqueRelations.map((r: any) => r.familyMemberId).filter(Boolean);

            // 1. Delete removed links
            const toDelete = currentFms.filter(fm => !incomingFmIds.includes(fm.id));
            if (toDelete.length > 0) {
                console.log('[Backend] Deleting removed links:', toDelete.map(f => f.id));
                for (const fm of toDelete) {
                    await tx.familyMember.delete({ where: { id: fm.id } });
                }
            }

            // 2. Process updates and new links with Smart Discovery
            for (const rel of uniqueRelations) {
                await this.processRelationUpdate(tx, treeId, person, rel, uniqueRelations, currentUserId);
            }

            // --- Post-Save Reconciliation: Merge Redundant Spouse Families ---
            const allFamsInTree = await tx.family.findMany({
                where: { treeId },
                include: { familyMembers: true }
            });

            const spouseGroups = new Map<string, string[]>(); 
            for (const f of allFamsInTree) {
                const spouseIds = f.familyMembers
                    .filter(m => m.role === 'SPOUSE')
                    .map(m => m.personId)
                    .sort()
                    .join('|');
                
                if (spouseIds) {
                    const existing = spouseGroups.get(spouseIds) || [];
                    existing.push(f.id);
                    spouseGroups.set(spouseIds, existing);
                }
            }

            for (const [key, famIds] of spouseGroups.entries()) {
                if (famIds.length > 1) {
                    const survivorId = famIds[0];
                    const victims = famIds.slice(1);
                    console.log(`[Reconciliation] Merging redundant families into ${survivorId} for spouses ${key}`);
                    
                    for (const vid of victims) {
                        // Move Children
                        const victimChildren = await tx.familyMember.findMany({ where: { familyId: vid, role: 'CHILD' } });
                        for (const child of victimChildren) {
                            await tx.familyMember.upsert({
                                where: { familyId_personId: { familyId: survivorId, personId: child.personId } },
                                update: { pedigreeType: child.pedigreeType, isPrimary: child.isPrimary },
                                create: { familyId: survivorId, personId: child.personId, role: 'CHILD', pedigreeType: child.pedigreeType, isPrimary: child.isPrimary }
                            });
                        }
                        // Move Events, Notes, Media, Citations
                        await tx.event.updateMany({ where: { familyId: vid }, data: { familyId: survivorId } });
                        await tx.noteLink.updateMany({ where: { familyId: vid }, data: { familyId: survivorId } });
                        await tx.mediaLink.updateMany({ where: { familyId: vid }, data: { familyId: survivorId } });
                        await tx.citation.updateMany({ where: { familyId: vid }, data: { familyId: survivorId } });
                        await tx.association.updateMany({ where: { familyId: vid }, data: { familyId: survivorId } });
                        
                        // Cleanup victim
                        await tx.familyMember.deleteMany({ where: { familyId: vid } });
                        await tx.family.delete({ where: { id: vid } });
                    }
                }
            }

            // --- Final Cleanup: Delete families with NO members in this tree ---
            const finalFams = await tx.family.findMany({
                where: { treeId },
                include: { familyMembers: true }
            });
            for (const f of finalFams) {
                if (f.familyMembers.length === 0) {
                    console.log(`[Reconciliation] Deleting empty ghost family ${f.id}`);
                    // Ensure no leftovers
                    await tx.event.deleteMany({ where: { familyId: f.id } });
                    await tx.noteLink.deleteMany({ where: { familyId: f.id } });
                    await tx.mediaLink.deleteMany({ where: { familyId: f.id } });
                    await tx.citation.deleteMany({ where: { familyId: f.id } });
                    await tx.association.deleteMany({ where: { familyId: f.id } });
                    await tx.family.delete({ where: { id: f.id } });
                }
            }

            // 4. Notes
            if (data.notes) await this.notesService.processSharedNotes(tx, treeId, data.notes, { personId: person.id }, currentUserId);

            // 5. Media
            if (Array.isArray(data.media)) {
                await tx.mediaLink.deleteMany({ where: { personId: person.id, eventId: null, factId: null } });
                for (const med of data.media) {
                    const mediaObj = await this.gedcomService.ensureMediaObject(treeId, med);
                    if (mediaObj) {
                        await tx.mediaLink.create({
                            data: {
                                treeId,
                                personId: person.id,
                                mediaId: mediaObj.id,
                                isPrimary: !!med.isPrimary,
                                role: med.role || null
                            }
                        });
                    }
                }
            }

            // 6. Person-level Citations
            if (Array.isArray(data.citations)) {
                await tx.citationText.deleteMany({ where: { citation: { personId: person.id, eventId: null, factId: null } } });
                await tx.citation.deleteMany({ where: { personId: person.id, eventId: null, factId: null } });

                for (const cit of data.citations) {
                    if (!cit.sourceId) continue;
                    const createdCitation = await tx.citation.create({
                        data: {
                            treeId,
                            personId: person.id,
                            sourceId: cit.sourceId,
                            page: cit.page || cit.whereInSource || null,
                            dateText: cit.dateText || cit.date || null,
                            confidence: cit.confidence || null,
                            citationTexts: (cit.text || cit.dataText) ? {
                                create: [{ text: cit.text || cit.dataText }]
                            } : undefined
                        }
                    });
                    if (cit.notes) await this.notesService.processSharedNotes(tx, treeId, cit.notes, { citationId: createdCitation.id }, currentUserId);
                }
            }

            // 7. DNA Matches
            if (Array.isArray(data.dnaMatches)) {
                await tx.dnaSegment.deleteMany({ where: { personId: person.id } });
                await tx.dnaMatch.deleteMany({ where: { personId: person.id } });

                for (const m of data.dnaMatches) {
                    const dnaMatch = await tx.dnaMatch.create({
                        data: {
                            treeId,
                            personId: person.id,
                            matchPersonId: m.matchPersonId || null,
                            provider: m.provider || null,
                            totalCm: (m.totalCm !== null && m.totalCm !== '') ? Number(m.totalCm) : null,
                            largestSegmentCm: (m.largestSegmentCm !== null && m.largestSegmentCm !== '') ? Number(m.largestSegmentCm) : null,
                            segmentCount: (m.segmentCount !== null && m.segmentCount !== '') ? Number(m.segmentCount) : null,
                            predictedRelationship: m.predictedRelationship || null,
                            confidence: m.confidence || null,
                            testDate: m.testDate ? new Date(m.testDate) : null,
                            kitId: m.kitId || null
                        }
                    });

                    if (Array.isArray(m.segments)) {
                        for (const s of m.segments) {
                            await tx.dnaSegment.create({
                                data: {
                                    treeId,
                                    personId: person.id,
                                    matchId: dnaMatch.id,
                                    chromosome: String(s.chromosome || ''),
                                    startPosition: Number(s.startPosition || 0),
                                    endPosition: Number(s.endPosition || 0),
                                    cm: Number(s.cm || 0),
                                    snpCount: (s.snpCount !== null && s.snpCount !== '') ? Number(s.snpCount) : null,
                                    isTriangulated: !!s.isTriangulated
                                }
                            });
                        }
                    }
                }
            }

            // Audit Log
            const afterState = await tx.person.findUnique({
                where: { id: person.id },
                include: {
                    names: true,
                    events: { include: { place: true } },
                    facts: { include: { place: true } }
                }
            });

            const action = data.id ? 'UPDATE' : 'CREATE';
            await this.auditService.logChange({
                treeId,
                userId: currentUserId,
                action: action,
                entityType: 'PERSON',
                entityId: person.id,
                before: data.beforeState,
                after: afterState,
                summary: `Person ${data.firstName || ''} ${data.lastName || ''} ${action === 'CREATE' ? 'erstellt' : 'aktualisiert'}`.trim()
            });

            return this.getFullProfile(person.id, treeId);
        });
    }

    async deletePerson(id: string, treeId: string) {
        const person = await this.prisma.person.findUnique({
            where: { id },
            include: { names: { where: { isPrimary: true } } }
        });
        if (!person) throw new Error('Person not found');

        const primaryName = person.names[0];
        await this.auditService.logChange({
            treeId,
            action: 'DELETE',
            entityType: 'PERSON',
            entityId: person.id,
            before: person,
            summary: `Person ${primaryName?.given || ''} ${primaryName?.surname || ''} gelöscht`.trim()
        });

        await this.prisma.person.delete({ where: { id } });

        // Cleanup: Remove any families that became empty/redundant after this deletion
        // We import it lazily or locally to avoid circular dependencies if needed
        const { FamilyService } = await import('./family.service');
        const familyService = new FamilyService(this.prisma);
        await familyService.cleanupRedundantFamilies(treeId);
    }

    async getChildren(personId: string) {
        const familyMembers = await this.prisma.familyMember.findMany({
            where: { personId, role: 'SPOUSE' },
            select: { familyId: true }
        });
        const familyIds = familyMembers.map(fm => fm.familyId);
        
        return this.prisma.familyMember.findMany({
            where: {
                familyId: { in: familyIds },
                role: 'CHILD'
            },
            include: {
                person: {
                    include: {
                        names: { where: { isPrimary: true } }
                    }
                }
            }
        });
    }

    async getParents(personId: string) {
        return this.prisma.familyMember.findMany({
            where: { personId, role: 'CHILD' },
            include: {
                family: {
                    include: {
                        familyMembers: {
                            include: {
                                person: {
                                    include: {
                                        names: { where: { isPrimary: true } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    async getSpouses(personId: string) {
        return this.prisma.familyMember.findMany({
            where: { personId, role: 'SPOUSE' },
            include: {
                family: {
                    include: {
                        events: { include: { place: true } },
                        familyMembers: {
                            include: {
                                person: {
                                    include: {
                                        names: { where: { isPrimary: true } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    static formatPersonForClient(person: any) {
        if (!person) return null;
        const primaryName = person.names?.find((n: any) => n.isPrimary) || person.names?.[0];
        const fullName = primaryName ? (primaryName.full || `${primaryName.given || ''} ${primaryName.surname || ''}`.trim()) : '';
        const finalName = fullName || person.gedcomId || 'Unbekannt';
        
        const birthEvent = person.events?.find((e: any) => e.type === 'BIRT');
        const deathEvent = person.events?.find((e: any) => e.type === 'DEAT');
        
        const primaryMediaLink = person.mediaLinks?.find((ml: any) => ml.isPrimary) || person.mediaLinks?.[0];

        return {
            id: person.id,
            treeId: person.treeId,
            gedcomId: person.gedcomId,
            name: finalName,
            firstName: primaryName?.given || '',
            lastName: primaryName?.surname || '',
            gender: person.sex || 'U',
            genderLabel: PersonService.getGenderLabel(person.sex),
            privacyLevel: person.privacyLevel || 'PRIVATE',
            privacyLevelLabel: PersonService.getPrivacyLabel(person.privacyLevel),
            isLiving: !deathEvent,
            birthDate: birthEvent?.dateText || '',
            birthPlace: birthEvent?.place?.name || '',
            deathDate: deathEvent?.dateText || '',
            deathPlace: deathEvent?.place?.name || '',
            profileImageUrl: primaryMediaLink?.media?.id || '',
            
            names: person.names || [],
            events: (person.events || []).map((e: any) => ({
                id: e.id,
                type: e.type,
                dateText: e.dateText,
                place: e.place?.name,
                placeId: e.placeId,
                description: e.description,
                isPrimary: e.type === 'BIRT' || e.type === 'DEAT'
            })),
            facts: (person.facts || []).map((f: any) => ({
                id: f.id,
                type: f.type,
                value: f.value,
                dateText: f.dateText,
                placeId: f.placeId,
                placeName: f.place?.name
            })),
            media: (person.mediaLinks || []).map((ml: any) => ({
                id: ml.media.id,
                title: ml.media.title,
                url: ml.media.path || ml.media.remoteUrl,
                isPrimary: ml.isPrimary
            })),
            completeness: GenealogyValidator.calculateCompleteness(person),
            familyLinkCount: PersonService.calculateFamilyLinkCount(person),
            formattedCitations: PersonService.formatCitationsForClient(person.citations),
            formattedNotes: PersonService.formatNotesForClient(person.noteLinks),
            notes: (person.noteLinks || []).map((nl: any) => nl.note?.text).filter(Boolean),
            createdAt: person.createdAt,
            updatedAt: person.updatedAt
        };
    }

    // calculateCompletenessScore moved to GenealogyValidator

    static calculateFamilyLinkCount(person: any): number {
        if (!person.familyMembers) return 0;
        let count = 0;
        // Parents and Spouse roles
        count += person.familyMembers.length;
        // Children (count children in families where person is spouse)
        person.familyMembers.forEach((fm: any) => {
            if (fm.role === 'SPOUSE' && fm.family?.familyMembers) {
                count += fm.family.familyMembers.filter((m: any) => m.role === 'CHILD').length;
            }
        });
        return count;
    }

    private async processRelationUpdate(tx: any, treeId: string, person: any, rel: any, allRelations: any[], currentUserId?: string) {
        console.log(`[processRelationUpdate] Person: ${person.id}, RelType: ${rel.type}, RelPerson: ${rel.personId}, mType: ${rel.marriageType}`);
        const pedigree = (rel.pedigreeType === null || rel.pedigreeType === 'null') ? null : (rel.pedigreeType || undefined);
        
        let selfRole: any = 'SPOUSE';
        let relatedRole: any = 'SPOUSE';
        if (rel.type === 'FATHER' || rel.type === 'MOTHER') {
            selfRole = 'CHILD';
            relatedRole = 'SPOUSE';
        } else if (rel.type === 'CHILD') {
            selfRole = 'SPOUSE';
            relatedRole = 'CHILD';
        }

        let targetFam;
        if (rel.familyId && isUuid(rel.familyId)) {
            targetFam = await tx.family.findUnique({ where: { id: rel.familyId } });
        }

        // Discovery Logic: Find existing family for these participants
        if (!targetFam && rel.personId) {
            if (rel.type === 'FATHER' || rel.type === 'MOTHER') {
                targetFam = await tx.family.findFirst({
                    where: { treeId, familyMembers: { some: { personId: person.id, role: 'CHILD' } } }
                });
                if (!targetFam) {
                    const otherParentRel = allRelations.find((r: any) => (r.type === 'FATHER' || r.type === 'MOTHER') && r.personId !== rel.personId);
                    if (otherParentRel && otherParentRel.personId) {
                        targetFam = await tx.family.findFirst({
                            where: {
                                treeId,
                                AND: [
                                    { familyMembers: { some: { personId: rel.personId, role: 'SPOUSE' } } },
                                    { familyMembers: { some: { personId: otherParentRel.personId, role: 'SPOUSE' } } }
                                ]
                            }
                        });
                    }
                }
            } else if (rel.type === 'SPOUSE') {
                targetFam = await tx.family.findFirst({
                    where: {
                        treeId,
                        AND: [
                            { familyMembers: { some: { personId: person.id, role: 'SPOUSE' } } },
                            { familyMembers: { some: { personId: rel.personId, role: 'SPOUSE' } } }
                        ]
                    }
                });
            } else if (rel.type === 'CHILD') {
                targetFam = await tx.family.findFirst({
                    where: { treeId, familyMembers: { some: { personId: person.id, role: 'SPOUSE' } } }
                });
            }
        }

        // Create new family if discovery failed
        if (!targetFam && rel.personId) {
            targetFam = await tx.family.create({ data: { treeId } });
            await tx.familyMember.create({
                data: { familyId: targetFam.id, personId: rel.personId, role: relatedRole }
            });
        }

        if (targetFam) {
            // Update family-level meta
            console.log(`[processRelationUpdate] Updating family ${targetFam.id} with restriction: ${rel.restrictionNotice}`);
            await tx.family.update({
                where: { id: targetFam.id },
                data: { restrictionNotice: (rel.restrictionNotice || 'NONE') as any }
            });

            // 1. Process Family Level Notes
            if (Array.isArray(rel.notes)) {
                 await this.notesService.processSharedNotes(tx, treeId, rel.notes, { familyId: targetFam.id }, currentUserId);
            }

            // 2. Process Family Level Citations
            if (Array.isArray(rel.citations)) {
                await tx.citation.deleteMany({ where: { familyId: targetFam.id, eventId: null } });
                for (const cit of rel.citations) {
                    if (!cit.sourceId) continue;
                    const cCit = await tx.citation.create({
                        data: {
                            treeId, familyId: targetFam.id, sourceId: cit.sourceId,
                            page: cit.whereInSource || null, dateText: cit.date || null,
                            confidence: (cit.confidence || 'CERTAIN') as any
                        }
                    });
                    if (cit.notes) await this.notesService.processSharedNotes(tx, treeId, cit.notes, { citationId: cCit.id }, currentUserId);
                }
            }

            // 3. Process Wedding Event (MARR)
            if (rel.weddingEvent && rel.type === 'SPOUSE') {
                const we = rel.weddingEvent;
                const placeName = (we.place || '').trim();
                let placeId = we.placeId || null;

                if (placeName) {
                    let place = await tx.place.findFirst({ where: { treeId, name: placeName, parentId: null } });
                    if (!place) place = await tx.place.create({ data: { treeId, name: placeName, historicNames: [] } });
                    placeId = place.id;
                }

                const eventData = {
                    type: 'MARR' as any, dateText: we.dateText || null, dateType: we.dateType || null,
                    placeId, description: we.description || null,
                    ldsTemple: we.ldsTemple || null, ldsStatus: we.ldsStatus || null,
                    isNegative: !!we.isNegative, treeId
                };

                const hasData = !!(we.dateText || we.place || we.description || we.notes?.length || we.citations?.length || we.media?.length);
                const shouldHaveEvent = we.showInTimeline || hasData;

                const existingMarr = await tx.event.findFirst({ where: { familyId: targetFam.id, type: 'MARR' } });
                
                if (!shouldHaveEvent) {
                    if (existingMarr) {
                        console.log(`[processRelationUpdate] Deleting empty/hidden wedding event ${existingMarr.id} for family ${targetFam.id}`);
                        await tx.noteLink.deleteMany({ where: { eventId: existingMarr.id } });
                        await tx.citation.deleteMany({ where: { eventId: existingMarr.id } });
                        await tx.mediaLink.deleteMany({ where: { eventId: existingMarr.id } });
                        await tx.event.delete({ where: { id: existingMarr.id } });
                    }
                } else {
                    const createdEvent = existingMarr 
                        ? await tx.event.update({ where: { id: existingMarr.id }, data: eventData })
                        : await tx.event.create({ data: { ...eventData, familyId: targetFam.id } });

                    console.log(`[processRelationUpdate] Wedding event ${createdEvent.id} ${existingMarr ? 'updated' : 'created'} with ${we.notes?.length || 0} notes`);
                    if (Array.isArray(we.notes)) await this.notesService.processSharedNotes(tx, treeId, we.notes, { eventId: createdEvent.id }, currentUserId);
                    
                    if (Array.isArray(we.citations)) {
                        await tx.citation.deleteMany({ where: { eventId: createdEvent.id } });
                        for (const cit of we.citations) {
                            if (!cit.sourceId) continue;
                            const cEvCit = await tx.citation.create({
                                data: {
                                    treeId, eventId: createdEvent.id, sourceId: cit.sourceId,
                                    page: cit.whereInSource || null, dateText: cit.date || null,
                                    confidence: (cit.confidence || 'CERTAIN') as any
                                }
                            });
                            if (cit.notes) await this.notesService.processSharedNotes(tx, treeId, cit.notes, { citationId: cEvCit.id }, currentUserId);
                        }
                    }

                    if (Array.isArray(we.media)) {
                        await tx.mediaLink.deleteMany({ where: { eventId: createdEvent.id } });
                        for (const med of we.media) {
                            const mediaObj = await this.gedcomService.ensureMediaObject(treeId, med);
                            if (mediaObj) await tx.mediaLink.create({ data: { treeId, eventId: createdEvent.id, mediaId: mediaObj.id, isPrimary: !!med.isPrimary } });
                        }
                    }
                }
            }

            // 4. Update the FamilyMember link for the CURRENT person
            const mType = rel.type === 'SPOUSE' ? (rel.marriageType || null) : null;
            const pType = rel.type !== 'SPOUSE' ? (rel.pedigreeType || 'BIRTH') : null;

            await tx.familyMember.upsert({
                where: { familyId_personId: { familyId: targetFam.id, personId: person.id } },
                update: { role: selfRole, marriageType: mType as any, pedigreeType: pType as any, isPrimary: rel.isPrimary || false, sortOrder: rel.sortOrder || 0 },
                create: { familyId: targetFam.id, personId: person.id, role: selfRole, marriageType: mType as any, pedigreeType: pType as any, isPrimary: rel.isPrimary || false, sortOrder: rel.sortOrder || 0 }
            });

            // Ensure the related person is also part of this family (especially important if family already existed)
            if (rel.personId) {
                await tx.familyMember.upsert({
                    where: { familyId_personId: { familyId: targetFam.id, personId: rel.personId } },
                    update: { role: relatedRole },
                    create: { familyId: targetFam.id, personId: rel.personId, role: relatedRole }
                });
            }

            // 5. If it's a SPOUSE relation, ALSO update the marriageType for the OTHER spouse in this family
            if (rel.type === 'SPOUSE' && rel.personId) {
                console.log(`[processRelationUpdate] Syncing marriageType ${mType} to other spouse(s) in family ${targetFam.id}`);
                await tx.familyMember.updateMany({
                    where: { familyId: targetFam.id, role: 'SPOUSE' },
                    data: { marriageType: mType as any }
                });
            }
        }
    }

    private parseToComparableDate(dateStr: string | undefined): Date {
        if (!dateStr) return new Date(9999, 11, 31);

        const months: { [key: string]: number } = {
            'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
            'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
        };

        const cleaned = dateStr.replace(/^(ABT|CAL|EST|FROM|TO|INT|BEF|AFT)\s+/i, '');

        const dmy = cleaned.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i);
        if (dmy) {
            const day = parseInt(dmy[1]);
            const month = months[dmy[2].toUpperCase()] || 0;
            const year = parseInt(dmy[3]);
            return new Date(year, month, day);
        }

        const my = cleaned.match(/([A-Z]{3})\s+(\d{4})/i);
        if (my) {
            const month = months[my[1].toUpperCase()] || 0;
            const year = parseInt(my[2]);
            return new Date(year, month, 1);
        }

        const y = cleaned.match(/(\d{4})/);
        if (y) {
            return new Date(parseInt(y[1]), 0, 1);
        }

        return new Date(9999, 11, 31);
    }
}
