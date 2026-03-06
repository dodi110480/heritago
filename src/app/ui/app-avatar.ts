import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="containerClasses()" [title]="alt || ''">
      <img 
        [src]="safeImageUrl()" 
        [alt]="alt || 'Avatar'"
        class="w-full h-full object-cover transition-opacity duration-300"
        [class.opacity-0]="!isLoaded"
        (load)="isLoaded = true"
        [style.padding]="isFallback() ? fallbackPadding() : '0'"
      />
      <!-- Shimmer/Placeholder while loading -->
      <div *ngIf="!isLoaded" class="absolute inset-0 animate-pulse bg-neutral-200"></div>
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
  `]
})
export class AppAvatarComponent {
  @Input() imageUrl?: string | null;
  @Input() gender?: 'M' | 'F' | 'X' | 'U' | string;
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() alt?: string;
  @Input() circular: boolean = true;
  @Input() border: boolean = true;

  isLoaded = false;

  safeImageUrl = computed(() => {
    const url = this.imageUrl;
    if (url && !url.includes('assets/avatars/')) return url;
    
    // Fallback logic
    const g = (this.gender || 'U').toUpperCase();
    if (g === 'M') return 'assets/avatars/male.svg';
    if (g === 'F') return 'assets/avatars/female.svg';
    return 'assets/avatars/unknown.svg';
  });

  isFallback = computed(() => this.safeImageUrl().includes('assets/avatars/'));

  fallbackPadding = computed(() => {
    switch (this.size) {
      case 'xs': return '2px';
      case 'sm': return '4px';
      case 'md': return '8px';
      case 'lg': return '12px';
      case 'xl': return '20px';
      default: return '8px';
    }
  });

  containerClasses = computed(() => {
    const base = 'relative overflow-hidden flex items-center justify-center bg-brand-100 shrink-0';
    const sizeMap = {
      xs: 'w-6 h-6',
      sm: 'w-8 h-8',
      md: 'w-12 h-12',
      lg: 'w-20 h-20',
      xl: 'w-32 h-32'
    };
    
    return [
      base,
      sizeMap[this.size] || sizeMap.md,
      this.circular ? 'rounded-full' : 'rounded-2xl',
      this.border ? 'border border-ui-border shadow-sm' : ''
    ].join(' ');
  });
}
