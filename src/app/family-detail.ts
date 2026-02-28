import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { Individual, Family } from './models';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from './auth.service';

@Component({
    selector: 'app-family-detail',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './family-detail.html',
    styleUrl: './family-detail.css'
})
export class FamilyDetail implements OnInit, OnDestroy {
    private gedcomService = inject(GedcomService);
    private authService = inject(AuthService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    familyId = signal<string | null>(null);
    family = signal<Family | null>(null);
    individuals = signal<Individual[]>([]);
    loading = signal(true);
    isDirty = signal(false);
    isSaving = signal(false);

    private sub = new Subscription();

    ngOnInit() {
        this.sub.add(
            this.route.params.subscribe(params => {
                this.familyId.set(params['id']);
                this.loadData();
            })
        );
    }

    ngOnDestroy() {
        this.sub.unsubscribe();
    }

    loadData() {
        this.loading.set(true);
        this.gedcomService.getTreeData().subscribe({
            next: (data) => {
                if (data) {
                    this.individuals.set(data.individuals);
                    const fam = data.families.find(f => f.id === this.familyId());
                    if (fam) {
                        const clonedFam = JSON.parse(JSON.stringify(fam));
                        // Normalize events
                        if (clonedFam.events) {
                            clonedFam.events.forEach((e: any) => {
                                if (!e.dateText && e.date) e.dateText = e.date;
                                if (!e.place && e.placeName) e.place = e.placeName;
                                if (!e.subType && e.eventSubtype) e.subType = e.eventSubtype;
                                if (!Array.isArray(e.media)) e.media = [];
                                if (!Array.isArray(e.notes)) e.notes = [];
                                if (!Array.isArray(e.citations)) e.citations = [];
                            });
                        }
                        this.family.set(clonedFam);
                    } else {
                        // Handle not found
                        this.router.navigate(['/families']);
                    }
                }
                this.loading.set(false);
            },
            error: () => this.loading.set(false)
        });
    }

    getPersonById(id: string | undefined): Individual | undefined {
        if (!id) return undefined;
        return this.individuals().find(i => i.id === id);
    }

    getPersonName(id: string | undefined): string {
        const p = this.getPersonById(id);
        if (!p) return 'Unbekannt';
        return `${p.firstName} ${p.lastName}`;
    }

    getPersonImage(id: string | undefined): string {
        const p = this.getPersonById(id);
        if (!p) return 'assets/avatars/unknown.svg';
        if (p.media && p.media.length > 0) {
            const primary = p.media.find(m => m.isPrimary) || p.media[0];
            if (primary?.url) return this.gedcomService.getMediaUrl(primary.url);
        }
        const gender = p.gender === 'M' ? 'male' : (p.gender === 'F' ? 'female' : 'unknown');
        return `assets/avatars/${gender}.svg`;
    }

    getPersonGender(id: string | undefined): string {
        const p = this.getPersonById(id);
        return p?.gender || 'U';
    }

    getMarriageInfo(): string {
        const fam = this.family();
        if (!fam || !fam.events) return '';
        const marr = fam.events.find(e => e.type === 'MARR');
        if (!marr) return '';
        const date = marr.date || (marr as any).dateText || '';
        const place = marr.place || (marr as any).placeName || '';
        return date + (place ? ` in ${place}` : '');
    }

    addEvent() {
        const fam = this.family();
        if (!fam) return;
        if (!fam.events) fam.events = [];
        fam.events.push({
            type: 'MARR',
            subType: '',
            dateText: '',
            place: '',
            isPrimary: false
        });
        this.isDirty.set(true);
    }

    removeEvent(index: number) {
        const fam = this.family();
        if (!fam || !fam.events) return;
        fam.events.splice(index, 1);
        this.isDirty.set(true);
    }

    updateEvent() {
        const fam = this.family();
        if (fam?.events) {
            for (const ev of fam.events) {
                if (ev.type !== 'MARR') {
                    ev.subType = '';
                }
                if (!ev.media) ev.media = [];
                if (!ev.notes) ev.notes = [];
                if (!ev.citations) ev.citations = [];
            }
        }
        this.isDirty.set(true);
    }

    addEventMedia(eventIndex: number) {
        const fam = this.family();
        const event = fam?.events?.[eventIndex];
        if (!event) return;
        event.media = event.media || [];
        event.media.push({ url: '', title: '', isPrimary: false });
        this.isDirty.set(true);
    }

    removeEventMedia(eventIndex: number, mediaIndex: number) {
        const fam = this.family();
        const event = fam?.events?.[eventIndex];
        if (!event?.media) return;
        event.media.splice(mediaIndex, 1);
        this.isDirty.set(true);
    }

    addEventNote(eventIndex: number) {
        const fam = this.family();
        const event = fam?.events?.[eventIndex];
        if (!event) return;
        event.notes = event.notes || [];
        event.notes.push('');
        this.isDirty.set(true);
    }

    updateEventNote(eventIndex: number, noteIndex: number, value: string) {
        const fam = this.family();
        const event = fam?.events?.[eventIndex];
        if (!event?.notes) return;
        event.notes[noteIndex] = value;
        this.isDirty.set(true);
    }

    removeEventNote(eventIndex: number, noteIndex: number) {
        const fam = this.family();
        const event = fam?.events?.[eventIndex];
        if (!event?.notes) return;
        event.notes.splice(noteIndex, 1);
        this.isDirty.set(true);
    }

    addEventCitation(eventIndex: number) {
        const fam = this.family();
        const event = fam?.events?.[eventIndex];
        if (!event) return;
        event.citations = event.citations || [];
        event.citations.push({ sourceId: '', sourceTitle: '', quality: 2, whereInSource: '', text: '' });
        this.isDirty.set(true);
    }

    removeEventCitation(eventIndex: number, citationIndex: number) {
        const fam = this.family();
        const event = fam?.events?.[eventIndex];
        if (!event?.citations) return;
        event.citations.splice(citationIndex, 1);
        this.isDirty.set(true);
    }

    isImage(media: any): boolean {
        const mime = (media?.mimeType || '').toLowerCase();
        const url = (media?.url || '').toLowerCase();
        return mime.startsWith('image/')
            || url.endsWith('.jpg')
            || url.endsWith('.jpeg')
            || url.endsWith('.png')
            || url.endsWith('.gif')
            || url.endsWith('.webp')
            || url.endsWith('.svg');
    }

    getMediaUrl(url: string | undefined): string {
        return this.gedcomService.getMediaUrl(url);
    }

    addChild() {
        const fam = this.family();
        if (!fam) return;
        if (!fam.children) fam.children = [];

        const query = (prompt('Kind-ID oder Name eingeben:') || '').trim();
        if (!query) return;

        const normalizedQuery = query.toLowerCase();
        const existing = new Set<string>([
            ...(fam.children || []),
            fam.husband || '',
            fam.wife || ''
        ].filter(Boolean));

        const candidates = this.individuals().filter(p => {
            const id = (p.id || '').toLowerCase();
            const name = `${p.firstName || ''} ${p.lastName || ''}`.trim().toLowerCase();
            return id === normalizedQuery || name.includes(normalizedQuery);
        });

        if (candidates.length === 0) {
            alert('Keine passende Person gefunden.');
            return;
        }

        let selected = candidates[0];
        if (candidates.length > 1) {
            const options = candidates
                .slice(0, 10)
                .map(c => `${c.id}: ${(c.firstName || '')} ${(c.lastName || '')}`.trim())
                .join('\n');
            const selectedId = (prompt(`Mehrere Treffer gefunden. Bitte ID wählen:\n${options}`) || '').trim();
            if (!selectedId) return;
            const match = candidates.find(c => c.id === selectedId);
            if (!match) {
                alert('Ungültige ID-Auswahl.');
                return;
            }
            selected = match;
        }

        if (existing.has(selected.id)) {
            alert('Diese Person ist bereits in der Familie verknüpft.');
            return;
        }

        fam.children.push(selected.id);
        this.isDirty.set(true);
    }

    removeChild(childId: string) {
        const fam = this.family();
        if (!fam || !fam.children) return;
        fam.children = fam.children.filter(id => id !== childId);
        this.isDirty.set(true);
    }

    save() {
        const fam = this.family();
        const tree = this.authService.currentTree();
        if (!fam || !tree || this.isSaving()) return;

        this.isSaving.set(true);
        this.gedcomService.saveFamily(tree.name, fam).subscribe({
            next: (res) => {
                this.isDirty.set(false);
                this.isSaving.set(false);
                if (res.family?.deleted) {
                    this.router.navigate(['/families']);
                } else {
                    this.loadData();
                }
            },
            error: (err) => {
                this.isSaving.set(false);
                alert(err?.error?.message || 'Speichern der Familie fehlgeschlagen.');
            }
        });
    }

    cancel() {
        if (this.isDirty()) {
            if (confirm('Ungespeicherte Änderungen verwerfen?')) {
                this.router.navigate(['/families']);
            }
        } else {
            this.router.navigate(['/families']);
        }
    }
}
