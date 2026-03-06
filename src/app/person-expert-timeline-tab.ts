import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


@Component({
    selector: 'app-person-expert-timeline-tab',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="glass-card shadow-sm flex flex-col">
            <div class="!p-4 md:!p-5">
                <div class="flex justify-between items-center mb-5">
                    <h2 class="text-xl font-semibold text-neutral-950">Lebenslauf</h2>
                    <button (click)="addTimelineItem()" class="btn-primary !w-auto !py-1.5 !px-3 text-xs">
                        + Ereignis/Fakt hinzufügen
                    </button>
                </div>

                <div
                    class="relative pl-6 space-y-4 before:absolute before:left-2 before:top-1 before:bottom-1 before:w-0.5 before:bg-canvas-white/10">
                    <div *ngFor="let item of timeline(); let i = index" class="relative group/item">
                        <div
                            class="absolute -left-[20px] top-1.5 w-3 h-3 rounded-full bg-brand-500 border-2 border-neutral-900 z-10 transition-transform group-hover/item:scale-125">
                        </div>

                        <div class="glass-card !p-3 !bg-canvas-white/5 !rounded-xl transition-all shadow-sm cursor-pointer hover:bg-canvas-white/10"
                            (click)="openTimelineItemModal(i)"
                            [class.ring-2]="item.editing" [class.ring-brand-500/50]="item.editing">
                            <div *ngIf="!item.editing" class="space-y-2">
                                <div class="flex justify-between items-start">
                                    <div class="space-y-1">
                                        <div class="text-[10px] font-bold text-neutral-800 uppercase tracking-widest">
                                            {{ getTagLabel(item.tag) }}</div>
                                        <div class="text-sm font-semibold text-neutral-950">{{ item.date || 'Kein Datum'
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
                                        <img [src]="getMediaUrl(med.url)" [alt]="med.title"
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

                            <div *ngIf="item.editing" class="space-y-6">
                                <div class="flex justify-between items-center pb-4 border-b border-canvas-white/10">
                                    <select [(ngModel)]="item.tag" class="form-input !w-auto !py-2">
                                        <optgroup label="Lebensereignisse">
                                            <option value="BIRT">Geburt</option>
                                            <option value="CHR">Taufe</option>
                                            <option value="DEAT">Tod</option>
                                            <option value="BURI">Begräbnis</option>
                                            <option value="CREM">Einäscherung</option>
                                            <option value="EMIG">Auswanderung</option>
                                            <option value="IMMI">Einwanderung</option>
                                        </optgroup>
                                        <optgroup label="Eigenschaften & Fakten">
                                            <option value="OCCU">Beruf</option>
                                            <option value="RELI">Religion</option>
                                            <option value="EDUC">Bildung</option>
                                            <option value="RESI">Wohnsitz</option>
                                            <option value="TITL">Titel</option>
                                            <option value="NATI">Nationalität/Herkunft</option>
                                            <option value="DSCR">Körperl. Merkmale</option>
                                            <option value="FACT">Anderer Fakt</option>
                                        </optgroup>
                                    </select>
                                    <button (click)="removeTimelineItem(i)"
                                        class="p-2 rounded-lg bg-accent-danger-500/10 text-accent-danger-400 hover:bg-accent-danger-500/20 transition-all">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                            stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path
                                                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2">
                                            </path>
                                            <line x1="10" y1="11" x2="10" y2="17"></line>
                                            <line x1="14" y1="11" x2="14" y2="17"></line>
                                        </svg>
                                    </button>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div class="form-group mb-0">
                                        <label class="form-label">Datum / Zeitraum</label>
                                        <input type="text" [(ngModel)]="item.date" placeholder="z.B. 1980-04-11"
                                            class="form-input">
                                    </div>
                                    <div class="form-group mb-0 relative">
                                        <label class="form-label">Ort</label>
                                        <div class="flex gap-2">
                                            <input type="text" [(ngModel)]="item.place"
                                                (input)="searchPlaces(i, item.place!)"
                                                (focus)="searchPlaces(i, item.place!)"
                                                placeholder="z.B. Lichtenfels" class="form-input">
                                            <button (click)="openPlaceModal(i)"
                                                class="btn-secondary !w-auto !py-2 !px-3 !text-[10px]">Neu</button>
                                        </div>
                                    </div>
                                    <div class="md:col-span-2 form-group mb-0">
                                        <label class="form-label">Beschreibung / Wert</label>
                                        <input
                                            *ngIf="['OCCU', 'EDUC', 'RELI', 'RESI', 'TITL', 'NATI', 'DSCR', 'FACT'].includes(item.tag)"
                                            type="text" [(ngModel)]="item.value" placeholder="z.B. Beruf, Titel..."
                                            class="form-input">
                                        <input
                                            *ngIf="!['OCCU', 'EDUC', 'RELI', 'RESI', 'TITL', 'NATI', 'DSCR', 'FACT'].includes(item.tag)"
                                            type="text" [(ngModel)]="item.description" placeholder="Zusätzliche Notiz"
                                            class="form-input">
                                    </div>
                                </div>

                                <div class="space-y-4 pt-4 border-t border-canvas-white/5">
                                    <button (click)="toggleExpand(i)"
                                        class="text-[10px] font-bold text-neutral-400 hover:text-canvas-white uppercase tracking-widest transition-colors flex items-center gap-1.5">
                                        <span class="text-xs">{{ item.expanded ? '▼' : '▶' }}</span>
                                        {{ item.expanded ? 'Weniger anzeigen' : 'Erweitert (Quellen, Medien, Notizen)...' }}
                                    </button>

                                    <div *ngIf="item.expanded"
                                        class="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div *ngIf="item.originalType === 'event'" class="space-y-4">
                                            <div class="flex justify-between items-center">
                                                <h4 class="text-sm font-semibold text-neutral-300">Medien zum Ereignis
                                                </h4>
                                                <div class="flex gap-2">
                                                    <button (click)="openMediaAddModal(i)"
                                                        class="px-3 py-1.5 bg-canvas-white/5 hover:bg-canvas-white/10 text-canvas-white text-[10px] font-bold uppercase rounded-lg border border-canvas-white/5 transition-all">+
                                                        Upload</button>
                                                    <button (click)="openMediaSelector(i)"
                                                        class="px-3 py-1.5 bg-canvas-white/5 hover:bg-canvas-white/10 text-canvas-white text-[10px] font-bold uppercase rounded-lg border border-canvas-white/5 transition-all">Galerie</button>
                                                </div>
                                            </div>
                                            <div *ngIf="item.media && item.media.length > 0"
                                                class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <div *ngFor="let med of item.media; let mIndex = index"
                                                    class="relative group/media glass-card !bg-neutral-black/20 !rounded-xl overflow-hidden flex flex-col">
                                                    <div (click)="openViewer(med)" class="aspect-square cursor-pointer shrink-0">
                                                        <img [src]="getMediaUrl(med.url)" [alt]="med.title"
                                                            class="w-full h-full object-cover">
                                                    </div>
                                                    <div class="p-3 space-y-2 flex-1 flex flex-col justify-between">
                                                        <div class="space-y-2">
                                                            <input type="text" [(ngModel)]="med.title"
                                                                placeholder="Titel..."
                                                                class="w-full bg-canvas-white/5 border border-canvas-white/5 rounded px-2 py-1.5 text-[10px] sm:text-xs text-canvas-white focus:outline-none">
                                                            <select [(ngModel)]="med.role"
                                                                class="w-full form-select !py-1 !px-2 !text-[10px] bg-canvas-white/5 border-canvas-white/10 text-neutral-300">
                                                                <option value="">(Keine Rolle)</option>
                                                                <option value="PORTRAIT">Portrait</option>
                                                                <option value="DOCUMENT">Dokument</option>
                                                                <option value="CERTIFICATE">Urkunde</option>
                                                                <option value="GRAVESTONE">Grabstein</option>
                                                                <option value="SIGNATURE">Unterschrift</option>
                                                                <option value="OTHER">Sonstiges</option>
                                                            </select>
                                                            <input type="text" [(ngModel)]="med.caption"
                                                                placeholder="Bildunterschrift / Quelle..."
                                                                class="w-full form-input !py-1 !text-[10px] bg-canvas-white/5 border-canvas-white/10 text-neutral-300 placeholder:text-neutral-600">
                                                        </div>
                                                        <button (click)="removeEventMedia(i, mIndex)"
                                                            class="w-full mt-2 py-1.5 text-[10px] font-bold text-accent-danger-400 bg-accent-danger-500/5 hover:bg-accent-danger-500/10 rounded-lg transition-colors uppercase border border-accent-danger-500/10">Entfernen</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="space-y-3">
                                            <div class="flex justify-between items-center">
                                                <h4 class="text-sm font-semibold text-neutral-300 flex items-center gap-1.5">
                                                    📖 Quellenbelege
                                                    <span *ngIf="item.citations?.length"
                                                        class="text-xs bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full">
                                                        {{ item.citations?.length }}
                                                    </span>
                                                </h4>
                                                <button (click)="addEventCitation(i)"
                                                    class="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg border border-emerald-500/20 transition-all flex items-center gap-1">
                                                    + Beleg
                                                </button>
                                            </div>

                                            <p *ngIf="!item.citations?.length" class="text-xs text-neutral-950 italic">
                                                Noch kein Quellbeleg für dieses Ereignis.
                                            </p>

                                            <div *ngIf="item.citations && item.citations.length > 0" class="space-y-2">
                                                <div *ngFor="let cit of item.citations; let cIndex = index"
                                                    class="bg-surface-darkest/60 border border-canvas-white/5 rounded-xl p-3 space-y-2.5">
                                                    <div class="flex gap-2 items-center">
                                                        <select [(ngModel)]="cit.sourceId"
                                                            class="flex-1 bg-surface-dark border border-surface-light rounded-lg px-2.5 py-1.5 text-xs text-canvas-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 min-w-0">
                                                            <option value="">— Quelle wählen —</option>
                                                            <option *ngFor="let s of availableSources()" [value]="s.id">
                                                                {{ s.title }}{{ s.author ? ' · ' + s.author : '' }}
                                                            </option>
                                                        </select>
                                                        <button (click)="removeEventCitation(i, cIndex)"
                                                            class="p-1.5 text-neutral-950 hover:text-accent-danger-400 hover:bg-accent-danger-500/10 rounded-lg transition-all shrink-0"
                                                            title="Beleg entfernen">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14"
                                                                height="14" viewBox="0 0 24 24" fill="none"
                                                                stroke="currentColor" stroke-width="2.5">
                                                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                                                <line x1="6" y1="6" x2="18" y2="18"></line>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                    <div class="grid grid-cols-2 gap-2">
                                                        <input type="text" [(ngModel)]="cit.page"
                                                            placeholder="Fundstelle / Seite / Nr."
                                                            class="bg-surface-dark border border-surface-light rounded-lg px-2.5 py-1.5 text-xs text-canvas-white placeholder-neutral-950 focus:outline-none focus:ring-1 focus:ring-brand-500">
                                                        <select [(ngModel)]="cit.confidence"
                                                            class="bg-surface-dark border border-surface-light rounded-lg px-2.5 py-1.5 text-xs text-canvas-white focus:outline-none focus:ring-1 focus:ring-brand-500">
                                                            <option value="">Konfidenz wählen</option>
                                                            <option value="CERTAIN">✅ Sicher</option>
                                                            <option value="VERY_LIKELY">🟩 Sehr wahrscheinlich</option>
                                                            <option value="LIKELY">🟨 Wahrscheinlich</option>
                                                            <option value="POSSIBLE">🟧 Möglich</option>
                                                            <option value="UNLIKELY">🟥 Unwahrscheinlich</option>
                                                        </select>
                                                    </div>
                                                    <input type="text" [(ngModel)]="cit.text"
                                                        placeholder="Zitierter Ausschnitt (optional)..."
                                                        class="w-full bg-surface-dark border border-surface-light rounded-lg px-2.5 py-1.5 text-xs text-canvas-white placeholder-neutral-950 focus:outline-none focus:ring-1 focus:ring-brand-500">
                                                </div>
                                            </div>
                                        </div>

                                        <div class="space-y-4">
                                            <div class="flex justify-between items-center">
                                                <h4 class="text-sm font-semibold text-neutral-300">Notizen</h4>
                                                <button (click)="addEventNote(i)"
                                                    class="px-3 py-1.5 bg-canvas-white/5 hover:bg-canvas-white/10 text-canvas-white text-[10px] font-bold uppercase rounded-lg border border-canvas-white/5 transition-all">+
                                                    Notiz</button>
                                            </div>
                                            <div *ngFor="let note of item.notes; let nIndex = index; trackBy: trackByIndex"
                                                class="flex gap-2">
                                                <textarea [ngModel]="note"
                                                    (ngModelChange)="updateEventNote(i, nIndex, $event)"
                                                    placeholder="Anmerkung..."
                                                    class="flex-1 min-h-[80px] bg-canvas-white/5 border border-canvas-white/5 rounded-xl p-3 text-xs text-canvas-white focus:ring-1 focus:ring-brand-500/50 outline-none"></textarea>
                                                <button (click)="removeEventNote(i, nIndex)"
                                                    class="p-2 text-accent-danger-500 self-start">✕</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="flex justify-end pt-4 border-t border-canvas-white/10">
                                    <button (click)="saveTimelineItem(i)"
                                        class="px-6 py-2 bg-brand-500 hover:bg-brand-600 text-canvas-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all">
                                        Speichern
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div *ngIf="timeline().length === 0"
                    class="py-12 flex flex-col items-center justify-center border-2 border-dashed border-canvas-white/5 rounded-3xl text-neutral-950">
                    <span class="text-4xl mb-3 opacity-20">📅</span>
                    <p class="font-medium">Keine Einträge im Lebenslauf vorhanden.</p>
                </div>
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
    getMediaUrl(url: string | undefined) { return this.ctx.getMediaUrl(url); }
    openViewer(med: any) { this.ctx.openViewer(med); }
    searchPlaces(i: number, place: string) { this.ctx.searchPlaces(i, place); }
    openPlaceModal(i: number) { this.ctx.openPlaceModal(i); }
    toggleExpand(i: number) { this.ctx.toggleExpand(i); }
    openMediaAddModal(i: number) { this.ctx.openMediaAddModal(i); }
    openMediaSelector(i: number) { this.ctx.openMediaSelector(i); }
    removeEventMedia(i: number, m: number) { this.ctx.removeEventMedia(i, m); }
    addEventCitation(i: number) { this.ctx.addEventCitation(i); }
    removeEventCitation(i: number, c: number) { this.ctx.removeEventCitation(i, c); }
    addEventNote(i: number) { this.ctx.addEventNote(i); }
    updateEventNote(i: number, n: number, value: string) { this.ctx.updateEventNote(i, n, value); }
    removeEventNote(i: number, n: number) { this.ctx.removeEventNote(i, n); }
    saveTimelineItem(i: number) { this.ctx.saveTimelineItem(i); }
    isTimelineItemLocked(item: any) { return this.ctx.isTimelineItemLocked(item); }
    openTimelineItemModal(i: number) { this.ctx.openTimelineItemModal(i); }
}
