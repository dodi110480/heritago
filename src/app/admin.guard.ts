import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // First check if authenticated
    if (!authService.isAuthenticated()) {
        return router.createUrlTree(['/login']);
    }

    // Then check if admin
    const user = authService.currentUser();
    if (user && user.isAdmin) {
        return true;
    }

    // Redirect to dashboard if not admin
    return router.createUrlTree(['/']);
};
