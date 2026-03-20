
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function check() {
    const id = '4c31af89-44ec-4181-9d00-921b1755dac6';
    const person = await p.person.findUnique({ 
        where: { id },
        include: { 
            mediaLinks: { include: { media: true } } 
        } 
    });
    console.log('PERSON DATA:');
    console.log(JSON.stringify(person, null, 2));
    
    const media = await p.media.findUnique({ where: { id } });
    console.log('MEDIA DATA WITH SAME ID:');
    console.log(JSON.stringify(media, null, 2));
}
check()
    .catch(err => console.error(err))
    .finally(() => p.$disconnect());
