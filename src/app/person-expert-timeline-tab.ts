import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppEmptyStateComponent } from './ui/app-empty-state';
import { AppSectionHeaderComponent } from './ui/app-section-header';


@Component({
    selector: 'app-person-expert-timeline-tab',
    standalone: true,
    imports: [CommonModule, FormsModule, AppEmptyStateComponent, AppSectionHeaderComponent],
    template: `
        <div class="glass-card shadow-sm flex flex-col">
            <div class="!p-4 md:!p-5">
                <app-section-header title="Lebenslauf" icon="⏳">
                    <button actions (click)="addTimelineItem()" class="btn-primary !w-auto !py-1.5 !px-3 text-xs">
                        + Ereignis/Fakt
                    </button>
                </app-section-header>

                <div
                    class="relative pl-6 space-y-4 before:absolute before:left-2 before:top-1 before:bottom-1 before:w-0.5 before:bg-canvas-white/10">
                    <div *ngFor="let item of timeline(); let i = index" class="relative group/item">
                        <div
                            class="absolute -left-[20px] top-1.5 w-3 h-3 rounded-full bg-brand-500 border-2 border-neutral-900 z-10 transition-transform group-hover/item:scale-125">
                        </div>

                        <div class="glass-card !p-3 !bg-canvas-white/5 !rounded-xl transition-all shadow-sm cursor-pointer hover:bg-canvas-white/10"
                            (click)="!isTimelineItemLocked(item) && openTimelineItemModal(i)"
                            [class.ring-2]="item.editing" [class.ring-brand-500/50]="item.editing">
                            <div *ngIf="!item.editing" class="space-y-2">
                                <div class="flex justify-between items-start">
                                    <div class="space-y-1">
                                        <div class="text-[10px] font-bold text-neutral-800 uppercase tracking-widest">
                                            {{ getTagLabel(item.tag) }}</div>
                                        <div class="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{{ item.date || 'Kein Datum'
                                            }}</div>
                                    </div>
                                </div>
                                <div class="flex flex-wrap gap-2" *ngIf="item.place">
                                    <span
                                        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-canvas-white/5 text-neutral-600 text-xs border border-canvas-white/5">
                                        <span class="text-xs">📍</span> {{ item.place }}
                                    </span>
                                </div>
                                <div class="text-xs text-neutral-800 leading-relaxed"
                                    *ngIf="item.value || item.description">
                                    {{ item.value || item.description }}
                                </div>

                                <div class="flex flex-wrap gap-2" *ngIf="item.media?.length">
                                    <div *ngFor="let med of item.media" (click)="openViewer(med)"
                                        class="w-12 h-12 rounded-lg overflow-hidden cursor-pointer ring-1 ring-white/10 hover:ring-brand-500 transition-all hover:scale-105 active:scale-95">
                                        <img [src]="getMediaUrl(med.id || med.url)" [alt]="med.title"
                                            class="w-full h-full object-cover">
                                    </div>
                                </div>

                                <div class="flex flex-wrap gap-2">
                                    <span *ngIf="isTimelineItemLocked(item)" class="badge badge-primary">🔒 Nur lesen</span>
                                    <span *ngIf="item.media?.length" class="badge badge-primary">🖼 {{
                                        item.media?.length }}</span>
                                    <span *ngIf="item.citations?.length" class="badge badge-success">📖 {{
                                        item.citations?.length }}</span>
                                    <span *ngIf="item.notes?.length" class="badge badge-highlight">📝 {{
                                        item.notes?.length }}</span>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                <app-empty-state *ngIf="timeline().length === 0"
                    icon="⏳" 
                    title="Lebenslauf leer" 
                    message="Anhand von Daten und Fakten entsteht ein Bild der Person. Füge das erste Ereignis hinzu.">
                </app-empty-state>
            </div>
        </div>
    `
})
export class PersonExpertTimelineTabComponent {
    @Input({ required: true }) ctx!: any;

    timeline() { return this.ctx.timeline(); }
    availableSources() { return this.ctx.availableSources(); }
    trackByIndex(index: number, item: any) { return this.ctx.trackByIndex(index, item); }
    addTimelineItem() { this.ctx.addTimelineItem(); }
    editTimelineItem(i: number) { this.ctx.editTimelineItem(i); }
    removeTimelineItem(i: number) { this.ctx.removeTimelineItem(i); }
    getTagLabel(tag: string) { return this.ctx.getTagLabel(tag); }
    getMediaUrl(url: string | undefined) { return this.ctx.getMediaUrl(url, 'thumbs'); }
    openViewer(med: any) { this.ctx.openViewer(med); }
    searchPlaces(i: number, place: string) { this.ctx.searchPlaces(i, place); }
    openPlaceModal(i: number) { this.ctx.openPlaceModal(i); }
    toggleExpand(i: number) { this.ctx.toggleExpand(i); }
    openMediaAddModal(i: number) { this.ctx.openMediaAddModal(i); }
    openMediaSelector(i: number) { this.ctx.openMediaSelector(i); }
    removeEventMedia(i: number, m: number) { this.ctx.removeEventMedia(i, m); }
    addEventNote(i: number) { this.ctx.addEventNote(i); }
    updateEventNote(i: number, n: number, value: string) { this.ctx.updateEventNote(i, n, value); }
    removeEventNote(i: number, n: number) { this.ctx.removeEventNote(i, n); }
    saveTimelineItem(i: number) { this.ctx.saveTimelineItem(i); }
    isTimelineItemLocked(item: any) { return this.ctx.isTimelineItemLocked(item); }
    openTimelineItemModal(i: number) { this.ctx.openTimelineItemModal(i); }
}
