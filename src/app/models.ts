export interface Name {
    id?: string;
    type?: string; // BIRTH, MARRIED, AKA, etc.
    full?: string;
    given?: string;
    surname?: string;
    prefix?: string;
    suffix?: string;
    nickname?: string;
    isPrimary: boolean;
    sortOrder?: number;
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
    path?: string;
    url?: string; // Legacy compatibility
    remoteUrl?: string;
    title?: string;
    mediaType?: 'PHOTO' | 'DOCUMENT' | 'RECORD' | 'OTHER';
    mimeType?: string;
    filesize?: number;
    userId?: string;
    version?: number;
    isCurrent?: boolean;
    isPrimary?: boolean; // Needed for person/family links
    cropX?: number;
    cropY?: number;
    cropWidth?: number;
    cropHeight?: number;
    links?: any[];
    orphanFile?: boolean;
    fileMissing?: boolean;
    previewUrl?: string; // Frontend only
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
    isLiving?: boolean;
    privacyLevel?: 'PUBLIC' | 'FAMILY' | 'PRIVATE';
    exid?: string;
    associations?: {
        role?: string;
        associatedPersonId?: string;
        associatedPersonName?: string;
        relationText?: string;
        dateText?: string;
        confidence?: string;
        notes?: string;
    }[];
    dnaMatches?: {
        provider?: string;
        matchPersonId?: string;
        totalCm?: number;
        largestSegmentCm?: number;
        segmentCount?: number;
        predictedRelationship?: string;
        confidence?: string;
        testDate?: string;
        kitId?: string;
        segments?: {
            chromosome: string;
            startPosition: number;
            endPosition: number;
            cm: number;
            snpCount?: number;
            provider?: string;
            build?: string;
            isTriangulated?: boolean;
        }[];
    }[];

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
        familyId?: string; // Correctly added for deletion/reference
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
    subType?: string;
    media?: Media[];
    notes?: string[];
    citations?: Citation[];
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
