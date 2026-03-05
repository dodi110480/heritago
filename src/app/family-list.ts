import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { Individual, Family, TreeData } from './models';
import { FormsModule } from '@angular/forms';
import { AppEntityCard } from './ui/app-entity-card';
import { AppPageHeaderComponent } from './ui/app-page-header';
import { AppPageContainerComponent } from './ui/app-page-container';

@Component({
    selector: 'app-family-list',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, AppEntityCard, AppPageHeaderComponent, AppPageContainerComponent],
    templateUrl: './family-list.html'
})
export class FamilyList implements OnInit {
    private gedcomService = inject(GedcomService);
    private router = inject(Router);

    individuals = signal<Individual[]>([]);
    families = signal<Family[]>([]);
    loading = signal(true);
    searchTerm = signal('');
    sortMode = signal<'date_desc' | 'children_desc' | 'names_asc'>('date_desc');
    treeName = signal('');

    filteredFamilies = computed(() => {
        const term = this.searchTerm().toLowerCase();
        const base = this.families().filter(fam => {
            if (!term) return true;
            const h = this.getPersonById(fam.husband);
            const w = this.getPersonById(fam.wife);
            const hName = h ? (h.firstName + ' ' + h.lastName).toLowerCase() : '';
            const wName = w ? (w.firstName + ' ' + w.lastName).toLowerCase() : '';
            return hName.includes(term) || wName.includes(term) || fam.id.toLowerCase().includes(term);
        });

        return this.sortFamilies(base);
    });

    ngOnInit() {
        this.loadData();
    }

    loadData() {
        this.loading.set(true);
        this.gedcomService.getTreeData().subscribe({
            next: (data) => {
                if (data) {
                    this.individuals.set(data.individuals);
                    this.families.set(data.families || []);
                    this.treeName.set(data.meta?.tree || '');
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
        return p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unbekannt';
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

    getFamilyImage(fam: Family): string {
        // Use husband's image, if not available use wife's, if not available return unknown
        if (fam.husband) {
            const img = this.getPersonImage(fam.husband);
            if (!img.includes('unknown.svg')) return img;
        }
        if (fam.wife) {
            const img = this.getPersonImage(fam.wife);
            if (!img.includes('unknown.svg')) return img;
        }
        return 'assets/avatars/unknown.svg';
    }

    getPersonGender(id: string | undefined): string {
        const p = this.getPersonById(id);
        return p?.gender || 'U';
    }

    getMarriageInfo(fam: Family): string {
        if (!fam.events) return '';
        const marr = fam.events.find(e => e.type === 'MARR');
        if (!marr) return '';
        const date = marr.date || (marr as any).dateText || '';
        const place = marr.place || (marr as any).placeName || '';
        return date + (place ? ` in ${place}` : '');
    }

    getMarriageSubtypeLabels(fam: Family): string[] {
        const marrEvents = (fam.events || []).filter(e => e.type === 'MARR');
        const labels = marrEvents
            .map((e: any) => this.mapMarriageSubtypeLabel((e.subType || '').toString()))
            .filter((x): x is string => x !== null);
        return Array.from(new Set(labels));
    }

    private mapMarriageSubtypeLabel(value: string): string | null {
        const v = value.trim().toUpperCase();
        if (!v) return null;
        if (v === 'CIVIL') return 'Standesamtlich';
        if (v === 'RELIGIOUS') return 'Kirchlich';
        return null;
    }

    getFamilyStatusIcon(fam: Family): string {
        const status = this.getFamilyStatusType(fam);
        if (status === 'DIV' || status === 'DIVF') return '💔';
        if (status === 'ANUL') return '⚖️';
        if (status === 'ENGA') return '💞';
        if (status === 'MARR' || status === 'MARB' || status === 'MARC' || status === 'MARS') return '💍';
        return '🤝';
    }

    getFamilyStatusLabel(fam: Family): string {
        const status = this.getFamilyStatusType(fam);
        if (status === 'DIV') return 'Status: Geschieden';
        if (status === 'DIVF') return 'Status: Scheidungsantrag';
        if (status === 'ANUL') return 'Status: Annulliert';
        if (status === 'ENGA') return 'Status: Verlobt';
        if (status === 'MARR') return 'Status: Verheiratet';
        if (status === 'MARB') return 'Status: Aufgebot';
        if (status === 'MARC') return 'Status: Ehevertrag';
        if (status === 'MARS') return 'Status: Zivile Eheschliessung';
        return 'Status: Partnerschaft/Familie';
    }

    private getFamilyStatusType(fam: Family): string {
        const tags = (fam.events || []).map(e => (e.type || '').toUpperCase());

        // Priority: ended states first, then engaged, then marriage states.
        if (tags.includes('DIV')) return 'DIV';
        if (tags.includes('DIVF')) return 'DIVF';
        if (tags.includes('ANUL')) return 'ANUL';
        if (tags.includes('ENGA')) return 'ENGA';
        if (tags.includes('MARR')) return 'MARR';
        if (tags.includes('MARS')) return 'MARS';
        if (tags.includes('MARC')) return 'MARC';
        if (tags.includes('MARB')) return 'MARB';
        return 'UNKNOWN';
    }

    private sortFamilies(fams: Family[]): Family[] {
        const mode = this.sortMode();
        return [...fams].sort((a, b) => {
            if (mode === 'children_desc') {
                return (b.children?.length || 0) - (a.children?.length || 0);
            } else if (mode === 'names_asc') {
                const nameA = this.getPersonName(a.husband) + this.getPersonName(a.wife);
                const nameB = this.getPersonName(b.husband) + this.getPersonName(b.wife);
                return nameA.localeCompare(nameB);
            } else {
                // date_desc
                const dateA = this.getMarriageDate(a);
                const dateB = this.getMarriageDate(b);
                return dateB.getTime() - dateA.getTime();
            }
        });
    }

    private getMarriageDate(fam: Family): Date {
        const marr = fam.events?.find(e => e.type === 'MARR');
        const dateStr = marr?.date || (marr as any)?.dateText;
        return this.parseToComparableDate(dateStr);
    }

    private parseToComparableDate(dateStr: string | undefined): Date {
        if (!dateStr) return new Date(9999, 11, 31);

        const months: { [key: string]: number } = {
            'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
            'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
        };

        const dmy = dateStr.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i);
        if (dmy) {
            const m = months[dmy[2].toUpperCase()];
            if (m !== undefined) return new Date(parseInt(dmy[3]), m, parseInt(dmy[1]));
        }

        const my = dateStr.match(/([A-Z]{3})\s+(\d{4})/i);
        if (my) {
            const m = months[my[1].toUpperCase()];
            if (m !== undefined) return new Date(parseInt(my[2]), m, 1);
        }

        const y = dateStr.match(/(\d{4})/);
        if (y) return new Date(parseInt(y[1]), 0, 1);

        const anyDate = new Date(dateStr);
        return isNaN(anyDate.getTime()) ? new Date(9999, 11, 31) : anyDate;
    }

    goToPerson(id: string | undefined) {
        if (id) this.router.navigate(['/person', id]);
    }

    getChildrenTooltip(fam: Family): string {
        if (!fam.children || fam.children.length === 0) return '';
        const count = fam.children.length;
        const names = fam.children.map(id => this.getPersonName(id)).join(', ');
        return `${count} ${count === 1 ? 'Kind' : 'Kinder'}: ${names}`;
    }
}
