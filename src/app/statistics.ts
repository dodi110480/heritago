import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GedcomService } from './gedcom.service';

@Component({
    selector: 'app-statistics',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './statistics.html',
    styleUrl: './statistics.css'
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

        const total = s.gender.male + s.gender.female + s.gender.unknown;
        return {
            male: total ? (s.gender.male / total) * 100 : 0,
            female: total ? (s.gender.female / total) * 100 : 0,
            unknown: total ? (s.gender.unknown / total) * 100 : 0
        };
    }
}
