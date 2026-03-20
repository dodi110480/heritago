import { Component, inject, signal, computed, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TreeService } from '../../core/services/tree.service';
import { Individual } from '../../core/models/models';
import { FormsModule } from '@angular/forms';
import { CleanDatePipe } from '../../shared/pipes/clean-date.pipe';
import { PersonCreateModal } from './person-create-modal';
import { AppEntityCard } from '../../shared/components/ui/app-entity-card';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';
import { AppListViewComponent } from '../../shared/components/ui/app-list-view';
import { AppSearchInputComponent } from '../../shared/components/ui/app-search-input';


import { MediaService } from '../../core/services/media.service';
@Component({
    selector: 'app-person-list',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule, CleanDatePipe, PersonCreateModal, AppEntityCard, AppPageHeaderComponent, AppListViewComponent],
    templateUrl: './person-list.html',
    encapsulation: ViewEncapsulation.None
})
export class PersonList {
    public mediaService = inject(MediaService);
    private readonly FOCUS_PERSON_KEY = 'heritago_last_focus_person';
    private treeService = inject(TreeService);
    private router = inject(Router);

    individuals = signal<Individual[]>([]);
    families = signal<any[]>([]);
    loading = signal(true);
    searchTerm = signal('');
    sortMode = signal<'completion_desc' | 'first_asc' | 'last_asc' | 'family_desc'>('completion_desc');
    sortDirection = signal<'asc' | 'desc'>('desc');
    treeName = signal('');
    focusedPersonId = signal<string>(localStorage.getItem(this.FOCUS_PERSON_KEY) || '');
    isCreating = false;
    showCreateModal = signal(false);

    sortOptions = [
        { label: 'Vollständigkeit', value: 'completion_desc' },
        { label: 'Vorname (A-Z)', value: 'first_asc' },
        { label: 'Nachname (A-Z)', value: 'last_asc' },
        { label: 'Familienbezug', value: 'family_desc' }
    ];

    getAvatarUrl(person: Individual): string {
        if (!person.profileImageUrl) return '';
        return this.mediaService.getMediaUrl(person.profileImageUrl, 'thumbs');
    }

    filteredIndividuals = computed(() => {
        const term = this.searchTerm().toLowerCase();
        const base = this.individuals().filter(person => {
            if (!term) return true;
            return (
                person.name.toLowerCase().includes(term) ||
                (person.firstName || '').toLowerCase().includes(term) ||
                (person.lastName || '').toLowerCase().includes(term) ||
                person.id.toLowerCase().includes(term)
            );
        });

        return this.sortIndividuals(base);
    });

    constructor() {
        this.loadPersons();
    }

    createPerson() {
        this.showCreateModal.set(true);
    }

    onPersonCreated(event: any) {
        this.showCreateModal.set(false);
        if (event && event.person) {
            console.log('[PersonList] Person created, navigating...', event.person);
            const id = event.person.id || event.person.gedcomId;
            if (id) {
                this.rememberFocus(id);
                this.router.navigate(['/person', id]).then(success => {
                    if (!success) console.error('[PersonList] Navigation failed to /person/', id);
                });
            } else {
                this.loadPersons(); // Fallback: just refresh list
            }
        } else {
            this.loadPersons();
        }
    }

    loadPersons() {
        this.loading.set(true);
        this.treeService.getTreeData().subscribe({
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

    getLifespan(person: Individual): string {
        const birth = person.birthDate || '';
        const death = person.deathDate || '';
        if (!birth && !death) return '';
        return `${birth} - ${death}`.trim();
    }

    rememberFocus(id: string) {
        this.focusedPersonId.set(id);
        localStorage.setItem(this.FOCUS_PERSON_KEY, id);
    }

    private sortIndividuals(items: Individual[]): Individual[] {
        return [...items].sort((a, b) => this.compareBySortMode(a, b));
    }

    private compareBySortMode(a: Individual, b: Individual): number {
        const mode = this.sortMode();
        const dir = this.sortDirection() === 'asc' ? 1 : -1;
        if (mode === 'first_asc') {
            const cmp = (a.firstName || '').localeCompare(b.firstName || '') || (a.lastName || '').localeCompare(b.lastName || '');
            return cmp * dir;
        }
        if (mode === 'last_asc') {
            const cmp = (a.lastName || '').localeCompare(b.lastName || '') || (a.firstName || '').localeCompare(b.firstName || '');
            return cmp * dir;
        }
        if (mode === 'family_desc') {
            const fa = a.familyLinkCount || 0;
            const fb = b.familyLinkCount || 0;
            if (fa !== fb) return (fa - fb) * dir;
            return (a.lastName || '').localeCompare(b.lastName || '') * dir;
        }
        // default: completion
        const ca = a.completeness?.score || 0;
        const cb = b.completeness?.score || 0;
        if (ca !== cb) return (ca - cb) * dir;
        return (a.lastName || '').localeCompare(b.lastName || '') * dir;
    }

    completionFor(person: Individual): { score: number; missing: string[] } {
        return person.completeness || { score: 0, missing: [] };
    }

    completionColorClass(score: number): string {
        if (score >= 80) return 'text-accent-emerald-600';
        if (score >= 60) return 'text-accent-emerald-500';
        if (score >= 40) return 'text-accent-highlight-500';
        return 'text-accent-amber-600';
    }

    completionDotClass(score: number): string {
        if (score >= 80) return 'bg-accent-emerald-600';
        if (score >= 60) return 'bg-accent-emerald-500';
        if (score >= 40) return 'bg-accent-highlight-500';
        return 'bg-accent-amber-600';
    }

    completionCardClass(score: number): string {
        if (score >= 80) return 'bg-accent-emerald-500/10 text-accent-emerald-600 border-accent-emerald-500/20';
        if (score >= 60) return 'bg-accent-emerald-500/5 text-accent-emerald-500 border-accent-emerald-500/10';
        if (score >= 40) return 'bg-accent-highlight-500/10 text-accent-highlight-600 border-accent-highlight-500/20';
        return 'bg-accent-amber-500/10 text-accent-amber-600 border-accent-amber-500/20';
    }

    completionTooltip(person: Individual): string {
        const c = this.completionFor(person);
        if (c.missing.length === 0) return `Datenqualität: ${c.score}%\nSehr gut gepflegt.`;
        return `Datenqualität: ${c.score}%\nFehlt: ${c.missing.join(', ')}`;
    }

    toggleSortDirection() {
        this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    }
}
