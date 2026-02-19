import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { AuthService } from './auth.service';

@Component({
    selector: 'app-search-results',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './search-results.html',
    styleUrl: './search-results.css'
})
export class SearchResults {
    private route = inject(ActivatedRoute);
    private gedcomService = inject(GedcomService);
    private authService = inject(AuthService);

    query = signal('');
    results = signal<any[]>([]);
    loading = signal(false);

    constructor() {
        effect(() => {
            // Re-run search when query changes
            const q = this.query();
            if (q) {
                this.performSearch(q);
            }
        });

        this.route.queryParams.subscribe(params => {
            this.query.set(params['q'] || '');
        });
    }

    performSearch(query: string) {
        this.loading.set(true);
        // We need a tree name. For now, use the first available tree or 'sperlich' via getTreeData logic
        // Ideally, we should store the current tree in a service.
        // Quick fix: fetch tree data first to interpret the 'best' tree
        this.gedcomService.getTreeData().subscribe(treeData => {
            if (treeData && treeData.meta && treeData.meta.tree) {
                this.gedcomService.searchIndividuals(treeData.meta.tree, query).subscribe({
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
                this.loading.set(false);
            }
        });
    }
}
