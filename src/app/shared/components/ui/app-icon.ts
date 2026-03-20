import { Component, Input, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="icon-wrapper flex items-center justify-center shrink-0" 
         [class]="class" 
         [style.width]="size" 
         [style.height]="size"
         [innerHTML]="safeSvg()">
    </div>
  `,
  styles: [`
    :host { display: inline-block; line-height: 0; }
    :host ::ng-deep svg { width: 100%; height: 100%; display: block; }
  `]
})
export class AppIconComponent {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  @Input({ required: true }) name!: string;
  @Input() size: string = '1.5rem';
  @Input() class: string = '';
  @Input() folder: string = 'dashboard';

  safeSvg = signal<SafeHtml>('');

  constructor() {
    effect(() => {
      const path = `assets/icons/${this.folder}/${this.name}.svg`;
      this.http.get(path, { responseType: 'text' }).subscribe({
        next: (svg) => {
          this.safeSvg.set(this.sanitizer.bypassSecurityTrustHtml(svg));
        },
        error: (err) => {
          console.error(`Could not load icon: ${path}`, err);
          this.safeSvg.set('');
        }
      });
    });
  }
}
