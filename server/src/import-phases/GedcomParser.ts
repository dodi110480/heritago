import * as fs from 'fs';
import * as readline from 'readline';

export interface GedcomNode {
    level: number;
    xref?: string;
    tag: string;
    value?: string;
    children: GedcomNode[];
}

export class GedcomParser {
    /**
     * Parst eine GEDCOM-Datei stream-basiert und gibt Level-0-Records nacheinander aus.
     */
    static async *parseStream(filePath: string): AsyncGenerator<GedcomNode> {
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let currentRoot: GedcomNode | null = null;
        const stack: GedcomNode[] = [];

        for await (const line of rl) {
            const match = line.match(/^(\d+)\s+(@\S+@)?\s*(\S+)\s*(.*)?$/);
            if (!match) continue;

            const level = parseInt(match[1]);
            const xref = match[2];
            const tag = match[3];
            const value = match[4]?.trim();

            const node: GedcomNode = { level, xref, tag, value, children: [] };

            if (level === 0) {
                // Wenn wir einen neuen Root-Record (Level 0) finden, 
                // geben wir den vorherigen (falls vorhanden) aus.
                if (currentRoot) {
                    yield currentRoot;
                }
                currentRoot = node;
                stack.length = 0;
                stack[0] = node;
            } else {
                // Stack-Management für die Hierarchie
                while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                    stack.pop();
                }

                if (stack.length > 0) {
                    stack[stack.length - 1].children.push(node);
                    stack.push(node);
                } else if (currentRoot) {
                    // Fallback, sollte ein Record außerhalb von Level 0 starten (unwahrscheinlich bei validem GEDCOM)
                    currentRoot.children.push(node);
                    stack.push(node);
                }
            }
        }

        // Letzten Record ausgeben
        if (currentRoot) {
            yield currentRoot;
        }
    }

    /**
     * Hilfsmethode: Extrahiert den vollen Text inkl. CONT/CONC Zeilen.
     */
    static getFullValue(node: GedcomNode): string {
        let val = node.value || '';
        for (const child of node.children) {
            if (child.tag === 'CONT') {
                val += '\n' + (child.value || '');
            } else if (child.tag === 'CONC') {
                val += (child.value || '');
            }
        }
        return val;
    }
}
