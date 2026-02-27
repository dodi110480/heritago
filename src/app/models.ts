export interface Name {
    id?: string;
    type?: string; // BIRTH, MARRIED, AKA, etc.
    given?: string;
    surname?: string;
    prefix?: string;
    suffix?: string;
    nickname?: string;
    isPrimary: boolean;
}

export interface Citation {
    id?: string;
    sourceId: string;
    sourceTitle?: string;
    whereInSource?: string;
    date?: string;
    text?: string;
    quality?: number;
}

export interface Media {
    id?: string;
    url: string;
    title?: string;
    caption?: string; // Legacy
    isPrimary: boolean;
    mimeType?: string;
    originalFileName?: string;
    fileSize?: number;
}

export interface Fact {
    id?: string;
    type: string; // OCCU, EDUC, etc.
    value?: string;
    dateText?: string;
    placeId?: string;
    placeName?: string;
}

export interface Individual {
    id: string;
    name: string; // Display name
    names: Name[];
    gender: 'M' | 'F' | 'X' | 'U';
    isAlive?: boolean;
    email?: string;
    parents?: string[]; // Family IDs
    spouses?: string[]; // Family IDs
    events: LifeEvent[];
    facts: Fact[];
    citations: Citation[];
    media: Media[];
    notes: string[];
    extensions: { key: string; value: string }[];
    updatedAt?: string;

    // Legacy/Derived fields for easier access in tree
    firstName?: string;
    lastName?: string;
    birthDate?: string;
    deathDate?: string;
    birthPlace?: string;
    deathPlace?: string;
    profileImageUrl?: string;

    // Simple Mode UI derived fields
    fatherId?: string;
    fatherName?: string;
    motherId?: string;
    motherName?: string;
    familiesAsSpouse?: {
        spouseId?: string;
        spouseName?: string;
        children: { id: string; name: string }[];
    }[];
}

export interface LifeEvent {
    id?: string;
    type: string;
    date?: string;
    dateText?: string;
    placeId?: string;
    place?: string;
    description?: string;
    age?: string;
    isPrimary: boolean;
}

export interface Family {
    id: string;
    husband?: string; // Individual ID
    wife?: string;    // Individual ID
    children: string[]; // Individual IDs
    events?: LifeEvent[];
    media?: Media[];
}

export interface TreeData {
    individuals: Individual[];
    families: Family[];
    meta?: {
        tree: string;
        treeId?: string;
        gedcom?: string;
    };
}
