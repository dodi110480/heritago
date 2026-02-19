import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth.service';

import { CalendarWidget } from './calendar-widget';

import { GedcomService } from './gedcom.service';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink, CalendarWidget],
    templateUrl: './dashboard.html',
    styleUrl: './dashboard.css'
})
export class Dashboard {
    authService = inject(AuthService);
    private gedcomService = inject(GedcomService);

    stats = signal<any>(null);
    treeName = signal('');
    loading = signal(true);
    availableTrees = signal<any[]>([]);
    showTreeSwitcher = signal(false);
    isDragging = signal(false);

    constructor() {
        this.loadTrees();
        this.loadStats();
    }

    loadTrees() {
        this.authService.getTrees().subscribe(trees => {
            this.availableTrees.set(trees.filter(t => t.name !== 'DEFAULT_TREE'));
        });
    }

    loadStats(treeName?: string) {
        this.loading.set(true);
        this.gedcomService.getTreeData(treeName).subscribe({
            next: (treeData) => {
                if (treeData && treeData.meta && treeData.meta.tree) {
                    this.treeName.set(treeData.meta.tree);
                    this.gedcomService.getStatistics(treeData.meta.tree).subscribe({
                        next: (res) => {
                            this.stats.set(res);
                            this.loading.set(false);
                        },
                        error: () => this.loading.set(false)
                    });
                } else {
                    this.loading.set(false);
                }
            },
            error: () => this.loading.set(false)
        });
    }

    toggleSwitcher() {
        this.showTreeSwitcher.set(!this.showTreeSwitcher());
    }

    onDragStart(event: DragEvent, tree: any) {
        event.dataTransfer?.setData('treeName', tree.name);
        this.isDragging.set(true);
    }

    onDragEnd() {
        this.isDragging.set(true); // Wait, this should be false, but maybe I want to keep some state? No, false.
        this.isDragging.set(false);
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        const name = event.dataTransfer?.getData('treeName');
        if (name && name !== this.treeName()) {
            this.loadStats(name);
        }
        this.isDragging.set(false);
    }

    selectTree(name: string) {
        if (name !== this.treeName()) {
            this.loadStats(name);
        }
        this.showTreeSwitcher.set(false);
    }
}
