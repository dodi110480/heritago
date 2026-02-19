import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
    selector: 'app-create-tree',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './create-tree.html',
    styleUrl: './create-tree.css'
})
export class CreateTree {
    private authService = inject(AuthService);
    private router = inject(Router);

    name = '';
    title = '';
    firstName = '';
    lastName = '';
    gender = 'M';
    birthDate = '';

    error = signal<string | null>(null);
    loading = signal(false);

    onSubmit() {
        if (!this.name || !this.title || !this.firstName || !this.lastName) {
            this.error.set('Bitte fülle alle Pflichtfelder aus.');
            return;
        }

        this.loading.set(true);
        this.error.set(null);

        // Ensure name follows common ID rules (lowercase, no spaces)
        const normalizedName = this.name.toLowerCase().replace(/[^a-z0-9]/g, '');

        this.authService.createTree(normalizedName, this.title, this.firstName, this.lastName, this.gender, this.birthDate).subscribe(result => {
            this.loading.set(false);
            if (result.success) {
                this.router.navigate(['/tree']);
            } else {
                this.error.set(result.message || 'Fehler beim Erstellen des Stammbaums. Vielleicht existiert der Name schon?');
            }
        });
    }
}
