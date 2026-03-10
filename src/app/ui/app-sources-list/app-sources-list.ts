import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { inject } from '@angular/core';

import { GlassCardComponent } from '../app-glass-card';
import { SourceSummaryPipe } from '../source-summary-pipe';
import { SourceModal } from '../../source-modal';
import { AuthService } from '../../auth.service';
import { GedcomService } from '../../gedcom.service';
import { DisplaySource, EntityType, SourceType } from '../../models';

@Component({
  selector: 'app-sources-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    ScrollingModule,
    GlassCardComponent,
    SourceSummaryPipe,
    SourceModal
  ],
  templateUrl: './app-sources-list.html',
  styleUrls: ['./app-sources-list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppSourcesListComponent {

  // ---------------------------
  // Signal Inputs (Angular 17+)
  // ---------------------------

  entityId = input.required<string>();
  entityType = input.required<EntityType>();

  sourcesDisplay = input<DisplaySource[]>([]);

  allowCreate = input<boolean>(true);
  allowEdit = input<boolean>(true);

  readOnly = input<boolean>(false);

  showCreatedBy = input<boolean>(true);
  showLinkedEntity = input<boolean>(true);

  enableEntityLinking = input<boolean>(false);

  typeOptions = input<SourceType[]>([
    'BUCH','WEBSEITE','DOKUMENT','ZEITUNG','ARCHIV',
    'FOTO','AUDIO','VIDEO','PERIODISCH',
    'KIRCHBUCH','VOLKSZAEHLUNG','ANDERE'
  ]);

  debounceTimeInput = input<number>(300);

  placeholder = input<string>('Quellen durchsuchen…');

  enableDragDrop = input<boolean>(false);
  enableVirtualScroll = input<boolean>(false);

  maxItems = input<number | null>(null);

  filterByCategory = input<'PRIMARY' | 'SECONDARY' | null>(null);
  showHeader = input<boolean>(true);
  searchTerm = input<string>('');

  // ---------------------------
  // Outputs
  // ---------------------------

  @Output() sourceEditRequested = new EventEmitter<DisplaySource>();
  @Output() sourceCreateRequested = new EventEmitter<void>();
  @Output() sourceDeleted = new EventEmitter<string>();
  @Output() sourceArchived = new EventEmitter<string>();
  @Output() sourceCopyRequested = new EventEmitter<DisplaySource>();

  @Output() searchChanged = new EventEmitter<string>();
  @Output() countChanged = new EventEmitter<number>();
  @Output() loadMore = new EventEmitter<void>();
  @Output() masterSaved = new EventEmitter<void>();

  // ---------------------------
  // Interner Zustand
  // ---------------------------

  searchQuery = '';
  private searchSubject = new Subject<string>();

  private authService = inject(AuthService);
  private gedcomService = inject(GedcomService);

  /** UI State für expandierte Beschreibungen */
  expandedSources = signal<Set<string>>(new Set());

  /** Master Source Modal State */
  showSourceMasterModal = signal(false);
  selectedSourceForMaster = signal<any>(null);
  allSourcesForMaster = signal<any[]>([]);

  // ---------------------------
  // Computed Signals
  // ---------------------------

  filteredSources = computed(() => {

    const query = (this.searchQuery.toLowerCase().trim() || this.searchTerm().toLowerCase().trim());

    let sources = this.sourcesDisplay().filter(s => !s.isArchived);

    if (this.filterByCategory()) {
      sources = sources.filter(s => s.category === this.filterByCategory());
    }

    if (!query) return sources;

    return sources.filter(source =>
      source.title.toLowerCase().includes(query) ||
      source.shortTitle?.toLowerCase().includes(query) ||
      source.tags?.some(tag => tag.toLowerCase().includes(query)) ||
      source.sourceType?.toLowerCase().includes(query) ||
      source.author?.toLowerCase().includes(query) ||
      source.publication?.toLowerCase().includes(query) ||
      source.repository?.name?.toLowerCase().includes(query)
    );

  });

  /** Performance: Liste begrenzen */
  visibleSources = computed(() => {
    const list = this.filteredSources();
    if (!this.maxItems()) return list;
    return list.slice(0, this.maxItems()!);
  });

  /** TrackBy für große Listen */
  trackSource = (_: number, s: DisplaySource) => s.id;

  // ---------------------------
  // Konstruktor
  // ---------------------------

  constructor() {

    this.searchSubject
      .pipe(debounceTime(this.debounceTimeInput()))
      .subscribe(query => {
        this.searchChanged.emit(query);
      });

  }

  // ---------------------------
  // Methoden
  // ---------------------------

  onSearchChange(): void {
    this.searchSubject.next(this.searchQuery);
  }

  toggleExpanded(id: string) {

    const set = new Set(this.expandedSources());

    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }

    this.expandedSources.set(set);
  }

  deleteSource(sourceId: string): void {

    if (this.allowEdit() && !this.readOnly()) {
      this.sourceDeleted.emit(sourceId);
    }

  }

  archiveSource(source: DisplaySource): void {

    if (this.allowEdit() && !this.readOnly()) {
      this.sourceArchived.emit(source.id);
    }

  }

  copySource(source: DisplaySource): void {
    this.sourceCopyRequested.emit(source);
  }

  onEditMaster(source: any): void {
    this.selectedSourceForMaster.set(source);
    
    // Wir brauchen eine Liste aller Quellen für das Modal (z.B. für Merge)
    const tree = this.authService.currentTree();
    if (tree) {
      this.gedcomService.getSources(tree.name).subscribe(res => {
        if (res.success) {
          this.allSourcesForMaster.set(res.sources);
        }
      });
    }
    
    this.showSourceMasterModal.set(true);
  }

  onSourceMasterSaved(): void {
    this.showSourceMasterModal.set(false);
    this.masterSaved.emit();
  }

  onSourceMasterDeleted(payload: any): void {
    // Wenn die Quelle im Master-Modal gelöscht wird, leiten wir das an das Parent weiter
    // oder wir benachrichtigen das System.
    // In diesem Kontext löscht das System die Quelle komplett aus dem Baum.
    const tree = this.authService.currentTree();
    if (!tree) return;

    if (confirm('Möchtest du diese Quelle wirklich UNWIDERRUFLICH aus dem gesamten Stammbaum löschen? Alle Belege an Personen und Ereignissen gehen verloren.')) {
        this.gedcomService.saveSource(tree.name, { id: payload.source.id, mode: 'delete', reassignToId: payload.reassignToId }).subscribe(res => {
            if (res.success) {
                this.showSourceMasterModal.set(false);
                this.masterSaved.emit();
            }
        });
    }
  }

  drop(event: CdkDragDrop<DisplaySource[]>): void {

    if (!this.enableDragDrop()) return;

    const list = [...this.sourcesDisplay()];

    moveItemInArray(list, event.previousIndex, event.currentIndex);

    // Parent muss neue Prioritäten speichern
    this.countChanged.emit(list.length);

  }

  // ---------------------------
  // UI Helper
  // ---------------------------

  getSourceTypeClass(sourceType?: SourceType): string {
    return 'bg-blue-100 text-blue-800';
  }

  getSourceTypeBorder(sourceType?: SourceType): string {
    return 'border-blue-500';
  }

  getSourceTypeIcon(type?: SourceType): string {

    switch (type) {

      case 'BUCH': return 'book';
      case 'WEBSEITE': return 'globe';
      case 'ZEITUNG': return 'newspaper';
      case 'ARCHIV': return 'archive';
      case 'FOTO': return 'image';

      default:
        return 'file-text';
    }

  }

  getConfidenceLabel(conf?: string): string {
    switch (conf) {
      case 'CERTAIN': return 'Sicher';
      case 'VERY_LIKELY': return 'Sehr wahrscheinlich';
      case 'LIKELY': return 'Wahrscheinlich';
      case 'POSSIBLE': return 'Möglich';
      case 'UNLIKELY': return 'Fraglich';
      default: return conf || '';
    }
  }

  getConfidenceClass(conf?: string): string {
    switch (conf) {
      case 'CERTAIN': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'VERY_LIKELY': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'LIKELY': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'POSSIBLE': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'UNLIKELY': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-neutral-500/10 text-neutral-600 border-neutral-500/20';
    }
  }
}

