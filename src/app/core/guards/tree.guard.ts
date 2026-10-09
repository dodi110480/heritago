import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guards tree-scoped routes: redirects to tree management when the user
 * has no active tree yet (e.g. right after registration).
 */
export const treeGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.currentTree()) {
        return true;
    }
    return router.createUrlTree(['/tree-management']);
};
