// server/src/repositories/person.repository.ts
import { PrismaClient } from "@prisma/client";
import { includeStandardRelations, includeEventRelations } from "../shared/relations.utils";

export class PersonRepository {
    constructor(public prisma: PrismaClient) {}

    async getPersonWithRelations(id: string, treeId: string) {
        const eventFactInclude = includeEventRelations();
        return this.prisma.person.findFirst({
            where: {
                treeId,
                OR: [
                    { id },
                    { gedcomId: id }
                ]
            },
            include: {
                names: true,
                events: { include: eventFactInclude },
                facts: { include: eventFactInclude },
                mediaLinks: includeStandardRelations().mediaLinks,
                citations: includeStandardRelations().citations,
                noteLinks: includeStandardRelations().noteLinks,
                dnaMatches: {
                    include: {
                        matchPerson: { include: { names: true } },
                        segments: true
                    }
                },
                familyMembers: {
                    include: {
                        family: {
                            include: {
                                events: { include: eventFactInclude },
                                citations: includeStandardRelations().citations,
                                noteLinks: includeStandardRelations().noteLinks,
                                familyMembers: {
                                    include: {
                                        person: {
                                            include: {
                                                names: true,
                                                mediaLinks: { include: { media: true } },
                                                events: { include: eventFactInclude }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    async findById(id: string, treeId: string, tx?: any) {
        const client = tx || this.prisma;
        const eventFactInclude = includeEventRelations();
        return client.person.findFirst({
            where: {
                treeId,
                OR: [
                    { id },
                    { gedcomId: id }
                ]
            },
            include: {
                names: true,
                events: { include: eventFactInclude },
                facts: { include: eventFactInclude },
                mediaLinks: { include: { media: true } },
                citations: { include: { source: true } },
                noteLinks: { include: { note: true } },
                dnaMatches: {
                    include: {
                        matchPerson: { include: { names: true } },
                        segments: true
                    }
                }
            }
        });
    }

    async savePerson(data: any, tx?: any) {
        const client = tx || this.prisma;
        const { id, treeId, names, events, facts, ...rest } = data;

        const {
            gender,
            name,
            firstName,
            lastName,
            displayName,
            profileImageUrl,
            updatedAt,
            timeline,
            relations,
            beforeState,
            notes,
            citations,
            media,
            formattedCitations,
            formattedNotes,
            dnaMatches,
            ...dbData
        } = rest;

        const sex = dbData.sex ?? gender ?? undefined;
        const personData: any = {
            treeId,
            gedcomId: dbData.gedcomId ?? undefined,
            sex,
            isLiving: dbData.isLiving ?? undefined,
            privacyLevel: dbData.privacyLevel ?? undefined,
            restrictionNotice: dbData.restrictionNotice ?? undefined,
            exid: dbData.exid ?? undefined,
            www: Array.isArray(dbData.www) ? dbData.www : undefined,
            religion: dbData.religion ?? undefined,
            importId: dbData.importId ?? undefined,
            chanDate: dbData.chanDate ?? undefined,
            extensions: dbData.extensions ?? undefined
        };


        if (id) {
            const existing = await client.person.findFirst({
                where: { id, treeId },
                select: { id: true }
            });

            if (!existing) {
                throw new Error("Person not found for update");
            }

            return client.person.update({
                where: { id },
                data: personData
            });
        }

        return client.person.create({
            data: {
                ...personData,
                www: Array.isArray(dbData.www) ? dbData.www : []
            }
        });
    }

    async deleteEvents(personId: string, tx?: any) {
        const client = tx || this.prisma;
        return client.event.deleteMany({ where: { personId } });
    }

    async createEvent(data: any, tx?: any) {
        const client = tx || this.prisma;
        return client.event.create({ data });
    }

    async deleteFacts(personId: string, tx?: any) {
        const client = tx || this.prisma;
        return client.fact.deleteMany({ where: { personId } });
    }

    async createFact(data: any, tx?: any) {
        const client = tx || this.prisma;
        return client.fact.create({ data });
    }

    async deleteNames(personId: string, tx?: any) {
        const client = tx || this.prisma;
        return client.name.deleteMany({ where: { personId } });
    }

    async findPlaceByName(treeId: string, name: string, tx?: any) {
        const client = tx || this.prisma;
        return client.place.findFirst({ where: { treeId, name } });
    }

    async createPlace(data: any, tx?: any) {
        const client = tx || this.prisma;
        return client.place.create({ data });
    }

    async deletePerson(id: string, treeId: string) {
        const existing = await this.prisma.person.findFirst({
            where: { id, treeId },
            select: { id: true }
        });

        if (!existing) {
            throw new Error("Person not found for delete");
        }

        return this.prisma.person.delete({
            where: { id }
        });
    }

    async getChildren(personId: string) {
        const familiesAsSpouse = await this.prisma.familyMember.findMany({
            where: { personId, role: "SPOUSE" },
            select: { familyId: true }
        });

        const familyIds = familiesAsSpouse.map((family) => family.familyId);

        return this.prisma.familyMember.findMany({
            where: {
                familyId: { in: familyIds },
                role: "CHILD"
            },
            include: {
                person: {
                    include: {
                        names: { where: { isPrimary: true } }
                    }
                }
            }
        });
    }

    async getFamiliesAsChild(personId: string) {
        return this.prisma.familyMember.findMany({
            where: { personId, role: "CHILD" },
            include: { family: true }
        });
    }

    async getFamiliesAsSpouse(personId: string) {
        return this.prisma.familyMember.findMany({
            where: { personId, role: "SPOUSE" },
            select: { familyId: true }
        });
    }

    async getSpousesInFamily(familyId: string, excludePersonId?: string) {
        return this.prisma.familyMember.findMany({
            where: {
                familyId,
                role: "SPOUSE",
                NOT: excludePersonId ? { personId: excludePersonId } : undefined
            },
            include: {
                person: {
                    include: {
                        names: { where: { isPrimary: true } }
                    }
                }
            }
        });
    }
}
