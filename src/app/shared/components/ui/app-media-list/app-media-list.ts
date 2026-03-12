import { Component, input, output, signal, computed, ChangeDetectionStrategy, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GlassCardComponent } from '../app-glass-card';
import { DisplayMedia, EntityType } from '../../../../core/models/models';
import { MediaService } from '../../../../core/services/media.service';

@Component({
  selector: 'app-media-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GlassCardComponent
  ],
  templateUrl: './app-media-list.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppMediaList {
  private mediaService = inject(MediaService);

  // --- Inputs ---
  entityId = input.required<string>();
  entityType = input.required<string>();
  mediaDisplay = input<DisplayMedia[]>([]);
  allowCreate = input<boolean>(true);
  allowEdit = input<boolean>(true);
  readOnly = input<boolean>(false);
  showHeader = input<boolean>(true);
  showPrimaryToggle = input<boolean>(true);
  placeholder = input<string>('Medien durchsuchen...');
  searchTerm = input<string>('');

  // --- Outputs ---
  mediaEditRequested = output<DisplayMedia>();
  mediaUploadRequested = output<void>();
  mediaGalleryRequested = output<void>();
  mediaDeleted = output<string>();
  primaryChanged = output<string>();
  viewerRequested = output<DisplayMedia>();
  countChanged = output<number>();

  // --- Internal State ---
  searchQuery = '';

  filteredMedia = computed(() => {
    const query = (this.searchQuery.toLowerCase().trim() || this.searchTerm().toLowerCase().trim());
    const media = this.mediaDisplay();
    if (!query) return media;
    return media.filter(m =>
      (m.title && m.title.toLowerCase().includes(query)) ||
      (m.role && m.role.toLowerCase().includes(query)) ||
      (m.caption && m.caption.toLowerCase().includes(query)) ||
      (m.mimeType && m.mimeType.toLowerCase().includes(query))
    );
  });

  // --- Methods ---
  onEdit(media: DisplayMedia) {
    if (this.allowEdit() && !this.readOnly()) {
      this.mediaEditRequested.emit(media);
    }
  }

  onDelete(mediaId: string, event: Event) {
    event.stopPropagation();
    if (confirm('Möchtest du dieses Medium wirklich entfernen?')) {
      this.mediaDeleted.emit(mediaId);
    }
  }

  onPrimaryToggle(mediaId: string, event: Event) {
    event.stopPropagation();
    this.primaryChanged.emit(mediaId);
  }

  onView(media: DisplayMedia, event: Event) {
    event.stopPropagation();
    this.viewerRequested.emit(media);
  }

  isImage(m: DisplayMedia): boolean {
    if (m.mimeType) return m.mimeType.startsWith('image/');
    if (m.url) return /\.(jpeg|jpg|gif|png|webp)$/i.test(m.url);
    return false;
  }

  getPreviewUrl(m: DisplayMedia): string | null {
    if (m.previewUrl) return m.previewUrl;
    if (m.id) return this.mediaService.getMediaUrl(m.id, 'thumbs');
    return null;
  }

  getRoleLabel(role?: string): string {
    switch (role) {
      case 'PORTRAIT': return 'Portrait';
      case 'DOCUMENT': return 'Dokument';
      case 'CERTIFICATE': return 'Urkunde';
      case 'GRAVESTONE': return 'Grabstein';
      case 'SIGNATURE': return 'Unterschrift';
      case 'OTHER': return 'Sonstiges';
      default: return 'Medium';
    }
  }

  getRoleBorder(role?: string): string {
    switch (role) {
      case 'PORTRAIT': return '#8b5cf6';
      case 'DOCUMENT': return '#3b82f6';
      case 'CERTIFICATE': return '#10b981';
      case 'GRAVESTONE': return '#6b7280';
      case 'SIGNATURE': return '#f59e0b';
      default: return '#6366f1';
    }
  }

  getRoleClass(role?: string): string {
    switch (role) {
      case 'PORTRAIT': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20';
      case 'DOCUMENT': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
      case 'CERTIFICATE': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      case 'GRAVESTONE': return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20';
      case 'SIGNATURE': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      default: return 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20';
    }
  }
}
