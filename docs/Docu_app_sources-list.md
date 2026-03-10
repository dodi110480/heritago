# `app-sources-list` – Wiederverwendbare Standalone-Komponente für Quellen

## Wichtig
- **Standalone & generisch**: Kein Event-/Person-spezifischer Tab-Inhalt.
- **Wiederverwendbar**: Für alle Entitäten (Person, Event, Fact, Family, Source, Place, ResearchLog, Media, Citation etc.).
- **Kein NgModule**: Wird per `imports` eingebunden.
- **Konfigurierbar**: Vollständig über Inputs steuerbar.
- **Design-Vorgabe**: Einheitliche Darstellung über `app-glass-card`.
- **Keine Inline-Bearbeitung**: Bearbeitung erfolgt ausschließlich über ein Modal.
- **UI-State getrennt vom Datenmodell** (z.B. Expanded-Zustände).

---

# Komponenten-Definition (TypeScript)

```typescript
@Component({
  selector: 'app-sources-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CdkDragDropModule,
    CdkScrollableModule,
    ScrollingModule,
    GlassCardComponent,
    SourceSummaryPipe
  ],
  templateUrl: './sources-list.component.html',
  styleUrls: ['./sources-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SourcesListComponent {

  // ---------------------------
  // Signal Inputs (Angular 17+)
  // ---------------------------

  entityId = input.required<string>();
  entityType = input.required<EntityType>();

  sourcesDisplay = input<DisplaySource[]>([]);

  allowCreate = input<boolean>(true);
  allowEdit = input<boolean>(() => this.allowCreate());

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

  // ---------------------------
  // Interner Zustand
  // ---------------------------

  searchQuery = '';
  private searchSubject = new Subject<string>();

  /** UI State für expandierte Beschreibungen */
  expandedSources = signal<Set<string>>(new Set());

  // ---------------------------
  // Computed Signals
  // ---------------------------

  filteredSources = computed(() => {

    const query = this.searchQuery.toLowerCase();

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

}


Datenmodel (DisplaySource)
type SourceType =
  | 'BUCH'
  | 'WEBSEITE'
  | 'DOKUMENT'
  | 'ZEITUNG'
  | 'ARCHIV'
  | 'FOTO'
  | 'AUDIO'
  | 'VIDEO'
  | 'PERIODISCH'
  | 'KIRCHBUCH'
  | 'VOLKSZAEHLUNG'
  | 'ANDERE';

type SourceCategory = 'PRIMARY' | 'SECONDARY';

interface DisplaySource {

  readonly id: string;
  readonly gedcomId?: string;

  readonly title: string;
  readonly shortTitle?: string;

  readonly author?: string;
  readonly publication?: string;

  readonly repository?: {
    readonly id: string;
    readonly gedcomId?: string;
    readonly name: string;
    readonly address?: string;
    readonly phone?: string;
    readonly email?: string;
    readonly website?: string;
  };

  readonly sourceType?: SourceType;
  readonly category?: SourceCategory;

  readonly url?: string;
  readonly description?: string;

  readonly confidence?: ConfidenceLevel;

  /** Counts sollten vom Backend geliefert werden (Performance) */
  readonly citationCount?: number;
  readonly mediaCount?: number;
  readonly noteCount?: number;

  readonly createdAt: Date;
  readonly updatedAt?: Date;
  readonly chanDate?: Date;

  readonly createdBy?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };

  readonly linkedEntity?: {
    type: EntityType;
    id: string;
    label: string;
    url?: string;
  };

  readonly isPrivate?: boolean;
  readonly tags?: string[];

  readonly isArchived?: boolean;

  /** Drag & Drop Sortierung */
  readonly priority?: number;

}


### Input-Parameter der Komponente
| Name               | Typ                              | Erforderlich | Default                | Beschreibung |
|--------------------|----------------------------------|-------------|------------------------|-------------|
| entityId           | string                           | Ja          | —                      | ID der Entität |
| entityType         | EntityType                       | Ja          | —                      | Typ der Entität (z.B. 'PERSON', 'EVENT') |
| sourcesDisplay     | DisplaySource[]                  | Nein        | []                     | Vorab geladene Quellen |
| allowCreate        | boolean                          | Nein        | true                   | Erlaubt das Erstellen neuer Quellen |
| allowEdit          | boolean                          | Nein        | allowCreate            | Erlaubt das Bearbeiten bestehender Quellen |
| readOnly           | boolean                          | Nein        | false                  | Globale Read-Only-Ansicht |
| showCreatedBy      | boolean                          | Nein        | true                   | Zeigt den Ersteller an |
| showLinkedEntity   | boolean                          | Nein        | true                   | Zeigt verknüpfte Entitäten an |
| enableEntityLinking| boolean                          | Nein        | false                  | Aktiviert Verknüpfungs-Button im Modal |
| typeOptions        | SourceType[]                     | Nein        | Alle Typen             | Einschränkung der Quellentypen |
| debounceTimeInput  | number                           | Nein        | 300                    | Debounce-Zeit für Suchfeld (ms) |
| placeholder        | string                           | Nein        | „Quellen durchsuchen…“ | Placeholder für Suchfeld |
| enableDragDrop     | boolean                          | Nein        | false                  | Aktiviert Drag & Drop für Priorisierung |
| maxItems           | number \| null                   | Nein        | null                   | Maximale Anzahl angezeigter Quellen |
| enableVirtualScroll| boolean                          | Nein        | false                  | Aktiviert Virtual Scrolling für große Listen |
| filterByCategory   | 'PRIMARY' \| 'SECONDARY' \| null | Nein        | null                   | Filtert nach Quellen-Kategorie |



Entwicklerregeln

Bearbeitung immer über Modal

Nur DisplaySource im UI verwenden

Counts vom Backend liefern (keine Arrays laden)

Große Listen → Virtual Scroll

Reihenfolge optional über priority + Drag & Drop

UI-State nicht im Datenmodell speichern