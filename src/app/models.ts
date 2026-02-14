export interface Individual {
    id: string;
    name: string;
    birthDate?: string;
    deathDate?: string;
    gender: 'M' | 'F' | 'U';
    parents?: string[]; // Family IDs
    spouses?: string[]; // Family IDs
}

export interface Family {
    id: string;
    husband?: string; // Individual ID
    wife?: string;    // Individual ID
    children: string[]; // Individual IDs
}

export interface TreeData {
    individuals: Individual[];
    families: Family[];
}
