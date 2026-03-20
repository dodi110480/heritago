
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const id = '4c31af89-44ec-4181-9d00-921b1755dac6';
    console.log('--- DB CHECK FOR ID:', id, '---');
    
    try {
        const person = await prisma.person.findUnique({ 
            where: { id },
            include: { 
                mediaLinks: { include: { media: true } } 
            } 
        });
        console.log('PERSON DATA:', JSON.stringify(person, null, 2));
        
        const media = await prisma.media.findUnique({ where: { id } });
        console.log('MEDIA DATA WITH SAME ID:', JSON.stringify(media, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
