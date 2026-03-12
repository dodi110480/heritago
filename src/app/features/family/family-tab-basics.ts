import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Family, Individual } from '../../core/models/models';
import { AppAvatarComponent } from '../../shared/components/ui/app-avatar';
import { AppSectionHeaderComponent } from '../../shared/components/ui/app-section-header';

@Component({
    selector: 'app-family-tab-basics',
    standalone: true,
    imports: [CommonModule, RouterLink, AppAvatarComponent, AppSectionHeaderComponent],
    template: `
        <div class="glass-card !p-6 sm:!p-8 flex flex-col gap-6">
            <app-section-header title="Partner" [accent]="true"></app-section-header>
            <div
                class="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-10 items-center bg-canvas/5 dark:bg-white/5 !rounded-2xl p-6 md:p-10 relative border border-canvas/10 dark:border-white/10">
                
                <!-- Husband -->
                <div class="flex items-center gap-5">
                    <app-avatar [imageUrl]="getPersonImage(husband)"
                        [gender]="husband?.gender || 'U'" size="lg"
                        [alt]="getPersonName(husband)"></app-avatar>
                    <div class="flex flex-col">
                        <span
                            class="text-xs text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider mb-1">Ehemann</span>
                        <span class="text-lg font-bold text-neutral-900 dark:text-white">{{
                            getPersonName(husband) }}</span>
                        <a [routerLink]="['/person', husband?.id]"
                            class="text-sm text-brand-600 dark:text-brand-400 hover:underline mt-1">Profil
                            ansehen</a>
                    </div>
                </div>

                <div class="text-4xl opacity-30 rotate-90 md:rotate-0 text-center">💍</div>

                <!-- Wife -->
                <div
                    class="flex items-center gap-5 justify-start md:justify-end text-left md:text-right flex-row md:flex-row-reverse">
                    <app-avatar [imageUrl]="getPersonImage(wife)"
                        [gender]="wife?.gender || 'U'" size="lg"
                        [alt]="getPersonName(wife)"></app-avatar>
                    <div class="flex flex-col">
                        <span
                            class="text-xs text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider mb-1">Ehefrau</span>
                        <span class="text-lg font-bold text-neutral-900 dark:text-white">{{
                            getPersonName(wife) }}</span>
                        <a [routerLink]="['/person', wife?.id]"
                            class="text-sm text-brand-600 dark:text-brand-400 hover:underline mt-1">Profil
                            ansehen</a>
                    </div>
                </div>
            </div>
        </div>
    `
})
export class FamilyTabBasicsComponent {
    @Input() family: Family | null = null;
    @Input() husband: Individual | undefined;
    @Input() wife: Individual | undefined;

    getPersonName(p: Individual | undefined): string {
        if (!p) return 'Unbekannt';
        return `${p.firstName} ${p.lastName}`;
    }

    getPersonImage(p: Individual | undefined): string | undefined {
        if (!p || !p.media || p.media.length === 0) return undefined;
        const primary = p.media.find(m => m.isPrimary) || p.media[0];
        return primary?.url || primary?.id;
    }
}
