import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './login.html'
})
export class Login {
    private authService = inject(AuthService);
    private router = inject(Router);

    username = '';
    password = '';
    error = signal<string | null>(null);
    loading = signal(false);

    onSubmit() {
        if (!this.username || !this.password) return;

        this.loading.set(true);
        this.error.set(null);

        this.authService.login(this.username, this.password).subscribe(success => {
            this.loading.set(false);
            if (success) {
                this.checkTreesAndRedirect();
            } else {
                this.error.set('Ungültiger Benutzername oder Passwort.');
            }
        });
    }

    private checkTreesAndRedirect() {
        // Redirect to dashboard
        this.router.navigate(['/']);
    }
}
