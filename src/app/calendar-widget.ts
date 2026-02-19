import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GedcomService } from './gedcom.service';

@Component({
    selector: 'app-calendar-widget',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './calendar-widget.html',
    styleUrl: './calendar-widget.css'
})
export class CalendarWidget implements OnInit {
    private gedcomService = inject(GedcomService);

    events = signal<any[]>([]);
    currentDate = signal('');
    loading = signal(true);
    hasTree = signal(false);

    ngOnInit() {
        this.loadEvents();
    }

    loadEvents() {
        this.loading.set(true);
        this.gedcomService.getTreeData().subscribe(treeData => {
            if (treeData && treeData.meta && treeData.meta.tree) {
                this.hasTree.set(true);
                this.gedcomService.getCalendarEvents(treeData.meta.tree).subscribe({
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
