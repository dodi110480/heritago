import { GedcomParser } from './src/import-phases/GedcomParser';
import * as path from 'path';

async function test() {
    const filePath = '/tmp/test.ged';
    console.log(`Parsing ${filePath}...`);

    for await (const node of GedcomParser.parseStream(filePath)) {
        console.log(`Record: ${node.tag} (${node.xref || 'no xref'})`);
        if (node.tag === 'INDI') {
            const name = node.children.find((c: any) => c.tag === 'NAME');
            console.log(`  Name: ${name?.value}`);
        }
    }
}

test().catch(console.error);
