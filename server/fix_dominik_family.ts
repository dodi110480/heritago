import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
    // Definierte IDs aus der Analyse
    const targetFamilyId = '33bd78c0-cfeb-420c-b2cf-df068b8e53bb'; // Die Familie mit den Kindern
    const sourceFamilyId = '106a4de9-a6ef-44cd-a619-3cfd0dc9fd78'; // Die Familie mit Vanessa
    const vanessaId = '@I152176468089@';

    console.log("Starte Konsolidierung der Familiendaten...");

    // 1. Finde Vanessa in der DB
    const vanessa = await prisma.person.findFirst({
        where: { gedcomId: vanessaId }
    });

    if (!vanessa) {
        console.error("Vanessa Jahn nicht gefunden!");
        return;
    }

    // 2. Verschiebe Vanessa in die Ziel-Familie (die mit den Kindern)
    // Suche die Beziehung von Vanessa in der Quell-Familie
    const vanessaRel = await prisma.relationship.findFirst({
        where: {
            parentId: vanessa.id,
            familyId: sourceFamilyId,
            type: 'spouse'
        }
    });

    if (vanessaRel) {
        await prisma.relationship.update({
            where: { id: vanessaRel.id },
            data: { familyId: targetFamilyId }
        });
        console.log(`Vanessa Jahn (${vanessa.id}) zur Zielfamilie hinzugefügt.`);
    } else {
        console.log("Gezielte Beziehung für Vanessa in Quellfamilie nicht gefunden.");
    }

    // 3. Lösche Dominiks redundante Beziehung in der Quell-Familie
    await prisma.relationship.deleteMany({
        where: {
            familyId: sourceFamilyId,
            parentId: { not: vanessa.id } // Löscht alle anderen Eltern/Spouses in dieser Familie (Dominik)
        }
    });
    console.log("Redundante Beziehungen in Quellfamilie entfernt.");

    // 4. Lösche die jetzt leere Quell-Familie
    await prisma.family.delete({
        where: { id: sourceFamilyId }
    });
    console.log(`Leere Quellfamilie (${sourceFamilyId}) gelöscht.`);

    console.log("--- KORREKTUR ABGESCHLOSSEN ---");
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
