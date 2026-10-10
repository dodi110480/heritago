#!/usr/bin/env node
/**
 * Minimal GEDCOM 7.0 conformance checker used to verify Heritago exports.
 *
 * Usage: node scripts/validate-gedcom.mjs <file.ged>
 *
 * It validates the structural rules of the FamilySearch GEDCOM 7.0 specification that a writer can
 * get wrong: header/trailer, structures removed in 7.0, line/level syntax, xref resolution, the
 * enumerations used by the exporter and the date value grammar.
 */

import { readFileSync } from 'node:fs';

const ENUMS = {
    SEX: ['M', 'F', 'X', 'U'],
    QUAY: ['0', '1', '2', '3'],
    PEDI: ['adopted', 'birth', 'foster', 'sealing', 'other'],
    RESN: ['CONFIDENTIAL', 'LOCKED', 'PRIVACY'],
    ROLE: ['CHIL', 'CLERGY', 'FATH', 'FRIEND', 'GODP', 'HUSB', 'MOTH', 'MULTIPLE', 'NGHBR', 'OFFICIATOR', 'PARENT', 'SPOU', 'WIFE', 'WITN', 'OTHER'],
    NAME_TYPE: ['aka', 'birth', 'immigrant', 'maiden', 'married', 'professional', 'other'],
    EVENATTR: [
        'CENS', 'NCHI', 'RESI', 'FACT', 'EVEN', 'ADOP', 'BAPM', 'BARM', 'BASM', 'BIRT', 'BLES', 'BURI', 'CHR',
        'CHRA', 'CONF', 'CREM', 'DEAT', 'EMIG', 'FCOM', 'GRAD', 'IMMI', 'NATU', 'ORDN', 'PROB', 'RETI', 'WILL',
        'ANUL', 'DIV', 'DIVF', 'ENGA', 'MARB', 'MARC', 'MARL', 'MARR', 'MARS', 'CAST', 'DSCR', 'EDUC', 'IDNO',
        'NATI', 'NMR', 'OCCU', 'PROP', 'RELI', 'SSN', 'TITL'
    ]
};

/** Structures that were removed in GEDCOM 7.0. */
const REMOVED_TAGS = new Set(['CHAR', 'CONC']);

const DATE_POINT_RE = /^(?:\d{1,2} [A-Z]{3} \d{3,4}|[A-Z]{3} \d{3,4}|\d{1,2} [A-Z]{3}|\d{3,4})$/;

const errors = [];
const warnings = [];
const report = (list, line, message) => list.push(`${line ? `Zeile ${line}: ` : ''}${message}`);

function isDatePoint(value) {
    return DATE_POINT_RE.test(value.trim());
}

function isDateValue(value) {
    const normalized = value.trim();
    const modifier = normalized.match(/^(ABT|CAL|EST|BEF|AFT) (.+)$/);
    if (modifier) return isDatePoint(modifier[2]);
    const range = normalized.match(/^BET (.+) AND (.+)$/);
    if (range) return isDatePoint(range[1]) && isDatePoint(range[2]);
    const period = normalized.match(/^FROM (.+) TO (.+)$/);
    if (period) return isDatePoint(period[1]) && isDatePoint(period[2]);
    return isDatePoint(normalized);
}

const filePath = process.argv[2];
if (!filePath) {
    console.error('Aufruf: node scripts/validate-gedcom.mjs <datei.ged>');
    process.exit(2);
}

const content = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
if (content.includes('\r')) report(warnings, 0, 'Datei enthält CR-Zeichen (GEDCOM 7.0 verwendet LF).');

const rawLines = content.split('\n');
if (rawLines.length && rawLines[rawLines.length - 1] === '') rawLines.pop();

const records = [];
const xrefs = new Set();
const pointers = [];
const uids = new Set();
const extensionTags = new Set();
const declaredTags = new Set();
let stack = [];

rawLines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const match = rawLine.match(/^(\d+) ?(@[^@\s]+@)? ?(\S+)(?: (.*))?$/);
    if (!match) {
        report(errors, lineNumber, `Ungültige Zeile: "${rawLine.slice(0, 60)}"`);
        return;
    }

    const level = Number(match[1]);
    const xref = match[2] || null;
    const tag = match[3];
    const payload = match[4] === undefined ? null : match[4];

    if (!/^[A-Z0-9_]{1,31}$/.test(tag)) report(errors, lineNumber, `Ungültiges Tag "${tag}"`);
    if (REMOVED_TAGS.has(tag)) report(errors, lineNumber, `Struktur "${tag}" existiert in GEDCOM 7.0 nicht`);
    if (tag.startsWith('_')) extensionTags.add(tag);
    if (rawLine.length > 255) report(warnings, lineNumber, `Zeile länger als 255 Zeichen (${rawLine.length})`);

    if (level === 0) {
        stack = [];
        if (xref) {
            records.push({ xref, tag, line: lineNumber });
            if (xrefs.has(xref)) report(errors, lineNumber, `Doppelter xref ${xref}`);
            xrefs.add(xref);
        }
        stack[0] = { tag, payload, line: lineNumber, level: 0 };
    } else {
        const previousLevel = stack[level - 1]?.level ?? -1;
        if (level > previousLevel + 1) report(errors, lineNumber, `Levelsprung von ${previousLevel} auf ${level}`);
        stack[level] = { tag, payload, line: lineNumber, level };
    }

    if (payload && payload.startsWith('@') && !/^@[A-Za-z0-9_]+@$/.test(payload.trim())) {
        report(errors, lineNumber, `Payload beginnt mit @ ist aber kein Pointer: "${payload.slice(0, 40)}"`);
    }
    if (payload && /^@[A-Za-z0-9_]+@$/.test(payload.trim()) && payload.trim() !== '@VOID@') {
        pointers.push({ value: payload.trim(), line: lineNumber });
    }

    if (tag === 'UID' && payload) {
        if (uids.has(payload)) report(warnings, lineNumber, `UID ${payload} mehrfach verwendet`);
        uids.add(payload);
    }

    const parent = level > 0 ? stack[level - 1]?.tag : null;

    if (tag === 'VERS' && parent === 'GEDC' && payload && !/^7\.\d+(\.\d+)?$/.test(payload.trim())) {
        report(errors, lineNumber, `GEDC.VERS muss 7.x sein, gefunden "${payload}"`);
    }
    if (tag === 'FORM' && parent === 'GEDC') {
        report(errors, lineNumber, 'GEDC.FORM existiert in GEDCOM 7.0 nicht');
    }
    if (['SEX', 'QUAY', 'PEDI', 'RESN', 'ROLE'].includes(tag) && payload
        && !ENUMS[tag].includes(payload.trim())) {
        report(errors, lineNumber, `${tag} "${payload.trim()}" ist kein gültiger Enumerationswert`);
    }
    if (tag === 'TYPE' && parent === 'NAME' && payload && !ENUMS.NAME_TYPE.includes(payload.trim())) {
        report(errors, lineNumber, `NAME.TYPE "${payload.trim()}" ist kein gültiger Enumerationswert`);
    }
    if (tag === 'TYPE' && parent === 'EVEN' && payload && !ENUMS.EVENATTR.includes(payload.trim().toUpperCase())) {
        report(warnings, lineNumber, `EVEN.TYP "${payload.trim()}" steht nicht im EVENATTR-Enum`);
    }
    if (tag === 'DATE' && payload) {
        const dateContext = parent === null || ['CHAN', 'HEAD', 'EVEN', 'DATA', 'BIRT', 'DEAT', 'MARR', 'DIV',
            'BURI', 'CHR', 'RESI', 'OCCU', 'CENS', 'EMIG', 'IMMI', 'WILL', 'PROB', 'NATU'].includes(parent);
        if (dateContext && !isDateValue(payload)) {
            report(errors, lineNumber, `Ungültiger Datumswert "${payload}"`);
        }
    }
    if (tag === 'TAG' && parent === 'SCHMA' && payload) declaredTags.add(payload.split(' ')[0]);
});

if (!rawLines[0]?.startsWith('0 HEAD')) report(errors, 1, 'Dokument beginnt nicht mit "0 HEAD"');
if (rawLines[rawLines.length - 1] !== '0 TRLR') report(errors, rawLines.length, 'Dokument endet nicht mit "0 TRLR"');
if (!records.some((record) => record.tag === 'INDI')) report(warnings, 0, 'Keine INDI-Records gefunden');

for (const pointer of pointers) {
    if (!xrefs.has(pointer.value)) report(errors, pointer.line, `Pointer ${pointer.value} zeigt auf kein Record`);
}

for (const tag of extensionTags) {
    if (!declaredTags.has(tag)) report(errors, 0, `Extension-Tag ${tag} ist nicht in HEAD.SCHMA deklariert`);
}

// Generic EVEN and FACT structures must carry a TYPE substructure.
let currentRecordTag = null;
rawLines.forEach((rawLine, index) => {
    const parts = rawLine.split(' ');
    if (parts[0] === '0') {
        currentRecordTag = parts[parts.length - 1];
        return;
    }
    if (currentRecordTag !== 'INDI' && currentRecordTag !== 'FAM') return;
    if (parts[1] !== 'EVEN' && parts[1] !== 'FACT') return;
    const level = Number(parts[0]);
    const hasType = rawLines.slice(index + 1, index + 4)
        .some((candidate) => new RegExp(`^${level + 1} TYPE `).test(candidate));
    if (!hasType) report(errors, index + 1, `${parts[1]} ohne TYPE (für EVEN/FACT in GEDCOM 7.0 erforderlich)`);
});

console.log(`Geprüft: ${filePath}`);
console.log(`Records: ${records.length} (INDI ${records.filter(r => r.tag === 'INDI').length}, FAM ${records.filter(r => r.tag === 'FAM').length})`);
console.log(`Warnungen: ${warnings.length}`);
for (const warning of warnings.slice(0, 25)) console.log(`  WARN   ${warning}`);
console.log(`Fehler: ${errors.length}`);
for (const error of errors.slice(0, 40)) console.log(`  FEHLER ${error}`);

process.exit(errors.length ? 1 : 0);
