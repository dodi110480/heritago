/**
 * Data Bridge for Heritago
 * Fetches data from Heritago backend and transforms it for family-chart examples.
 */

export async function fetchHeritagoData(treeName = 'default') {
    try {
        let response = await fetch(`http://localhost:3000/api/tree/${treeName}`);

        if (!response.ok) {
            // If default fails, try to find any available tree
            const treesRes = await fetch('http://localhost:3000/api/trees');
            const treesData = await treesRes.json();
            if (treesData.success && treesData.trees.length > 0) {
                treeName = treesData.trees[0].name;
                response = await fetch(`http://localhost:3000/api/tree/${treeName}`);
            }
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error('Failed to fetch tree data');
        }

        return transformToFamilyChart(result.individuals, result.families);
    } catch (error) {
        console.error('Error fetching Heritago data:', error);
        return [];
    }
}

function transformToFamilyChart(individuals, families) {
    return individuals.map(person => {
        const node = {
            id: person.id,
            data: {
                gender: person.gender === 'F' ? 'F' : 'M',
                "first name": person.firstName || person.name?.split(' ')[0] || '',
                "last name": person.lastName || person.name?.split(' ').slice(1).join(' ') || '',
                birthday: person.birthDate,
                death: person.deathDate,
            },
            rels: {
                parents: [],
                spouses: [],
                children: []
            }
        };

        // Avatar
        if (person.media && person.media.length > 0) {
            const primary = person.media.find(m => m.isPrimary) || person.media[0];
            node.data.avatar = primary.url;
        }

        // Parents
        const birthFam = families.find(f => (f.children || []).includes(person.id));
        if (birthFam) {
            if (birthFam.husband) node.rels.parents.push(birthFam.husband);
            if (birthFam.wife) node.rels.parents.push(birthFam.wife);
        }

        // Spouses & Children
        const ownFamilies = families.filter(f => f.husband === person.id || f.wife === person.id);
        for (const fam of ownFamilies) {
            const spouseId = fam.husband === person.id ? fam.wife : fam.husband;
            if (spouseId && !node.rels.spouses.includes(spouseId)) {
                node.rels.spouses.push(spouseId);
            }
            for (const childId of (fam.children || [])) {
                if (!node.rels.children.includes(childId)) {
                    node.rels.children.push(childId);
                }
            }
        }

        return node;
    });
}
