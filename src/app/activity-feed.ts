import { Component, inject, signal, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { GedcomService } from './core/services/gedcom.service';


import { AnalyticsService } from './core/services/analytics.service';
@Component({
    selector: 'app-activity-feed',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
    <div class="min-h-screen text-canvas-white/90 flex flex-col p-0 m-0">
        <div class="page-header overflow-hidden h-[300px]">
             <div class="absolute -top-1/2 -left-[10%] w-[60%] h-[150%] pointer-events-none -rotate-12 header-gold-glow"></div>
            <div class="page-header-inner flex flex-col justify-center h-full">
                <div class="header-info">
                    <h1 class="page-title text-4xl font-bold mb-2">Aktivitätsverlauf</h1>
                    <p class="page-subtitle text-canvas-white/50 text-lg">Die letzten Änderungen in deinem Stammbaum</p>
                </div>
            </div>
        </div>

        <div class="max-w-[1000px] w-full mx-auto -mt-20 px-6 pb-20 relative z-20">
            <div class="flex flex-col gap-8">
                <div *ngIf="loading()" class="flex justify-center p-20">
                    <div class="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
                </div>

                <div *ngIf="!loading() && groupedLogs().length === 0" class="glass-card text-center py-20">
                    <p class="text-canvas-white/40 text-xl">Noch keine Aktivitäten aufgezeichnet.</p>
                </div>

                <div *ngFor="let group of groupedLogs()" class="flex flex-col gap-4">
                    <h3 class="text-meta uppercase text-canvas-white/30 tracking-[0.2em] font-bold text-sm ml-2">{{ group.dateLabel }}</h3>
                    
                    <div class="flex flex-col gap-3">
                        <div *ngFor="let log of group.logs" 
                             class="glass-card flex items-center gap-6 p-4 hover:border-canvas-white/20 transition-all cursor-pointer group"
                             (click)="navigateToEntity(log)">
                            
                            <!-- Action Icon -->
                            <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-canvas-white/5 shadow-inner"
                                 [ngClass]="{
                                    'bg-accent-emerald-500/10 text-accent-emerald-400': log.action === 'CREATE',
                                    'bg-brand-500/10 text-brand-400': log.action === 'UPDATE',
                                    'bg-accent-danger-500/10 text-accent-danger-400': log.action === 'DELETE'
                                 }">
                                <span class="text-xl font-bold" *ngIf="log.action === 'CREATE'">＋</span>
                                <span class="text-xl font-bold" *ngIf="log.action === 'UPDATE'">✎</span>
                                <span class="text-xl font-bold" *ngIf="log.action === 'DELETE'">✕</span>
                            </div>

                            <!-- Content -->
                            <div class="flex flex-col flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-0.5">
                                    <span class="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" [ngClass]="getEntityColor(log.entityType)">
                                        <span>{{ getEntityIcon(log.entityType) }}</span>
                                        <span>{{ log.entityType === 'PERSON' ? 'Person' : (log.entityType === 'FAMILY' ? 'Familie' : (log.entityType === 'PLACE' ? 'Ort' : log.entityType)) }}</span>
                                    </span>
                                    <span class="w-1 h-1 bg-canvas-white/10 rounded-full"></span>
                                    <span class="text-xs text-canvas-white/40">{{ log.createdAt | date:'HH:mm' }} Uhr</span>
                                </div>
                                <h4 class="text-lg font-bold text-canvas-white group-hover:text-brand-400 transition-colors truncate">
                                    {{ log.summary }}
                                </h4>
                                <div class="flex items-center gap-2 text-sm text-canvas-white/40">
                                    <span *ngIf="log.user">von <b>{{ log.user.username }}</b></span>
                                    <span *ngIf="!log.user">System</span>
                                </div>
                            </div>

                            <!-- Arrow -->
                            <div class="text-canvas-white/20 group-hover:text-brand-400 transition-all group-hover:translate-x-1 pr-2">
                                →
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-16 flex justify-center">
                <a routerLink="/" class="text-canvas-white/40 hover:text-canvas-white transition-colors flex items-center gap-2 text-sm font-medium">
                    ← Zurück zum Dashboard
                </a>
            </div>
        </div>
    </div>
    `,
    encapsulation: ViewEncapsulation.None,
    styles: [`
        .glass-card {
            @apply bg-canvas-white/5 backdrop-blur-md border border-canvas-white/10 rounded-[24px] p-6 shadow-xl;
        }
    `]
})
export class ActivityFeed implements OnInit {
    public analyticsService = inject(AnalyticsService);
    private gedcomService = inject(GedcomService);
    private router = inject(Router);

    logs = signal<any[]>([]);
    groupedLogs = signal<any[]>([]);
    loading = signal(true);

    ngOnInit() {
        this.loadLogs();
    }

    loadLogs() {
        this.gedcomService.getTreeData().subscribe(treeData => {
            if (treeData && treeData.meta && treeData.meta.tree) {
                this.analyticsService.getChangeLog(treeData.meta.tree).subscribe({
                    next: (logs) => {
                        this.logs.set(logs);
                        this.groupedLogs.set(this.groupLogs(logs));
                        this.loading.set(false);
                    },
                    error: () => this.loading.set(false)
                });
            } else {
                this.loading.set(false);
            }
        });
    }

    private groupLogs(logs: any[]): any[] {
        const groups: { [key: string]: any[] } = {};
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        logs.forEach(log => {
            const date = new Date(log.createdAt);
            const dateStr = date.toDateString();
            let label = date.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

            if (dateStr === today) label = 'Heute';
            else if (dateStr === yesterday) label = 'Gestern';

            if (!groups[label]) groups[label] = [];
            groups[label].push(log);
        });

        return Object.entries(groups).map(([label, items]) => ({
            dateLabel: label,
            logs: items
        }));
    }

    navigateToEntity(log: any) {
        if (log.action === 'DELETE') return;

        const entity = log.after || {};
        const targetId = entity.gedcomId || entity.id || log.entityId;

        if (log.entityType === 'PERSON') {
            if (targetId) this.router.navigate(['/person', targetId]);
        } else if (log.entityType === 'FAMILY') {
            if (targetId) this.router.navigate(['/family', targetId]);
        } else if (log.entityType === 'PLACE') {
            this.router.navigate(['/places']);
        } else if (log.entityType === 'MEDIA') {
            this.router.navigate(['/media']);
        }
    }

    getEntityIcon(type: string): string {
        switch (type) {
            case 'PERSON': return '👤';
            case 'FAMILY': return '👨‍👩‍👧‍👦';
            case 'PLACE': return '📍';
            case 'MEDIA': return '🖼️';
            case 'SOURCE': return '📜';
            default: return '📄';
        }
    }

    getEntityColor(type: string): string {
        switch (type) {
            case 'PERSON': return 'text-brand-400';
            case 'FAMILY': return 'text-accent-emerald-400';
            case 'PLACE': return 'text-accent-amber-400';
            case 'MEDIA': return 'text-accent-cyan-400';
            default: return 'text-canvas-white/30';
        }
    }
}
