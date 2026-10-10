// server/src/repositories/family.repository.ts
import { PrismaClient } from '@prisma/client';
import { includeStandardRelations, includeEventRelations } from '../shared/relations.utils';

export class FamilyRepository {
    constructor(private prisma: PrismaClient) {}

    async findById(id: string, treeId: string, tx?: any) {
        const client = tx || this.prisma;
        return client.family.findFirst({
            where: {
                treeId,
                OR: [
                    { id },
                    { gedcomId: id }
                ]
            },
            include: {
                familyMembers: {
                    include: {
                        person: {
                            include: {
                                names: { where: { isPrimary: true } }
                            }
                        }
                    }
                },
                events: { include: includeEventRelations() },
                facts: { include: includeEventRelations() },
                ...includeStandardRelations()
            }
        });
    }

    /**
     * Only scalar `Family` columns may reach Prisma.
     *
     * Relation arrays (`events`, `notes`, `citations`, `media`, `identifiers`) and
     * display-only fields from the API DTO are persisted by `FamilyWriteService`.
     * Spreading the raw request body into `family.upsert()` (as this method used to
     * do) made every save that carried notes or citations fail with a Prisma
     * validation error (HTTP 500), the same defect that broke media metadata saves.
     */
    private static readonly SCALAR_FIELDS = [
        'gedcomId',
        'importId',
        'restrictionNotice',
        'childCount',
        'chanDate',
        'extensions'
    ] as const;

    async saveFamily(data: any, tx?: any) {
        const client = tx || this.prisma;
        const { id, treeId } = data;

        const scalars: Record<string, any> = {};
        for (const field of FamilyRepository.SCALAR_FIELDS) {
            if (data?.[field] !== undefined) scalars[field] = data[field];
        }

        return client.family.upsert({
            where: { id: id || '', treeId },
            create: { ...scalars, treeId },
            update: scalars
        });
    }

    /** Raw Prisma client – used by write services that need their own transaction. */
    get client() {
        return this.prisma;
    }

    async deleteFamily(id: string, treeId: string) {
        return this.prisma.family.delete({
            where: { id, treeId }
        });
    }

    async deleteMembers(familyId: string, tx?: any) {
        const client = tx || this.prisma;
        return client.familyMember.deleteMany({
            where: { familyId }
        });
    }

    async createManyMembers(members: any[], tx?: any) {
        const client = tx || this.prisma;
        return client.familyMember.createMany({
            data: members
        });
    }

    async addMember(familyId: string, personId: string, role: any) {
        return this.prisma.familyMember.create({
            data: { familyId, personId, role }
        });
    }

    async removeMember(familyId: string, personId: string) {
        return this.prisma.familyMember.delete({
            where: { familyId_personId: { familyId, personId } }
        });
    }
}
