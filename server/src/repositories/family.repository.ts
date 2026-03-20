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

    async saveFamily(data: any, tx?: any) {
        const client = tx || this.prisma;
        const { id, treeId, ...rest } = data;
        
        // Remove virtual fields that don't belong to the database model
        const { 
            husband, wife, children, husbandName, wifeName, childNames, 
            status, statusLabel, marriageLabel, childrenCount, profileImageUrl, 
            events, media, beforeState, updatedAt, ...dbData 
        } = rest;

        return client.family.upsert({
            where: { id: id || '', treeId },
            create: { ...dbData, treeId },
            update: dbData
        });
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
