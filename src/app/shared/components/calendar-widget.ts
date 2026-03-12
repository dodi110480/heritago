import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TreeService } from '../../core/services/tree.service';


import { AnalyticsService } from '../../core/services/analytics.service';
@Component({
    selector: 'app-calendar-widget',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './calendar-widget.html'
})
export class CalendarWidget implements OnInit {
    public analyticsService = inject(AnalyticsService);
    private treeService = inject(TreeService);

    events = signal<any[]>([]);
    currentDate = signal('');
    loading = signal(true);
    hasTree = signal(false);

    ngOnInit() {
        this.loadEvents();
    }

    loadEvents() {
        this.loading.set(true);
        this.treeService.getTreeData().subscribe(data => {
            if (data && data.meta && data.meta.tree) {
                this.hasTree.set(true);
                this.analyticsService.getCalendarEvents(data.meta.tree).subscribe({
                    next: (res: any) => {
                        this.events.set(res.events || []);
                        this.currentDate.set(res.date);
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
}
