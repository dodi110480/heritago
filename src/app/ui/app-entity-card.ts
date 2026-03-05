import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export type EntityBadgeColor = 'primary' | 'highlight' | 'success' | 'danger' | 'neutral';

@Component({
    selector: 'app-entity-card',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
        <div class="glass-card !p-3 flex items-start gap-3 hover:bg-ui-cardHover transition-all cursor-pointer group border-l-[3px]"
             [ngClass]="getBorderColorClass()"
             [routerLink]="routerLink"
             [queryParams]="queryParams"
             (click)="onClick.emit($event)">
             
            <!-- Avatar / Icon Area -->
            <div class="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center overflow-hidden border border-ui-border"
                 [ngClass]="getIconBgClass()">
                
                <img *ngIf="avatarUrl" [src]="avatarUrl" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="Avatar">
                
                <span *ngIf="!avatarUrl && icon" class="text-xl group-hover:scale-110 transition-transform duration-300">
                    {{ icon }}
                </span>
            </div>

            <!-- Content Area -->
            <div class="flex-1 min-w-0 flex flex-col justify-center">
                <div class="flex items-start justify-between gap-2">
                    <div class="truncate">
                        <div *ngIf="badgeText" class="text-[8px] font-bold uppercase tracking-wider mb-0.5 leading-none" [ngClass]="getTextColorClass()">
                            {{ badgeText }}
                        </div>
                        <h3 class="text-sm font-bold text-ui-text truncate leading-tight group-hover:text-brand-700 transition-colors">
                            {{ title }}
                        </h3>
                    </div>
                    
                    <!-- Optional Actions (e.g. Delete) passed via Content Projection -->
                    <div class="shrink-0 flex items-center" (click)="$event.stopPropagation()">
                        <ng-content select="[actions]"></ng-content>
                    </div>
                </div>
                
                <div *ngIf="subtitle" class="text-meta leading-tight text-ui-textSoft truncate mt-0.5">
                    {{ subtitle }}
                </div>
                
                <div *ngIf="meta" class="text-meta leading-tight text-ui-textMuted truncate mt-0.5">
                    {{ meta }}
                </div>
            </div>
        </div>
    `
})
export class AppEntityCard {
    @Input() title: string = '';
    @Input() subtitle?: string;
    @Input() meta?: string;
    @Input() avatarUrl?: string | null;
    @Input() icon: string = '📄';
    @Input() badgeText?: string;
    @Input() badgeColor: EntityBadgeColor = 'neutral';
    @Input() routerLink?: any[] | string;
    @Input() queryParams?: Record<string, any>;
    @Input() isFocused: boolean = false;

    @Output() onClick = new EventEmitter<MouseEvent>();

    getBorderColorClass(): string {
        if (this.isFocused) return 'border-l-brand-500 ring-2 ring-brand-500/50';
        const map: Record<EntityBadgeColor, string> = {
            'primary': 'border-l-brand-500',
            'highlight': 'border-l-accent-highlight-500',
            'success': 'border-l-accent-success-500',
            'danger': 'border-l-accent-danger-500',
            'neutral': 'border-l-canvas-white/20',
        };
        return map[this.badgeColor] || map['neutral'];
    }

    getIconBgClass(): string {
        const map: Record<EntityBadgeColor, string> = {
            'primary': 'bg-brand-500/10 text-brand-400',
            'highlight': 'bg-accent-highlight-500/10 text-accent-highlight-400',
            'success': 'bg-accent-success-500/10 text-accent-success-400',
            'danger': 'bg-accent-danger-500/10 text-accent-danger-400',
            'neutral': 'bg-ui-panel text-ui-textSoft',
        };
        return map[this.badgeColor] || map['neutral'];
    }

    getTextColorClass(): string {
        const map: Record<EntityBadgeColor, string> = {
            'primary': 'text-brand-500',
            'highlight': 'text-accent-highlight-500',
            'success': 'text-accent-success-500',
            'danger': 'text-accent-danger-500',
            'neutral': 'text-ui-textMuted',
        };
        return map[this.badgeColor] || map['neutral'];
    }
}
