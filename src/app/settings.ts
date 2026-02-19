import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './settings.html',
    styleUrl: './settings.css'
})
export class Settings {
    public authService = inject(AuthService);
}
