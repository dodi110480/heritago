import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { signal, effect } from '@angular/core';

@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, CommonModule],
    templateUrl: './navbar.html',
    styleUrl: './navbar.css'
})
export class Navbar {
    authService = inject(AuthService);
    private gedcomService = inject(GedcomService);
    private router = inject(Router);

    errorCount = signal<number>(0);

    constructor() {
        // Automatically fetch diagnostics when tree might have changed
        effect(() => {
            const user = this.authService.currentUser();
            if (user) {
                this.updateDiagnostics();
            }
        });
    }

    updateDiagnostics() {
        const activeTree = this.authService.currentTree();
        if (activeTree) {
            this.gedcomService.getDiagnostics(activeTree.name).subscribe({
                next: (data) => {
                    this.errorCount.set(data.count || 0);
                },
                error: () => this.errorCount.set(0)
            });
        } else {
            this.errorCount.set(0);
        }
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }

    search(event: any) {
        const query = event.target.value;
        const activeTree = this.authService.currentTree();
        if (query && activeTree) {
            this.router.navigate(['/search'], {
                queryParams: { q: query, tree: activeTree.name }
            });
        }
    }
}
