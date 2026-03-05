import { PrismaClient } from '@prisma/client';
import { GedcomParser } from './GedcomParser';
import { Phase2Import } from './Phase2Import';
import { Phase3Resolver } from './Phase3Resolver';
import { Phase4FinalInsert } from './Phase4FinalInsert';

export class GedcomImportEngine {
    constructor(private prisma: PrismaClient) { }

    /**
     * Startet den vollständigen 4-Phasen-Import.
     */
    async runImport(treeId: string, filePath: string, filename: string) {
        console.log(`Starting GEDCOM import for tree ${treeId}, file: ${filename}`);

        // 0. Import-Container erstellen
        const importRecord = await this.prisma.import.create({
            data: {
                treeId,
                filename,
                source: 'GEDCOM'
            }
        });

        try {
            // PHASE 1 & 2: Parsing & Raw Insertion
            await this.executePhases1And2(treeId, importRecord.id, filePath);

            // PHASE 3: Resolver (Mapping XREF -> UUID)
            await this.executePhase3(treeId, importRecord.id);

            // PHASE 4: Final Insertion (Relational)
            await this.executePhase4(treeId, importRecord.id);

            // Statistiken aktualisieren
            await this.updateImportStats(importRecord.id);

            return {
                success: true,
                importId: importRecord.id
            };
        } catch (error) {
            console.error('Import Engine Error:', error);
            // Optional: Cleanup bei Fehler
            throw error;
        }
    }

    private async executePhases1And2(treeId: string, importId: string, filePath: string) {
        console.log('--- Executing Phase 1 & 2 (Stream Import) ---');
        const phase2 = new Phase2Import(this.prisma, treeId, importId);

        for await (const node of GedcomParser.parseStream(filePath)) {
            await phase2.processNode(node);
        }

        await phase2.flushAll();
        console.log('--- Phase 1 & 2 Completed ---');
    }

    private async executePhase3(treeId: string, importId: string) {
        const resolver = new Phase3Resolver(this.prisma, treeId, importId);
        await resolver.resolveAll();
    }

    private async executePhase4(treeId: string, importId: string) {
        const inserter = new Phase4FinalInsert(this.prisma, treeId, importId);
        await inserter.run();
    }

    private async updateImportStats(importId: string) {
        const [persons, families, events] = await Promise.all([
            this.prisma.importPerson.count({ where: { importId } }),
            this.prisma.importFamily.count({ where: { importId } }),
            this.prisma.importEvent.count({ where: { importId } })
        ]);

        await this.prisma.import.update({
            where: { id: importId },
            data: {
                personCount: persons,
                familyCount: families,
                eventCount: events
            }
        });
    }
}
