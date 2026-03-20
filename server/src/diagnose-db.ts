import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
    console.log('--- DIAGNOSE ---');
    
    const users = await prisma.user.findMany();
    console.log('Users:', users.map(u => ({ id: u.id, username: u.username, role: u.globalRole })));
    
    const trees = await prisma.tree.findMany();
    console.log('Trees:', trees.map(t => ({ id: t.id, name: t.name, isPublic: t.isPublic })));
    
    const permissions = await prisma.treePermission.findMany({
        include: { tree: true, user: true }
    });
    console.log('Permissions:', permissions.map(p => ({
        tree: p.tree.name,
        user: p.user.username,
        level: p.level
    })));

    const sources = await prisma.source.count();
    console.log('Total Sources in DB:', sources);

    await prisma.$disconnect();
}

diagnose().catch(console.error);
