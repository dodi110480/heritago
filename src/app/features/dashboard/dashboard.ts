import { Component, inject, signal, ViewChild, ElementRef, AfterViewInit, effect, ViewEncapsulation } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { CalendarWidget } from '../../shared/components/calendar-widget';
import { GedcomService } from '../../core/services/gedcom.service';
import { DashboardFactService } from '../../core/services/dashboard-fact.service';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';
import { AppStatCardComponent } from '../../shared/components/ui/app-stat-card';
import * as d3 from 'd3';


import { AnalyticsService } from '../../core/services/analytics.service';
@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink, CalendarWidget, AppPageHeaderComponent, AppStatCardComponent],
    templateUrl: './dashboard.html',
    encapsulation: ViewEncapsulation.None
})
export class Dashboard implements AfterViewInit {
    public analyticsService = inject(AnalyticsService);
    @ViewChild('miniTree') miniTreeSvg!: ElementRef<SVGSVGElement>;
    authService = inject(AuthService);
    private gedcomService = inject(GedcomService);
    private router = inject(Router);
    private factService = inject(DashboardFactService);

    stats = signal<any>(null);
    treeName = signal('');
    loading = signal(true);
    availableTrees = signal<any[]>([]);
    showTreeSwitcher = signal(false);
    isDragging = signal(false);
    allIndividuals = signal<any[]>([]);
    allFamilies = signal<any[]>([]);
    completeness = signal(0);
    funStat = signal('');

    constructor() {
        this.loadTrees();
        this.loadStats();

        // Automatically render/update mini-tree when data is loaded
        effect(() => {
            const people = this.allIndividuals();
            if (people.length > 0) {
                setTimeout(() => this.renderMiniTree(), 100);
            }
        });
    }

    ngAfterViewInit() {
        if (this.allIndividuals().length > 0) {
            this.renderMiniTree();
        }
    }

    loadTrees() {
        this.authService.getTrees().subscribe(trees => {
            const filtered = trees.filter(t => t.name !== 'DEFAULT_TREE');
            this.availableTrees.set(filtered);

            if (!this.authService.currentTree() && filtered.length > 0) {
                const currentName = this.treeName();
                const toSelect = currentName ? filtered.find(t => t.name === currentName) : filtered[0];
                if (toSelect) {
                    this.authService.selectTree(toSelect);
                }
            }
        });
    }

    loadStats(treeName?: string) {
        this.loading.set(true);
        this.gedcomService.getTreeData(treeName).subscribe({
            next: (treeData) => {
                if (treeData && treeData.meta) {
                    const meta = treeData.meta;
                    this.treeName.set(meta.tree);
                    this.allIndividuals.set(treeData.individuals || []);
                    this.allFamilies.set(treeData.families || []);

                    // Calculate Completeness
                    const people = treeData.individuals || [];
                    if (people.length > 0) {
                        let score = 0;
                        people.forEach(p => {
                            if (p.names?.length > 0) score += 0.4;
                            if (p.gender && p.gender !== 'U') score += 0.2;
                            if (p.events?.some((e: any) => e.type === 'BIRT')) score += 0.4;
                        });
                        this.completeness.set(Math.round((score / people.length) * 100));

                        this.updateFunStat(people);
                    }

                    const trees = this.availableTrees();
                    if (trees.length > 0) {
                        const current = trees.find(t => t.name === meta.tree);
                        if (current) {
                            this.authService.selectTree(current);
                        }
                    }

                    this.analyticsService.getStatistics(meta.tree).subscribe({
                        next: (res) => {
                            this.stats.set(res);
                            this.loading.set(false);
                            // Initial render
                            setTimeout(() => this.renderMiniTree(), 200);
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

    updateFunStat(people: any[]) {
        const fact = this.factService.generateFact(people, this.allFamilies(), this.completeness());
        this.funStat.set(fact);
    }

    renderMiniTree() {
        if (!this.miniTreeSvg) return;

        const svg = d3.select(this.miniTreeSvg.nativeElement);
        svg.selectAll('*').remove();

        const data = this.allIndividuals();
        const families = this.allFamilies();
        if (data.length === 0) return;

        // 1. Build a simple hierarchy (Top 3 generations)
        // Find "root" candidates (those with no parents in data)
        const childInFam = new Set<string>();
        families.forEach(f => f.children?.forEach((cid: string) => childInFam.add(cid)));

        const roots = data.filter(p => !childInFam.has(p.id));
        if (roots.length === 0 && data.length > 0) roots.push(data[0]);

        // Simple tree builder (Depth 3)
        const buildHierarchy = (person: any, depth: number): any => {
            if (depth >= 3) return { name: person.lastName, id: person.id };

            // Find families where this person is a parent
            const fams = families.filter(f => f.husband === person.id || f.wife === person.id);
            const children: any[] = [];

            fams.forEach(f => {
                f.children?.forEach((cid: string) => {
                    const child = data.find(p => p.id === cid);
                    if (child) children.push(buildHierarchy(child, depth + 1));
                });
            });

            return {
                name: person.lastName ? `${person.firstName[0]}. ${person.lastName}` : person.firstName,
                id: person.id,
                children: children.length > 0 ? children : undefined
            };
        };

        const hierarchyData = buildHierarchy(roots[0], 1);
        const root = d3.hierarchy(hierarchyData);

        // 2. Layout
        const width = 400;
        const height = 180;
        const treeLayout = d3.tree().size([width - 80, height - 60]);
        treeLayout(root as any);

        const g = svg.append('g').attr('transform', 'translate(40, 30)');

        // 3. Render Links
        g.selectAll('.link')
            .data(root.links())
            .enter()
            .append('path')
            .attr('class', 'mini-link')
            .attr('d', (d: any) => {
                return `M${d.source.x},${d.source.y} C${d.source.x},${(d.source.y + d.target.y) / 2} ${d.target.x},${(d.source.y + d.target.y) / 2} ${d.target.x},${d.target.y}`;
            })
            .style('fill', 'none')
            .style('stroke', 'rgba(191, 149, 63, 0.25)') // Brand-500/25
            .style('stroke-width', '1.5px');

        // 4. Render Nodes
        const node = g.selectAll('.node')
            .data(root.descendants())
            .enter()
            .append('g')
            .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

        node.append('circle')
            .attr('r', 18)
            .attr('class', 'mini-node')
            .style('fill', 'rgba(255, 255, 255, 0.05)')
            .style('stroke', 'rgba(255, 255, 255, 0.2)')
            .style('backdrop-filter', 'blur(4px)');

        node.append('text')
            .attr('dy', '2.5em')
            .attr('text-anchor', 'middle')
            .text((d: any) => d.data.name)
            .style('font-size', '8px')
            .style('fill', '#64748b') // Neutral-500
            .style('font-weight', '600');
    }

    discoverAncestor() {
        const people = this.allIndividuals();
        if (people.length > 0) {
            const randomPerson = people[Math.floor(Math.random() * people.length)];
            // Navigate to tree with focus parameter
            this.router.navigate(['/tree'], { queryParams: { focus: randomPerson.id } });
        }
    }

    toggleSwitcher() {
        this.showTreeSwitcher.set(!this.showTreeSwitcher());
    }

    onDragStart(event: DragEvent, tree: any) {
        event.dataTransfer?.setData('treeName', tree.name);
        this.isDragging.set(true);
    }

    onDragEnd() {
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

    selectTree(tree: any) {
        this.authService.selectTree(tree);
        this.loadStats(tree.name);
        this.showTreeSwitcher.set(false);
    }
}
