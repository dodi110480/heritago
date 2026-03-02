import { Component, inject, signal, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GedcomService } from './gedcom.service';
import { AuthService } from './auth.service';
import { Individual } from './models';

@Component({
    selector: 'app-person-create-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './person-create-modal.html'
})
export class PersonCreateModal {
    private gedcomService = inject(GedcomService);
    private authService = inject(AuthService);

    @Input() visible = false;
    @Input() title = 'Neue Person anlegen';
    @Input() initialLastName = '';
    @Input() showSearch = true;

    @Output() created = new EventEmitter<any>();
    @Output() closed = new EventEmitter<void>();

    newPersonData = signal({
        firstName: '',
        lastName: '',
        gender: 'U' as 'M' | 'F' | 'X' | 'U'
    });

    isSaving = signal(false);
    searchResults = signal<Individual[]>([]);
    showResults = signal(false);

    ngOnChanges() {
        if (this.visible) {
            this.newPersonData.set({
                firstName: '',
                lastName: this.initialLastName,
                gender: 'U'
            });
            this.searchResults.set([]);
            this.showResults.set(false);
        }
    }

    updateField(field: string, value: any) {
        this.newPersonData.update(prev => ({ ...prev, [field]: value }));
    }

    search(query: string) {
        if (!query || query.length < 2) {
            this.searchResults.set([]);
            this.showResults.set(false);
            return;
        }

        const tree = this.authService.currentTree();
        if (!tree) return;

        this.gedcomService.searchIndividuals(tree.name, query).subscribe(res => {
            this.searchResults.set(res.results || []);
            this.showResults.set(true);
        });
    }

    selectExisting(person: any) {
        this.created.emit({ mode: 'existing', person });
        this.close();
    }

    save() {
        const data = this.newPersonData();
        const tree = this.authService.currentTree();
        if (!tree || !data.firstName) return;

        this.isSaving.set(true);
        const payload = {
            firstName: data.firstName,
            lastName: data.lastName,
            gender: data.gender,
            events: [],
            facts: []
        };

        this.gedcomService.savePerson(tree.name, payload).subscribe({
            next: (res: any) => {
                this.isSaving.set(false);
                if (res && res.success && res.person) {
                    this.created.emit({ mode: 'new', person: res.person });
                    this.close();
                }
            },
            error: () => {
                this.isSaving.set(false);
                alert('Fehler beim Anlegen der Person');
            }
        });
    }

    close() {
        this.closed.emit();
    }
}
