import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GedcomService } from './gedcom.service';
import { AppPageContainerComponent } from './ui/app-page-container';
import { AppPageHeaderComponent } from './ui/app-page-header';
import { AppStatCardComponent } from './ui/app-stat-card';

@Component({
    selector: 'app-statistics',
    standalone: true,
    imports: [CommonModule, AppPageContainerComponent, AppPageHeaderComponent, AppStatCardComponent],
    templateUrl: './statistics.html'
})
export class StatisticsDashboard implements OnInit {
    private gedcomService = inject(GedcomService);

    stats = signal<any>(null);
    loading = signal(true);
    treeName = signal('');

    ngOnInit() {
        this.loadStatistics();
    }

    loadStatistics() {
        this.loading.set(true);
        this.gedcomService.getTreeData().subscribe(treeData => {
            if (treeData && treeData.meta && treeData.meta.tree) {
                this.treeName.set(treeData.meta.tree);
                this.gedcomService.getStatistics(treeData.meta.tree).subscribe({
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
        if (!s || !s.gender) return { male: 0, female: 0, unknown: 0 };

        const male = s.gender.male || 0;
        const female = s.gender.female || 0;
        const unknown = s.gender.unknown || 0;
        const total = male + female + unknown;

        return {
            male: total ? (male / total) * 100 : 0,
            female: total ? (female / total) * 100 : 0,
            unknown: total ? (unknown / total) * 100 : 0
        };
    }
}
