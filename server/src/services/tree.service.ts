import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { STORAGE_ROOT, MEDIA_ROOT } from '../config';
import { PersonService } from './person.service';

export class TreeService {
    private personService: PersonService;

    constructor(private prisma: PrismaClient) {
        this.personService = new PersonService(prisma);
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
                if (ownerCount >= 1) {
                    throw new Error('Du kannst nur einen Stammbaum besitzen.');
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

    async getFullTreeData(treeId: string) {
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
            families: families.map(f => ({
                id: f.id,
                gedcomId: f.gedcomId,
                spouses: f.familyMembers.filter(m => m.role === 'SPOUSE').map(m => m.personId),
                husband: f.familyMembers.find(m => m.role === 'SPOUSE' && m.person.sex === 'M')?.personId,
                wife: f.familyMembers.find(m => m.role === 'SPOUSE' && m.person.sex === 'F')?.personId,
                children: f.familyMembers.filter(m => m.role === 'CHILD').map(m => m.personId),
                events: f.events.map(e => ({
                    id: e.id,
                    type: e.type,
                    dateText: e.dateText,
                    description: e.description,
                    place: e.place?.name
                }))
            })),
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
        const [counts, gender] = await Promise.all([
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
            })
        ]);

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

        const countsObj = {
            individuals: counts[0],
            families: counts[1],
            sources: counts[2],
            media: counts[3],
            places: counts[4]
        };

        return {
            counts: countsObj,
            gender: genderCounts,
            persons: counts[0],
            families: counts[1],
            sources: counts[2],
            media: counts[3],
            places: counts[4],
            genderDist: gender
        };
    }
}
