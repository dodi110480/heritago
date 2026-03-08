# app-notes-list – Wiederverwendbare Standalone-Komponente für Notizen

## Wichtig: Dies ist eine eigenständige, generische Komponente!
`app-notes-list` ist **kein** Event- oder Person-spezifischer Tab-Inhalt.  
Sie ist bewusst als **standalone, wiederverwendbare UI-Komponente** entwickelt worden, die überall dort eingesetzt werden kann, wo Notizen an eine Entität gebunden werden sollen (Person, Event, Fact, Family, Source, Place, ResearchLog, Media, Citation usw.).

Sie benötigt **kein** NgModule, wird per `imports` eingebunden und ist vollständig konfigurierbar über Inputs.

## Design-Vorgabe: Einheitliche Darstellung mit `app-glass-card`
**Jede Notiz MUSS zwingend in der einheitlichen `app-glass-card`-Komponente dargestellt werden.**  
Das gilt für alle Listenansichten (Empty State ausgenommen). Direkte Verwendung von `.glass-card` als Klasse im Template von `app-notes-list` ist **nicht erlaubt** – immer `<app-glass-card>` nutzen.

Begründung: Einheitliches Design, Wartbarkeit, konsistentes Verhalten (Hover, Actions, Border-Highlight, Responsive).

---

# Komponenten-Definition

```ts
@Component({
  selector: 'app-notes-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CdkDragDropModule,
    GlassCardComponent, // Zwingend erforderlich!
    // weitere Module nach Bedarf
  ],
  templateUrl: './notes-list.component.html',
  styleUrls: ['./notes-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotesListComponent { … }
```

---

# Inputs (vollständig & final)

| Name | Typ | Erforderlich | Default | Beschreibung |
|-----|-----|-----|-----|-----|
| entityId | string | Ja | — | ID der Entität |
| entityType | EntityType | Ja | — | Typ: 'PERSON' \| 'EVENT' \| 'FACT' … |
| notesDisplay | DisplayNote[] | Nein | [] | Vorab geladene Notizen (Offline, SSR, Performance) |
| allowCreate | boolean | Nein | true | Neue Notizen erstellen? |
| allowEdit | boolean | Nein | allowCreate | Bestehende bearbeiten? |
| readOnly | boolean | Nein | false | Globale Read-Only-Ansicht |
| showCreatedBy | boolean | Nein | true | Ersteller anzeigen |
| showLinkedEntity | boolean | Nein | true | Verknüpfungen anzeigen |
| enableEntityLinking | boolean | Nein | false | Verknüpfungs-Button im Modal aktivieren |
| categoryOptions | NoteType[] | Nein | Alle Typen | Einschränken der Kategorien |
| debounceTime | number | Nein | 300 | Debounce-Zeit für Suchfeld (ms) |
| placeholder | string | Nein | „Notizen durchsuchen…“ | Placeholder für das Suchfeld |

---

# Outputs (angepasst an Modal-Bedienung)

| Name | Payload | Wann ausgelöst |
|-----|-----|-----|
| noteEditRequested | DisplayNote | Klick auf Notiz-Karte → Modal öffnen |
| noteCreateRequested | void | „+ Notiz“ geklickt |
| noteDeleted | string (noteId) | Notiz gelöscht |
| countChanged | number | Anzahl geändert (für Tab-Badge) |
| searchChanged | string | Suchbegriff geändert |

---

# Datenmodell (DisplayNote)

```ts
interface DisplayNote {
  id: string;
  text: string;
  noteType?: 'FORSCHUNG' | 'HINWEIS' | 'FRAGE' | 'TRANSKRIPTION' | 'AUFGABE' | 'KOMMENTAR' | 'ANDERE';
  createdAt: Date;
  updatedAt?: Date;
  createdBy?: { id: string; username: string; avatarUrl?: string };
  linkedEntity?: { type: EntityType; id: string; label: string; url?: string };
  isPrivate?: boolean;
  tags?: string[];
  isArchived?: boolean;     // Default: false
  priority?: number;        // Für Drag & Drop
}
```

---

# Funktionale Highlights

- **Nur Vorschau in der Liste**  
  Jede Notiz wird ausschließlich als Vorschau-Karte (`<app-glass-card variant="note">`) angezeigt (Text-Auszug, Kategorie, Tags, Meta).

- **Keine Inline-Bearbeitung**  
  Es gibt kein Inline-Editing direkt in der Card (keine Textarea in der Card selbst).

- **Bearbeitung & Erstellung immer modal**  
  Klick auf eine Notiz-Karte → Event `noteEditRequested` → Parent-Komponente öffnet ein separates Bearbeitungs-Modal via `app-modal-shell`.

- **„+ Notiz“-Button**  
  Button oben rechts → Event `noteCreateRequested` → Parent öffnet dasselbe Modal im Erstellungsmodus.

- **Löschen**  
  Botton in "Notizbearbeiten" unten mit links Trashcan und Text "Löschen" nach Vorbild "Event bearbeiten" → sofortiges Löschen (mit Schließen des Notizbearbeiten-Modals).

- **Archivieren (optional)**  
  Button in der Card → `isArchived = true` → Notiz wird ausgeblendet.

- **Drag & Drop (optional)**  
  Manuelle Reihenfolge per `priority`-Feld (CDK Drag & Drop).

- **Markdown-Vorschau**  
  Text wird in der Card mit einfachem Rendering angezeigt (fett, kursiv, Listen).

- **Kein extra Scroll-Container**  
  Die Notizen stehen untereinander – die gesamte Seite scrollt.

---

# Template-Struktur (zwingend mit app-glass-card)

```html
<!-- notes-list.component.html -->

<div class="space-y-6">

  <!-- Header -->
  <div class="flex items-center justify-between">

    <input
      *ngIf="!readOnly()"
      type="text"
      [(ngModel)]="searchQuery"
      (ngModelChange)="onSearchChange()"
      [placeholder]="placeholder()"
      class="input input-sm w-64"
    >

    <button
      *ngIf="allowCreate() && !readOnly()"
      (click)="noteCreateRequested.emit()"
      class="btn btn-primary btn-sm"
    >
      + Notiz
    </button>

  </div>

  <!-- Empty State -->
  <div *ngIf="filteredNotes().length === 0" class="text-center py-12 text-neutral-500">
    <p>Keine Notizen hinzugefügt.</p>
  </div>

  <!-- Notizenliste -->
  <div class="space-y-3">

    @for (note of filteredNotes(); track note.id) {

      <app-glass-card
        variant="note"
        [borderColor]="getNoteTypeBorder(note.noteType)"
        (cardClicked)="noteEditRequested.emit(note)"
      >

        <div class="flex flex-col gap-2">

          <div class="flex items-center gap-2 flex-wrap">

            <span class="badge badge-xs" [ngClass]="getNoteTypeClass(note.noteType)">
              {{ note.noteType || 'Notiz' }}
            </span>

            @for (tag of note.tags; track tag) {
              <span class="badge badge-outline text-xs">#{{ tag }}</span>
            }

          </div>

          <div class="text-sm whitespace-pre-line">
            {{
              note.text.length > 220 && !note.expanded
              ? (note.text | slice:0:220) + '...'
              : note.text
            }}

            <button
              *ngIf="note.text.length > 220"
              (click)="note.expanded = !note.expanded; $event.stopPropagation()"
              class="text-xs text-brand-600"
            >
              {{ note.expanded ? 'Weniger' : 'Mehr anzeigen' }}
            </button>

          </div>

          <div class="text-xs text-neutral-500 flex justify-between">

            <span>
              von {{ note.createdBy?.username || 'Unbekannt' }}
              · {{ note.createdAt | date:'dd.MM.yyyy' }}
            </span>

            <span *ngIf="note.linkedEntity">
              <a
                [routerLink]="note.linkedEntity.url"
                class="text-brand-600 hover:underline"
                (click)="$event.stopPropagation()"
              >
                → {{ note.linkedEntity.label }}
              </a>
            </span>

          </div>

        </div>

        <ng-container actions>

          <button
            *ngIf="allowEdit() && !readOnly()"
            (click)="deleteNote(note.id); $event.stopPropagation()"
            class="btn btn-xs btn-ghost text-red-500"
          >
            🗑️
          </button>

        </ng-container>

      </app-glass-card>

    }

  </div>

</div>
```

---

# Wichtige Hinweise

- **Keine Inline-Bearbeitung** – immer Modal (`app-modal-shell`)
- **Klick auf Karte** → `noteEditRequested`
- **+ Notiz** immer oben rechts
- **Kein extra Scroll-Container**
- **Löschen direkt aus der Karte**
- **Keine `.glass-card` Divs** – nur `<app-glass-card>`
- **Event Propagation stoppen** bei Buttons (`$event.stopPropagation()`)

---

# Beispiel-Einbindung

```html
<app-notes-list
  [entityId]="eventId()"
  [entityType]="'EVENT'"
  [allowCreate]="canEdit()"
  [allowEdit]="canEdit()"
  [readOnly]="isArchived()"
  [categoryOptions]="['RESEARCH', 'HINT', 'QUESTION', 'TRANSCRIPTION', 'TODO', 'COMMENT', 'OTHER']"
  [enableEntityLinking]="true"
  [showCreatedBy]="true"
  (noteEditRequested)="openNoteEditModal($event)"
  (noteCreateRequested)="openNoteCreateModal()"
  (noteDeleted)="onNoteDeleted($event)"
  (countChanged)="updateTabBadge('notizen', $event)"
/>

<!-- Modal -->

<app-modal-shell
  [visible]="showNoteModal()"
  title="Notiz bearbeiten"
  size="md"
  (close)="closeNoteModal()"
  (save)="saveNote()"
>
  <!-- Modal Inhalt -->
</app-modal-shell>
```

---

# Technische Empfehlungen

- **Signal Inputs (Angular 17+)**  
  Inputs als `input()` bzw. `input.required()` definieren.

- **Loading State**  
  Skeleton-Karten anzeigen (3–4 leere `app-glass-card`).

- **Error Handling**  
  Fehlermeldung: „Notizen konnten nicht geladen werden“.

- **Barrierefreiheit**  
  `aria-label` für Buttons  
  Fokus nach Modal-Schließen zurück auf zuletzt fokussierte Karte.

- **Dark Mode**  
  Tailwind `dark:` Varianten nutzen – keine zusätzlichen Klassen notwendig.