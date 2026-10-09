import { Component, inject, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { TreeService } from '../../core/services/tree.service';
import { NotificationService } from '../../core/services/notification.service';
import { signal, effect } from '@angular/core';
import { filter } from 'rxjs/operators';


import { AnalyticsService } from '../../core/services/analytics.service';
import { AppIconComponent } from './ui/app-icon';

@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, CommonModule, AppIconComponent],
    templateUrl: './navbar.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    encapsulation: ViewEncapsulation.None
})
export class Navbar {
    public analyticsService = inject(AnalyticsService);
    authService = inject(AuthService);
    notificationService = inject(NotificationService);
    private treeService = inject(TreeService);
    private router = inject(Router);

    errorCount = signal<number>(0);
    warningCount = signal<number>(0);
    isMobileMenuOpen = signal<boolean>(false);
    showNotifications = signal<boolean>(false);
    notifications = signal<any[]>([]);

    constructor() {
        const router = inject(Router);
        // Automatically fetch diagnostics when tree might have changed
        effect(() => {
            const user = this.authService.currentUser();
            if (user) {
                this.updateDiagnostics();
                this.loadNotifications();
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

    toggleNotifications() {
        this.showNotifications.update(v => !v);
        if (this.showNotifications()) {
            this.loadNotifications();
        }
    }

    loadNotifications() {
        this.notificationService.refresh().subscribe(data => this.notifications.set(data.notifications));
    }

    openNotification(n: any) {
        this.notificationService.markRead(n.id).subscribe(() => this.loadNotifications());
        if (n.type === 'CHANGE_REQUEST' && n.entityId) {
            this.router.navigate(['/change-requests'], { queryParams: { open: n.entityId } });
        }
        this.showNotifications.set(false);
    }

    markAllNotificationsRead() {
        this.notificationService.markAllRead().subscribe(() => this.loadNotifications());
    }

    closeMobileMenu() {
        this.isMobileMenuOpen.set(false);
    }
}
