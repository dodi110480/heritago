import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { Individual } from './models';
import { FormsModule } from '@angular/forms';
import { CleanDatePipe } from './clean-date.pipe';

@Component({
    selector: 'app-person-list',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule, CleanDatePipe],
    templateUrl: './person-list.html',
    styleUrl: './person-list.css'
})
export class PersonList {
    private gedcomService = inject(GedcomService);

    individuals = signal<Individual[]>([]);
    loading = signal(true);
    searchTerm = signal('');
    treeName = signal('');

    filteredIndividuals = computed(() => {
        const term = this.searchTerm().toLowerCase();
        if (!term) return this.individuals();

        return this.individuals().filter(person =>
            person.name.toLowerCase().includes(term) ||
            person.firstName?.toLowerCase().includes(term) ||
            person.lastName?.toLowerCase().includes(term) ||
            person.id.toLowerCase().includes(term)
        );
    });

    constructor() {
        this.loadPersons();
    }

    loadPersons() {
        this.loading.set(true);
        this.gedcomService.getTreeData().subscribe({
            next: (data) => {
                if (data) {
                    this.individuals.set(data.individuals);
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

    getProfileImage(person: Individual): string | null {
        if (!person.media || person.media.length === 0) return null;
        const primary = person.media.find(m => m.isPrimary) || person.media[0];
        return primary?.url ? this.gedcomService.getMediaUrl(primary.url) : null;
    }
}
