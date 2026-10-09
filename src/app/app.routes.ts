import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { treeGuard } from './core/guards/tree.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';
import { AppShellComponent } from './shared/components/app-shell';

export const routes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./features/auth/login').then(m => m.Login)
    },
    {
        path: 'register',
        loadComponent: () => import('./features/auth/register').then(m => m.Register)
    },
    {
        path: 'verify-email',
        loadComponent: () => import('./features/auth/verify-email').then(m => m.VerifyEmail)
    },
    {
        path: 'forgot-password',
        loadComponent: () => import('./features/auth/forgot-password').then(m => m.ForgotPassword)
    },
    {
        path: 'reset-password',
        loadComponent: () => import('./features/auth/reset-password').then(m => m.ResetPassword)
    },
    {
        path: '',
        component: AppShellComponent,
        canActivate: [authGuard],
        children: [
            {
                path: 'tree',
                canActivate: [treeGuard],
                loadComponent: () => import('./features/family/family-chart.component').then(m => m.FamilyChartComponent),
                data: { wide: true, breadcrumb: 'Stammbaum' }
            },
            {
                path: 'settings',
                loadComponent: () => import('./features/system/settings').then(m => m.Settings),
                data: { wide: true }
            },
            {
                path: 'gedcom-io',
                loadComponent: () => import('./features/system/gedcom-io').then(m => m.GedcomIo),
                data: { wide: true }
            },
            {
                path: 'settings/update',
                loadComponent: () => import('./features/system/update-settings').then(m => m.UpdateSettings),
                canActivate: [adminGuard]
            },
            {
                path: 'tree-management',
                loadComponent: () => import('./features/system/tree-management').then(m => m.TreeManagement),
                data: { wide: true }
            },
            {
                path: 'admin/users',
                loadComponent: () => import('./features/system/user-management').then(m => m.UserManagement),
                canActivate: [adminGuard],
                data: { wide: true }
            },
            {
                path: 'admin/trees',
                loadComponent: () => import('./features/system/tree-administration').then(m => m.TreeAdministration),
                canActivate: [adminGuard],
                data: { wide: true }
            },
            {
                path: 'change-requests',
                loadComponent: () => import('./features/change-requests/change-requests').then(m => m.ChangeRequests),
                data: { wide: true }
            },
            {
                path: 'persons',
                canActivate: [treeGuard],
                loadComponent: () => import('./features/person/person-list').then(m => m.PersonList),
                data: { wide: true, breadcrumb: 'Personen' }
            },
            {
                path: 'families',
                canActivate: [treeGuard],
                loadComponent: () => import('./features/family/family-list').then(m => m.FamilyList),
                data: { wide: true, breadcrumb: 'Familien' }
            },
            {
                path: 'family/:id',
                canActivate: [treeGuard],
                loadComponent: () => import('./features/family/family-detail').then(m => m.FamilyDetail),
                data: { wide: true, breadcrumb: 'Details' }
            },
            {
                path: 'familie/:id',
                canActivate: [treeGuard],
                loadComponent: () => import('./features/family/family-detail').then(m => m.FamilyDetail),
                data: { wide: true, breadcrumb: 'Details' }
            },
            {
                path: 'person/:id',
                canActivate: [treeGuard],
                loadComponent: () => import('./features/person/person-detail').then(m => m.PersonDetail),
                data: { wide: true, breadcrumb: 'Details' }
            },
            {
                path: 'places',
                canActivate: [treeGuard],
                loadComponent: () => import('./features/places/place-list').then(m => m.PlaceList),
                data: { wide: true, breadcrumb: 'Orte' }
            },
            {
                path: 'sources',
                canActivate: [treeGuard],
                loadComponent: () => import('./features/sources/source-list').then(m => m.SourceList),
                data: { wide: true, breadcrumb: 'Quellen' }
            },
            {
                path: 'map',
                canActivate: [treeGuard],
                loadComponent: () => import('./features/places/map-view').then(m => m.MapView),
                data: { wide: true, breadcrumb: 'Karte' }
            },
            {
                path: 'media',
                canActivate: [treeGuard],
                loadComponent: () => import('./features/media/media-gallery').then(m => m.MediaGallery),
                data: { wide: true, breadcrumb: 'Medien' }
            },
            {
                path: 'statistics',
                canActivate: [treeGuard],
                loadComponent: () => import('./features/analytics/statistics').then(m => m.StatisticsDashboard),
                data: { wide: true, breadcrumb: 'Statistiken' }
            },
            {
                path: 'activity',
                canActivate: [treeGuard],
                loadComponent: () => import('./features/dashboard/activity-feed').then(m => m.ActivityFeed),
                data: { wide: true, breadcrumb: 'Aktivitäten' }
            },
            {
                path: 'diagnostics',
                canActivate: [treeGuard],
                loadComponent: () => import('./features/analytics/diagnostics').then(m => m.Diagnostics),
                data: { wide: true }
            },
            {
                path: '',
                loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard),
                data: { wide: true }
            }
        ]
    }
];

