import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './register.html'
})
export class Register {
    private authService = inject(AuthService);
    private router = inject(Router);

    username = '';
    email = '';
    password = '';
    confirmPassword = '';
    error = signal<string | null>(null);
    loading = signal(false);

    onSubmit() {
        if (!this.username || !this.email || !this.password) {
            this.error.set('Alle Felder sind erforderlich.');
            return;
        }

        if (this.password !== this.confirmPassword) {
            this.error.set('Die Passwörter stimmen nicht überein.');
            return;
        }

        this.loading.set(true);
        this.error.set(null);

        this.authService.register(this.username, this.email, this.password).subscribe(result => {
            this.loading.set(false);
            if (result.success) {
                this.router.navigate(['/']);
            } else {
                this.error.set(result.message || 'Registrierung fehlgeschlagen.');
            }
        });
    }
}
