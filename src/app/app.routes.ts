import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { unsavedChangesGuard } from './unsaved-changes.guard';

export const routes: Routes = [
    {
        path: 'tree',
        loadComponent: () => import('./family-chart.component').then(m => m.FamilyChartComponent),
        canActivate: [authGuard]
    },
    {
        path: 'login',
        loadComponent: () => import('./login').then(m => m.Login)
    },
    {
        path: 'settings',
        loadComponent: () => import('./settings').then(m => m.Settings),
        canActivate: [authGuard]
    },
    {
        path: 'gedcom-io',
        loadComponent: () => import('./gedcom-io').then(m => m.GedcomIo),
        canActivate: [authGuard]
    },
    {
        path: 'settings/update',
        loadComponent: () => import('./update-settings').then(m => m.UpdateSettings),
        canActivate: [adminGuard]
    },
    {
        path: 'tree-management',
        loadComponent: () => import('./tree-management').then(m => m.TreeManagement),
        canActivate: [authGuard]
    },
    /* old tree-selector removed */
    {
        path: 'admin/users',
        loadComponent: () => import('./user-management').then(m => m.UserManagement),
        canActivate: [adminGuard]
    },
    {
        path: 'persons',
        loadComponent: () => import('./person-list').then(m => m.PersonList),
        canActivate: [authGuard]
    },
    {
        path: 'families',
        loadComponent: () => import('./family-list').then(m => m.FamilyList),
        canActivate: [authGuard]
    },
    {
        path: 'family/:id',
        loadComponent: () => import('./family-detail').then(m => m.FamilyDetail),
        canActivate: [authGuard]
    },
    {
        path: 'familie/:id',
        loadComponent: () => import('./family-detail').then(m => m.FamilyDetail),
        canActivate: [authGuard]
    },
    {
        path: 'person/:id',
        loadComponent: () => import('./person-detail').then(m => m.PersonDetail),
        canActivate: [authGuard],
        canDeactivate: [unsavedChangesGuard]
    },
    {
        path: 'places',
        loadComponent: () => import('./place-list').then(m => m.PlaceList),
        canActivate: [authGuard]
    },
    {
        path: 'map',
        loadComponent: () => import('./map-view').then(m => m.MapView),
        canActivate: [authGuard]
    },
    {
        path: 'media',
        loadComponent: () => import('./media-gallery').then(m => m.MediaGallery),
        canActivate: [authGuard]
    },
    {
        path: 'statistics',
        loadComponent: () => import('./statistics').then(m => m.StatisticsDashboard),
        canActivate: [authGuard]
    },
    {
        path: 'diagnostics',
        loadComponent: () => import('./diagnostics').then(m => m.Diagnostics),
        canActivate: [authGuard]
    },
    {
        path: 'testo',
        loadComponent: () => import('./testo').then(m => m.TestoComponent)
    },
    {
        path: '',
        loadComponent: () => import('./dashboard').then(m => m.Dashboard),
        canActivate: [authGuard]
    }
];
