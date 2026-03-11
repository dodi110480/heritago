import { Component, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { Navbar } from './navbar';
import { AppPageContainerComponent } from './ui/app-page-container';
import { filter, map, mergeMap } from 'rxjs/operators';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, Navbar, AppPageContainerComponent],
  template: `
    <div class="min-h-screen text-neutral-200">
      <!-- Central Navbar -->
      <app-navbar></app-navbar>

      <!-- Main Content Area -->
      <main class="pt-14 md:pt-16">
        <app-page-container [wide]="isWide()">
            <router-outlet></router-outlet>
        </app-page-container>
      </main>


      <!-- Simple Footer -->
      <footer class="py-12 border-t border-canvas-white/5 text-center text-neutral-800 dark:text-neutral-200 text-sm">
        <p>&copy; 2026 Heritago - Gedächtnis der Generationen</p>
      </footer>
    </div>
  `
})
export class AppShellComponent {
    isWide = signal(false);

    constructor(private router: Router, private activatedRoute: ActivatedRoute) {
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd),
            map(() => this.activatedRoute),
            map(route => {
                while (route.firstChild) route = route.firstChild;
                return route;
            }),
            mergeMap(route => route.data)
        ).subscribe(data => {
            this.isWide.set(!!data['wide']);
        });
    }
}
