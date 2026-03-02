import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { unsavedChangesGuard } from './unsaved-changes.guard';
import { AppShellComponent } from './app-shell';

export const routes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./login').then(m => m.Login)
    },
    {
        path: '',
        component: AppShellComponent,
        canActivate: [authGuard],
        children: [
            {
                path: 'tree',
                loadComponent: () => import('./family-chart.component').then(m => m.FamilyChartComponent),
            },
            {
                path: 'settings',
                loadComponent: () => import('./settings').then(m => m.Settings),
            },
            {
                path: 'gedcom-io',
                loadComponent: () => import('./gedcom-io').then(m => m.GedcomIo),
            },
            {
                path: 'settings/update',
                loadComponent: () => import('./update-settings').then(m => m.UpdateSettings),
                canActivate: [adminGuard]
            },
            {
                path: 'tree-management',
                loadComponent: () => import('./tree-management').then(m => m.TreeManagement),
            },
            {
                path: 'admin/users',
                loadComponent: () => import('./user-management').then(m => m.UserManagement),
                canActivate: [adminGuard]
            },
            {
                path: 'persons',
                loadComponent: () => import('./person-list').then(m => m.PersonList),
            },
            {
                path: 'families',
                loadComponent: () => import('./family-list').then(m => m.FamilyList),
            },
            {
                path: 'family/:id',
                loadComponent: () => import('./family-detail').then(m => m.FamilyDetail),
            },
            {
                path: 'familie/:id',
                loadComponent: () => import('./family-detail').then(m => m.FamilyDetail),
            },
            {
                path: 'person/:id',
                loadComponent: () => import('./person-detail').then(m => m.PersonDetail),
                canDeactivate: [unsavedChangesGuard]
            },
            {
                path: 'places',
                loadComponent: () => import('./place-list').then(m => m.PlaceList),
            },
            {
                path: 'sources',
                loadComponent: () => import('./source-list').then(m => m.SourceList),
            },
            {
                path: 'map',
                loadComponent: () => import('./map-view').then(m => m.MapView),
            },
            {
                path: 'media',
                loadComponent: () => import('./media-gallery').then(m => m.MediaGallery),
            },
            {
                path: 'statistics',
                loadComponent: () => import('./statistics').then(m => m.StatisticsDashboard),
            },
            {
                path: 'diagnostics',
                loadComponent: () => import('./diagnostics').then(m => m.Diagnostics),
            },
            {
                path: 'testo',
                loadComponent: () => import('./testo').then(m => m.TestoComponent)
            },
            {
                path: '',
                loadComponent: () => import('./dashboard').then(m => m.Dashboard),
            }
        ]
    }
];

