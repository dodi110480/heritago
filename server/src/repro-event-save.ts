import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function repro() {
    try {
        console.log('--- EVENT SAVE REPRO START ---');
        
        // Find a tree and a person
        const tree = await prisma.tree.findFirst({ where: { name: 'aaa' } }); // Adjust tree name if needed
        if (!tree) {
            console.log('Tree "aaa" not found. Please ensure a tree exists.');
            return;
        }

        const person = await prisma.person.findFirst({ 
            where: { treeId: tree.id },
            include: { names: true }
        });

        if (!person) {
            console.log('No person found in tree.');
            return;
        }

        console.log(`Testing with person: ${person.names[0]?.full || person.id} in tree ${tree.name}`);

        // Prepare a payload like the frontend sends
        // We will simulate what PersonWriteService receives
        const payload = {
            id: person.id,
            treeId: tree.id,
            timeline: [
                {
                    tag: 'BIRT',
                    dateText: '18 MAR 2026',
                    place: 'Test City',
                    description: 'Deep Save Test',
                    itemKind: 'event',
                    notes: [
                        { text: 'This is a test note for the event', noteType: 'COMMENT' }
                    ],
                    citations: [
                        { sourceId: (await prisma.source.findFirst({ where: { treeId: tree.id } }))?.id, page: 'P. 100' }
                    ],
                    media: [
                        { id: (await prisma.media.findFirst({ where: { treeId: tree.id } }))?.id, title: 'Test Media' }
                    ],
                    associations: [
                        { personId: (await prisma.person.findFirst({ where: { treeId: tree.id, NOT: { id: person.id } } }))?.id, role: 'WITNESS', associatedPersonName: 'Witness Name' }
                    ]
                }
            ]
        };

        // Note: We can't easily call the service here without full DI setup, 
        // but we can monitor the database or the API response if we were using a real HTTP request.
        // For now, this script serves as a way to clarify the data structure and eventually test the DB state.

        console.log('Payload structure confirmed.');
        console.log('Now waiting for implementation of deep sync in PersonWriteService...');

    } catch (error) {
        console.error('Repro script failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

repro();
