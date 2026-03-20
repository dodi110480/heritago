import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TreeService } from '../../core/services/tree.service';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';
import { AppStatCardComponent } from '../../shared/components/ui/app-stat-card';


import { AnalyticsService } from '../../core/services/analytics.service';
@Component({
    selector: 'app-statistics',
    standalone: true,
    imports: [CommonModule, AppPageHeaderComponent, AppStatCardComponent],
    templateUrl: './statistics.html'
})
export class StatisticsDashboard implements OnInit {
    public analyticsService = inject(AnalyticsService);
    private treeService = inject(TreeService);

    stats = signal<any>(null);
    loading = signal(true);
    treeName = signal('');

    ngOnInit() {
        this.loadStatistics();
    }

    loadStatistics() {
        this.loading.set(true);
        this.treeService.getTreeData().subscribe(data => {
            if (data && data.meta && data.meta.tree) {
                this.treeName.set(data.meta.tree);
                this.analyticsService.getStatistics(data.meta.tree).subscribe({
                    next: (res: any) => {
                        this.stats.set(res);
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

    get genderPercentages() {
        const s = this.stats();
        if (!s || !s.genderPercentages) return { male: 0, female: 0, unknown: 0 };
        return s.genderPercentages;
    }
}
