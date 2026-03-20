// server/src/shared/formatters/person.formatter.ts
import { DateUtils } from "../date.utils";
import { GenealogyValidator } from '../validator.utils';

export class PersonFormatter {
    static formatPersonForClient(person: any) {
        if (!person) return null;
        const primaryName = person.names?.find((n: any) => n.isPrimary) || person.names?.[0];
        const displayName = primaryName?.full || "Unbekannt";

        return {
            id: person.id,
            gedcomId: person.gedcomId,
            treeId: person.treeId,
            sex: person.sex,
            gender: person.sex,
            genderLabel: PersonFormatter.getGenderLabel(person.sex),
            firstName: primaryName?.given || "",
            lastName: primaryName?.surname || "",
            name: displayName,
            displayName,
            isLiving: person.isLiving,
            privacyLevel: person.privacyLevel,
            privacyLevelLabel: PersonFormatter.getPrivacyLevelLabel(person.privacyLevel),
            profileImageUrl: this.getProfileImageUrl(person),
            names: person.names || [],
            citations: this.formatCitations(person.citations),
            formattedCitations: this.formatFormattedCitations(person.citations),
            notes: this.formatNoteLinks(person.noteLinks),
            formattedNotes: this.formatNoteLinks(person.noteLinks),
            media: this.formatMediaLinks(person.mediaLinks),
            dnaMatches: this.formatDnaMatches(person.dnaMatches),
            updatedAt: person.updatedAt,
            createdAt: person.createdAt
        };
    }

    static getGenderLabel(sex?: string): string {
        if (sex === "M") return "Männlich";
        if (sex === "F") return "Weiblich";
        if (sex === "X") return "Divers";
        return "Unbekannt";
    }

    static getPrivacyLevelLabel(level?: string): string {
        if (level === "PUBLIC") return "Öffentlich";
        if (level === "FAMILY") return "Familie";
        return "Privat";
    }

    static getProfileImageUrl(person: any) {
        if (!person?.mediaLinks) return null;
        const primaryMedia = person.mediaLinks.find((ml: any) => ml.isPrimary);
        return primaryMedia?.media?.id || null;
    }

    static getPrimaryName(person: any): string {
        const primary = person?.names?.find((n: any) => n.isPrimary) || person?.names?.[0];
        return primary ? primary.full : "Unbekannt";
    }

    static buildTimeline(person: any, birthDate: string | null | undefined): any[] {
        const timeline: any[] = [];

        (person.events || []).forEach((ev: any) => {
            timeline.push({
                id: ev.id,
                itemKind: "event",
                originalType: "event",
                originalIndex: -1,
                tag: ev.type,
                label: this.getEventLabel(ev.type),
                date: ev.dateText,
                dateText: ev.dateText,
                place: ev.place?.name,
                placeId: ev.placeId,
                description: ev.description,
                age: this.calculateAge(birthDate, ev.dateText),
                isPrimary: ev.type === "BIRT" || ev.type === "DEAT",
                media: this.formatMediaLinks(ev.mediaLinks),
                notes: this.formatNoteLinks(ev.noteLinks),
                citations: this.formatCitations(ev.citations),
                associations: this.formatAssociations(ev.associations)
            });
        });

        (person.facts || []).forEach((fact: any) => {
            timeline.push({
                id: fact.id,
                itemKind: "fact",
                originalType: "fact",
                originalIndex: -1,
                tag: fact.type,
                label: this.getTagLabel(fact.type),
                date: fact.dateText,
                dateText: fact.dateText,
                place: fact.place?.name,
                placeId: fact.placeId,
                value: fact.value,
                description: fact.description,
                age: this.calculateAge(birthDate, fact.dateText),
                media: this.formatMediaLinks(fact.mediaLinks),
                notes: this.formatNoteLinks(fact.noteLinks),
                citations: this.formatCitations(fact.citations),
                associations: this.formatAssociations(fact.associations)
            });
        });

        const relSeen = new Set<string>();
        const personId = person.id;

        person.familyMembers?.forEach((fm: any) => {
            const fam = fm.family;
            if (!fam) return;

            if (fm.role === "SPOUSE") {
                const partnerLink = fam.familyMembers.find((member: any) => member.role === "SPOUSE" && member.personId !== personId);
                const partner = partnerLink?.person;

                (fam.events || []).forEach((event: any, index: number) => {
                    timeline.push({
                        id: event.id,
                        itemKind: "event",
                        originalType: "family-event",
                        originalIndex: index,
                        familyId: fam.id,
                        tag: event.type,
                        label: this.getEventLabel(event.type),
                        date: event.dateText,
                        dateText: event.dateText,
                        place: event.place?.name,
                        placeId: event.placeId,
                        description: event.description || (event.type === "MARR" ? `Heirat mit ${partner ? this.getPrimaryName(partner) : "Unbekannt"}` : ""),
                        age: this.calculateAge(birthDate, event.dateText),
                        media: this.formatMediaLinks(event.mediaLinks),
                        notes: this.formatNoteLinks(event.noteLinks),
                        citations: this.formatCitations(event.citations),
                        associations: this.formatAssociations(event.associations)
                    });
                });

                fam.familyMembers
                    .filter((member: any) => member.role === "CHILD")
                    .forEach((childLink: any) => {
                        const child = childLink.person;
                        if (!child) return;

                        const childEventKey = `CHILD_DERIVED:${child.id}`;
                        if (!relSeen.has(childEventKey)) {
                            relSeen.add(childEventKey);
                            const interesting = ["BIRT", "MARR", "DEAT"];
                            const labels: Record<string, string> = { BIRT: "Geburt", MARR: "Heirat", DEAT: "Tod" };

                            (child.events || [])
                                .filter((event: any) => interesting.includes(event.type))
                                .forEach((event: any) => {
                                    timeline.push({
                                        id: event.id,
                                        isDerived: true, // Mark as derived to prevent sync back to DB
                                        itemKind: "event",
                                        originalType: "family-event",
                                        originalIndex: -1,
                                        familyId: fam.id,
                                        tag: event.type,
                                        label: labels[event.type] || event.type,
                                        date: event.dateText,
                                        dateText: event.dateText,
                                        place: event.place?.name,
                                        placeId: event.placeId,
                                        description: `${labels[event.type] || event.type} von Kind ${this.getPrimaryName(child)}`,
                                        age: this.calculateAge(birthDate, event.dateText),
                                        sourcePersonId: child.id,
                                        sourcePersonName: this.getPrimaryName(child),
                                        media: [],
                                        notes: [],
                                        citations: [],
                                        associations: []
                                    });
                                });
                        }
                    });
            } else if (fm.role === "CHILD") {
                const parents = fam.familyMembers.filter((member: any) => member.role === "SPOUSE");
                parents.forEach((parentLink: any) => {
                    const parent = parentLink.person;
                    if (!parent) return;

                    const parentEventKey = `PARENT_DERIVED:${parent.id}`;
                    if (!relSeen.has(parentEventKey)) {
                        relSeen.add(parentEventKey);
                        const interesting = ["DEAT", "BURI"];
                        const labels: Record<string, string> = { DEAT: "Tod", BURI: "Begräbnis" };

                        (parent.events || [])
                            .filter((event: any) => interesting.includes(event.type))
                            .forEach((event: any) => {
                                timeline.push({
                                    id: event.id,
                                    isDerived: true, // Mark as derived to prevent sync back to DB
                                    itemKind: "event",
                                    originalType: "family-event",
                                    originalIndex: -1,
                                    familyId: fam.id,
                                    tag: event.type,
                                    label: labels[event.type] || event.type,
                                    date: event.dateText,
                                    dateText: event.dateText,
                                    place: event.place?.name,
                                    placeId: event.placeId,
                                    description: `${labels[event.type] || event.type} von ${this.getPrimaryName(parent)}`,
                                    age: this.calculateAge(birthDate, event.dateText),
                                    sourcePersonId: parent.id,
                                    sourcePersonName: this.getPrimaryName(parent),
                                    media: [],
                                    notes: [],
                                    citations: [],
                                    associations: []
                                });
                            });
                    }
                });
            }
        });

        return timeline.sort((a, b) => DateUtils.compareTimelineItems(a, b));
    }

    static buildRelations(person: any): any[] {
        const relations: any[] = [];
        const relSeen = new Set<string>();
        const personId = person.id;

        person.familyMembers?.forEach((fm: any) => {
            const fam = fm.family;
            if (!fam) return;

            const famNotes = this.formatNoteLinks(fam.noteLinks);
            const famCitations = this.formatCitations(fam.citations);

            if (fm.role === "SPOUSE") {
                const partnerLink = fam.familyMembers.find((member: any) => member.role === "SPOUSE" && member.personId !== personId);
                const partner = partnerLink?.person;
                const weddingEvent = (fam.events || []).find((event: any) => event.type === "MARR");
                const weddingInfo = weddingEvent
                    ? `${weddingEvent.dateText || ""}${weddingEvent.place?.name ? " in " + weddingEvent.place.name : ""}`.trim()
                    : undefined;

                const spouseKey = `SPOUSE:${partner?.id || "unknown"}:${fam.id}`;
                if (!relSeen.has(spouseKey)) {
                    relSeen.add(spouseKey);
                    relations.push({
                        type: "SPOUSE",
                        label: this.getRelationLabel("SPOUSE", fm.pedigreeType, partner?.sex),
                        personId: partner?.id,
                        personName: partner ? this.getPrimaryName(partner) : "Unbekannt",
                        familyId: fam.id,
                        familyMemberId: fm.id,
                        pedigreeType: fm.pedigreeType,
                        marriageType: fm.marriageType,
                        restrictionNotice: fam.restrictionNotice,
                        isPrimary: fm.isPrimary,
                        profileImageUrl: this.getProfileImageUrl(partner),
                        weddingInfo,
                        weddingEvent: weddingEvent ? {
                            id: weddingEvent.id,
                            type: weddingEvent.type,
                            dateText: weddingEvent.dateText,
                            dateType: weddingEvent.dateType,
                            place: weddingEvent.place?.name,
                            placeId: weddingEvent.placeId,
                            description: weddingEvent.description,
                            notes: this.formatNoteLinks(weddingEvent.noteLinks),
                            citations: this.formatCitations(weddingEvent.citations),
                            media: this.formatMediaLinks(weddingEvent.mediaLinks),
                            showInTimeline: true
                        } : undefined,
                        notes: famNotes,
                        citations: famCitations
                    });
                }

                fam.familyMembers
                    .filter((member: any) => member.role === "CHILD")
                    .forEach((childLink: any) => {
                        const child = childLink.person;
                        if (!child) return;

                        const childKey = `CHILD:${child.id}:${fam.id}`;
                        if (!relSeen.has(childKey)) {
                            relSeen.add(childKey);
                            relations.push({
                                type: "CHILD",
                                label: this.getRelationLabel("CHILD", childLink.pedigreeType, child.sex),
                                personId: child.id,
                                personName: this.getPrimaryName(child),
                                familyId: fam.id,
                                familyMemberId: childLink.id,
                                pedigreeType: childLink.pedigreeType,
                                isPrimary: childLink.isPrimary,
                                profileImageUrl: this.getProfileImageUrl(child),
                                notes: famNotes,
                                citations: famCitations
                            });
                        }
                    });
            } else if (fm.role === "CHILD") {
                const parents = fam.familyMembers.filter((member: any) => member.role === "SPOUSE");
                parents.forEach((parentLink: any) => {
                    const parent = parentLink.person;
                    if (!parent) return;

                    const role = parent.sex === "M" ? "FATHER" : (parent.sex === "F" ? "MOTHER" : "PARENT");
                    const parentKey = `${role}:${parent.id}:${fam.id}`;
                    if (!relSeen.has(parentKey)) {
                        relSeen.add(parentKey);
                        relations.push({
                            type: role,
                            label: this.getRelationLabel(role, fm.pedigreeType, parent.sex),
                            personId: parent.id,
                            personName: this.getPrimaryName(parent),
                            familyId: fam.id,
                            familyMemberId: parentLink.id,
                            pedigreeType: fm.pedigreeType,
                            isPrimary: fm.isPrimary,
                            profileImageUrl: this.getProfileImageUrl(parent),
                            notes: famNotes,
                            citations: famCitations
                        });
                    }
                });
            }
        });

        return relations;
    }

    static formatFullProfile(person: any) {
        const birthEvent = (person.events || []).find((event: any) => event.type === "BIRT");
        const birthDate = birthEvent?.dateText;

        return {
            person: this.formatPersonForClient(person),
            timeline: this.buildTimeline(person, birthDate),
            relations: this.buildRelations(person),
            validationIssues: this.buildValidationIssues(person)
        };
    }

    static buildValidationIssues(person: any): any[] {
        const chronology = GenealogyValidator.validatePersonChronology(person);
        const todos = GenealogyValidator.validatePersonTodos(person);
        return [...chronology, ...todos];
    }

    static getEventLabel(tag: string): string {
        return GenealogyValidator.getEventLabel(tag);
    }

    static getTagLabel(tag: string): string {
        return GenealogyValidator.getTagLabel(tag);
    }

    static calculateAge(birthDate: string | null | undefined, eventDate: string | null | undefined): number | null {
        return GenealogyValidator.calculateAge(birthDate, eventDate);
    }

    static parseDateRange(dateText: string | null | undefined): { min: number; max: number } | null {
        return GenealogyValidator.parseDateRange(dateText);
    }

    static toValidUtcDate(year: number, month: number, day: number): number | null {
        return GenealogyValidator.toValidUtcDate(year, month, day);
    }

    static getRelationLabel(type: string, pedigree?: string, sex?: string): string {
        if (type === "SPOUSE") return sex === "F" ? "Ehefrau" : "Ehemann";
        if (type === "CHILD") return sex === "F" ? "Tochter" : "Sohn";
        if (type === "FATHER") return "Vater";
        if (type === "MOTHER") return "Mutter";
        if (pedigree === "STEP") {
            if (type === "FATHER") return "Stiefvater";
            if (type === "MOTHER") return "Stiefmutter";
            if (type === "CHILD") return sex === "F" ? "Stieftochter" : "Stiefsohn";
        }
        if (pedigree === "ADOPTED") {
            if (type === "FATHER") return "Adoptivvater";
            if (type === "MOTHER") return "Adoptivmutter";
        }
        return type;
    }

    private static formatMediaLinks(links: any[]) {
        if (!links) return [];
        return links.map((link) => ({
            id: link.media?.id,
            url: link.media?.remoteUrl || (link.media?.filePath ? `/uploads/${link.media.filePath}` : null),
            title: link.media?.title || link.caption || "",
            isPrimary: link.isPrimary,
            caption: link.caption,
            role: link.role || null
        }));
    }

    private static formatNoteLinks(links: any[]) {
        if (!links) return [];
        return links.map((link) => ({
            id: link.note?.id,
            text: link.note?.text,
            noteType: link.note?.noteType || "OTHER",
            isPrivate: link.note?.isPrivate || link.note?.privacyLevel === "PRIVATE"
        }));
    }

    private static formatCitations(citations: any[]) {
        if (!citations) return [];
        return citations.map((citation) => ({
            id: citation.id,
            sourceId: citation.sourceId,
            whereInSource: citation.page,
            page: citation.page,
            confidence: citation.confidence,
            date: citation.dateText || citation.dataDateText,
            dateText: citation.dateText || citation.dataDateText,
            text: citation.citationTexts?.[0]?.text || "",
            notes: this.formatNoteLinks(citation.noteLinks),
            sourceTitle: citation.source?.title
        }));
    }

    private static formatFormattedCitations(citations: any[]) {
        if (!citations) return [];
        return citations.map((citation) => ({
            ...citation,
            title: citation.source?.title || "Unbekannte Quelle",
            author: citation.source?.author,
            publication: citation.source?.publication,
            description: citation.page ? "Fundstelle: " + citation.page : "",
            whereInSource: citation.page,
            date: citation.dateText || citation.dataDateText,
            text: citation.citationTexts?.[0]?.text || ""
        }));
    }

    private static formatAssociations(associations: any[]) {
        if (!associations) return [];
        return associations.map((association) => {
            const person = association.associated;
            const primaryName = person?.names?.find((name: any) => name.isPrimary) || person?.names?.[0];
            return {
                id: association.id,
                personId: association.associatedPersonId,
                associatedPersonId: association.associatedPersonId,
                associatedPersonName: primaryName?.full || "Unbekannt",
                role: association.role,
                relationText: association.relationText,
                dateText: association.dateText,
                confidence: association.confidence,
                notes: association.notes
            };
        });
    }

    private static formatDnaMatches(matches: any[]) {
        if (!matches) return [];
        return matches.map((match) => ({
            id: match.id,
            provider: match.provider,
            matchPersonId: match.matchPersonId,
            matchPersonName: match.matchPerson ? this.getPrimaryName(match.matchPerson) : undefined,
            totalCm: match.totalCm,
            largestSegmentCm: match.largestSegmentCm,
            segmentCount: match.segmentCount,
            predictedRelationship: match.predictedRelationship,
            confidence: match.confidence,
            testDate: match.testDate,
            kitId: match.kitId,
            segments: (match.segments || []).map((segment: any) => ({
                id: segment.id,
                chromosome: segment.chromosome,
                startPosition: segment.startPosition,
                endPosition: segment.endPosition,
                cm: segment.cm,
                snpCount: segment.snpCount,
                provider: segment.provider,
                build: segment.build,
                isTriangulated: segment.isTriangulated
            }))
        }));
    }
}
