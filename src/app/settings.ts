import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from './auth.service';
import { AppPageContainerComponent } from './ui/app-page-container';
import { AppPageHeaderComponent } from './ui/app-page-header';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [CommonModule, RouterModule, AppPageContainerComponent, AppPageHeaderComponent],
    templateUrl: './settings.html'
})



export class Settings {
    public authService = inject(AuthService);
}
