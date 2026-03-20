import { Component, input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Individual } from '../../core/models/models';
import { TabCitationsComponent } from '../../shared/components/ui/tabs/tab-citations';

@Component({
    selector: 'app-person-tab-citations',
    standalone: true,
    imports: [CommonModule, TabCitationsComponent],
    template: `
        <app-tab-citations
            [entity]="person()"
            [entityType]="'PERSON'"
            [availableSources]="availableSources()"
            (changed)="changed.emit($event)"
        ></app-tab-citations>
    `
})
export class PersonTabCitationsComponent {
    person = input.required<Individual>();
    availableSources = input<any[]>([]);
    @Output() changed = new EventEmitter<{ notes: any[]; citations: any[] }>();
}
