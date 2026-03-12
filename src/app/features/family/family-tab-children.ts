import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Family, Individual } from '../../core/models/models';
import { AppAvatarComponent } from '../../shared/components/ui/app-avatar';
import { AppSectionHeaderComponent } from '../../shared/components/ui/app-section-header';
import { AppEmptyStateComponent } from '../../shared/components/ui/app-empty-state';

@Component({
    selector: 'app-family-tab-children',
    standalone: true,
    imports: [CommonModule, RouterLink, AppAvatarComponent, AppSectionHeaderComponent, AppEmptyStateComponent],
    template: `
        <div class="glass-card !p-6 sm:!p-8 flex flex-col gap-6">
            <app-section-header title="Kinder" icon="👶">
                <button actions class="btn-primary !w-auto !py-1.5 text-sm" (click)="addChildRequested.emit()">+
                    Kind</button>
            </app-section-header>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" *ngIf="children.length">
                <div class="glass-card !p-4 !rounded-2xl flex items-center gap-4 hover:scale-[1.02] transition-transform cursor-pointer"
                    *ngFor="let child of children" [routerLink]="['/person', child.id]">
                    <app-avatar [imageUrl]="getPersonImage(child)"
                        [gender]="child.gender" size="sm" [alt]="getPersonName(child)"></app-avatar>
                    <div class="flex flex-col flex-1 min-w-0">
                        <span class="font-bold text-sm text-neutral-900 dark:text-white truncate">{{
                            getPersonName(child) }}</span>
                        <div class="flex gap-3 mt-1 text-xs">
                            <span class="text-brand-600 dark:text-brand-400 hover:underline">Profil</span>
                            <button class="text-accent-danger-500/70 hover:text-accent-danger-500 hover:underline"
                                (click)="$event.stopPropagation(); removeChildRequested.emit(child.id)">Entfernen</button>
                        </div>
                    </div>
                </div>
            </div>

            <app-empty-state *ngIf="children.length === 0" icon="👶"
                title="Keine Kinder" message="Bisher sind keine Kinder dieser Familie zugeordnet.">
            </app-empty-state>
        </div>
    `
})
export class FamilyTabChildrenComponent {
    @Input() family: Family | null = null;
    @Input() children: Individual[] = [];
    
    @Output() addChildRequested = new EventEmitter<void>();
    @Output() removeChildRequested = new EventEmitter<string>();

    getPersonName(p: Individual): string {
        return `${p.firstName} ${p.lastName}`;
    }

    getPersonImage(p: Individual): string | undefined {
        if (!p.media || p.media.length === 0) return undefined;
        const primary = p.media.find(m => m.isPrimary) || p.media[0];
        return primary?.url || primary?.id;
    }
}
