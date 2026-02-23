/**
 * Dump tree structure from DB for debugging layout.
 * Run: cd server && DATABASE_URL="postgresql://heritago:heritago@127.0.0.1:5432/heritago_new?schema=public" npx ts-node dump_tree_structure.ts
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

function main() {
    return prisma.tree.findMany({
        include: {
            individuals: { include: { names: true } },
            families: {
                include: {
                    members: { include: { person: { include: { names: true } } } }
                }
            }
        }
    });
}

main()
    .then(trees => {
        console.log('=== TREES ===');
        trees.forEach(t => {
            console.log(`Tree: ${t.name} (id: ${t.id})`);
            console.log(`  Individuals: ${t.individuals.length}`);
            console.log(`  Families: ${t.families.length}`);
        });

        const tree = trees[0];
        if (!tree) {
            console.log('No tree found.');
            return;
        }

        console.log('\n=== INDIVIDUALS (id = gedcomId) ===');
        tree.individuals.forEach(i => {
            const name = i.names.find(n => n.isPrimary) || i.names[0];
            const full = name ? `${name.given || ''} ${name.surname || ''}`.trim() : '?';
            console.log(`  ${i.gedcomId}  ${full}`);
        });

        console.log('\n=== FAMILIES (husband, wife, children) ===');
        tree.families.forEach(f => {
            const husb = f.members.find(m => m.role === 'HUSB')?.person;
            const wife = f.members.find(m => m.role === 'WIFE')?.person;
            const childs = f.members.filter(m => m.role === 'CHIL').map(m => m.person);
            const hName = husb?.names?.find((n: any) => n.isPrimary) || husb?.names?.[0];
            const wName = wife?.names?.find((n: any) => n.isPrimary) || wife?.names?.[0];
            const hStr = husb ? `${husb.gedcomId} (${hName ? (hName.given + ' ' + hName.surname).trim() : '?'})` : '-';
            const wStr = wife ? `${wife.gedcomId} (${wName ? (wName.given + ' ' + wName.surname).trim() : '?'})` : '-';
            const cStrs = childs.map(c => {
                const n = c?.names?.find((x: any) => x.isPrimary) || c?.names?.[0];
                return `${c?.gedcomId} (${n ? (n.given + ' ' + n.surname).trim() : '?'})`;
            });
            console.log(`  Family ${f.gedcomId}:`);
            console.log(`    Husband: ${hStr}`);
            console.log(`    Wife:    ${wStr}`);
            console.log(`    Children: [${cStrs.join(', ')}]`);
        });
    })
    .catch(e => console.error(e))
    .finally(() => {
        prisma.$disconnect();
        pool.end();
    });
