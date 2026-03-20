export type PersonOption = {
    id?: string;
    gedcomId?: string;
    displayName?: string;
    name?: string;

    // Optional disambiguation fields (if backend provides them)
    birthDate?: string | null;
    deathDate?: string | null;
};

function cmp(v: any): string {
    return String(v || '').trim().toLowerCase();
}

function firstYear(v: any): string {
    const m = String(v || '').match(/\d{4}/);
    return m ? m[0] : '';
}

export function stripIdSuffix(label: string): string {
    const s = String(label || '').trim();
    return s.replace(/\s*\([^)]+\)\s*$/, '').trim();
}

export function stripLifeDatesSuffix(label: string): string {
    const s = String(label || '').trim();

    // Matches e.g. "(1900-1970)", "(*1900)", "(+1970)", "(1900)" at the end.
    return s
        .replace(/\s*\(\s*\d{3,4}\s*(?:[-–]\s*\d{3,4}\s*)?\)\s*$/, '')
        .replace(/\s*\(\s*[\*\+]\s*\d{3,4}\s*\)\s*$/, '')
        .trim();
}

export function stripPersonLabelToName(label: string): string {
    // Remove trailing "(uuid)" and then a trailing life-date marker if present.
    return stripLifeDatesSuffix(stripIdSuffix(label));
}

export function personOptionLabel(opt: PersonOption): string {
    // Start from a clean base name (no id suffix / no life-date suffix).
    const baseName = stripPersonLabelToName(String(opt.displayName || opt.name || '').trim());
    const id = String(opt.id || '').trim();

    const by = firstYear(opt.birthDate);
    const dy = firstYear(opt.deathDate);

    let dates = '';
    if (by && dy) {
        dates = `(${by}-${dy})`;
    } else if (by) {
        dates = `(*${by})`;
    } else if (dy) {
        dates = `(+${dy})`;
    }

    const nameWithDates = [baseName, dates].filter(Boolean).join(' ').trim();

    if (nameWithDates && id) return `${nameWithDates} (${id})`;
    return nameWithDates || id;
}

export function resolvePersonOption(
    input: string,
    options: PersonOption[],
    cfg?: { allowPrefix?: boolean }
): PersonOption | null {
    const normalized = cmp(input);
    if (!normalized) return null;

    // If input ends with "(something)", treat it as an id candidate.
    const m = String(input || '').trim().match(/\(([^)]+)\)\s*$/);
    const tail = m ? cmp(m[1]) : '';

    const exact = options.find((opt) => {
        const id = cmp(opt.id);
        const gedcomId = cmp(opt.gedcomId);
        const dnRaw = String(opt.displayName || opt.name || '').trim();
        const dn = cmp(dnRaw);

        const nameOnly = cmp(stripPersonLabelToName(dnRaw));

        return (id && (id === normalized || id === tail))
            || (gedcomId && (gedcomId === normalized || gedcomId === tail))
            || (dn && dn === normalized)
            || (nameOnly && nameOnly === normalized);
    });
    if (exact) return exact;

    if (!cfg?.allowPrefix) return null;

    return options.find((opt) => {
        const dnRaw = String(opt.displayName || opt.name || '').trim();
        const dn = cmp(dnRaw);
        const nameOnly = cmp(stripPersonLabelToName(dnRaw));
        return (nameOnly && nameOnly.startsWith(normalized))
            || (dn && dn.startsWith(normalized));
    }) || null;
}
