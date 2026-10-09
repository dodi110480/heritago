import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { STORAGE_ROOT, MEDIA_ROOT } from '../config';
import { PersonService } from './person.service';
import { FamilyService } from './family.service';
import { GenealogyValidator } from '../shared/validator.utils';

export class TreeService {
    private personService: PersonService;
    private familyService: FamilyService;

    constructor(private prisma: PrismaClient) {
        this.personService = new PersonService(prisma);
        this.familyService = new FamilyService(prisma);
    }

    async getTrees() {
        return this.prisma.tree.findMany({
            include: {
                _count: {
                    select: {
                        persons: true,
                        families: true,
                        media: true
                    }
                }
            }
        });
    }

    async createTree(data: {
        name: string;
        title?: string;
        userId?: string;
        initialPerson?: {
            firstName: string;
            lastName: string;
            gender?: string;
            birthDate?: string;
        }
    }) {
        const { name, title, initialPerson } = data;
        const { userId } = data;
        const normalizedName = (name || '').trim();
        if (!normalizedName) {
            throw new Error('Tree name is required.');
        }

        // Enforce one tree limit for non-admins
        if (userId) {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!user) {
                throw new Error('Benutzer nicht gefunden. Bitte neu einloggen.');
            }
            if (user && user.globalRole !== 'ADMIN') {
                const ownerCount = await this.prisma.treePermission.count({
                    where: { userId, level: 'OWNER' }
                });
                if (ownerCount >= user.maxTrees) {
                    throw new Error(`Du kannst maximal ${user.maxTrees} Stammbaum/Stammbäume besitzen.`);
                }
            }
        }

        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.tree.findUnique({ where: { name: normalizedName } });
            if (existing) {
                throw new Error('Tree name already exists.');
            }
            const tree = await tx.tree.create({ data: { name: normalizedName, title } });

            if (userId) {
                await tx.treePermission.create({
                    data: {
                        treeId: tree.id,
                        userId,
                        level: 'OWNER'
                    }
                });
            }

            if (initialPerson?.firstName && initialPerson?.lastName) {
                const gedcomId = `@I${Date.now()}@`;
                const person = await tx.person.create({
                    data: {
                        treeId: tree.id,
                        gedcomId,
                        sex: (initialPerson.gender as any) || 'U'
                    }
                });

                await tx.name.create({
                    data: {
                        treeId: tree.id,
                        personId: person.id,
                        given: initialPerson.firstName,
                        surname: initialPerson.lastName,
                        full: `${initialPerson.firstName} ${initialPerson.lastName}`.trim(),
                        isPrimary: true
                    }
                });
            }

            return tree;
        });
    }

    async updateTree(id: string, data: { title?: string, description?: string, isPublic?: boolean }) {
        return this.prisma.tree.update({
            where: { id },
            data
        });
    }

    async deleteTree(id: string) {
        // Find media to delete files
        const media = await this.prisma.media.findMany({ where: { treeId: id } });
        for (const m of media) {
            const fname = m.path;
            if (fname) {
                const baseDir = fname.startsWith('users/') ? STORAGE_ROOT : MEDIA_ROOT;
                const fullPath = path.join(baseDir, fname);
                try {
                    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                } catch (e) {
                    console.warn(`[TreeService]: Could not delete file ${fullPath}`, e);
                }
            }
        }

        return this.prisma.tree.delete({ where: { id } });
    }

    /**
     * Admin-only listing of all trees with metadata only (no genealogy payload).
     * Returns owners, collaborators, counts and an `isOrphaned` flag so the admin
     * can spot trees that lost their owner (e.g. after a user was deleted).
     */
    async listAllTreesForAdmin() {
        const trees = await this.prisma.tree.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                permissions: {
                    include: {
                        user: { select: { id: true, username: true, email: true } }
                    }
                },
                _count: {
                    select: { persons: true, families: true, media: true }
                }
            }
        });

        return trees.map((tree) => {
            const owners = tree.permissions
                .filter((p) => p.level === 'OWNER')
                .map((p) => ({ id: p.user.id, username: p.user.username, email: p.user.email }));
            const collaborators = tree.permissions
                .filter((p) => p.level !== 'OWNER')
                .map((p) => ({ id: p.user.id, username: p.user.username, email: p.user.email, level: p.level }));

            return {
                id: tree.id,
                name: tree.name,
                title: tree.title,
                isPublic: tree.isPublic,
                createdAt: tree.createdAt,
                isOrphaned: owners.length === 0,
                owners,
                collaborators,
                counts: {
                    persons: tree._count.persons,
                    families: tree._count.families,
                    media: tree._count.media
                }
            };
        });
    }

    /**
     * Transfer ownership of a tree to another user. Replaces existing OWNER
     * permissions while leaving EDITOR/VIEWER/COMMENTER permissions untouched.
     */
    async reassignTreeOwner(treeId: string, userId: string) {
        const tree = await this.prisma.tree.findUnique({ where: { id: treeId } });
        if (!tree) {
            throw new Error('Stammbaum nicht gefunden.');
        }

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new Error('Benutzer nicht gefunden.');
        }

        return this.prisma.$transaction(async (tx) => {
            // Remove existing owners (single ownership transfer).
            await tx.treePermission.deleteMany({ where: { treeId, level: 'OWNER' } });

            // Set the new owner; keep other collaborator roles untouched.
            await tx.treePermission.upsert({
                where: { treeId_userId: { treeId, userId } },
                create: { treeId, userId, level: 'OWNER' },
                update: { level: 'OWNER' }
            });

            return tx.tree.findUnique({ where: { id: treeId } });
        });
    }


    async getMapData(treeId: string) {
        const dbTree = await this.prisma.tree.findUnique({
            where: { id: treeId },
            include: {
                places: {
                    where: {
                        AND: [
                            { latitude: { not: null } },
                            { longitude: { not: null } }
                        ]
                    }
                }
            }
        });

        if (!dbTree) return { markers: [], persons: [] };

        const personsWithPlaces = await this.prisma.person.findMany({
            where: { treeId: treeId },
            take: 200, // Increased limit
            include: {
                events: {
                    where: { place: { latitude: { not: null }, longitude: { not: null } } },
                    include: { place: true }
                },
                facts: {
                    where: { place: { latitude: { not: null }, longitude: { not: null } } },
                    include: { place: true }
                },
                names: { where: { isPrimary: true } },
                mediaLinks: {
                    include: { media: true },
                    where: { isPrimary: true }
                }
            }
        });

        const markers = dbTree.places.map(p => {
            // Find persons at this exact place
            const personsAtThisPlace = personsWithPlaces.filter(person => 
                person.events.some(e => e.placeId === p.id) || 
                person.facts.some(f => f.placeId === p.id)
            ).map(person => {
                const primaryName = person.names[0];
                return {
                    id: person.id,
                    firstName: primaryName?.given || '',
                    lastName: primaryName?.surname || '',
                    profileImageUrl: person.mediaLinks[0]?.media?.id || ''
                };
            });

            return {
                id: p.id,
                name: p.name,
                lat: p.latitude,
                lng: p.longitude,
                persons: personsAtThisPlace
            };
        });

        const persons = personsWithPlaces.filter(p => p.events.length > 0 || p.facts.length > 0).map((p: any) => {
            return {
                ...PersonService.formatPersonForClient(p),
                places: [
                    ...p.events.map((e: any) => ({ name: e.place?.name || '', lat: e.place?.latitude, lng: e.place?.longitude })),
                    ...p.facts.map((f: any) => ({ name: f.place?.name || '', lat: f.place?.latitude, lng: f.place?.longitude }))
                ]
            };
        });

        return { markers, persons };
    }

    async getFullTreeData(treeId: string) {
        // Ensure redundant families are cleaned up before fetching
        await this.familyService.cleanupRedundantFamilies(treeId);

        const [persons, families, sources, repositories, places] = await Promise.all([
            this.prisma.person.findMany({
                where: { treeId },
                include: {
                    names: true,
                    events: { include: { place: true } },
                    facts: { include: { place: true } },
                    mediaLinks: { include: { media: true } },
                    citations: { include: { source: true } }
                }
            }),
            this.prisma.family.findMany({
                where: { treeId },
                include: {
                    familyMembers: { include: { person: { include: { names: true } } } },
                    events: { include: { place: true } },
                    citations: { include: { source: true } }
                }
            }),
            this.prisma.source.findMany({
                where: { treeId },
                include: { repository: true }
            }),
            this.prisma.repository.findMany({
                where: { treeId }
            }),
            this.prisma.place.findMany({
                where: { treeId }
            })
        ]);

        return {
            individuals: persons.map(p => PersonService.formatPersonForClient(p)),
            families: families.map(f => FamilyService.formatFamilyForClient(f)),
            sources,
            repositories,
            places,
            meta: {
                treeId,
                tree: (await this.prisma.tree.findUnique({ where: { id: treeId } }))?.name || ''
            }
        };
    }

    async getStats(treeId: string) {
        const [counts, gender, personsWithData] = await Promise.all([
            this.prisma.$transaction([
                this.prisma.person.count({ where: { treeId } }),
                this.prisma.family.count({ where: { treeId } }),
                this.prisma.source.count({ where: { treeId } }),
                this.prisma.media.count({ where: { treeId } }),
                this.prisma.place.count({ where: { treeId } }),
            ]),
            this.prisma.person.groupBy({
                by: ['sex'],
                where: { treeId },
                _count: true
            }),
            this.prisma.person.findMany({
                where: { treeId },
                select: {
                    id: true,
                    sex: true,
                    updatedAt: true,
                    names: {
                        where: { isPrimary: true },
                        select: { given: true, surname: true, full: true }
                    },
                    events: {
                        where: { type: 'BIRT' },
                        select: { dateText: true }
                    },
                    mediaLinks: {
                        select: { id: true }
                    }
                }
            })
        ]);

        const totalPersons = counts[0];
        let completenessScore = 0;
        const surnames: Record<string, number> = {};
        let latestUpdate: any = null;

        personsWithData.forEach(p => {
            // Completeness calculation
            const { score } = GenealogyValidator.calculateCompleteness(p);
            completenessScore += score;

            // Surname stats
            const primaryName = p.names[0];
            if (primaryName?.surname) {
                surnames[primaryName.surname] = (surnames[primaryName.surname] || 0) + 1;
            }

            // Recent activity
            if (!latestUpdate || p.updatedAt > latestUpdate.updatedAt) {
                latestUpdate = p;
            }
        });

        const completeness = totalPersons > 0 ? Math.round(completenessScore / totalPersons) : 0;

        // Fun Fact generation (simplified version of DashboardFactService)
        const funFacts: string[] = [];
        
        // 1. Surname fact
        const topSurnames = Object.entries(surnames).sort((a, b) => b[1] - a[1]);
        if (topSurnames.length > 0) {
            funFacts.push(`„Der häufigste Nachname in deinem Stammbaum ist ${topSurnames[0][0]} (${topSurnames[0][1]} Mal).“`);
        }

        // 2. Completeness fact
        if (completeness > 0) {
            funFacts.push(`„Dein Forschungsgrad liegt bei ${completeness}% vollständig dokumentierten Datensätzen.“`);
        }

        // 3. Activity fact
        if (latestUpdate) {
            const name = latestUpdate.names[0] ? `${latestUpdate.names[0].given} ${latestUpdate.names[0].surname}`.trim() : 'Eine Person';
            funFacts.push(`„Zuletzt am Stammbaum gearbeitet: ${name} wurde aktualisiert.“`);
        }

        // 4. Counts fact
        if (totalPersons > 5) {
            funFacts.push(`„In deinem Baum finden sich aktuell ${totalPersons} dokumentierte Personen.“`);
        }

        // Fallback facts
        funFacts.push(`„Ahnenforschung – das einzige Hobby, bei dem Tote zurückschreiben.“`);
        funFacts.push(`„Wusstest du? Dein Stammbaum wird im modernen GEDCOM 7.0 Format verwaltet.“`);

        const randomFact = funFacts[Math.floor(Math.random() * funFacts.length)];

        const genderCounts = gender.reduce(
            (acc: { male: number; female: number; unknown: number }, row: any) => {
                const sex = (row.sex || 'U').toUpperCase();
                if (sex === 'M') acc.male += row._count;
                else if (sex === 'F') acc.female += row._count;
                else acc.unknown += row._count;
                return acc;
            },
            { male: 0, female: 0, unknown: 0 }
        );

        const total = genderCounts.male + genderCounts.female + genderCounts.unknown;
        const genderPercentages = {
            male: total ? Math.round((genderCounts.male / total) * 100) : 0,
            female: total ? Math.round((genderCounts.female / total) * 100) : 0,
            unknown: total ? Math.round((genderCounts.unknown / total) * 100) : 0
        };

        return {
            counts: {
                individuals: counts[0],
                families: counts[1],
                sources: counts[2],
                media: counts[3],
                places: counts[4]
            },
            gender: genderCounts,
            genderPercentages,
            completeness,
            funStat: randomFact,
            persons: counts[0],
            families: counts[1],
            sources: counts[2],
            media: counts[3],
            places: counts[4],
            genderDist: gender
        };
    }

    async validateTree(treeId: string) {
        // 1. Fetch all relevant data for the entire tree
        const [persons, families] = await Promise.all([
            this.prisma.person.findMany({
                where: { treeId },
                include: {
                    names: true,
                    events: { include: { place: true, associations: { include: { associated: { include: { names: true, events: true } } } } } },
                    facts: { include: { place: true, associations: { include: { associated: { include: { names: true, events: true } } } } } },
                    familyMembers: {
                        include: {
                            family: {
                                include: {
                                    events: { include: { associations: { include: { associated: { include: { names: true, events: true } } } } } }
                                }
                            }
                        }
                    }
                }
            }),
            this.prisma.family.findMany({
                where: { treeId },
                include: {
                    familyMembers: { include: { person: { include: { names: { where: { isPrimary: true } } } } } },
                    events: true
                }
            })
        ]);

        let results: any[] = [];
        const individualsMap = new Map<string, any>(persons.map(p => [p.id, p]));

        // 2. Individual Chronology and Event Constraints (using shared validator)
        for (const person of persons) {
            const personIssues = GenealogyValidator.validatePersonChronology(person);
            const personTodos = GenealogyValidator.validatePersonTodos(person);
            
            const allPersonIssues = [...personIssues, ...personTodos];
            results = results.concat(allPersonIssues.map(issue => ({
                ...issue,
                entityId: person.id,
                entityType: 'PERSON',
                involvedIds: [person.id]
            })));
        }

        // 3. Cycle Detection
        const parentChildGraph = new Map<string, string[]>();
        families.forEach(fam => {
            const parents = fam.familyMembers.filter(m => m.role === 'SPOUSE').map(m => m.personId);
            const children = fam.familyMembers.filter(m => m.role === 'CHILD').map(m => m.personId);

            parents.forEach(pId => {
                if (!parentChildGraph.has(pId)) parentChildGraph.set(pId, []);
                children.forEach(cId => {
                    if (!parentChildGraph.get(pId)!.includes(cId)) {
                        parentChildGraph.get(pId)!.push(cId);
                    }
                });
            });
        });

        const visited = new Map<string, 'white' | 'gray' | 'black'>();
        persons.forEach(p => visited.set(p.id, 'white'));

        const detectCycles = (node: string) => {
            visited.set(node, 'gray');
            const children = parentChildGraph.get(node) || [];
            for (const child of children) {
                const childStatus = visited.get(child);
                if (childStatus === 'gray') {
                    const p = individualsMap.get(node);
                    const c = individualsMap.get(child);
                    const pName = GenealogyValidator.getPrimaryName(p);
                    const cName = GenealogyValidator.getPrimaryName(c);
                    results.push({
                        type: 'error',
                        code: 'CYCLE_DETECTED',
                        message: `Zyklus erkannt: ${pName} ist ein Vorfahr von sich selbst (über ${cName}).`,
                        entityType: 'PERSON',
                        entityId: node,
                        involvedIds: [node, child]
                    });
                } else if (childStatus === 'white') {
                    detectCycles(child);
                }
            }
            visited.set(node, 'black');
        };

        persons.forEach(p => {
            if (visited.get(p.id) === 'white') detectCycles(p.id);
        });

        // 4. Parent-Child Temporal Consistency
        parentChildGraph.forEach((children, parentId) => {
            const parent = individualsMap.get(parentId);
            const birthDate = (parent?.events || []).find((e: any) => e.type === 'BIRT')?.dateText;
            const birthRange = GenealogyValidator.parseDateRange(birthDate);
            if (!birthRange) return;

            children.forEach(childId => {
                const child = individualsMap.get(childId);
                const childBirthDate = (child?.events || []).find((e: any) => e.type === 'BIRT')?.dateText;
                const childBirthRange = GenealogyValidator.parseDateRange(childBirthDate);
                if (!childBirthRange) return;

                const pName = GenealogyValidator.getPrimaryName(parent);
                const cName = GenealogyValidator.getPrimaryName(child);

                if (childBirthRange.max < birthRange.min) {
                    results.push({
                        type: 'error',
                        code: 'CHILD_BORN_BEFORE_PARENT',
                        message: `Zeitliche Unstimmigkeit: ${cName} wurde vor dem Elternteil ${pName} geboren.`,
                        entityType: 'PERSON',
                        entityId: childId,
                        involvedIds: [parentId, childId]
                    });
                } else {
                    const diffYear = GenealogyValidator.calculateAge(birthDate, childBirthDate);
                    if (diffYear !== null && diffYear < 13) {
                        results.push({
                            type: 'warning',
                            code: 'PARENT_TOO_YOUNG',
                            message: `Hinweis: ${pName} war bei der Geburt von ${cName} erst ${diffYear} Jahre alt.`,
                            entityType: 'PERSON',
                            entityId: parentId,
                            involvedIds: [parentId, childId]
                        });
                    }
                }
            });
        });

        // 5. Data Integrity (Invalid Family IDs and Duplicates)
        const familyService = new (require('./family.service').FamilyService)(this.prisma);
        const integrity = await familyService.analyzeInvalidFamilyIds(treeId);
        
        integrity.invalidIds.forEach((id: string) => {
            results.push({
                type: 'error',
                code: 'INVALID_FAMILY_ID',
                message: `Ungültiges Format für Familien-ID: ${id}`,
                entityType: 'FAMILY',
                entityId: id,
                explanation: 'Familien-IDs sollten ein GEDCOM-ähnliches Format haben (@F123@).'
            });
        });

        integrity.duplicateCleanupCandidates.forEach((c: any) => {
            results.push({
                type: 'warning',
                code: 'DUPLICATE_FAMILY_CANDIDATE',
                message: `Mögliches Familienduplikat für: ${c.signature}`,
                entityType: 'FAMILY',
                entityId: c.canonicalId,
                explanation: `Folgende IDs scheinen Duplikate zu sein: ${c.deleteIds.join(', ')}`
            });
        });

        // 6. Duplicate Person Detection
        const seenPeople = new Map<string, string[]>();
        for (const person of persons) {
            const name = GenealogyValidator.getPrimaryName(person).toLowerCase();
            const birth = (person.events || []).find((e: any) => e.type === 'BIRT')?.dateText || '';
            const place = (person.events || []).find((e: any) => e.type === 'BIRT')?.place?.name?.toLowerCase() || '';
            
            // Signature: name|birth|place
            const signature = `${name}|${birth}|${place}`;
            if (signature.length > 10) { // Only check if we have some data
                if (!seenPeople.has(signature)) seenPeople.set(signature, []);
                seenPeople.get(signature)!.push(person.id);
            }
        }

        for (const [sig, ids] of seenPeople.entries()) {
            if (ids.length > 1) {
                results.push({
                    type: 'warning',
                    code: 'DUPLICATE_PERSON_CANDIDATE',
                    message: `Mögliche Personendublette: ${sig.split('|')[0]} (${sig.split('|')[1]})`,
                    entityType: 'PERSON',
                    entityId: ids[0],
                    involvedIds: ids,
                    explanation: `Folgende Personen könnten identisch sein: ${ids.join(', ')}`
                });
            }
        }

        // 7. Cross-Link Consistency (Parent-Child)
        // Check if children have parents that also exist as spouses in the corresponding family
        for (const family of families) {
            const familyTodos = GenealogyValidator.validateFamilyTodos(family);
            results = results.concat(familyTodos);

            const childIds = family.familyMembers.filter(m => m.role === 'CHILD').map(m => m.personId);
            const parentIds = family.familyMembers.filter(m => m.role === 'SPOUSE').map(m => m.personId);

            for (const childId of childIds) {
                const child = individualsMap.get(childId);
                if (!child) continue;

                // Check if this child's family record includes the parents
                const familiesAsChild = child.familyMembers.filter((fm: any) => fm.role === 'CHILD');
                const isLinkedToThisFamily = familiesAsChild.some((fm: any) => fm.familyId === family.id);

                if (!isLinkedToThisFamily) {
                    results.push({
                        type: 'error',
                        code: 'INCONSISTENT_FAMILY_LINK',
                        message: `Inkonsistente Verknüpfung: ${GenealogyValidator.getPrimaryName(child)} ist in Familie ${family.id} als Kind gelistet, hat aber keine Rückverknüpfung.`,
                        entityType: 'PERSON',
                        entityId: childId,
                        involvedIds: [childId, ...parentIds]
                    });
                }
            }
        }

        return results;
    }

    async getTreeIssuesSummary(treeId: string) {
        const issues = await this.validateTree(treeId);
        return {
            count: issues.length,
            errors: issues.filter(i => i.type === 'error').length,
            warnings: issues.filter(i => i.type === 'warning').length
        };
    }

    async getMiniTreeHierarchy(treeId: string, maxDepth: number = 3) {
        const [persons, families] = await Promise.all([
            this.prisma.person.findMany({
                where: { treeId },
                select: {
                    id: true,
                    sex: true,
                    names: { where: { isPrimary: true }, select: { given: true, surname: true } }
                }
            }),
            this.prisma.family.findMany({
                where: { treeId },
                include: {
                    familyMembers: { select: { personId: true, role: true } }
                }
            })
        ]);

        if (persons.length === 0) return null;

        const individualsMap = new Map<string, any>(persons.map(p => [p.id, {
            id: p.id,
            firstName: p.names[0]?.given || 'Unbekannt',
            lastName: p.names[0]?.surname || '',
            sex: p.sex
        }]));

        // Build relations
        const childOfFamilies = new Set<string>();
        const familiesAsParent = new Map<string, string[]>();

        families.forEach(f => {
            const children = f.familyMembers.filter(m => m.role === 'CHILD').map(m => m.personId);
            const parents = f.familyMembers.filter(m => m.role === 'SPOUSE').map(m => m.personId);
            
            children.forEach(c => childOfFamilies.add(c));
            parents.forEach(p => {
                if (!familiesAsParent.has(p)) familiesAsParent.set(p, []);
                familiesAsParent.get(p)!.push(f.id);
            });
        });

        // Find root (someone without parents in data)
        const rootCandidates = persons.filter(p => !childOfFamilies.has(p.id));
        const rootPerson = rootCandidates.length > 0 ? rootCandidates[0] : persons[0];

        const buildNode = (pId: string, currentDepth: number): any => {
            const p = individualsMap.get(pId);
            if (!p || currentDepth >= maxDepth) {
                return p ? { id: p.id, name: p.lastName || p.firstName } : null;
            }

            const childrenNodes: any[] = [];
            const parentFamIds = familiesAsParent.get(pId) || [];
            
            parentFamIds.forEach(fId => {
                const fam = families.find(f => f.id === fId);
                if (fam) {
                    const children = fam.familyMembers.filter(m => m.role === 'CHILD').map(m => m.personId);
                    children.forEach(cId => {
                        const childNode = buildNode(cId, currentDepth + 1);
                        if (childNode) childrenNodes.push(childNode);
                    });
                }
            });

            return {
                id: p.id,
                name: p.lastName ? `${p.firstName[0]}. ${p.lastName}` : p.firstName,
                children: childrenNodes.length > 0 ? childrenNodes : undefined
            };
        };

        return buildNode(rootPerson.id, 1);
    }

    async getFamilyChartData(treeId: string) {
        const [persons, families] = await Promise.all([
            this.prisma.person.findMany({
                where: { treeId },
                orderBy: { id: 'asc' },
                include: {
                    names: { where: { isPrimary: true } },
                    events: { where: { type: { in: ['BIRT', 'DEAT'] } } },
                    mediaLinks: {
                        include: { media: true }
                    }
                }
            }),
            this.prisma.family.findMany({
                where: { treeId },
                include: {
                    familyMembers: { select: { personId: true, role: true } }
                }
            })
        ]);

        const individualIds = new Set(persons.map(p => p.id));
        const familiesById = new Map<string, any>(families.map((f) => [f.id, f]));

        // GEDCOM permits exactly one birth family (FAMC) per person. Imports
        // occasionally violate this and list the same child in two families,
        // which results in more than two parents. family-chart aborts the whole
        // render in that case ("child has more than 1 parent") and shows nothing,
        // so the conflict is resolved here - deterministically - instead of
        // letting a single dirty record blank the entire chart.
        const birthFamilyByPerson = this.resolveBirthFamilies(families, individualIds);

        const nodes = persons.map(p => {
            const primaryMedia = p.mediaLinks.find(ml => ml.isPrimary)?.media || p.mediaLinks[0]?.media;
            const bEvent = p.events.find(e => e.type === 'BIRT');
            const dEvent = p.events.find(e => e.type === 'DEAT');

            const node: any = {
                id: p.id,
                data: {
                    gender: p.sex === 'F' ? 'F' : 'M',
                    "first name": p.names[0]?.given || '',
                    "last name": p.names[0]?.surname || '',
                    birthday: bEvent?.dateText,
                    death: dEvent?.dateText,
                    avatar: primaryMedia?.id
                },
                rels: {
                    parents: [],
                    spouses: [],
                    children: []
                }
            };

            // Parents: taken from the single resolved birth family. family-chart
            // supports at most two parents, so the list is capped deterministically.
            const birthFamily = familiesById.get(birthFamilyByPerson.get(p.id) as string);
            if (birthFamily) {
                node.rels.parents = birthFamily.familyMembers
                    .filter((m: any) => m.role === 'SPOUSE' && individualIds.has(m.personId))
                    .map((m: any) => m.personId)
                    .sort()
                    .slice(0, 2);
            }

            // Spouses and Children
            const ownFamilies = families.filter(f =>
                f.familyMembers.some(m => m.personId === p.id && m.role === 'SPOUSE')
            );
            for (const fam of ownFamilies) {
                const spouseId = fam.familyMembers.find(m => m.personId !== p.id && m.role === 'SPOUSE')?.personId;
                if (spouseId && individualIds.has(spouseId) && !node.rels.spouses.includes(spouseId)) {
                    node.rels.spouses.push(spouseId);
                }

                // Only children whose resolved birth family is this one - keeps
                // parent/child links symmetric and removes duplicate child links.
                const children = fam.familyMembers
                    .filter(m => m.role === 'CHILD' && individualIds.has(m.personId) && birthFamilyByPerson.get(m.personId) === fam.id)
                    .map(m => m.personId);
                children.forEach(cId => {
                    if (!node.rels.children.includes(cId)) {
                        node.rels.children.push(cId);
                    }
                });
            }

            return node;
        });

        return {
            nodes,
            mainPersonId: this.pickMainPersonId(nodes)
        };
    }

    /**
     * Picks the default focus person for the family chart.
     *
     * The chart only renders the main person plus its ancestry/progeny, so an
     * isolated individual (e.g. a person whose GEDCOM links were never imported)
     * would render an almost empty chart. Therefore the largest connected
     * component is selected first and the most connected person inside it
     * becomes the entry point. Purely deterministic - no randomness involved.
     */
    private pickMainPersonId(nodes: any[]): string | null {
        if (nodes.length === 0) return null;

        const byId = new Map<string, any>(nodes.map((n) => [n.id, n]));
        const neighbors = (node: any): string[] => [
            ...node.rels.parents,
            ...node.rels.spouses,
            ...node.rels.children
        ];

        const visited = new Set<string>();
        let best: any = null;
        let bestDegree = -1;

        for (const startNode of nodes) {
            if (visited.has(startNode.id)) continue;

            // Collect the whole connected component of this node (iterative BFS).
            const component: any[] = [];
            const queue: string[] = [startNode.id];
            visited.add(startNode.id);

            while (queue.length > 0) {
                const currentId = queue.pop() as string;
                const currentNode = byId.get(currentId);
                if (!currentNode) continue;

                component.push(currentNode);
                for (const neighborId of neighbors(currentNode)) {
                    if (!visited.has(neighborId) && byId.has(neighborId)) {
                        visited.add(neighborId);
                        queue.push(neighborId);
                    }
                }
            }

            // Only a component larger than the current best can beat it.
            if (best && component.length < best.componentSize) continue;

            for (const node of component) {
                const degree = neighbors(node).length;
                if (degree > bestDegree || (degree === bestDegree && best && component.length > best.componentSize)) {
                    best = { node, componentSize: component.length };
                    bestDegree = degree;
                }
            }
        }

        return best ? (best.node.id as string) : null;
    }

    /**
     * Resolves exactly one birth family per person (GEDCOM: FAMC).
     *
     * Duplicate child links - the same person listed as CHILD in two families -
     * are a known GEDCOM import artifact. They lead to more than two parents and
     * make family-chart abort with "child has more than 1 parent", leaving the
     * chart blank. The conflict is resolved deterministically:
     *   1. prefer the family with the most parents present in this tree,
     *   2. then the lowest GEDCOM id (fallback: database id).
     */
    private resolveBirthFamilies(families: any[], individualIds: Set<string>): Map<string, string> {
        const parentCount = (fam: any): number =>
            fam.familyMembers.filter((m: any) => m.role === 'SPOUSE' && individualIds.has(m.personId)).length;

        const ranked = [...families].sort((a, b) => {
            const byParentCount = parentCount(b) - parentCount(a);
            if (byParentCount !== 0) return byParentCount;
            return String(a.gedcomId ?? a.id).localeCompare(String(b.gedcomId ?? b.id));
        });

        const birthFamily = new Map<string, string>();
        for (const fam of ranked) {
            for (const member of fam.familyMembers) {
                if (member.role !== 'CHILD') continue;
                if (!individualIds.has(member.personId)) continue;
                if (!birthFamily.has(member.personId)) {
                    birthFamily.set(member.personId, fam.id);
                }
            }
        }

        return birthFamily;
    }
}
