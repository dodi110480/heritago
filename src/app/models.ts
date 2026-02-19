export interface Individual {
    id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    gedcomName?: string;
    birthDate?: string;
    deathDate?: string;
    gender: 'M' | 'F' | 'X' | 'U';
    title?: string;
    suffix?: string;
    birthName?: string; // Maiden/Birth name
    birthPlace?: string;
    deathPlace?: string;
    isAlive?: boolean;
    email?: string;
    parents?: string[]; // Family IDs
    spouses?: string[]; // Family IDs
    events?: LifeEvent[];
}

export interface LifeEvent {
    type: string;
    date?: string;
    place?: string;
    description?: string;
}

export interface Family {
    id: string;
    husband?: string; // Individual ID
    wife?: string;    // Individual ID
    children: string[]; // Individual IDs
    events?: LifeEvent[];
}

export interface TreeData {
    individuals: Individual[];
    families: Family[];
    meta?: {
        tree: string;
        gedcom?: string;
    };
}
