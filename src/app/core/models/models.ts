export type NoteCategory = 'RESEARCH' | 'HINT' | 'QUESTION' | 'TRANSCRIPTION' | 'TODO' | 'COMMENT' | 'OTHER';

export type SourceType =
  | 'BUCH'
  | 'WEBSEITE'
  | 'DOKUMENT'
  | 'ZEITUNG'
  | 'ARCHIV'
  | 'FOTO'
  | 'AUDIO'
  | 'VIDEO'
  | 'PERIODISCH'
  | 'KIRCHBUCH'
  | 'VOLKSZAEHLUNG'
  | 'ANDERE';

export type SourceCategory = 'PRIMARY' | 'SECONDARY';

export type ConfidenceLevel = 'CERTAIN' | 'VERY_LIKELY' | 'LIKELY' | 'POSSIBLE' | 'UNLIKELY';

export type EntityType = 'PERSON' | 'EVENT' | 'FACT' | 'FAMILY' | 'SOURCE' | 'PLACE' | 'RESEARCH_LOG' | 'MEDIA' | 'CITATION' | 'REPOSITORY' | 'NOTE';

export interface DisplaySource {
  readonly id: string;
  readonly gedcomId?: string;

  readonly title: string;
  readonly shortTitle?: string;

  readonly author?: string;
  readonly publication?: string;

  readonly repository?: {
    readonly id: string;
    readonly gedcomId?: string;
    readonly name: string;
    readonly address?: string;
    readonly phone?: string;
    readonly email?: string;
    readonly website?: string;
  };

  readonly sourceType?: SourceType;
  readonly category?: SourceCategory;

  readonly url?: string;
  readonly description?: string;

  readonly confidence?: ConfidenceLevel;

  readonly citationCount?: number;
  readonly mediaCount?: number;
  readonly noteCount?: number;

  readonly createdAt: Date;
  readonly updatedAt?: Date;
  readonly chanDate?: Date;

  readonly createdBy?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };

  readonly linkedEntity?: {
    type: EntityType;
    id: string;
    label: string;
    url?: string;
  };

  readonly isPrivate?: boolean;
  readonly tags?: string[];

  readonly isArchived?: boolean;

  readonly text?: string;
  readonly priority?: number;
}

export interface DisplayNote {
    id: string;
    text: string;
    noteType?: NoteCategory;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    createdBy?: { id: string; username: string; avatarUrl?: string };
    linkedEntity?: { type: string; id: string; label: string; url?: string | any[] };
    isPrivate?: boolean;
    tags?: string[];
    isArchived?: boolean;
    priority?: number;
}

export interface DisplayMedia {
    id: string;
    title?: string;
    mimeType?: string;
    mediaType?: 'PHOTO' | 'DOCUMENT' | 'RECORD' | 'OTHER';
    isPrimary?: boolean;
    role?: 'PORTRAIT' | 'DOCUMENT' | 'CERTIFICATE' | 'GRAVESTONE' | 'SIGNATURE' | 'OTHER';
    caption?: string;
    url?: string;
    previewUrl?: string;
    links?: any[];
    orphanFile?: boolean;
    fileMissing?: boolean;
}

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
    notes?: DisplayNote[];
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
    gedcomId?: string;
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
    notes: DisplayNote[];
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
    participations?: {
        role: string;
        eventTag: string;
        eventDate?: string;
        subjectPersonId: string;
        subjectPersonName: string;
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
    notes?: DisplayNote[];
    citations?: Citation[];
    age?: string;
    isPrimary: boolean;
    associations?: any[]; // For event participants
}

export interface Family {
    id: string;
    gedcomId?: string;
    husband?: string; // Individual ID
    wife?: string;    // Individual ID
    children: string[]; // Individual IDs
    events?: LifeEvent[];
    media?: Media[];
    notes?: DisplayNote[];
    citations?: Citation[];
}

export interface TreeData {
    individuals: Individual[];
    families: Family[];
    sources?: any[];
    repositories?: any[];
    places?: any[];
    meta?: {
        tree: string;
        treeId?: string;
        gedcom?: string;
    };
}

export interface TimelineItem {
    originalType: 'event' | 'fact' | 'family-event';
    originalIndex: number;
    familyId?: string;
    sourcePersonId?: string;
    sourcePersonName?: string;
    tag: string;
    date?: string;
    place?: string;
    description?: string; // Für Events
    value?: string; // Für Fakten
    media?: any[];
    notes?: string[];
    citations?: any[];
    associations?: any[];
    expanded?: boolean;
    editing?: boolean;
}
