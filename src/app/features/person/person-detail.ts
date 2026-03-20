import { Component, inject, signal, OnInit, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CleanDatePipe } from '../../shared/pipes/clean-date.pipe';
import { CanComponentDeactivate } from '../../core/guards/unsaved-changes.guard';

import { PersonFeatureStore } from './person-feature.store';
import { PersonTimelineService } from './person-timeline.service';


import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';
import { AppModalShell } from '../../shared/components/ui/app-modal-shell';

import { PersonTabMediaComponent } from './person-tab-media';
import { PersonTabNotesComponent } from './person-tab-notes';
import { PersonTabCitationsComponent } from './person-tab-citations';
import { PersonTabBasicsComponent } from './person-tab-basics';
import { PersonTabDnaComponent } from './person-tab-dna';
import { PersonTabRelationsComponent } from './person-tab-relations';
import { PersonTabTimelineComponent } from './person-tab-timeline';

@Component({
    selector: 'app-person-detail',
    standalone: true,
    providers: [PersonFeatureStore],
    imports: [
        CommonModule,
        FormsModule,
        CleanDatePipe,
        AppPageHeaderComponent,
        AppModalShell,

        PersonTabMediaComponent,
        PersonTabNotesComponent,
        PersonTabCitationsComponent,
        PersonTabBasicsComponent,

        PersonTabDnaComponent,
        PersonTabRelationsComponent,
        PersonTabTimelineComponent,
        // Media UI handled within tabs
    ],
    templateUrl: './person-detail.html',
    encapsulation: ViewEncapsulation.None
})
export class PersonDetail implements OnInit {
    public store = inject(PersonFeatureStore);
    public timelineService = inject(PersonTimelineService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    showDeleteModal = signal(false);

    ngOnInit() {
        this.route.paramMap.subscribe(params => {
            const id = params.get('id');
            if (id) {
                this.store.init(id);
            }
        });
    }

    openDeleteModal() {
        this.showDeleteModal.set(true);
    }

    closeDeleteModal() {
        this.showDeleteModal.set(false);
    }

    confirmDeletePerson() {
        this.store.deletePerson(() => {
            this.showDeleteModal.set(false);
            this.router.navigate(['/persons']);
        });
    }

    goBack() {
        this.router.navigate(['/persons']);
    }
}
