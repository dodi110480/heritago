import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [CommonModule, RouterModule, AppPageHeaderComponent],
    changeDetection: ChangeDetectionStrategy.Eager,
    templateUrl: './settings.html'
})



export class Settings {
    public authService = inject(AuthService);
}
