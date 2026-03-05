import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { AppPageContainerComponent } from './ui/app-page-container';

@Component({
    selector: 'app-timeline',
    standalone: true,
    imports: [CommonModule, AppPageContainerComponent],
    templateUrl: './timeline.html'
})
export class TimelineView implements OnInit {
    private route = inject(ActivatedRoute);
    private gedcomService = inject(GedcomService);

    timelineData = signal<any>(null);
    loading = signal(true);
    treeName = '';

    ngOnInit() {
        this.route.paramMap.subscribe(params => {
            const xref = params.get('xref');
            // Note: We need the tree name too. Typically we get it from service or route.
            // If route is /tree/:tree/timeline/:xref? No, current routes design might be simpler.
            // Let's rely on gedcomService.getTreeData() to get current tree if not in url.

            if (xref) {
                this.loadTimeline(xref);
            }
        });
    }

    loadTimeline(xref: string) {
        this.loading.set(true);
        this.gedcomService.getTreeData().subscribe(treeData => {
            if (treeData && treeData.meta && treeData.meta.tree) {
                this.treeName = treeData.meta.tree;
                this.gedcomService.getTimeline(this.treeName, xref).subscribe({
                    next: (res: any) => {
                        this.timelineData.set(res);
                        this.loading.set(false);
                    },
                    error: () => {
                        this.loading.set(false);
                    }
                });
            } else {
                this.loading.set(false);
            }
        });
    }

    getIcon(type: string): string {
        const t = type.toLowerCase();
        if (t.includes('birt') || t.includes('geburt') || t.includes('born')) return '👶';
        if (t.includes('marr') || t.includes('heirat')) return '💍';
        if (t.includes('death') || t.includes('tod') || t.includes('gestorben')) return '⚰️';
        if (t.includes('burial') || t.includes('begräbnis')) return '🪦';
        if (t.includes('bapm') || t.includes('taufe') || t.includes('chr')) return '💧';
        if (t.includes('cens') || t.includes('volkszählung')) return '📝';
        if (t.includes('occu') || t.includes('beruf')) return '🔨';
        return '📅';
    }
}
