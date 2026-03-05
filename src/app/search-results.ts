import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { AuthService } from './auth.service';
import { AppPageContainerComponent } from './ui/app-page-container';
import { AppPageHeaderComponent } from './ui/app-page-header';
import { AppEntityCard } from './ui/app-entity-card';

@Component({
    selector: 'app-search-results',
    standalone: true,
    imports: [CommonModule, RouterLink, AppPageContainerComponent, AppPageHeaderComponent, AppEntityCard],
    templateUrl: './search-results.html'
})
export class SearchResults {
    private route = inject(ActivatedRoute);
    private gedcomService = inject(GedcomService);
    private authService = inject(AuthService);

    query = signal('');
    results = signal<any[]>([]);
    loading = signal(false);

    treeName = signal<string | null>(null);

    constructor() {
        effect(() => {
            const q = this.query();
            const t = this.treeName();
            if (q) {
                this.performSearch(q, t);
            }
        });

        this.route.queryParams.subscribe(params => {
            this.query.set(params['q'] || '');
            this.treeName.set(params['tree'] || null);
        });
    }

    performSearch(query: string, tree?: string | null) {
        this.loading.set(true);

        let t = tree;
        if (!t) {
            const active = this.authService.currentTree();
            if (active) t = active.name;
        }

        if (t) {
            this.gedcomService.searchIndividuals(t, query).subscribe({
                next: (res: any) => {
                    this.results.set(res.results || []);
                    this.loading.set(false);
                },
                error: () => {
                    this.loading.set(false);
                    this.results.set([]);
                }
            });
        } else {
            // Fallback: get data to find the tree name
            this.gedcomService.getTreeData().subscribe(treeData => {
                if (treeData && treeData.meta && treeData.meta.tree) {
                    this.performSearch(query, treeData.meta.tree);
                } else {
                    this.loading.set(false);
                }
            });
        }
    }
}
