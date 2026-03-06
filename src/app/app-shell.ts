import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './navbar';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, Navbar],
  template: `
    <div class="min-h-screen text-neutral-200">
      <!-- Central Navbar -->
      <app-navbar></app-navbar>

      <!-- Main Content Area -->
      <main class="pt-14 md:pt-16">
        <router-outlet></router-outlet>
      </main>


      <!-- Simple Footer -->
      <footer class="py-12 border-t border-canvas-white/5 text-center text-neutral-950 text-sm">
        <p>&copy; 2026 Heritago - Gedächtnis der Generationen</p>
      </footer>
    </div>
  `
})
export class AppShellComponent { }
