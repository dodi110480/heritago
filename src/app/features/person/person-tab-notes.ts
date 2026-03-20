import { Component, input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Individual } from '../../core/models/models';
import { TabNotesComponent } from '../../shared/components/ui/tabs/tab-notes';

@Component({
    selector: 'app-person-tab-notes',
    standalone: true,
    imports: [CommonModule, TabNotesComponent],
    template: `
        <app-tab-notes
            [entity]="person()"
            [entityType]="'PERSON'"
            (changed)="changed.emit()"
        ></app-tab-notes>
    `
})
export class PersonTabNotesComponent {
    person = input.required<Individual>();
    @Output() changed = new EventEmitter<void>();
}
