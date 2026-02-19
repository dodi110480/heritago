import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, CommonModule],
    templateUrl: './navbar.html',
    styleUrl: './navbar.css'
})
export class Navbar {
    authService = inject(AuthService);
    private router = inject(Router);

    logout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }

    search(event: any) {
        const query = event.target.value;
        if (query) {
            this.router.navigate(['/search'], { queryParams: { q: query } });
        }
    }
}
