import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';

export const routes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./login').then(m => m.Login)
    },
    {
        path: 'create-tree',
        loadComponent: () => import('./create-tree').then(m => m.CreateTree),
        canActivate: [adminGuard]
    },
    {
        path: 'search',
        loadComponent: () => import('./search-results').then(m => m.SearchResults),
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
        path: 'timeline/:xref',
        loadComponent: () => import('./timeline').then(m => m.TimelineView),
        canActivate: [authGuard]
    },
    {
        path: 'tree',
        loadComponent: () => import('./tree').then(m => m.Tree),
        canActivate: [authGuard]
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
        path: 'tree-selector',
        loadComponent: () => import('./tree-selector').then(m => m.TreeSelector),
        canActivate: [authGuard]
    },
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
        path: 'places',
        loadComponent: () => import('./place-list').then(m => m.PlaceList),
        canActivate: [authGuard]
    },
    {
        path: '',
        loadComponent: () => import('./dashboard').then(m => m.Dashboard),
        canActivate: [authGuard]
    }
];
