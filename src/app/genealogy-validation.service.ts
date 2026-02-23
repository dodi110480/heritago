import { Injectable } from '@angular/core';
import { Individual, Family, TreeData } from './models';

export interface ValidationResult {
    type: 'error' | 'warning';
    message: string;
    involvedIds: string[];
}

@Injectable({
    providedIn: 'root'
})
export class GenealogyValidationService {

    private MIN_AGE_DIFFERENCE = 15; // Minimum age difference between parent and child
    private MAX_MARRIAGE_AGE = 70;   // Warning for very late marriages
    private MAX_CHILDBEARING_AGE = 50; // Warning for late childbearing (biological probability)

    validateTree(data: TreeData): ValidationResult[] {
        const results: ValidationResult[] = [];
        if (!data) return results;

        const individualsMap = new Map<string, Individual>(data.individuals.map(i => [this.normId(i.id), i]));

        // Step 1: Build graph (directed: parent -> child)
        const parentChildGraph = new Map<string, string[]>();
        data.families.forEach(fam => {
            const parents = [];
            if (fam.husband) parents.push(this.normId(fam.husband));
            if (fam.wife) parents.push(this.normId(fam.wife));

            parents.forEach(p => {
                if (!parentChildGraph.has(p)) parentChildGraph.set(p, []);
                fam.children.forEach(c => {
                    const cid = this.normId(c);
                    if (!parentChildGraph.get(p)!.includes(cid)) {
                        parentChildGraph.get(p)!.push(cid);
                    }
                });
            });
        });

        // Step 2: Detect Cycles (DFS)
        const visited = new Map<string, 'white' | 'gray' | 'black'>();
        data.individuals.forEach(ind => visited.set(this.normId(ind.id), 'white'));

        data.individuals.forEach(ind => {
            const id = this.normId(ind.id);
            if (visited.get(id) === 'white') {
                this.detectCycles(id, parentChildGraph, visited, results, individualsMap);
            }
        });

        // Step 3: Check temporal inconsistencies
        parentChildGraph.forEach((children, parentId) => {
            const parent = individualsMap.get(parentId);
            const parentYear = this.getYearFromDate(parent?.birthDate);

            if (parentYear === null) return;

            children.forEach(childId => {
                const child = individualsMap.get(childId);
                const childYear = this.getYearFromDate(child?.birthDate);

                if (childYear === null) return;

                if (childYear < parentYear) {
                    results.push({
                        type: 'error',
                        message: `Zeitliche Unstimmigkeit: ${child?.name || childId} wurde im Jahr ${childYear} geboren, also vor dem Elternteil ${parent?.name || parentId} (geboren ${parentYear}).`,
                        involvedIds: [parentId, childId]
                    });
                } else {
                    const ageDiff = childYear - parentYear;
                    if (ageDiff < this.MIN_AGE_DIFFERENCE) {
                        results.push({
                            type: 'warning',
                            message: `${parent?.name || parentId} (geboren ${parentYear}) war bei der Geburt von ${child?.name || childId} (geboren ${childYear}) erst ${ageDiff} Jahre alt.`,
                            involvedIds: [parentId, childId]
                        });
                    }

                    // Biological check for mother
                    if (parent && parent.gender === 'F' && ageDiff > this.MAX_CHILDBEARING_AGE) {
                        results.push({
                            type: 'warning',
                            message: `Biologisch unwahrscheinlich: ${parent.name} war bei der Geburt von ${child?.name || childId} bereits ${ageDiff} Jahre alt.`,
                            involvedIds: [parentId, childId]
                        });
                    }
                }
            });
        });

        // Step 4: Gender consistency and Marriage Age
        data.families.forEach(fam => {
            const husbandId = fam.husband ? this.normId(fam.husband) : null;
            const wifeId = fam.wife ? this.normId(fam.wife) : null;
            const husband = husbandId ? individualsMap.get(husbandId) : null;
            const wife = wifeId ? individualsMap.get(wifeId) : null;

            // Gender consistency
            if (husband && husband.gender === 'F') {
                results.push({
                    type: 'warning',
                    message: `Geschlechter-Rollen: ${husband.name} ist als Ehemann eingetragen, aber als weiblich markiert.`,
                    involvedIds: [husband.id]
                });
            }
            if (wife && wife.gender === 'M') {
                results.push({
                    type: 'warning',
                    message: `Geschlechter-Rollen: ${wife.name} ist als Ehefrau eingetragen, aber als männlich markiert.`,
                    involvedIds: [wife.id]
                });
            }

            // Marriage age check
            const marrEvent = fam.events?.find(e => e.type === 'MARR');
            const marrYear = this.getYearFromDate(marrEvent?.date || marrEvent?.dateText);

            if (marrYear) {
                [husband, wife].forEach(p => {
                    if (p) {
                        const birthYear = this.getYearFromDate(p.birthDate);
                        if (birthYear) {
                            const ageAtMarr = marrYear - birthYear;
                            if (ageAtMarr > this.MAX_MARRIAGE_AGE) {
                                results.push({
                                    type: 'warning',
                                    message: `Hohes Heiratsalter: ${p.name} (*${birthYear}) hat erst im Jahr ${marrYear} geheiratet (Alter: ${ageAtMarr}). Das ist biologisch/statistisch ungewöhnlich.`,
                                    involvedIds: [p.id]
                                });
                            }
                        }
                    }
                });
            }
        });

        return results;
    }

    private normId(id: string | undefined | null): string {
        return (id ?? '').trim().replace(/^@|@$/g, '');
    }

    private getYearFromDate(dateStr: string | undefined | null): number | null {
        if (!dateStr) return null;
        // Match 4 consecutive digits (Year)
        const match = dateStr.match(/\d{4}/);
        return match ? parseInt(match[0], 10) : null;
    }

    private detectCycles(node: string, graph: Map<string, string[]>, visited: Map<string, 'white' | 'gray' | 'black'>, results: ValidationResult[], individualsMap: Map<string, Individual>) {
        visited.set(node, 'gray');
        const children = graph.get(node) || [];

        for (const child of children) {
            const childStatus = visited.get(child);
            if (childStatus === 'gray') {
                const person = individualsMap.get(node);
                const childPerson = individualsMap.get(child);
                results.push({
                    type: 'error',
                    message: `Zyklus erkannt: ${person?.name || node} ist ein Vorfahr von sich selbst (über ${childPerson?.name || child}).`,
                    involvedIds: [node, child]
                });
            } else if (childStatus === 'white') {
                this.detectCycles(child, graph, visited, results, individualsMap);
            }
        }

        visited.set(node, 'black');
    }
}
