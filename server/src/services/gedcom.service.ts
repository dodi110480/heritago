import { PrismaClient } from '@prisma/client';

/**
 * GEDCOM 7.0 writer for a single tree.
 *
 * The output follows the FamilySearch GEDCOM 7.0 specification
 * (https://gedcom.io/terms/v7/ and https://gedcom.io/specifications/FamilySearchGEDCOMv7.html):
 *  - `HEAD` carries `GEDC.VERS 7.0`. The 5.5.1 structures `CHAR` and `GEDC.FORM` were removed in 7.0.
 *  - Multi-line payloads are serialized with generated `CONT` lines (`CONC` was removed in 7.0).
 *  - A payload that starts with `@` escapes that first character as `@@`; pointers stay `@X@`.
 *  - Non-standard structures are written as extension tags (`_X`) and declared in `HEAD.SCHMA`.
 */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** GEDCOM 7.0 `enumset-SEX`. */
const SEX_VALUES = new Set(['M', 'F', 'X', 'U']);

/** DB `NameType` -> GEDCOM 7.0 `enumset-NAME-TYPE`. */
const NAME_TYPE_MAP: Record<string, string> = {
    BIRTH: 'birth',
    MARRIED: 'married',
    MAIDEN: 'maiden',
    IMMIGRANT: 'immigrant',
    ALSO_KNOWN_AS: 'aka',
    OTHER: 'other'
};

/** DB `PedigreeType` -> GEDCOM 7.0 `enumset-PEDI`. `STEP` has no standard value and keeps its label in a `PHRASE`. */
const PEDI_MAP: Record<string, string> = {
    BIRTH: 'birth',
    ADOPTED: 'adopted',
    FOSTER: 'foster',
    SEALED: 'sealing',
    STEP: 'other'
};

/** DB `AssociationRole` -> GEDCOM 7.0 `enumset-ROLE`. */
const ROLE_MAP: Record<string, string> = {
    GODPARENT: 'GODP',
    WITNESS: 'WITN',
    CLERGY: 'CLERGY',
    FRIEND: 'FRIEND',
    SPOUSE: 'SPOU',
    INFORMANT: 'OTHER',
    EMPLOYER: 'OTHER',
    PARTNER: 'OTHER',
    OTHER: 'OTHER'
};

/** Roles without a GEDCOM 7.0 enumeration value keep their readable label in a `PHRASE` substructure. */
const NON_STANDARD_ROLE_LABELS: Record<string, string> = {
    INFORMANT: 'Informant',
    EMPLOYER: 'Employer',
    PARTNER: 'Partner'
};

/** Attributes carry their value as payload instead of the `Y` occurrence flag. */
const ATTRIBUTE_TAGS = new Set([
    'CAST', 'DSCR', 'EDUC', 'FACT', 'IDNO', 'NATI', 'NCHI', 'NMR', 'OCCU', 'PROP', 'RELI', 'RESI', 'SSN', 'TITL'
]);

/** Structures that accept the negative assertion payload `Y`. */
const NEGATABLE_TAGS = new Set([
    'ADOP', 'ANUL', 'BAPM', 'BARM', 'BASM', 'BIRT', 'BLES', 'BURI', 'CENS', 'CHR', 'CHRA', 'CONF', 'CREM', 'DEAT',
    'DIV', 'DIVF', 'EMIG', 'ENGA', 'FCOM', 'GRAD', 'IMMI', 'MARB', 'MARC', 'MARL', 'MARR', 'MARS', 'NATU', 'ORDN',
    'PROB', 'RETI', 'WILL'
]);

/** Structures allowed directly below `INDI` (GEDCOM 7.0 individual events, attributes and LDS ordinances). */
const PERSON_EVENT_TAGS = new Set([
    ...NEGATABLE_TAGS, ...ATTRIBUTE_TAGS, 'BAPL', 'CONL', 'ENDL', 'SLGC', 'SLGS', 'EVEN'
]);

/** Structures allowed directly below `FAM` (GEDCOM 7.0 family events and attributes). */
const FAMILY_EVENT_TAGS = new Set([
    'ANUL', 'CENS', 'DIV', 'DIVF', 'ENGA', 'EVEN', 'MARR', 'MARB', 'MARC', 'MARL', 'MARS', 'RESI'
]);

/** DB `EventType` -> GEDCOM 7.0 structure tag. `MILI` has no standard tag and becomes the extension `_MILI`. */
const EVENT_TAG_MAP: Record<string, string> = {
    BIRT: 'BIRT', CHR: 'CHR', BAPM: 'BAPM', DEAT: 'DEAT', BURI: 'BURI', CREM: 'CREM',
    MARR: 'MARR', DIV: 'DIV', ANUL: 'ANUL', ENGA: 'ENGA', ADOP: 'ADOP', BARM: 'BARM',
    BASM: 'BASM', BLES: 'BLES', CHRA: 'CHRA', CONF: 'CONF', FCOM: 'FCOM', ORDN: 'ORDN',
    NATU: 'NATU', EMIG: 'EMIG', IMMI: 'IMMI', CENS: 'CENS', PROB: 'PROB', WILL: 'WILL',
    GRAD: 'GRAD', RETI: 'RETI', RESI: 'RESI', CAST: 'CAST', DSCR: 'DSCR',
    BAPL: 'BAPL', CONL: 'CONL', ENDL: 'ENDL', SLGC: 'SLGC', SLGS: 'SLGS',
    MILI: '_MILI', EVEN: 'EVEN', OTHER: 'EVEN'
};

/** DB `FactType` -> GEDCOM 7.0 structure tag (`MILITARY_SERVICE` has no standard tag). */
const FACT_TAG_MAP: Record<string, string> = {
    OCCUPATION: 'OCCU',
    EDUCATION: 'EDUC',
    RELIGION: 'RELI',
    NATIONALITY: 'NATI',
    TITLE: 'TITL',
    RESIDENCE: 'RESI',
    PROPERTY: 'PROP',
    DESCRIPTION: 'DSCR',
    MILITARY_SERVICE: '_MILI'
};

/** Extension tags written by this exporter; they are declared in `HEAD.SCHMA` as required by GEDCOM 7.0. */
const EXTENSION_TAG_URIS: Record<string, string> = {
    _MILI: 'https://heritago.app/terms/MILI'
};

/** Submitter xref used for `HEAD.SUBM`. */
const SUBMITTER_XREF = '@U1@';

/** Database row shapes used by the exporter (kept loose, the Prisma includes are dynamic). */
type Row = Record<string, any>;

/** Maps database ids to the GEDCOM xrefs used in the output document. */
type XrefMaps = {
    person: Map<string, string>;
    family: Map<string, string>;
    source: Map<string, string>;
    repository: Map<string, string>;
    media: Map<string, string>;
    note: Map<string, string>;
};

export class GedcomService {
    constructor(private prisma: PrismaClient) {}

    // ─────────────────────────────────────────────────────────────────────────
    // Text handling
    // ─────────────────────────────────────────────────────────────────────────

    /** True for a syntactically valid GEDCOM cross-reference identifier. */
    isGedcomXref(id?: string | null): boolean {
        if (!id) return false;
        return /^@[A-Za-z0-9_][A-Za-z0-9_]*@$/.test(id.trim());
    }

    /** GEDCOM 7.0 text escaping: only a literal leading at-sign is doubled (`@@`, pointers stay `@X@`). */
    private escapeAtSign(value: string): string {
        return value.startsWith('@') ? `@${value}` : value;
    }

    /** Normalizes text, keeps line breaks (serialized as generated `CONT` lines) and escapes at-signs. */
    private text(value?: string | null): string | null {
        if (value === null || value === undefined) return null;
        const normalized = String(value)
            .replace(/\r\n?/g, '\n')
            .split('\n')
            .map((line) => line.replace(/[ \t]+$/, ''))
            .join('\n')
            .replace(/^\n+/, '')
            .replace(/\n+$/, '');
        if (!normalized.trim()) return null;
        return this.escapeAtSign(normalized.normalize('NFC'));
    }

    /** Normalizes text to a single line (names, places, enumeration-like payloads). */
    private inline(value?: string | null): string | null {
        const normalized = this.text(value);
        if (!normalized) return null;
        return normalized.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Line writer
    // ─────────────────────────────────────────────────────────────────────────

    /** Writes one structure; line breaks inside a payload become `CONT` lines (GEDCOM 7.0 serialization). */
    private write(lines: string[], level: number, tag: string, payload?: string | number | null) {
        const value = payload === null || payload === undefined ? null : String(payload).trim();
        // Optional structures without a value are omitted; use `writeTag` for payload-less structures.
        if (!value) return;
        const [first, ...rest] = value.split('\n');
        lines.push(`${level} ${tag} ${first}`);
        for (const continuation of rest) lines.push(`${level + 1} CONT ${continuation}`);
    }

    /** Writes a structure that carries no payload (for example `GEDC`, `MAP`, `CROP` or `SCHMA`). */
    private writeTag(lines: string[], level: number, tag: string) {
        lines.push(`${level} ${tag}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dates
    // ─────────────────────────────────────────────────────────────────────────

    /** True for a single GEDCOM date point such as `1914`, `SEP 1914` or `16 SEP 2016`. */
    private isDatePoint(token: string): boolean {
        const value = token.trim().toUpperCase();
        return /^\d{1,2} [A-Z]{3} \d{3,4}$/.test(value)
            || /^[A-Z]{3} \d{3,4}$/.test(value)
            || /^\d{1,2} [A-Z]{3}$/.test(value)
            || /^\d{3,4}$/.test(value);
    }

    /** True for a complete GEDCOM date value (plain, modified, range or period). */
    private isDateValue(value: string): boolean {
        const normalized = value.trim().toUpperCase();
        const modifier = normalized.match(/^(ABT|CAL|EST|BEF|AFT) (.+)$/);
        if (modifier) return this.isDatePoint(modifier[2]);
        const range = normalized.match(/^BET (.+) AND (.+)$/);
        if (range) return this.isDatePoint(range[1]) && this.isDatePoint(range[2]);
        const period = normalized.match(/^FROM (.+) TO (.+)$/);
        if (period) return this.isDatePoint(period[1]) && this.isDatePoint(period[2]);
        return this.isDatePoint(normalized);
    }

    /** Converts a single date string (`16.09.2016`, `1914`, `SEP 1914`) into a GEDCOM date point. */
    private toDatePoint(raw?: string | null): string | null {
        if (!raw) return null;
        const value = String(raw).trim().toUpperCase().replace(/\s+/g, ' ');
        if (!value) return null;
        if (this.isDatePoint(value)) return value;

        const germanFull = value.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{3,4})$/);
        if (germanFull) {
            const month = MONTHS[Number(germanFull[2]) - 1];
            if (month) return `${Number(germanFull[1])} ${month} ${germanFull[3]}`;
        }
        const germanMonthOnly = value.match(/^(\d{1,2})\.\s*(\d{3,4})$/);
        if (germanMonthOnly) {
            const month = MONTHS[Number(germanMonthOnly[1]) - 1];
            if (month) return `${month} ${germanMonthOnly[2]}`;
        }
        return null;
    }

    /** Formats a `DateTime` as a GEDCOM date point. */
    private formatDateTime(value: Date): string | null {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
    }

    /** Formats a timestamp for `CHAN.DATE` / `HEAD.DATE` (GEDCOM 7.0 date value, defaulting to today). */
    private formatTimestamp(value?: Date | null): string | null {
        const date = value ? new Date(value) : new Date();
        if (Number.isNaN(date.getTime())) return null;
        return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
    }

    /** Serializes a date value, honoring the stored precision and range separators. */
    private toGedcomDate(
        dateText?: string | null,
        dateType?: string | null,
        dateStart?: Date | null,
        dateEnd?: Date | null
    ): string | null {
        const rawText = this.inline(dateText);
        const precision = (dateType || '').toUpperCase();
        const rangeParts = rawText
            ? rawText.split(/\s*(?:\/|–|—|bis|-{2})\s*/i).map((part) => part.trim()).filter(Boolean)
            : [];

        if (rangeParts.length === 2 && (precision === 'BETWEEN' || precision === 'RANGE')) {
            const from = this.toDatePoint(rangeParts[0]);
            const to = this.toDatePoint(rangeParts[1]);
            if (from && to) return precision === 'BETWEEN' ? `BET ${from} AND ${to}` : `FROM ${from} TO ${to}`;
        }

        if (rawText) {
            const normalized = rawText.toUpperCase().replace(/\s+/g, ' ');
            if (/^(ABT|CAL|EST|BEF|AFT|BET|FROM) /.test(normalized) && this.isDateValue(normalized)) return normalized;

            const point = this.toDatePoint(rawText);
            if (point) {
                if (precision === 'ABOUT') return `ABT ${point}`;
                if (precision === 'CALCULATED') return `CAL ${point}`;
                if (precision === 'BEFORE') return `BEF ${point}`;
                if (precision === 'AFTER') return `AFT ${point}`;
                return point;
            }
            // Unparseable legacy values are written verbatim to avoid silent data loss.
            return normalized;
        }

        if (dateStart) {
            const start = this.formatDateTime(dateStart);
            if (start && dateEnd) {
                const end = this.formatDateTime(dateEnd);
                if (end) return precision === 'RANGE' ? `FROM ${start} TO ${end}` : `BET ${start} AND ${end}`;
            }
            return start;
        }
        return null;
    }

    private writeDate(lines: string[], level: number, dateValue: string | null) {
        if (dateValue) this.write(lines, level, 'DATE', dateValue);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Places, media and enumeration mapping
    // ─────────────────────────────────────────────────────────────────────────

    private formatLatitude(value?: number | null): string | null {
        if (value === null || value === undefined || !Number.isFinite(value)) return null;
        return `${value < 0 ? 'S' : 'N'}${Math.abs(value).toFixed(6)}`;
    }

    private formatLongitude(value?: number | null): string | null {
        if (value === null || value === undefined || !Number.isFinite(value)) return null;
        return `${value < 0 ? 'W' : 'E'}${Math.abs(value).toFixed(6)}`;
    }

    /** Writes `PLAC` including the optional `MAP`/`LATI`/`LONG` coordinates. */
    private writePlace(lines: string[], level: number, place?: Row | null) {
        const name = this.inline(place?.name);
        if (!name) return;
        this.write(lines, level, 'PLAC', name);
        const latitude = this.formatLatitude(place?.latitude);
        const longitude = this.formatLongitude(place?.longitude);
        if (latitude && longitude) {
            this.writeTag(lines, level + 1, 'MAP');
            this.write(lines, level + 2, 'LATI', latitude);
            this.write(lines, level + 2, 'LONG', longitude);
        }
    }

    /** Resolves the `FILE` payload of a media record: web URL when available, relative path otherwise. */
    private mediaFileReference(media: Row): string | null {
        const remoteUrl = this.inline(media?.remoteUrl);
        if (remoteUrl && /^(https?|ftp):\/\//i.test(remoteUrl)) return remoteUrl;
        return this.inline(media?.path) || remoteUrl;
    }

    /** Media type for `FILE.FORM`, which is a required substructure of `FILE` in GEDCOM 7.0. */
    private mediaForm(media: Row): string {
        const mimeType = this.inline(media?.mimeType);
        if (mimeType && /^[a-z]+\/[a-z0-9.+-]+$/i.test(mimeType)) return mimeType.toLowerCase();

        const extension = (this.inline(media?.fileFormat) || this.inline(media?.path)?.split('.').pop() || '').toLowerCase();
        const byExtension: Record<string, string> = {
            jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
            pdf: 'application/pdf', tif: 'image/tiff', tiff: 'image/tiff'
        };
        return byExtension[extension] || 'application/octet-stream';
    }

    /** Maps the stored confidence/quality value onto the GEDCOM 7.0 `enumset-QUAY` payload (0–3). */
    private resolveQuay(citation: Row): string | null {
        if (citation?.quay !== null && citation?.quay !== undefined) {
            const quay = Number(citation.quay);
            if (Number.isInteger(quay) && quay >= 0 && quay <= 3) return String(quay);
        }
        switch (citation?.confidence) {
            case 'CERTAIN':
            case 'VERY_LIKELY': return '3';
            case 'LIKELY': return '2';
            case 'POSSIBLE': return '1';
            case 'UNLIKELY': return '0';
            default: return null;
        }
    }

    /** Structural tag of an event, including extension handling for unknown custom tags. */
    private resolveEventTag(event: Row, extensionTags: Set<string>): string {
        const type = (this.inline(event?.type) || 'EVEN').toUpperCase();
        const mapped = EVENT_TAG_MAP[type];
        if (mapped && mapped !== 'EVEN') return mapped;

        const candidate = (this.inline(event?.customType) || '').replace(/[^A-Za-z0-9_]/g, '').toUpperCase();
        if (candidate && PERSON_EVENT_TAGS.has(candidate)) return candidate;
        if (candidate && candidate !== 'OTHER') return this.extensionTag(candidate, extensionTags);
        return 'EVEN';
    }

    /** Structural tag of a fact, including extension handling for unknown custom tags. */
    private resolveFactTag(fact: Row, extensionTags: Set<string>): string {
        const type = (this.inline(fact?.type) || 'OTHER').toUpperCase();
        const mapped = FACT_TAG_MAP[type];
        if (mapped) return mapped;

        const candidate = (this.inline(fact?.customType) || '').replace(/[^A-Za-z0-9_]/g, '').toUpperCase();
        if (candidate && ATTRIBUTE_TAGS.has(candidate)) return candidate;
        if (candidate && PERSON_EVENT_TAGS.has(candidate)) return candidate;
        if (candidate && candidate !== 'OTHER') return this.extensionTag(candidate, extensionTags);
        return 'FACT';
    }

    /** Normalizes a custom tag into a GEDCOM 7.0 extension tag and remembers it for `HEAD.SCHMA`. */
    private extensionTag(candidate: string, extensionTags: Set<string>): string {
        const tag = candidate.startsWith('_') ? candidate : `_${candidate}`;
        extensionTags.add(tag);
        return tag;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Xref allocation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns a function that hands out unique GEDCOM xrefs: stored xrefs are reused when they are
     * syntactically valid and still free, otherwise a sequential identifier is generated.
     */
    private createXrefAllocator() {
        const used = new Set<string>();
        const counters: Record<string, number> = {};

        return (prefix: string, preferred?: string | null): string => {
            const candidate = preferred?.trim();
            if (candidate && this.isGedcomXref(candidate) && !used.has(candidate)) {
                used.add(candidate);
                return candidate;
            }
            let counter = counters[prefix] || 1;
            while (used.has(`@${prefix}${counter}@`)) counter += 1;
            const generated = `@${prefix}${counter}@`;
            counters[prefix] = counter + 1;
            used.add(generated);
            return generated;
        };
    }

    /**
     * Legacy helper used by the person/family write services: returns the stored media record when it
     * can be resolved, otherwise it looks the file up by URL/path or creates a placeholder record.
     */
    async ensureMediaObject(treeId: string, med: any) {
        if (med?.id) {
            const existing = await this.prisma.media.findUnique({ where: { id: med.id } });
            if (existing) return existing;
        }

        if (med?.url || med?.remoteUrl || med?.path) {
            let cleanUrl = med.remoteUrl || med.url || null;
            const mediaPath = med.path || (cleanUrl && cleanUrl.includes('/uploads/') ? cleanUrl.split('/uploads/')[1] : null);
            if (cleanUrl && cleanUrl.includes('/uploads/')) {
                cleanUrl = '/uploads/' + cleanUrl.split('/uploads/')[1];
            }
            let mediaObj = await this.prisma.media.findFirst({
                where: {
                    treeId,
                    OR: [
                        cleanUrl ? { remoteUrl: cleanUrl } : undefined,
                        mediaPath ? { path: mediaPath } : undefined
                    ].filter(Boolean) as any
                }
            });
            if (!mediaObj) {
                mediaObj = await this.prisma.media.create({
                    data: { treeId, remoteUrl: cleanUrl, path: mediaPath, title: med.title, mimeType: med.mimeType }
                });
            }
            return mediaObj;
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Record writers
    // ─────────────────────────────────────────────────────────────────────────

    /** Writes the `SUBM` record referenced by `HEAD.SUBM`. */
    private writeSubmitter(lines: string[]) {
        lines.push(`0 ${SUBMITTER_XREF} SUBM`);
        this.write(lines, 1, 'NAME', 'Heritago Submitter');
    }

    private writeRepository(lines: string[], repository: Row, maps: XrefMaps) {
        const reference = maps.repository.get(repository.id);
        if (!reference) return;
        lines.push(`0 ${reference} REPO`);
        this.write(lines, 1, 'NAME', this.inline(repository.name) || 'Unbekanntes Archiv');
        this.write(lines, 1, 'ADDR', this.text(repository.address));
        this.write(lines, 1, 'PHON', this.inline(repository.phone));
        this.write(lines, 1, 'EMAIL', this.inline(repository.email));
        this.write(lines, 1, 'WWW', this.inline(repository.website));
        this.writeChangeDate(lines, 1, repository.chanDate || repository.updatedAt);
    }

    private writeSource(lines: string[], source: Row, maps: XrefMaps) {
        const reference = maps.source.get(source.id);
        if (!reference) return;
        lines.push(`0 ${reference} SOUR`);
        this.write(lines, 1, 'TITL', this.text(source.title) || 'Unbenannte Quelle');
        this.write(lines, 1, 'ABBR', this.inline(source.shortTitle));
        this.write(lines, 1, 'AUTH', this.text(source.author));
        this.write(lines, 1, 'PUBL', this.text(source.publication));
        this.write(lines, 1, 'TYPE', this.inline(source.sourceType));
        const repositoryXref = source.repositoryId ? maps.repository.get(source.repositoryId) : null;
        if (repositoryXref) this.write(lines, 1, 'REPO', repositoryXref);
        this.writeNoteStructures(lines, 1, source.noteLinks, maps);
        this.writeMediaLinks(lines, 1, source.mediaLinks, maps);
        this.writeChangeDate(lines, 1, source.chanDate || source.updatedAt);
    }

    private writeSharedNote(lines: string[], note: Row, maps: XrefMaps) {
        const reference = maps.note.get(note.id);
        if (!reference) return;
        const noteText = this.text(note.text) || ' ';
        lines.push(`0 ${reference} SNOTE ${noteText.split('\n')[0]}`);
        for (const continuation of noteText.split('\n').slice(1)) {
            lines.push(`1 CONT ${continuation}`);
        }
        this.write(lines, 1, 'MIME', this.inline(note.mime));
        // The Heritago note category is exported as a reference number, because GEDCOM has no note type.
        this.write(lines, 1, 'REFN', this.inline(note.noteType));
        this.write(lines, 1, 'UID', this.uuidToken(note.id));
        this.writeChangeDate(lines, 1, note.chanDate || note.updatedAt);
    }

    private writeMediaRecord(lines: string[], media: Row, maps: XrefMaps) {
        const reference = maps.media.get(media.id);
        if (!reference) return;
        const fileReference = this.mediaFileReference(media);
        if (!fileReference) return;
        lines.push(`0 ${reference} OBJE`);
        this.write(lines, 1, 'FILE', fileReference);
        this.write(lines, 2, 'FORM', this.mediaForm(media));
        this.write(lines, 2, 'TITL', this.inline(media.title));
        this.write(lines, 1, 'UID', this.uuidToken(media.id));
        this.writeNoteStructures(lines, 1, media.noteLinks, maps);
        this.writeChangeDate(lines, 1, media.chanDate || media.updatedAt);
    }

    /** `CHAN` requires a `DATE`; only written when the record carries a change timestamp. */
    private writeChangeDate(lines: string[], level: number, timestamp?: Date | null) {
        const formatted = timestamp ? this.formatTimestamp(timestamp) : null;
        if (!formatted) return;
        this.writeTag(lines, level, 'CHAN');
        this.write(lines, level + 1, 'DATE', formatted);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Nested structures (notes, media, citations, associations)
    // ─────────────────────────────────────────────────────────────────────────

    /** GEDCOM 7.0 `UID` payload: the record UUID, so imports keep identifying the same structures. */
    private uuidToken(id?: string | null): string | null {
        if (!id) return null;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id.toLowerCase() : null;
    }

    /** Writes one `SNOTE` pointer per linked note (link table plus optional direct note relation). */
    private writeNoteStructures(
        lines: string[],
        level: number,
        noteLinks?: Row[] | null,
        maps?: XrefMaps,
        directNotes?: Row[] | null
    ) {
        const written = new Set<string>();
        const emit = (note?: Row | null) => {
            const reference = note?.id ? maps?.note.get(note.id) : null;
            if (!reference || written.has(reference)) return;
            written.add(reference);
            this.write(lines, level, 'SNOTE', reference);
        };
        for (const link of noteLinks || []) emit(link?.note);
        for (const note of directNotes || []) emit(note);
    }

    /** Writes one `OBJE` pointer per linked media record, including the stored crop rectangle. */
    private writeMediaLinks(lines: string[], level: number, mediaLinks?: Row[] | null, maps?: XrefMaps) {
        const written = new Set<string>();
        for (const link of mediaLinks || []) {
            const reference = link?.mediaId ? maps?.media.get(link.mediaId) : null;
            if (!reference || written.has(reference)) continue;
            written.add(reference);
            this.write(lines, level, 'OBJE', reference);

            const media = link.media || {};
            const top = media.cropY;
            const left = media.cropX;
            const width = media.cropWidth;
            const height = media.cropHeight;
            if ([top, left, width, height].every((value) => typeof value === 'number') && width > 0 && height > 0) {
                this.writeTag(lines, level + 1, 'CROP');
                this.write(lines, level + 2, 'TOP', top);
                this.write(lines, level + 2, 'LEFT', left);
                this.write(lines, level + 2, 'WIDTH', width);
                this.write(lines, level + 2, 'HEIGHT', height);
            }
            this.write(lines, level + 1, 'TITL', this.inline(link.caption));
        }
    }

    /** Writes `SOUR` source citations including `PAGE`, `QUAY`, `DATA` and the covered `EVEN`. */
    private writeCitations(lines: string[], level: number, citations?: Row[] | null, maps?: XrefMaps) {
        for (const citation of citations || []) {
            const reference = citation?.sourceId ? maps?.source.get(citation.sourceId) : null;
            if (!reference) continue;

            this.write(lines, level, 'SOUR', reference);
            this.write(lines, level + 1, 'PAGE', this.text(citation.page));

            const quay = this.resolveQuay(citation);
            if (quay) this.write(lines, level + 1, 'QUAY', quay);

            const dataDate = this.toGedcomDate(
                citation.dataDateText, citation.dataDateType, citation.dataDateStart, citation.dataDateEnd
            );
            const citationTexts = Array.isArray(citation.citationTexts) ? citation.citationTexts : [];
            if (dataDate || citationTexts.length) {
                this.writeTag(lines, level + 1, 'DATA');
                this.writeDate(lines, level + 2, dataDate);
                for (const entry of citationTexts) {
                    this.write(lines, level + 2, 'TEXT', this.text(entry.text));
                    this.write(lines, level + 3, 'MIME', this.inline(entry.mime));
                }
            }

            const evenType = this.inline(citation.evenType)?.toUpperCase();
            const evenPhrase = this.inline(citation.evenPhrase);
            const role = this.inline(citation.evenRole)?.toUpperCase();
            if (evenType || evenPhrase || role) {
                const standard = evenType && (ATTRIBUTE_TAGS.has(evenType) || PERSON_EVENT_TAGS.has(evenType)) ? evenType : null;
                if (standard) this.write(lines, level + 1, 'EVEN', standard);
                else this.writeTag(lines, level + 1, 'EVEN');
                this.write(lines, level + 2, 'PHRASE', standard ? evenPhrase : (evenPhrase || evenType));
                const mappedRole = role ? ROLE_MAP[role] : null;
                if (mappedRole) {
                    this.write(lines, level + 2, 'ROLE', mappedRole);
                    this.write(lines, level + 3, 'PHRASE', this.inline(citation.evenRolePhrase) || NON_STANDARD_ROLE_LABELS[role!]);
                } else if (role) {
                    this.write(lines, level + 2, 'ROLE', 'OTHER');
                    this.write(lines, level + 3, 'PHRASE', this.inline(citation.evenRolePhrase) || role);
                }
            }

            this.writeNoteStructures(lines, level + 1, citation.noteLinks, maps);
        }
    }

    /** Writes `ASSO` person associations using the GEDCOM 7.0 role enumeration. */
    private writeAssociations(lines: string[], level: number, associations?: Row[] | null, maps?: XrefMaps) {
        for (const association of associations || []) {
            const reference = association?.associatedPersonId ? maps?.person.get(association.associatedPersonId) : null;
            if (!reference) continue;

            this.write(lines, level, 'ASSO', reference);
            const storedRole = (this.inline(association.role) || 'OTHER').toUpperCase();
            this.write(lines, level + 1, 'ROLE', ROLE_MAP[storedRole] || 'OTHER');
            this.write(lines, level + 2, 'PHRASE', this.inline(association.rolePhrase) || NON_STANDARD_ROLE_LABELS[storedRole]);
            this.write(lines, level + 1, 'PHRASE', this.inline(association.relationText));
            this.writeCitations(lines, level + 1, association.citations, maps);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Events, facts, persons and families
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Writes one event/attribute structure including date, place, notes, media, associations and sources.
     * Attributes receive the value as payload, events use the negative assertion `Y` when applicable.
     */
    private writeEventStructure(
        lines: string[],
        level: number,
        entity: Row,
        tag: string,
        maps: XrefMaps,
        fallbackType?: string | null
    ) {
        const isAttribute = ATTRIBUTE_TAGS.has(tag);
        const rawDescription = this.inline(entity.description);
        const negative = tag === 'EVEN'
            ? false
            : entity.isNegative === true || (rawDescription || '').toUpperCase() === 'Y';
        const value = this.text(entity.value) || (isAttribute ? this.text(entity.description) : null);
        const payload = isAttribute ? value : (negative && NEGATABLE_TAGS.has(tag) ? 'Y' : null);

        if (payload) this.write(lines, level, tag, payload);
        else this.writeTag(lines, level, tag);

        // `EVEN` and `FACT` must be classified by a `TYPE`.
        if (tag === 'EVEN' || tag === 'FACT') {
            const type = this.inline(entity.eventSubtype) || this.inline(entity.customType) || this.inline(fallbackType) || 'Ereignis';
            this.write(lines, level + 1, 'TYPE', this.normalizeMarriageSubtype(type) || type);
        } else {
            this.write(lines, level + 1, 'TYPE', this.normalizeMarriageSubtype(this.inline(entity.eventSubtype)) || this.inline(entity.eventSubtype));
        }

        this.writeDate(lines, level + 1, this.toGedcomDate(entity.dateText, entity.dateType, entity.dateStart, entity.dateEnd));
        this.writePlace(lines, level + 1, entity.place);
        this.write(lines, level + 1, 'CAUS', this.inline(entity.cause));
        this.write(lines, level + 1, 'AGE', this.inline(entity.age));
        this.write(lines, level + 1, 'TEMP', this.inline(entity.ldsTemple));

        // Attribute values live in the payload, so a differing description becomes an additional note.
        if (isAttribute) {
            const note = this.text(entity.description);
            if (note && note.replace(/\s+/g, ' ').toUpperCase() !== 'Y' && note !== value) this.write(lines, level + 1, 'NOTE', note);
        } else {
            const note = this.text(entity.description);
            if (note && note.toUpperCase() !== 'Y') this.write(lines, level + 1, 'NOTE', note);
        }

        this.writeNoteStructures(lines, level + 1, entity.noteLinks, maps);
        this.writeMediaLinks(lines, level + 1, entity.mediaLinks, maps);
        this.writeAssociations(lines, level + 1, entity.associations, maps);
        this.writeCitations(lines, level + 1, entity.citations, maps);
    }

    /** Normalizes the stored marriage subtype to the free-text values suggested by the specification. */
    private normalizeMarriageSubtype(value?: string | null): string | null {
        const normalized = (value || '').toUpperCase();
        if (normalized === 'CIVIL') return 'civil';
        if (normalized === 'RELIGIOUS') return 'religious';
        if (normalized === 'COMMON_LAW') return 'common law';
        if (normalized === 'SAME_SEX') return 'same sex';
        return null;
    }

    /** Writes `REFN`/`EXID` identifiers (round-tripped by the importer into the `Identifier` table). */
    private writeIdentifiers(lines: string[], level: number, identifiers?: Row[] | null) {
        for (const identifier of identifiers || []) {
            const value = this.inline(identifier.value);
            if (!value) continue;
            const type = this.inline(identifier.type);
            const tag = (type || '').toUpperCase() === 'EXID' ? 'EXID' : 'REFN';
            this.write(lines, level, tag, value);
            if (type && type.toUpperCase() !== tag) this.write(lines, level + 1, 'TYPE', type);
        }
    }

    private writeAddresses(lines: string[], level: number, addresses?: Row[] | null) {
        for (const address of addresses || []) {
            const street = this.inline(address.street);
            if (!street && !address.city && !address.postal) continue;
            if (street) this.write(lines, level, 'ADDR', street);
            else this.writeTag(lines, level, 'ADDR');
            this.write(lines, level + 1, 'CITY', this.inline(address.city));
            this.write(lines, level + 1, 'STAE', this.inline(address.state));
            this.write(lines, level + 1, 'POST', this.inline(address.postal));
            this.write(lines, level + 1, 'CTRY', this.inline(address.country));
            this.write(lines, level + 1, 'PHON', this.inline(address.phone));
            this.write(lines, level + 1, 'EMAIL', this.inline(address.email));
        }
    }

    private writePerson(
        lines: string[],
        person: Row,
        maps: XrefMaps,
        extensionTags: Set<string>,
        famcByPerson: Map<string, Array<{ reference: string; pedigree: string | null }>>,
        famsByPerson: Map<string, string[]>
    ) {
        const reference = maps.person.get(person.id);
        if (!reference) return;

        lines.push(`0 ${reference} INDI`);
        this.write(lines, 1, 'UID', this.uuidToken(person.id));
        const restriction = (this.inline(person.restrictionNotice) || 'NONE').toUpperCase();
        if (restriction !== 'NONE') this.write(lines, 1, 'RESN', restriction);
        if (person.sex && SEX_VALUES.has(person.sex)) this.write(lines, 1, 'SEX', person.sex);

        const names = [...(person.names || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        names.forEach((name, index) => {
            this.write(lines, 1, 'NAME', this.text(name.full) || 'Unbekannt');
            this.write(lines, 2, 'GIVN', this.inline(name.given));
            this.write(lines, 2, 'SURN', this.inline(name.surname));
            this.write(lines, 2, 'NPFX', this.inline(name.prefix));
            this.write(lines, 2, 'NSFX', this.inline(name.suffix));
            const nameType = NAME_TYPE_MAP[(this.inline(name.type) || '').toUpperCase()];
            if (nameType) this.write(lines, 2, 'TYPE', nameType);
            else if (names.length > 1 && index > 0) this.write(lines, 2, 'TYPE', 'married');
        });

        this.write(lines, 1, 'RELI', this.inline(person.religion));
        for (const website of person.www || []) this.write(lines, 1, 'WWW', this.inline(website));
        this.writeIdentifiers(lines, 1, person.identifiers);
        this.writeAddresses(lines, 1, person.addresses);

        for (const fact of person.facts || []) {
            this.writeEventStructure(lines, 1, fact, this.resolveFactTag(fact, extensionTags), maps);
        }
        for (const event of person.events || []) {
            const tag = this.resolveEventTag(event, extensionTags);
            if (tag === 'EVEN') {
                this.writeEventStructure(lines, 1, event, 'EVEN', maps, this.inline(event.customType));
                continue;
            }
            this.writeEventStructure(lines, 1, event, tag, maps);
        }

        this.writeAssociations(lines, 1, person.associations, maps);
        this.writeNoteStructures(lines, 1, person.noteLinks, maps, person.notes);
        this.writeMediaLinks(lines, 1, person.mediaLinks, maps);
        this.writeCitations(lines, 1, person.citations, maps);

        for (const familyLink of famcByPerson.get(person.id) || []) {
            this.write(lines, 1, 'FAMC', familyLink.reference);
            if (familyLink.pedigree) {
                this.write(lines, 2, 'PEDI', familyLink.pedigree);
                if (familyLink.pedigree === 'other') this.write(lines, 3, 'PHRASE', 'step');
            }
        }
        for (const familyReference of famsByPerson.get(person.id) || []) {
            this.write(lines, 1, 'FAMS', familyReference);
        }
        this.writeChangeDate(lines, 1, person.chanDate || person.updatedAt);
    }

    private writeFamily(lines: string[], family: Row, maps: XrefMaps, extensionTags: Set<string>) {
        const reference = maps.family.get(family.id);
        if (!reference) return;

        lines.push(`0 ${reference} FAM`);
        this.write(lines, 1, 'UID', this.uuidToken(family.id));
        const restriction = (this.inline(family.restrictionNotice) || 'NONE').toUpperCase();
        if (restriction !== 'NONE') this.write(lines, 1, 'RESN', restriction);

        const members = family.familyMembers || [];
        const parents = members.filter((member: Row) => member.role === 'SPOUSE' || member.role === 'PARENT');
        const children = members.filter((member: Row) => member.role === 'CHILD');
        const husband = parents.find((member: Row) => member.person?.sex === 'M') || parents[0];
        const wife = parents.find((member: Row) => member.person?.sex === 'F' && member !== husband);

        const husbandReference = husband?.personId ? maps.person.get(husband.personId) : null;
        const wifeReference = wife?.personId ? maps.person.get(wife.personId) : null;
        if (husbandReference) this.write(lines, 1, 'HUSB', husbandReference);
        if (wifeReference) this.write(lines, 1, 'WIFE', wifeReference);
        for (const child of children) {
            const childReference = maps.person.get(child.personId);
            if (childReference) this.write(lines, 1, 'CHIL', childReference);
        }

        for (const event of family.events || []) {
            const tag = this.resolveEventTag(event, extensionTags);
            const familyTag = FAMILY_EVENT_TAGS.has(tag) ? tag : 'EVEN';
            this.writeEventStructure(lines, 1, event, familyTag, maps, this.inline(event.customType));
        }

        this.writeNoteStructures(lines, 1, family.noteLinks, maps);
        this.writeMediaLinks(lines, 1, family.mediaLinks, maps);
        this.writeCitations(lines, 1, family.citations, maps);
        this.writeChangeDate(lines, 1, family.chanDate || family.updatedAt);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Document
    // ─────────────────────────────────────────────────────────────────────────

    /** Serializes a whole tree as one GEDCOM 7.0 document. */
    async exportTree(treeId: string): Promise<string> {
        const extensionTags = new Set<string>();
        const xref = this.createXrefAllocator();

        const [persons, families, sources, repositories, mediaRecords, notes] = await Promise.all([
            this.prisma.person.findMany({
                where: { treeId },
                include: {
                    names: true,
                    events: this.eventInclude(),
                    facts: this.eventInclude(),
                    noteLinks: { include: { note: true } },
                    mediaLinks: { include: { media: true } },
                    citations: this.citationInclude(),
                    associations: this.associationInclude(),
                    identifiers: true,
                    addresses: true,
                    notes: true
                }
            }),
            this.prisma.family.findMany({
                where: { treeId },
                include: {
                    familyMembers: { include: { person: { include: { names: true } } } },
                    events: this.eventInclude(),
                    noteLinks: { include: { note: true } },
                    mediaLinks: { include: { media: true } },
                    citations: this.citationInclude(),
                    identifiers: true
                }
            }),
            this.prisma.source.findMany({
                where: { treeId },
                include: {
                    repository: true,
                    noteLinks: { include: { note: true } },
                    mediaLinks: { include: { media: true } },
                    identifiers: true
                }
            }),
            this.prisma.repository.findMany({ where: { treeId }, include: { identifiers: true } }),
            this.prisma.media.findMany({
                where: { treeId },
                include: { noteLinks: { include: { note: true } } }
            }),
            this.prisma.sharedNote.findMany({ where: { treeId } })
        ]);

        const maps: XrefMaps = {
            person: new Map(),
            family: new Map(),
            source: new Map(),
            repository: new Map(),
            media: new Map(),
            note: new Map()
        };

        for (const repository of repositories) maps.repository.set(repository.id, xref('R', repository.gedcomId));
        for (const source of sources) maps.source.set(source.id, xref('S', source.gedcomId));
        for (const media of mediaRecords) maps.media.set(media.id, xref('O', media.gedcomId));
        for (const note of notes) maps.note.set(note.id, xref('N', note.gedcomId));
        for (const family of families) maps.family.set(family.id, xref('F', family.gedcomId));
        for (const person of persons) maps.person.set(person.id, xref('I', person.gedcomId));

        const famcByPerson = new Map<string, Array<{ reference: string; pedigree: string | null }>>();
        const famsByPerson = new Map<string, string[]>();
        for (const family of families) {
            const reference = maps.family.get(family.id);
            if (!reference) continue;
            for (const member of family.familyMembers || []) {
                if (!member.personId) continue;
                if (member.role === 'CHILD') {
                    const entries = famcByPerson.get(member.personId) || [];
                    entries.push({
                        reference,
                        pedigree: PEDI_MAP[(this.inline(member.pedigreeType) || '').toUpperCase()] || null
                    });
                    famcByPerson.set(member.personId, entries);
                } else {
                    const entries = famsByPerson.get(member.personId) || [];
                    if (!entries.includes(reference)) entries.push(reference);
                    famsByPerson.set(member.personId, entries);
                }
            }
        }

        const body: string[] = [];
        this.writeSubmitter(body);
        for (const repository of repositories) this.writeRepository(body, repository, maps);
        for (const source of sources) this.writeSource(body, source, maps);
        for (const note of notes) this.writeSharedNote(body, note, maps);
        for (const media of mediaRecords) this.writeMediaRecord(body, media, maps);
        for (const person of persons) this.writePerson(body, person, maps, extensionTags, famcByPerson, famsByPerson);
        for (const family of families) this.writeFamily(body, family, maps, extensionTags);
        body.push('0 TRLR');

        const lines: string[] = [];
        lines.push('0 HEAD');
        this.writeTag(lines, 1, 'GEDC');
        this.write(lines, 2, 'VERS', '7.0');
        this.write(lines, 1, 'SOUR', 'Heritago');
        this.write(lines, 2, 'VERS', '7.0');
        this.write(lines, 2, 'NAME', 'Heritago');
        this.write(lines, 1, 'DATE', this.formatTimestamp());
        this.write(lines, 1, 'LANG', 'de');
        this.write(lines, 1, 'SUBM', SUBMITTER_XREF);
        if (extensionTags.size) {
            this.writeTag(lines, 1, 'SCHMA');
            for (const tag of Array.from(extensionTags).sort()) {
                const uri = EXTENSION_TAG_URIS[tag] || `https://heritago.app/terms/${tag}`;
                this.write(lines, 2, 'TAG', `${tag} ${uri}`);
            }
        }

        return [...lines, ...body].join('\n');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Prisma include presets
    // ─────────────────────────────────────────────────────────────────────────

    private citationInclude(): any {
        return {
            include: {
                source: true,
                citationTexts: true,
                noteLinks: { include: { note: true } }
            }
        };
    }

    private associationInclude(): any {
        return {
            include: {
                associated: { include: { names: true } },
                citations: this.citationInclude()
            }
        };
    }

    private eventInclude(): any {
        return {
            include: {
                place: true,
                citations: this.citationInclude(),
                noteLinks: { include: { note: true } },
                mediaLinks: { include: { media: true } },
                associations: this.associationInclude()
            }
        };
    }
}
