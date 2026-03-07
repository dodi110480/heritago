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
        path: 'register',
        loadComponent: () => import('./register').then(m => m.Register)
    },
    {
        path: '',
        component: AppShellComponent,
        canActivate: [authGuard],
        children: [
            {
                path: 'tree',
                loadComponent: () => import('./family-chart.component').then(m => m.FamilyChartComponent),
                data: { wide: true, breadcrumb: 'Stammbaum' }
            },
            {
                path: 'settings',
                loadComponent: () => import('./settings').then(m => m.Settings),
                data: { wide: true }
            },
            {
                path: 'gedcom-io',
                loadComponent: () => import('./gedcom-io').then(m => m.GedcomIo),
                data: { wide: true }
            },
            {
                path: 'settings/update',
                loadComponent: () => import('./update-settings').then(m => m.UpdateSettings),
                canActivate: [adminGuard]
            },
            {
                path: 'tree-management',
                loadComponent: () => import('./tree-management').then(m => m.TreeManagement),
                data: { wide: true }
            },
            {
                path: 'admin/users',
                loadComponent: () => import('./user-management').then(m => m.UserManagement),
                canActivate: [adminGuard],
                data: { wide: true }
            },
            {
                path: 'persons',
                loadComponent: () => import('./person-list').then(m => m.PersonList),
                data: { wide: true, breadcrumb: 'Personen' }
            },
            {
                path: 'families',
                loadComponent: () => import('./family-list').then(m => m.FamilyList),
                data: { wide: true, breadcrumb: 'Familien' }
            },
            {
                path: 'family/:id',
                loadComponent: () => import('./family-detail').then(m => m.FamilyDetail),
                data: { wide: true, breadcrumb: 'Details' }
            },
            {
                path: 'familie/:id',
                loadComponent: () => import('./family-detail').then(m => m.FamilyDetail),
                data: { wide: true, breadcrumb: 'Details' }
            },
            {
                path: 'person/:id',
                loadComponent: () => import('./person-detail').then(m => m.PersonDetail),
                canDeactivate: [unsavedChangesGuard],
                data: { wide: true, breadcrumb: 'Details' }
            },
            {
                path: 'places',
                loadComponent: () => import('./place-list').then(m => m.PlaceList),
                data: { wide: true, breadcrumb: 'Orte' }
            },
            {
                path: 'sources',
                loadComponent: () => import('./source-list').then(m => m.SourceList),
                data: { wide: true, breadcrumb: 'Quellen' }
            },
            {
                path: 'map',
                loadComponent: () => import('./map-view').then(m => m.MapView),
                data: { wide: true, breadcrumb: 'Karte' }
            },
            {
                path: 'media',
                loadComponent: () => import('./media-gallery').then(m => m.MediaGallery),
                data: { wide: true, breadcrumb: 'Medien' }
            },
            {
                path: 'statistics',
                loadComponent: () => import('./statistics').then(m => m.StatisticsDashboard),
                data: { wide: true, breadcrumb: 'Statistiken' }
            },
            {
                path: 'activity',
                loadComponent: () => import('./activity-feed').then(m => m.ActivityFeed),
                data: { wide: true, breadcrumb: 'Aktivitäten' }
            },
            {
                path: 'diagnostics',
                loadComponent: () => import('./diagnostics').then(m => m.Diagnostics),
                data: { wide: true }
            },
            {
                path: '',
                loadComponent: () => import('./dashboard').then(m => m.Dashboard),
                data: { wide: true }
            }
        ]
    }
];

