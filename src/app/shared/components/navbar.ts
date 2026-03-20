import { Component, inject, ViewEncapsulation } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { TreeService } from '../../core/services/tree.service';
import { signal, effect } from '@angular/core';
import { filter } from 'rxjs/operators';


import { AnalyticsService } from '../../core/services/analytics.service';
import { AppIconComponent } from './ui/app-icon';

@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, CommonModule, AppIconComponent],
    templateUrl: './navbar.html',
    encapsulation: ViewEncapsulation.None
})
export class Navbar {
    public analyticsService = inject(AnalyticsService);
    authService = inject(AuthService);
    private treeService = inject(TreeService);
    private router = inject(Router);

    errorCount = signal<number>(0);
    warningCount = signal<number>(0);
    isMobileMenuOpen = signal<boolean>(false);

    constructor() {
        const router = inject(Router);
        // Automatically fetch diagnostics when tree might have changed
        effect(() => {
            const user = this.authService.currentUser();
            if (user) {
                this.updateDiagnostics();
            }
        });

        // Close mobile menu on navigation
        router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe(() => {
            this.isMobileMenuOpen.set(false);
        });
    }

    updateDiagnostics() {
        const activeTree = this.authService.currentTree();
        if (activeTree) {
            this.analyticsService.getDiagnosticsSummary(activeTree.name).subscribe({
                next: (data: any) => {
                    this.errorCount.set(data.errors || 0);
                    this.warningCount.set(data.warnings || 0);
                },
                error: () => {
                    this.errorCount.set(0);
                    this.warningCount.set(0);
                }
            });
        } else {
            this.errorCount.set(0);
            this.warningCount.set(0);
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

    toggleMobileMenu() {
        this.isMobileMenuOpen.update(v => !v);
    }

    closeMobileMenu() {
        this.isMobileMenuOpen.set(false);
    }
}
