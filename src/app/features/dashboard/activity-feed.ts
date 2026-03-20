import { Component, inject, signal, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TreeService } from '../../core/services/tree.service';
import { AnalyticsService } from '../../core/services/analytics.service';

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
                    <h3 class="text-meta uppercase text-neutral-500 tracking-[0.2em] font-bold text-[10px] ml-4 mt-8 first:mt-0">{{ group.dateLabel }}</h3>
                    
                    <div class="glass-card !p-0 overflow-hidden bg-white/80 dark:bg-slate-900/80 border-neutral-200/50 dark:border-slate-800/50 shadow-lg">
                        <div *ngFor="let log of group.logs" 
                             class="flex items-center gap-4 py-3 px-6 hover:bg-neutral-50 dark:hover:bg-slate-800/40 transition-all cursor-pointer group border-b border-neutral-100 dark:border-slate-800/50 last:border-0"
                             (click)="navigateToEntity(log)">
                             
                            <!-- Action Marker Dot -->
                            <div class="w-1 h-6 rounded-full shrink-0"
                                 [ngClass]="{
                                    'bg-accent-emerald-500': log.action === 'CREATE',
                                    'bg-brand-500': log.action === 'UPDATE',
                                    'bg-accent-danger-500': log.action === 'DELETE'
                                 }">
                            </div>

                            <!-- Content -->
                            <div class="flex-1 min-w-0 flex items-center gap-4">
                                <div class="text-xl shrink-0 opacity-80 group-hover:scale-110 transition-transform duration-300">
                                    {{ log.entityIcon }}
                                </div>
                                <div class="flex flex-col min-w-0">
                                    <div class="flex items-center gap-2">
                                        <span class="text-[9px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                            {{ log.entityTypeLabel }}
                                        </span>
                                        <span class="w-1 h-1 bg-neutral-200 dark:bg-slate-700 rounded-full"></span>
                                        <span class="text-[10px] text-neutral-400 dark:text-slate-500 font-medium uppercase tracking-wider">{{ log.createdAt | date:'HH:mm' }} Uhr</span>
                                    </div>
                                    <h4 class="text-[13px] font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors truncate mt-0.5">
                                        {{ log.summary }}
                                    </h4>
                                </div>
                            </div>

                            <!-- User Info (Right Aligned) -->
                            <div class="shrink-0 flex items-center gap-3">
                                <div class="hidden sm:flex flex-col items-end">
                                    <span class="text-[9px] text-neutral-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">Akteur</span>
                                    <span class="text-[11px] text-neutral-600 dark:text-neutral-400 font-bold mt-0.5">{{ log.user?.username || 'System' }}</span>
                                </div>
                                <div class="text-neutral-300 dark:text-slate-700 group-hover:text-brand-500 transition-all transform group-hover:translate-x-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
 
            <div class="mt-16 flex justify-center">
                <a routerLink="/" class="px-6 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 shadow-sm inline-flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 hover:text-brand-700 hover:border-brand-200 transition-all group-link">
                    <span class="text-sm">←</span>
                    <span>Zurück zum Dashboard</span>
                </a>
            </div>
        </div>
    </div>
    `,
    encapsulation: ViewEncapsulation.None,
    styles: [`
        .glass-card {
            @apply bg-white dark:bg-slate-950 backdrop-blur-md border border-neutral-200 dark:border-slate-800 rounded-[24px] p-8 shadow-xl transition-all duration-300;
        }
        .header-gold-glow {
            background: radial-gradient(circle at center, rgba(163, 131, 68, 0.1) 0%, transparent 70%);
        }
    `]
})
export class ActivityFeed implements OnInit {
    private analyticsService = inject(AnalyticsService);
    private treeService = inject(TreeService);
    private router = inject(Router);

    groupedLogs = signal<any[]>([]);
    loading = signal(true);

    ngOnInit() {
        this.loadLogs();
    }

    loadLogs() {
        this.treeService.getTreeData().subscribe(data => {
            if (data && data.meta && data.meta.tree) {
                this.analyticsService.getChangeLog(data.meta.tree).subscribe({
                    next: (groups) => {
                        this.groupedLogs.set(groups);
                        this.loading.set(false);
                    },
                    error: () => this.loading.set(false)
                });
            } else {
                this.loading.set(false);
            }
        });
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
}
