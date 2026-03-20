import { Component, inject, signal, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TreeService } from '../../core/services/tree.service';
import { AuthService } from '../../core/services/auth.service';
import { Individual } from '../../core/models/models';
import { AppModalShell } from '../../shared/components/ui/app-modal-shell';


import { PersonService } from '../../core/services/person.service';
@Component({
    selector: 'app-person-create-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, AppModalShell],
    templateUrl: './person-create-modal.html'
})
export class PersonCreateModal {
    public personService = inject(PersonService);
    private treeService = inject(TreeService);
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

        this.personService.searchIndividuals(tree.name, query).subscribe(res => {
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

        this.personService.savePerson(tree.name, payload).subscribe({
            next: (res: any) => {
                this.isSaving.set(false);
                if (res) {
                    // res is the mapped data from PersonService (either the person object or the full profile)
                    const personData = res.person || res;
                    this.created.emit({ mode: 'new', person: personData });
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
