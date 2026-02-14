import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GedcomService } from './gedcom.service';
import { TreeData, Individual } from './models';

@Component({
    selector: 'app-tree',
    imports: [CommonModule],
    templateUrl: './tree.html',
    styleUrl: './tree.css'
})
export class Tree {
    private gedcomService = inject(GedcomService);
    treeData = signal<TreeData | null>(null);

    constructor() {
        this.gedcomService.getTreeData().subscribe(data => {
            this.treeData.set(data);
        });
    }

    getIndividual(id: string): Individual | undefined {
        return this.treeData()?.individuals.find(i => i.id === id);
    }
}
