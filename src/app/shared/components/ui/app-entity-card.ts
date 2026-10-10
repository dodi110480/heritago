import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppAvatarComponent } from './app-avatar';

export type EntityBadgeColor = 'primary' | 'highlight' | 'success' | 'danger' | 'neutral';

@Component({
    selector: 'app-entity-card',
    standalone: true,
    imports: [CommonModule, RouterLink, AppAvatarComponent],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
        <div class="glass-card flex items-start gap-3 hover:bg-ui-cardHover transition-all cursor-pointer group border-l-[3px]"
             [ngClass]="getBorderColorClass()"
             [routerLink]="routerLink"
             [queryParams]="queryParams"
             (click)="onClick.emit($event)">
             
            <!-- Avatar / Icon Area -->
            <div class="shrink-0">
                <app-avatar 
                    *ngIf="avatarUrl || !icon"
                    [imageUrl]="avatarUrl" 
                    [gender]="gender" 
                    size="sm"
                    [circular]="false"
                    class="group-hover:scale-105 transition-transform duration-500"
                ></app-avatar>
                
                <div *ngIf="!avatarUrl && icon" 
                     class="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center overflow-hidden border border-ui-border"
                     [ngClass]="getIconBgClass()">
                    <span class="text-xl group-hover:scale-110 transition-transform duration-300">
                        {{ icon }}
                    </span>
                </div>
            </div>

            <!-- Content Area -->
            <div class="flex-1 min-w-0 flex flex-col justify-center">
                <div class="flex items-start justify-between gap-2">
                    <div class="truncate">
                        <div *ngIf="badgeText" class="text-[8px] font-bold uppercase tracking-wider mb-0.5 leading-none" [ngClass]="getTextColorClass()">
                            {{ badgeText }}
                        </div>
                        <!-- Typographic hierarchy: the entity name is the prominent line
                             (text-base), the secondary lines below stay one step smaller (text-sm). -->
                        <h3 class="text-base font-bold text-neutral-900 dark:text-neutral-100 truncate leading-tight group-hover:text-brand-700 transition-colors">
                            {{ title }}
                        </h3>
                    </div>
                    
                    <!-- Optional Actions (e.g. Delete) passed via Content Projection -->
                    <div class="shrink-0 flex items-center gap-2" (click)="$event.stopPropagation()">
                        <!-- Shared action badge: single source of truth for the chip
                             design used by every entity list (counts, labels, status). -->
                        @if (actionBadge) {
                            <span class="text-[10px] px-2 py-1 rounded-lg font-bold border whitespace-nowrap shadow-xs"
                                  [ngClass]="getActionBadgeClass()"
                                  [attr.title]="actionBadgeTooltip || null">
                                {{ actionBadge }}
                            </span>
                        }
                        <ng-content select="[actions]"></ng-content>
                    </div>
                </div>
                
                <div *ngIf="subtitle" class="text-sm leading-tight text-neutral-700 dark:text-neutral-300 truncate mt-0.5">
                    {{ subtitle }}
                </div>
                
                <div *ngIf="meta" class="text-sm leading-tight text-neutral-500 truncate mt-0.5">
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
    @Input() gender?: 'M' | 'F' | 'X' | 'U' | string;
    @Input() icon?: string;
    @Input() badgeText?: string;
    @Input() badgeColor: EntityBadgeColor = 'neutral';
    @Input() routerLink?: any[] | string;
    @Input() queryParams?: Record<string, any>;
    @Input() isFocused: boolean = false;

    /**
     * Optional action badge shown in the card's top-right corner (e.g. child/link
     * counts). Centralised here so every entity list renders the exact same badge
     * design instead of repeating inline Tailwind classes.
     */
    @Input() actionBadge?: string;
    /** Native tooltip (title) for the action badge. */
    @Input() actionBadgeTooltip?: string;
    /** Semantic tone of the action badge (reuses the card badge palette). */
    @Input() actionBadgeTone: EntityBadgeColor = 'primary';

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
            'neutral': 'bg-ui-bgSoft/20 text-neutral-700',
        };
        return map[this.badgeColor] || map['neutral'];
    }

    getTextColorClass(): string {
        const map: Record<EntityBadgeColor, string> = {
            'primary': 'text-brand-500',
            'highlight': 'text-accent-highlight-500',
            'success': 'text-accent-success-500',
            'danger': 'text-accent-danger-500',
            'neutral': 'text-neutral-900',
        };
        return map[this.badgeColor] || map['neutral'];
    }

    /**
     * Tone classes for the shared action badge. The `primary` tone is identical to
     * the global `.badge-primary` utility (incl. the `dark:` text step for contrast).
     */
    getActionBadgeClass(): string {
        const map: Record<EntityBadgeColor, string> = {
            'primary': 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20',
            'highlight': 'bg-accent-highlight-500/10 text-accent-highlight-600 dark:text-accent-highlight-400 border-accent-highlight-500/20',
            'success': 'bg-accent-success-500/10 text-accent-success-600 dark:text-accent-success-400 border-accent-success-500/20',
            'danger': 'bg-accent-danger-500/10 text-accent-danger-600 dark:text-accent-danger-400 border-accent-danger-500/20',
            'neutral': 'bg-canvas-white/10 text-neutral-500 dark:text-neutral-300 border-ui-border',
        };
        return map[this.actionBadgeTone] || map['primary'];
    }
}
