import { Component, inject, signal, ViewChild, ElementRef, AfterViewInit, effect, ViewEncapsulation } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../environment';
import { CalendarWidget } from '../../shared/components/calendar-widget';
import { TreeService } from '../../core/services/tree.service';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';
import { AppStatCardComponent } from '../../shared/components/ui/app-stat-card';
import * as d3 from 'd3';


import { AnalyticsService } from '../../core/services/analytics.service';
import { AppIconComponent } from '../../shared/components/ui/app-icon';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink, CalendarWidget, AppPageHeaderComponent, AppStatCardComponent, AppIconComponent],
    templateUrl: './dashboard.html',
    encapsulation: ViewEncapsulation.None
})
export class Dashboard implements AfterViewInit {
    public analyticsService = inject(AnalyticsService);
    @ViewChild('miniTree') miniTreeSvg!: ElementRef<SVGSVGElement>;
    authService = inject(AuthService);
    private treeService = inject(TreeService);
    private router = inject(Router);
    private http = inject(HttpClient);

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
        this.treeService.getTreeData(treeName).subscribe({
            next: (treeData) => {
                if (treeData && treeData.meta) {
                    const meta = treeData.meta;
                    this.treeName.set(meta.tree);
                    this.allIndividuals.set(treeData.individuals || []);
                    this.allFamilies.set(treeData.families || []);

                    this.analyticsService.getStatistics(meta.tree).subscribe({
                        next: (res) => {
                            this.stats.set(res);
                            if (res) {
                                this.completeness.set(res.completeness || 0);
                                this.funStat.set(res.funStat || '');
                            }
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

    renderMiniTree() {
        if (!this.miniTreeSvg) return;

        const svg = d3.select(this.miniTreeSvg.nativeElement);
        svg.selectAll('*').remove();

        const treeName = this.treeName() || this.authService.currentTree()?.name;
        if (!treeName) return;

        this.http.get<any>(`${environment.apiUrl}/tree/${treeName}/hierarchy`, { withCredentials: true }).subscribe({
            next: (res) => {
                const hierarchyData = res.data;
                if (!hierarchyData) return;

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
            .style('font-size', '7px') // Noch filigraner (von 8px)
            .style('fill', 'rgba(100, 116, 139, 0.7)') // Slate-500 mit Deckkraft
            .style('font-weight', '700')
            .style('text-transform', 'uppercase')
            .style('letter-spacing', '0.05em');
            },
            error: () => {}
        });
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

    openQuickWizard(type: string) {
        if (type === 'person') {
            // For now just navigate to persons or show a placeholder
            // alert('Der Wizard für ' + type + ' wird bald verfügbar sein! ✨');
            this.router.navigate(['/persons']);
        }
    }
}
