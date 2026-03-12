/**
 * Cleanup-Script für duplizierte/verwaiste Daten
 * 
 * Behebt die Korruption durch den onDelete:SetNull Bug:
 * - Verwaiste Associations (eventId/factId zeigt auf nicht-existierende Events/Facts)
 * - Verwaiste Citations, MediaLinks, NoteLinks
 * - Duplizierte Person-Level Associations
 * - Duplizierte Namen, Events und Facts
 * 
 * Usage: npx ts-node src/scripts/cleanup-duplicates.ts
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const rootEnv = path.resolve(process.cwd(), '.env');
const serverEnv = path.resolve(process.cwd(), 'server', '.env');
if (fs.existsSync(serverEnv)) {
    dotenv.config({ path: serverEnv });
} else if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv });
} else {
    dotenv.config();
}

if (!process.env.DATABASE_URL) {
    console.error('Fehler: DATABASE_URL ist nicht gesetzt. Bitte .env prüfen (z.B. server/.env).');
    process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://heritago:heritago@127.0.0.1:5432/heritago_new?schema=public";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function cleanup() {
    console.log('=== Heritago Duplikaten-Bereinigung ===\n');

    // 1. Verwaiste Associations löschen (eventId gesetzt, aber Event existiert nicht mehr)
    console.log('1. Verwaiste Associations bereinigen...');
    const orphanedEventAssociations = await prisma.$executeRaw`
        DELETE FROM "Association" 
        WHERE "eventId" IS NOT NULL 
        AND "eventId" NOT IN (SELECT id FROM "Event")
    `;
    console.log(`   → ${orphanedEventAssociations} verwaiste Event-Associations gelöscht`);

    const orphanedFactAssociations = await prisma.$executeRaw`
        DELETE FROM "Association" 
        WHERE "factId" IS NOT NULL 
        AND "factId" NOT IN (SELECT id FROM "Fact")
    `;
    console.log(`   → ${orphanedFactAssociations} verwaiste Fact-Associations gelöscht`);

    // 2. Verwaiste Citations löschen
    console.log('2. Verwaiste Citations bereinigen...');
    const orphanedEventCitations = await prisma.$executeRaw`
        DELETE FROM "Citation" 
        WHERE "eventId" IS NOT NULL 
        AND "eventId" NOT IN (SELECT id FROM "Event")
    `;
    console.log(`   → ${orphanedEventCitations} verwaiste Event-Citations gelöscht`);

    const orphanedFactCitations = await prisma.$executeRaw`
        DELETE FROM "Citation" 
        WHERE "factId" IS NOT NULL 
        AND "factId" NOT IN (SELECT id FROM "Fact")
    `;
    console.log(`   → ${orphanedFactCitations} verwaiste Fact-Citations gelöscht`);

    // 3. Verwaiste MediaLinks löschen
    console.log('3. Verwaiste MediaLinks bereinigen...');
    const orphanedEventMediaLinks = await prisma.$executeRaw`
        DELETE FROM "MediaLink" 
        WHERE "eventId" IS NOT NULL 
        AND "eventId" NOT IN (SELECT id FROM "Event")
    `;
    console.log(`   → ${orphanedEventMediaLinks} verwaiste Event-MediaLinks gelöscht`);

    const orphanedFactMediaLinks = await prisma.$executeRaw`
        DELETE FROM "MediaLink" 
        WHERE "factId" IS NOT NULL 
        AND "factId" NOT IN (SELECT id FROM "Fact")
    `;
    console.log(`   → ${orphanedFactMediaLinks} verwaiste Fact-MediaLinks gelöscht`);

    // 4. Verwaiste NoteLinks löschen
    console.log('4. Verwaiste NoteLinks bereinigen...');
    const orphanedEventNoteLinks = await prisma.$executeRaw`
        DELETE FROM "NoteLink" 
        WHERE "eventId" IS NOT NULL 
        AND "eventId" NOT IN (SELECT id FROM "Event")
    `;
    console.log(`   → ${orphanedEventNoteLinks} verwaiste Event-NoteLinks gelöscht`);

    const orphanedFactNoteLinks = await prisma.$executeRaw`
        DELETE FROM "NoteLink" 
        WHERE "factId" IS NOT NULL 
        AND "factId" NOT IN (SELECT id FROM "Fact")
    `;
    console.log(`   → ${orphanedFactNoteLinks} verwaiste Fact-NoteLinks gelöscht`);

    // 5. Duplizierte Person-Level Associations entfernen
    // Behalte nur den ältesten Eintrag pro (personId, associatedPersonId, role)
    console.log('5. Duplizierte Person-Level Associations bereinigen...');
    const dupPersonAssociations = await prisma.$executeRaw`
        DELETE FROM "Association" 
        WHERE id NOT IN (
            SELECT DISTINCT ON ("personId", "associatedPersonId", "role", "eventId", "factId") id 
            FROM "Association" 
            ORDER BY "personId", "associatedPersonId", "role", "eventId", "factId", "createdAt" ASC
        )
    `;
    console.log(`   → ${dupPersonAssociations} duplizierte Associations gelöscht`);

    // 6. Duplizierte Namen entfernen
    // Behalte nur den ältesten Eintrag pro (personId, type, given, surname, isPrimary)
    console.log('6. Duplizierte Namen bereinigen...');
    const dupNames = await prisma.$executeRaw`
        DELETE FROM "Name" 
        WHERE id NOT IN (
            SELECT DISTINCT ON ("personId", "type", "given", "surname", "isPrimary") id 
            FROM "Name" 
            ORDER BY "personId", "type", "given", "surname", "isPrimary", "sortOrder" ASC
        )
    `;
    console.log(`   → ${dupNames} duplizierte Namen gelöscht`);

    // 7. Duplizierte Events entfernen
    // Behalte nur den ältesten Eintrag pro (personId/familyId, type, dateText, placeId, description)
    console.log('7. Duplizierte Events bereinigen...');
    // Erst die Kinder der zu löschenden Events bereinigen
    const eventsToDelete = await prisma.$queryRaw<{id: string}[]>`
        SELECT id FROM "Event" 
        WHERE ("personId" IS NOT NULL OR "familyId" IS NOT NULL)
        AND id NOT IN (
            SELECT DISTINCT ON ("personId", "familyId", "type", "dateText", "placeId", COALESCE("description", '')) id 
            FROM "Event" 
            WHERE ("personId" IS NOT NULL OR "familyId" IS NOT NULL)
            ORDER BY "personId", "familyId", "type", "dateText", "placeId", COALESCE("description", ''), id ASC
        )
    `;
    
    if (eventsToDelete.length > 0) {
        const eventIdsToDelete = eventsToDelete.map(e => e.id);
        // Kinder der duplizierten Events löschen
        await prisma.association.deleteMany({ where: { eventId: { in: eventIdsToDelete } } });
        await prisma.citation.deleteMany({ where: { eventId: { in: eventIdsToDelete } } });
        await prisma.mediaLink.deleteMany({ where: { eventId: { in: eventIdsToDelete } } });
        await prisma.noteLink.deleteMany({ where: { eventId: { in: eventIdsToDelete } } });
        await prisma.event.deleteMany({ where: { id: { in: eventIdsToDelete } } });
    }
    console.log(`   → ${eventsToDelete.length} duplizierte Events (und deren Kinder) gelöscht`);

    // 8. Duplizierte Facts entfernen
    // Behalte nur den ältesten Eintrag pro (personId/familyId, type, value, dateText, placeId)
    console.log('8. Duplizierte Facts bereinigen...');
    const factsToDelete = await prisma.$queryRaw<{id: string}[]>`
        SELECT id FROM "Fact" 
        WHERE ("personId" IS NOT NULL OR "familyId" IS NOT NULL)
        AND id NOT IN (
            SELECT DISTINCT ON ("personId", "familyId", "type", COALESCE("value", ''), "dateText", "placeId") id 
            FROM "Fact" 
            WHERE ("personId" IS NOT NULL OR "familyId" IS NOT NULL)
            ORDER BY "personId", "familyId", "type", COALESCE("value", ''), "dateText", "placeId", id ASC
        )
    `;

    if (factsToDelete.length > 0) {
        const factIdsToDelete = factsToDelete.map(f => f.id);
        await prisma.association.deleteMany({ where: { factId: { in: factIdsToDelete } } });
        await prisma.citation.deleteMany({ where: { factId: { in: factIdsToDelete } } });
        await prisma.mediaLink.deleteMany({ where: { factId: { in: factIdsToDelete } } });
        await prisma.noteLink.deleteMany({ where: { factId: { in: factIdsToDelete } } });
        await prisma.fact.deleteMany({ where: { id: { in: factIdsToDelete } } });
    }
    console.log(`   → ${factsToDelete.length} duplizierte Facts (und deren Kinder) gelöscht`);

    // 9. Zusammenfassung
    console.log('\n=== Bereinigung abgeschlossen ===');
    
    // Prüfe verbleibende Daten
    const assocCount = await prisma.association.count();
    const citCount = await prisma.citation.count();
    const nameCount = await prisma.name.count();
    const eventCount = await prisma.event.count();
    console.log(`Verbleibend: ${assocCount} Associations, ${citCount} Citations, ${nameCount} Names, ${eventCount} Events`);
}

cleanup()
    .catch(e => {
        console.error('Fehler bei der Bereinigung:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
