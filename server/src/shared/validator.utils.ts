
/**
 * Shared utility for validating genealogical data.
 * Used by PersonFormatter for individual profiles and by TreeService for global diagnostics.
 */

export interface ValidationIssue {
    type: 'error' | 'warning' | 'todo';
    code: string;
    message: string;
    entityType: string;
    entityId: string;
    parentEntityType?: string;
    parentEntityId?: string;
    involvedIds?: string[];
    explanation?: string;
}

export class GenealogyValidator {
    static getPrimaryName(person: any): string {
        const primary = person?.names?.find((n: any) => n.isPrimary) || person?.names?.[0];
        return primary ? primary.full : "Unbekannt";
    }

    static getEventLabel(tag: string): string {
        const labels: Record<string, string> = {
            BIRT: "Geburt",
            CHR: "Taufe",
            DEAT: "Tod",
            BURI: "Begräbnis",
            MARR: "Heirat",
            OCCU: "Beruf",
            ADOP: "Adoption",
            CENS: "Volkszählung",
            RELI: "Religion",
            EVEN: "Ereignis",
            DIV: "Scheidung"
        };
        return labels[tag] || tag;
    }

    static getTagLabel(tag: string): string {
        const labels: Record<string, string> = {
            BIRT: "Geburt",
            CHR: "Taufe",
            DEAT: "Tod",
            BURI: "Begräbnis",
            CREM: "Einäscherung",
            EMIG: "Auswanderung",
            IMMI: "Einwanderung",
            OCCU: "Beruf",
            RELI: "Religion",
            EDUC: "Bildung",
            RESI: "Wohnsitz",
            TITL: "Titel",
            NATI: "Nationalität",
            DSCR: "Körperl. Merkmale",
            FACT: "Fakt"
        };
        return labels[tag] || tag;
    }

    static calculateAge(birthDate: string | null | undefined, eventDate: string | null | undefined): number | null {
        if (!birthDate || !eventDate) return null;
        const getYear = (value: string) => {
            const match = value.match(/(\d{4})/);
            return match ? parseInt(match[1], 10) : null;
        };
        const birthYear = getYear(birthDate);
        const eventYear = getYear(eventDate);
        if (birthYear === null || eventYear === null) return null;
        return eventYear - birthYear;
    }

    static parseDateRange(dateText: string | null | undefined): { min: number; max: number } | null {
        if (!dateText) return null;

        const normalized = String(dateText).trim();
        if (!normalized) return null;

        const exactDotMatch = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (exactDotMatch) {
            const exact = this.toValidUtcDate(Number(exactDotMatch[3]), Number(exactDotMatch[2]), Number(exactDotMatch[1]));
            if (exact !== null) return { min: exact, max: exact };
        }

        const exactIsoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (exactIsoMatch) {
            const exact = this.toValidUtcDate(Number(exactIsoMatch[1]), Number(exactIsoMatch[2]), Number(exactIsoMatch[3]));
            if (exact !== null) return { min: exact, max: exact };
        }

        const monthYearMatch = normalized.match(/^(\d{1,2})\.(\d{4})$/);
        if (monthYearMatch) {
            const month = Number(monthYearMatch[1]);
            const year = Number(monthYearMatch[2]);
            if (month >= 1 && month <= 12) {
                return {
                    min: Date.UTC(year, month - 1, 1),
                    max: Date.UTC(year, month, 0)
                };
            }
        }

        const yearOnlyMatch = normalized.match(/^(\d{4})$/);
        if (yearOnlyMatch) {
            const year = Number(yearOnlyMatch[1]);
            return {
                min: Date.UTC(year, 0, 1),
                max: Date.UTC(year, 11, 31)
            };
        }

        const fallbackYear = normalized.match(/\d{4}/);
        if (fallbackYear) {
            const year = Number(fallbackYear[0]);
            return {
                min: Date.UTC(year, 0, 1),
                max: Date.UTC(year, 11, 31)
            };
        }

        return null;
    }

    static toValidUtcDate(year: number, month: number, day: number): number | null {
        if (month < 1 || month > 12 || day < 1 || day > 31) {
            return null;
        }

        const utc = Date.UTC(year, month - 1, day);
        const date = new Date(utc);
        if (
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day
        ) {
            return null;
        }

        return utc;
    }

    static validatePersonChronology(person: any): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const personName = this.getPrimaryName(person);
        const birthDate = (person.events || []).find((event: any) => event.type === "BIRT")?.dateText || null;
        const deathDate = (person.events || []).find((event: any) => event.type === "DEAT")?.dateText || null;
        const birthRange = this.parseDateRange(birthDate);
        const deathRange = this.parseDateRange(deathDate);

        // 1. Completeness Checks
        if (!birthDate && deathDate) {
            issues.push({
                type: "warning",
                code: "MISSING_BIRTH_DATE",
                message: `Fehlende Daten: Bei ${personName} fehlt das Geburtsdatum, obwohl ein Sterbedatum vorhanden ist.`,
                entityType: "PERSON",
                entityId: person.id
            });
        }

        // 2. Plausibility Checks
        if (birthRange && deathRange && deathRange.max < birthRange.min) {
            issues.push({
                type: "error",
                code: "PERSON_DEATH_BEFORE_BIRTH",
                message: `Chronologie-Konflikt: Bei ${personName} liegt das Sterbedatum vor dem Geburtsdatum.`,
                entityType: "PERSON",
                entityId: person.id
            });
        }

        const ageAtDeath = this.calculateAge(birthDate, deathDate);
        if (ageAtDeath !== null && ageAtDeath > 110) {
            issues.push({
                type: "warning",
                code: "UNREALISTIC_AGE_AT_DEATH",
                message: `Unplausibles Alter: ${personName} war zum Zeitpunkt des Todes ${ageAtDeath} Jahre alt.`,
                entityType: "PERSON",
                entityId: person.id
            });
        }

        // 3. Systematic Checks (Enums)
        const validGenders = ["M", "F", "X", "U"];
        if (person.sex && !validGenders.includes(person.sex)) {
            issues.push({
                type: "error",
                code: "INVALID_GENDER",
                message: `Ungültiger Geschlechtseintrag: "${person.sex}" bei ${personName}.`,
                entityType: "PERSON",
                entityId: person.id
            });
        }

        const validPrivacy = ["PUBLIC", "FAMILY", "PRIVATE"];
        if (person.privacyLevel && !validPrivacy.includes(person.privacyLevel)) {
            issues.push({
                type: "error",
                code: "INVALID_PRIVACY_LEVEL",
                message: `Ungültiger Datenschutz-Status: "${person.privacyLevel}" bei ${personName}.`,
                entityType: "PERSON",
                entityId: person.id
            });
        }

        // 4. Multiple singular events (already existing)
        const singularTypes = ["BIRT", "DEAT", "CHR", "BURI"];
        const eventCounts: Record<string, number> = {};
        for (const event of person.events || []) {
            if (singularTypes.includes(event.type)) {
                eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
            }
        }

        for (const type of singularTypes) {
            if (eventCounts[type] > 1) {
                issues.push({
                    type: "error",
                    code: `MULTIPLE_${type}_EVENTS`,
                    message: `Ungültige Daten: ${personName} hat mehr als ein Ereignis vom Typ "${this.getEventLabel(type)}".`,
                    entityType: "PERSON",
                    entityId: person.id
                });
            }
        }

        // 5. Event-specific checks
        for (const event of person.events || []) {
            // Unrealistic Marriage Age
            if (event.type === 'MARR') {
                const ageAtMarriage = this.calculateAge(birthDate, event.dateText);
                if (ageAtMarriage !== null && ageAtMarriage < 14) {
                    issues.push({
                        type: "error",
                        code: "UNREALISTIC_AGE_AT_MARRIAGE",
                        message: `Unplausibles Alter: ${personName} war bei der Heirat erst ${ageAtMarriage} Jahre alt.`,
                        entityType: "EVENT",
                        entityId: event.id
                    });
                }
            }

            // Missing Citations for Critical Events
            if (["BIRT", "DEAT", "MARR"].includes(event.type) && (event.citations || []).length === 0) {
                issues.push({
                    type: "warning",
                    code: "MISSING_SOURCE_FOR_CRITICAL_EVENT",
                    message: `Fehlende Quelle: Das Ereignis "${this.getEventLabel(event.type)}" von ${personName} hat keine Belege.`,
                    entityType: "EVENT",
                    entityId: event.id
                });
            }

            // Invalid Date Format
            if (event.dateText && !this.parseDateRange(event.dateText)) {
                issues.push({
                    type: "error",
                    code: "INVALID_DATE_FORMAT",
                    message: `Ungültiges Datumsformat: "${event.dateText}" bei Ereignis "${this.getEventLabel(event.type)}" von ${personName}.`,
                    entityType: "EVENT",
                    entityId: event.id
                });
            }

            // Unknown Place Check
            const placeName = event.place?.name?.toLowerCase() || '';
            const unknownPlaceholders = ['unbekannt', 'unknown', 'mars', 'mond', 'untenannt', 'tbd', '?'];
            if (placeName && unknownPlaceholders.includes(placeName)) {
                issues.push({
                    type: "todo",
                    code: "EVENT_UNKNOWN_PLACE",
                    message: `TODO: Ereignis "${this.getEventLabel(event.type)}" von ${personName} hat einen unbekannten Ort: "${event.place?.name}". Bitte korrigieren.`,
                    entityType: "EVENT",
                    entityId: event.id
                });
            }

            this.appendSubjectChronologyIssues(issues, {
                personName,
                entityType: "EVENT",
                entityId: event.id,
                label: this.getEventLabel(event.type),
                dateText: event.dateText,
                birthRange,
                deathRange
            });

            this.appendAssociationIssues(issues, event.associations || [], {
                subjectType: "Ereignis",
                subjectLabel: this.getEventLabel(event.type),
                subjectDateText: event.dateText,
                subjectId: event.id
            });
        }

        for (const fact of person.facts || []) {
            // Unknown Place Check
            const placeName = fact.place?.name?.toLowerCase() || '';
            const unknownPlaceholders = ['unbekannt', 'unknown', 'mars', 'mond', 'untenannt', 'tbd', '?'];
            if (placeName && unknownPlaceholders.includes(placeName)) {
                issues.push({
                    type: "todo",
                    code: "FACT_UNKNOWN_PLACE",
                    message: `TODO: Fakt "${this.getTagLabel(fact.type)}" von ${personName} hat einen unbekannten Ort: "${fact.place?.name}". Bitte korrigieren.`,
                    entityType: "FACT",
                    entityId: fact.id
                });
            }

            this.appendSubjectChronologyIssues(issues, {
                personName,
                entityType: "FACT",
                entityId: fact.id,
                label: this.getTagLabel(fact.type),
                dateText: fact.dateText,
                birthRange,
                deathRange
            });

            this.appendAssociationIssues(issues, fact.associations || [], {
                subjectType: "Fakt",
                subjectLabel: this.getTagLabel(fact.type),
                subjectDateText: fact.dateText,
                subjectId: fact.id
            });
        }

        person.familyMembers?.forEach((familyMember: any) => {
            if (familyMember.role !== "SPOUSE") return;
            for (const event of familyMember.family?.events || []) {
                this.appendSubjectChronologyIssues(issues, {
                    personName,
                    entityType: "EVENT",
                    entityId: event.id,
                    label: this.getEventLabel(event.type),
                    dateText: event.dateText,
                    birthRange,
                    deathRange
                });

                this.appendAssociationIssues(issues, event.associations || [], {
                    subjectType: "Familienereignis",
                    subjectLabel: this.getEventLabel(event.type),
                    subjectDateText: event.dateText,
                    subjectId: event.id
                });
            }
        });

        return issues;
    }

    static appendSubjectChronologyIssues(issues: ValidationIssue[], context: any) {
        const subjectRange = this.parseDateRange(context.dateText);
        if (!subjectRange) return;

        if (context.birthRange && subjectRange.max < context.birthRange.min) {
            issues.push({
                type: "error",
                code: "PERSON_EVENT_BEFORE_BIRTH",
                message: `Chronologie-Konflikt: ${context.label} liegt bei ${context.personName} vor dem Geburtsdatum.`,
                entityType: context.entityType,
                entityId: context.entityId
            });
        }

        if (context.deathRange && subjectRange.min > context.deathRange.max) {
            issues.push({
                type: "error",
                code: "PERSON_EVENT_AFTER_DEATH",
                message: `Chronologie-Konflikt: ${context.label} liegt bei ${context.personName} nach dem Sterbedatum.`,
                entityType: context.entityType,
                entityId: context.entityId
            });
        }
    }

    static appendAssociationIssues(issues: ValidationIssue[], associations: any[], context: any) {
        const subjectRange = this.parseDateRange(context.subjectDateText);
        if (!subjectRange) return;

        for (const association of associations || []) {
            const associatedPerson = association.associated;
            if (!associatedPerson) continue;
            
            const associatedName = this.getPrimaryName(associatedPerson) || association.associatedPersonName || "Unbekannt";
            const associatedBirthDate = (associatedPerson.events || []).find((event: any) => event.type === "BIRT")?.dateText || null;
            const associatedDeathDate = (associatedPerson.events || []).find((event: any) => event.type === "DEAT")?.dateText || null;
            const associatedBirthRange = this.parseDateRange(associatedBirthDate);
            const associatedDeathRange = this.parseDateRange(associatedDeathDate);

            if (associatedBirthRange && subjectRange.max < associatedBirthRange.min) {
                issues.push({
                    type: "error",
                    code: "ASSOCIATION_BEFORE_BIRTH",
                    message: `Chronologie-Konflikt: Beteiligte Person ${associatedName} war beim ${context.subjectType.toLowerCase()} "${context.subjectLabel}" noch nicht geboren.`,
                    entityType: "ASSOCIATION",
                    entityId: association.id,
                    parentEntityType: context.subjectType,
                    parentEntityId: context.subjectId
                });
            }

            if (associatedDeathRange && subjectRange.min > associatedDeathRange.max) {
                issues.push({
                    type: "error",
                    code: "ASSOCIATION_AFTER_DEATH",
                    message: `Chronologie-Konflikt: Beteiligte Person ${associatedName} war beim ${context.subjectType.toLowerCase()} "${context.subjectLabel}" bereits verstorben.`,
                    entityType: "ASSOCIATION",
                    entityId: association.id,
                    parentEntityType: context.subjectType,
                    parentEntityId: context.subjectId
                });
            }
        }
    }

    static validatePersonTodos(person: any): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const personName = this.getPrimaryName(person);

        // 1. Missing Biographical Basics
        if ((person.events || []).length === 0) {
            issues.push({
                type: "todo",
                code: "PERSON_NO_EVENTS",
                message: `TODO: ${personName} hat keine Ereignisse (Geburt, Tod, etc.). Bitte Daten ergänzen.`,
                entityId: person.id,
                entityType: "PERSON"
            });
        } else {
            const birthEvent = (person.events || []).find((e: any) => e.type === "BIRT");
            const birthDate = birthEvent?.dateText;
            const deathDate = (person.events || []).find((e: any) => e.type === "DEAT")?.dateText;
            const hasOtherEvents = (person.events || []).some((e: any) => !["BIRT", "DEAT"].includes(e.type));

            if (!birthDate && (deathDate || hasOtherEvents)) {
                issues.push({
                    type: "todo",
                    code: "PERSON_MISSING_BIRTH_DATE",
                    message: `TODO: ${personName} hat kein Geburtsdatum, obwohl andere Lebensdaten vorhanden sind.`,
                    entityId: person.id,
                    entityType: "PERSON"
                });
            }

            const birthPlace = birthEvent?.place?.name;
            if (birthDate && !birthPlace) {
                issues.push({
                    type: "todo",
                    code: "PERSON_MISSING_BIRTH_PLACE",
                    message: `TODO: ${personName} hat keinen Geburtsort hinterlegt (Datum ist vorhanden).`,
                    entityId: person.id,
                    entityType: "PERSON"
                });
            }
        }

        // 2. Missing Relations
        if ((person.familyMembers || []).length === 0) {
            issues.push({
                type: "todo",
                code: "PERSON_NO_FAMILY_LINKS",
                message: `TODO: ${personName} ist mit keiner Familie (Eltern, Partner) verknüpft.`,
                entityId: person.id,
                entityType: "PERSON"
            });
        }

        // 3. Missing Evidence & Records
        if ((person.mediaLinks || []).length === 0) {
            issues.push({
                type: "todo",
                code: "PERSON_NO_MEDIA",
                message: `TODO: ${personName} hat noch keine Fotos oder Dokumente verlinkt.`,
                entityId: person.id,
                entityType: "PERSON"
            });
        }

        if ((person.citations || []).length === 0 && (person.events || []).length > 0) {
            issues.push({
                type: "todo",
                code: "PERSON_NO_SOURCES",
                message: `TODO: Für die Ereignisse von ${personName} fehlen noch Quellenbelege.`,
                entityId: person.id,
                entityType: "PERSON"
            });
        }

        // 4. Name Variants
        if ((person.names || []).length <= 1) {
            issues.push({
                type: "todo",
                code: "PERSON_NO_NAME_VARIANTS",
                message: `TODO: Bei ${personName} sind keine Namensvarianten (z.B. Geburtsname) bekannt.`,
                entityId: person.id,
                entityType: "PERSON"
            });
        }

        return issues;
    }

    static validateFamilyTodos(family: any): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const familyName = family.displayName || `Familie ${family.id}`;

        const childLinks = (family.familyMembers || []).filter((m: any) => m.role === 'CHILD');
        const hasEvents = (family.events || []).length > 0;

        // Family has children but no events (like MARR)
        if (childLinks.length > 0 && !hasEvents) {
            issues.push({
                type: 'todo',
                code: 'FAMILY_MISSING_EVENTS',
                message: `AUFGABE: ${familyName} hat Kinder, aber keine eingetragenen Ereignisse (z.B. Heirat).`,
                entityType: 'FAMILY',
                entityId: family.id
            });
        }

        return issues;
    }

    /**
     * Calculates a completeness score (0-100) based on research criteria.
     * This aligns with the 'todo' validation rules.
     */
    static calculateCompleteness(person: any): { score: number; missing: string[] } {
        let points = 0;
        let max = 0;
        const missing: string[] = [];

        const addRule = (ok: boolean, weight: number, label: string) => {
            max += weight;
            if (ok) points += weight;
            else missing.push(label);
        };

        const hasArray = (a: any) => Array.isArray(a) && a.length > 0;
        const primaryName = person.names?.find((n: any) => n.isPrimary) || person.names?.[0];

        // 1. Identity (20%)
        addRule(!!(primaryName?.given || primaryName?.surname), 10, 'Name');
        addRule(person.sex && person.sex !== 'U', 10, 'Geschlecht');

        // 2. Life Events (40%)
        const birthEvent = person.events?.find((e: any) => e.type === 'BIRT');
        const deathEvent = person.events?.find((e: any) => e.type === 'DEAT');
        
        addRule(!!birthEvent?.dateText, 15, 'Geburtsdatum');
        addRule(!!(birthEvent?.placeId || birthEvent?.place?.name), 10, 'Geburtsort');

        const likelyDeceased = person.isLiving === false || !!deathEvent;
        if (likelyDeceased) {
            addRule(!!deathEvent?.dateText, 10, 'Sterbedatum');
            addRule(!!(deathEvent?.placeId || deathEvent?.place?.name), 5, 'Sterbeort');
        }

        // 3. Evidence (30%)
        addRule(hasArray(person.citations), 15, 'Quellen');
        addRule(hasArray(person.mediaLinks), 15, 'Medien');

        // 4. Network & Depth (10%)
        addRule(hasArray(person.familyMembers), 5, 'Familien-Verknüpfung');
        addRule(hasArray(person.names) && person.names.length > 1, 5, 'Namensvarianten');

        const score = max > 0 ? Math.max(0, Math.min(100, Math.round((points / max) * 100))) : 0;
        return { score, missing: missing.slice(0, 5) };
    }
}
