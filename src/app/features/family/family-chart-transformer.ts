import { TreeData, Individual, Family } from '../../models';

export interface FamilyChartNode {
    id: string;
    data: {
        gender: 'M' | 'F';
        "first name": string;
        "last name": string;
        birthday?: string;
        death?: string;
        avatar?: string;
        [key: string]: any;
    };
    rels: {
        parents: string[];
        spouses: string[];
        children: string[];
    };
}

export function transformToFamilyChart(treeData: TreeData): FamilyChartNode[] {
    const nodes: FamilyChartNode[] = [];
    const individuals = treeData.individuals || [];
    const families = treeData.families || [];
    const individualIds = new Set(individuals.map(i => i.id));

    for (const person of individuals) {
        const node: FamilyChartNode = {
            id: person.id,
            data: {
                gender: person.gender === 'F' ? 'F' : 'M', // Fallback to M if unknown for layout stability
                "first name": person.firstName || person.name.split(' ')[0] || '',
                "last name": person.lastName || person.name.split(' ').slice(1).join(' ') || '',
                birthday: person.birthDate,
                death: person.deathDate,
            },
            rels: {
                parents: [],
                spouses: [],
                children: []
            }
        };

        // Add avatar if primary media exists, else fallback to centralized asset
        const primaryMedia = person.media && person.media.length > 0 ? (person.media.find(m => m.isPrimary) || person.media[0]) : null;
        if (primaryMedia?.id) {
            node.data.avatar = primaryMedia.id;
        }

        // Resolve relationships
        const personId = person.id;

        // Parents: Find all families where this person is a child and collect parents
        const birthFams = families.filter(f => (f.children || []).includes(personId));
        for (const fam of birthFams) {
            if (node.rels.parents.length >= 2) break;
            if (fam.husband && individualIds.has(fam.husband) && !node.rels.parents.includes(fam.husband)) {
                node.rels.parents.push(fam.husband);
            }
            if (node.rels.parents.length >= 2) break;
            if (fam.wife && individualIds.has(fam.wife) && !node.rels.parents.includes(fam.wife)) {
                node.rels.parents.push(fam.wife);
            }
        }

        // Spouses and Children: Find families where this person is husband or wife
        const ownFamilies = families.filter(f => f.husband === personId || f.wife === personId);
        for (const fam of ownFamilies) {
            const spouseId = fam.husband === personId ? fam.wife : fam.husband;
            if (spouseId && individualIds.has(spouseId) && !node.rels.spouses.includes(spouseId)) {
                node.rels.spouses.push(spouseId);
            }

            for (const childId of (fam.children || [])) {
                if (individualIds.has(childId) && !node.rels.children.includes(childId)) {
                    node.rels.children.push(childId);
                }
            }
        }

        nodes.push(node);
    }

    return nodes;
}
