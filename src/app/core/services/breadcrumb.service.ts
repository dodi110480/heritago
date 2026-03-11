import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface Breadcrumb {
  label: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private router = inject(Router);
  
  breadcrumbs = signal<Breadcrumb[]>([]);

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      const root = this.router.routerState.snapshot.root;
      const bc: Breadcrumb[] = [];
      // Always start with Dashboard if not already on dashboard
      bc.push({ label: 'Dashboard', url: '/' });
      this.buildBreadcrumbs(root, '', bc);
      this.breadcrumbs.set(this.deduplicateBreadcrumbs(bc));
    });
  }

  private buildBreadcrumbs(route: ActivatedRouteSnapshot, path = '', breadcrumbs: Breadcrumb[] = []): void {
    const children: ActivatedRouteSnapshot[] = route.children;

    if (route.routeConfig?.data?.['breadcrumb']) {
      const label = typeof route.routeConfig.data['breadcrumb'] === 'function'
        ? route.routeConfig.data['breadcrumb'](route)
        : route.routeConfig.data['breadcrumb'];

      const url = path + '/' + route.url.map(segment => segment.path).join('/');
      const cleanUrl = url.replace(/\/+/g, '/') || '/';
      
      // Avoid adding Dashboard twice if it's the root
      if (cleanUrl !== '/' || breadcrumbs.length === 0) {
          breadcrumbs.push({ label, url: cleanUrl });
      }
    }

    if (children.length === 0) return;

    // Usually there is only one primary child route active
    this.buildBreadcrumbs(children[0], path + '/' + route.url.map(s => s.path).join('/'), breadcrumbs);
  }

  private deduplicateBreadcrumbs(breadcrumbs: Breadcrumb[]): Breadcrumb[] {
    const seenUrls = new Set<string>();
    return breadcrumbs.filter(bc => {
      if (seenUrls.has(bc.url)) return false;
      seenUrls.add(bc.url);
      return true;
    });
  }
}
