import { PrismaClient, EntityType } from '@prisma/client';
import * as crypto from 'crypto';

export class Phase3Resolver {
    constructor(private prisma: PrismaClient, private treeId: string, private importId: string) { }

    /**
     * Iteriert über alle Import-Tabellen und erstellt eine UUID-Map in GedcomXrefMap.
     */
    async resolveAll() {
        console.log(`--- Phase 3: Resolving XREFs for import ${this.importId} ---`);

        // 1. Resolver für Personen
        await this.resolveTable('importPerson', EntityType.PERSON);

        // 2. Resolver für Familien
        await this.resolveTable('importFamily', EntityType.FAMILY);

        // 3. Resolver für Quellen
        await this.resolveTable('importSource', EntityType.SOURCE);

        // 4. Resolver für Submitter
        await this.resolveTable('importSubmitter', EntityType.SUBMITTER);

        // 5. Resolver für Repositories
        await this.resolveTable('importRepository', EntityType.REPOSITORY);

        // 6. Resolver für Medien
        await this.resolveTable('importMedia', EntityType.MEDIA);

        // 7. Resolver für Notizen
        await this.resolveTable('importSharedNote', EntityType.NOTE);

        console.log('--- Phase 3: Resolving Completed ---');
    }

    private async resolveTable(clientKey: keyof PrismaClient, entityType: EntityType) {
        const table = (this.prisma as any)[clientKey];
        if (!table) {
            console.error(`Table ${String(clientKey)} not found in Prisma Client`);
            return;
        }

        const records = await table.findMany({
            where: { importId: this.importId },
            select: { gedcomXref: true }
        });

        if (records.length === 0) return;


        const mappings = records.map((r: any) => ({
            treeId: this.treeId,
            xref: r.gedcomXref,
            entityType: entityType,
            entityId: crypto.randomUUID(), // Die zukünftige UUID für diesen Record
        }));

        // Batch-Insert in die Mapping-Tabelle
        // Wir nutzen createMany, um Performance zu sichern.
        // Falls ein XREF doppelt ist (unwahrscheinlich bei validem GEDCOM), schlägt es dank @unique fehl.
        // Wir nutzen skipDuplicates um stabil zu bleiben.
        await this.prisma.gedcomXrefMap.createMany({
            data: mappings,
            skipDuplicates: true
        });
    }
}
