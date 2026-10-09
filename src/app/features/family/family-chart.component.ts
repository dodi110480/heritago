import { Component, ElementRef, OnInit, OnDestroy, ViewChild, AfterViewInit, inject, signal, computed, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService, TreeAccessLevel } from '../../core/services/auth.service';
import { TreeService } from '../../core/services/tree.service';
import { PersonService } from '../../core/services/person.service';
import { environment } from '../../environment';
import * as d3 from 'd3';

import { MediaService } from '../../core/services/media.service';
import { AppContextMenuComponent, ContextMenuItem } from '../../shared/components/ui/app-context-menu';
import { AppRelationModal, RelationDraft } from '../../shared/components/ui/app-relation-modal/app-relation-modal';
import { AppModalShell } from '../../shared/components/ui/app-modal-shell';
// @ts-ignore
import * as f3 from 'family-chart';
import 'family-chart/styles/family-chart.css';

@Component({
  selector: 'app-family-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, AppContextMenuComponent, AppRelationModal, AppModalShell],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="f3-literal-wrapper">
      <div class="fc-toolbar">
        <button class="fc-icon-btn fc-config-btn" (click)="toggleConfig()" title="Baum konfigurieren">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.81,11.69,4.81,12c0,0.31,0.02,0.65,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>
            <span>Einstellungen</span>
        </button>
      </div>

      <!-- Config Popup Overlay -->
      <div class="fc-config-overlay" *ngIf="configOpen()" (click)="toggleConfig()">
        <div class="fc-config-popup" (click)="$event.stopPropagation()">
            <div class="fc-popup-header">
                <h3>Baum-Konfiguration</h3>
                <button class="fc-close-btn" (click)="toggleConfig()">&times;</button>
            </div>
            
            <div class="fc-popup-body">
                <div class="fc-config-section">
                    <label>Layout & Karten</label>
                    <div class="fc-config-field">
                        <span>Horizontale Ausrichtung</span>
                        <label class="fc-switch">
                            <input type="checkbox" [(ngModel)]="config.is_horizontal" (change)="updateTree()">
                            <span class="fc-slider fc-round"></span>
                        </label>
                    </div>
                    <div class="fc-config-field fc-flex-col">
                        <span>Kartendesign</span>
                        <div class="fc-design-selector">
                            <button [class.active]="config.card_design === 'imageRect'" (click)="setCardDesign('imageRect')">Foto Eckig</button>
                            <button [class.active]="config.card_design === 'imageCircle'" (click)="setCardDesign('imageCircle')">Foto Rund</button>
                            <button [class.active]="config.card_design === 'rect'" (click)="setCardDesign('rect')">Nur Text</button>
                        </div>
                    </div>
                </div>

                <div class="fc-config-section">
                    <label>Sichtbare Generationen</label>
                    <div class="fc-config-field">
                        <span>Vorfahren</span>
                        <div class="fc-range-group">
                            <input type="range" [(ngModel)]="config.ancestry_depth" (change)="updateTree()" min="0" max="6">
                            <span class="fc-val">{{config.ancestry_depth}}</span>
                        </div>
                    </div>
                    <div class="fc-config-field">
                        <span>Nachfahren</span>
                        <div class="fc-range-group">
                            <input type="range" [(ngModel)]="config.progeny_depth" (change)="updateTree()" min="0" max="6">
                            <span class="fc-val">{{config.progeny_depth}}</span>
                        </div>
                    </div>
                </div>

                <div class="fc-config-section">
                    <label>Abstände</label>
                    <div class="fc-config-field">
                        <span>Breite</span>
                        <div class="fc-range-group">
                            <input type="range" [(ngModel)]="config.node_separation" (input)="updateTree()" min="100" max="400">
                            <span class="fc-val">{{config.node_separation}}px</span>
                        </div>
                    </div>
                    <div class="fc-config-field">
                        <span>Höhe</span>
                        <div class="fc-range-group">
                            <input type="range" [(ngModel)]="config.level_separation" (input)="updateTree()" min="100" max="400">
                            <span class="fc-val">{{config.level_separation}}px</span>
                        </div>
                    </div>
                </div>

                <div class="fc-config-section">
                    <label>Zusätzliche Optionen</label>
                    <div class="fc-config-field">
                        <span>Geschwister des Fokus zeigen</span>
                        <label class="fc-switch">
                            <input type="checkbox" [(ngModel)]="config.show_siblings" (change)="updateTree()">
                            <span class="fc-slider fc-round"></span>
                        </label>
                    </div>
                    <div class="fc-config-field">
                        <span>Platzhalter für Eltern</span>
                        <label class="fc-switch">
                            <input type="checkbox" [(ngModel)]="config.single_parent_empty_card" (change)="updateTree()">
                            <span class="fc-slider fc-round"></span>
                        </label>
                    </div>
                </div>
            </div>
            <div class="fc-popup-footer">
                <button class="fc-btn-primary" (click)="toggleConfig()">Fertig</button>
            </div>
        </div>
      </div>

      @if (chartError(); as chartErrorMessage) {
        <div
          class="absolute top-5 left-1/2 -translate-x-1/2 z-[1000] px-5 py-2.5 rounded-btn text-sm font-medium bg-accent-danger-500/15 text-accent-danger-300 border border-accent-danger-500/30 backdrop-blur-xl"
          role="status"
        >{{ chartErrorMessage }}</div>
      }

      <div #familyChart class="f3 w-full h-full flex-1" id="FamilyChart"></div>

      <!-- Feedback for actions triggered from a card's context menu -->
      @if (actionMessage(); as message) {
        <div
          class="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1000] max-w-[90%] px-5 py-2.5 rounded-btn text-sm font-medium backdrop-blur-xl border"
          [ngClass]="{
            'bg-accent-success-500/15 text-accent-success-300 border-accent-success-500/30': message.type === 'success',
            'bg-accent-highlight-500/15 text-accent-highlight-300 border-accent-highlight-500/30': message.type === 'pending',
            'bg-accent-danger-500/15 text-accent-danger-300 border-accent-danger-500/30': message.type === 'error'
          }"
          role="status"
        >{{ message.text }}</div>
      }

      <!-- Right-click menu for profile cards -->
      <app-context-menu
        [visible]="contextMenu().visible"
        [x]="contextMenu().x"
        [y]="contextMenu().y"
        [title]="contextMenu().title"
        [subtitle]="contextMenu().subtitle"
        [items]="contextMenuItems()"
        (itemSelected)="onContextMenuAction($event)"
        (closed)="closeContextMenu()"
      ></app-context-menu>

      <!-- Quick add: insert a sibling into the person's birth family -->
      <app-modal-shell
        [visible]="siblingModalVisible()"
        title="Geschwister einfügen"
        size="sm"
        saveText="Einfügen"
        [loading]="siblingSaving()"
        [disabledSave]="!siblingDraft.firstName.trim()"
        (close)="closeSiblingModal()"
        (save)="saveSibling()"
      >
        <div class="space-y-4">
          <p class="text-sm text-neutral-500">
            Neues Kind der Familie von
            <span class="font-medium text-neutral-900 dark:text-canvas-white">{{ siblingParentLabel() }}</span>.
          </p>

          @if (siblingError(); as error) {
            <div class="px-3.5 py-2.5 rounded-btn text-sm bg-accent-danger-500/15 text-accent-danger-300 border border-accent-danger-500/30">
              {{ error }}
            </div>
          }

          <div class="form-group">
            <label class="form-label">Vorname</label>
            <input type="text" class="form-input" [(ngModel)]="siblingDraft.firstName" placeholder="z.B. Maria">
          </div>

          <div class="form-group">
            <label class="form-label">Nachname</label>
            <input type="text" class="form-input" [(ngModel)]="siblingDraft.lastName">
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
              <label class="form-label">Geschlecht</label>
              <select class="form-input" [(ngModel)]="siblingDraft.gender">
                <option value="M">männlich</option>
                <option value="F">weiblich</option>
                <option value="U">unbekannt</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Geburtsjahr</label>
              <input type="text" class="form-input" [(ngModel)]="siblingDraft.birthYear" placeholder="z.B. 1875">
            </div>
          </div>
        </div>
      </app-modal-shell>

      <!-- Add a relation to the selected person -->
      <app-relation-modal
        [visible]="relationModalVisible()"
        [relation]="relationDraftInput"
        [allPersonsOptions]="chartPersonOptions()"
        [errorMessage]="relationError()"
        (close)="closeRelationModal()"
        (save)="saveRelationFromChart($event)"
        (navigateToPerson)="navigateToPerson($event)"
      ></app-relation-modal>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    @reference "../../../styles.css";

  .f3 {
    --female-color: var(--color-gender-female);
    --male-color: var(--color-gender-male);
    --genderless-color: var(--color-gender-neutral);
    --background-color: transparent;
    --text-color: var(--color-neutral-900);
    --fc-primary: var(--color-accent-highlight-500);
    --fc-surface: var(--color-glass-bg);
    --fc-surface-2: var(--color-glass-bg);
    --fc-border: var(--color-glass-border);
    --fc-text-muted: var(--color-neutral-500);
    --fc-text-soft: var(--color-neutral-700);
    --fc-toolbar-bg: var(--color-glass-bg);
    --fc-toolbar-border: var(--color-glass-border);
    --fc-overlay: rgba(0, 0, 0, 0.4);
    font-family: var(--font-body);
}

    .fc-search-container {
        @apply absolute top-5 right-5 w-56 z-[1000];
    }
    .fc-search-input {
        @apply w-full bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-full px-5 py-2.5 text-neutral-900 dark:text-white outline-hidden shadow-lg font-medium focus:ring-2 focus:ring-brand-500/30;
    }
    .fc-search-dropdown {
        @apply absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl rounded-2xl border border-glass-border dark:border-glass-border-dark shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto z-[1001];
    }
    .fc-search-item {
        @apply px-4 py-2.5 cursor-pointer text-sm text-neutral-700 dark:text-neutral-300 border-b border-neutral-100 dark:border-neutral-800 transition-colors;
    }
    .fc-search-item:hover {
        @apply bg-brand-500 text-white;
    }

    .f3-literal-wrapper {
        position: relative;
        width: 100%;
        height: calc(100vh - 64px);
        background-color: transparent;
        margin: 0;
        overflow: hidden;
    }

    .fc-toolbar {
        position: absolute;
        top: 20px;
        left: 20px;
        z-index: 100;
        display: flex;
        gap: 10px;
    }

    .fc-icon-btn {
        background: var(--fc-toolbar-bg);
        backdrop-filter: blur(8px);
        border: 1px solid var(--fc-toolbar-border);
        color: white;
        padding: 10px 18px;
        border-radius: 30px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .fc-icon-btn:hover { background: var(--fc-primary); transform: translateY(-2px); }

    /* Popup Overlay */
    .fc-config-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: var(--fc-overlay);
        backdrop-filter: blur(4px);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .fc-config-popup {
        background: var(--fc-surface);
        border: 1px solid var(--fc-border);
        border-radius: 16px;
        width: 420px;
        max-width: 90vw;
        box-shadow: 0 20px 40px rgba(0,0,0,0.6);
        overflow: hidden;
        animation: popup-fade 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes popup-fade { from { opacity: 0; transform: scale(0.95) translateY(10px); } }

    .fc-popup-header {
        padding: 20px;
        background: var(--fc-surface-2);
        border-bottom: 1px solid var(--fc-border);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .fc-popup-header h3 { margin: 0; font-size: 18px; color: var(--fc-primary); }
    .fc-close-btn { background: none; border: none; color: var(--fc-text-muted); font-size: 28px; cursor: pointer; }
    .fc-close-btn:hover { color: white; }

    .fc-popup-body { padding: 20px; max-height: 70vh; overflow-y: auto; }
    .fc-config-section { margin-bottom: 25px; }
    .fc-config-section > label { display: block; font-size: 11px; text-transform: uppercase; color: var(--fc-text-muted); margin-bottom: 12px; letter-spacing: 1px; }

    .fc-config-field { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .fc-config-field.fc-flex-col { flex-direction: column; align-items: flex-start; gap: 10px; }
    .fc-config-field span { font-size: 14px; color: var(--fc-text-soft); }
    
    .fc-design-selector {
        display: flex;
        width: 100%;
        gap: 2px;
        background: rgba(255, 255, 255, 0.9);
        padding: 4px;
        border-radius: 10px;
        border: 1px solid var(--fc-border);
    }

    .fc-design-selector button {
        flex: 1;
        background: transparent;
        border: none;
        color: var(--fc-text-muted);
        padding: 8px 5px;
        font-size: 11px;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.2s;
    }

    .fc-design-selector button.active {
        background: var(--fc-primary);
        color: white;
        box-shadow: 0 4px 10px rgba(68, 138, 255, 0.3);
    }

    .fc-range-group { display: flex; align-items: center; gap: 10px; width: 60%; }
    .f3-literal-wrapper input[type="range"] { flex: 1; accent-color: var(--fc-primary); }
    .fc-val { font-size: 12px; color: var(--fc-primary); min-width: 40px; text-align: right; }

    .fc-popup-footer { padding: 15px 20px; background: var(--fc-surface-2); border-top: 1px solid var(--fc-border); text-align: right; }
    .fc-btn-primary { background: var(--fc-primary); color: white; border: none; padding: 8px 25px; border-radius: 6px; cursor: pointer; font-weight: 600; }

    /* Toggle Switch */
    .fc-switch { position: relative; display: inline-block; width: 44px; height: 22px; }
    .fc-switch input { opacity: 0; width: 0; height: 0; }
    .fc-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--fc-border); transition: .4s; }
    .fc-slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .4s; }
    .f3-literal-wrapper input:checked + .fc-slider { background-color: var(--fc-primary); }
    .f3-literal-wrapper input:checked + .fc-slider:before { transform: translateX(22px); }
    .fc-slider.fc-round { border-radius: 34px; }
    .fc-slider.fc-round:before { border-radius: 50%; }

    /* CSS for HTML Cards (family-chart uses these) */
    .f3-html-card {
        border-radius: 8px;
        border: 2px solid var(--fc-border);
        background: var(--fc-surface);
        color: white;
        overflow: hidden;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        transition: transform 0.2s;
    }
      .f3 div.card-image-circle div.card-label {
      @apply text-white;
  }
    /* Gender colors from /persons */
    .f3-html-card.gender-F { border-color: var(--color-gender-female); }
    .f3-html-card.gender-M { border-color: var(--color-gender-male); }

    /* Default Avatar Styling */
    .f3 div.card-image-rect[style*="assets/avatars/"],
    .f3 div.card-image-circle[style*="assets/avatars/"] {
        background-size: 32px !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
    }

    .f3-html-card.gender-M div.card-image-rect[style*="assets/avatars/"],
    .f3-html-card.gender-M div.card-image-circle[style*="assets/avatars/"] {
        background-color: --alpha(var(--color-brand-500) / 15%) !important;
    }

    .f3-html-card.gender-F div.card-image-rect[style*="assets/avatars/"],
    .f3-html-card.gender-F div.card-image-circle[style*="assets/avatars/"] {
        background-color: --alpha(var(--color-gender-female) / 15%) !important;
    }

    .f3-html-card.gender-U div.card-image-rect[style*="assets/avatars/"],
    .f3-html-card.gender-U div.card-image-circle[style*="assets/avatars/"],
    .f3-html-card.gender-X div.card-image-rect[style*="assets/avatars/"],
    .f3-html-card.gender-X div.card-image-circle[style*="assets/avatars/"] {
        background-color: --alpha(var(--color-neutral-500) / 15%) !important;
    }

    .f3 * { transition: none !important; }
    #FamilyChart { width: 100%; height: 100%; background-color: transparent; }
    `]
})
export class FamilyChartComponent implements OnInit, AfterViewInit, OnDestroy {
    public mediaService = inject(MediaService);
    public authService = inject(AuthService);
    private http = inject(HttpClient);

  @ViewChild('familyChart') chartElement!: ElementRef;

  private treeService = inject(TreeService);
  private router = inject(Router);

  private treeData = signal<any[]>([]);
  /** Entry point for the chart, computed by the backend (see chart-data endpoint). */
  private defaultMainPersonId = '';
  public configOpen = signal(false);
  /** User facing message when the chart cannot be loaded or drawn. */
  public chartError = signal<string | null>(null);

  private personService = inject(PersonService);

  /** Own access level on the active tree (gates the write actions of the card menu). */
  private treePermission = signal<TreeAccessLevel | null>(null);

  /** Position, target person and caption of the card context menu. */
  public contextMenu = signal<{
    visible: boolean;
    x: number;
    y: number;
    personId: string;
    title: string;
    subtitle: string;
  }>({ visible: false, x: 0, y: 0, personId: '', title: '', subtitle: '' });

  /** Full profile of the person the menu was opened for (loaded lazily). */
  private menuProfile = signal<any | null>(null);
  public menuProfileLoading = signal(false);

  /** Feedback banner for actions triggered from the context menu. */
  public actionMessage = signal<{ type: 'success' | 'pending' | 'error'; text: string } | null>(null);
  private actionMessageTimer: ReturnType<typeof setTimeout> | null = null;

  /** Relation modal state (adds a relation to the selected person). */
  public relationModal = signal<{ visible: boolean; personId: string }>({ visible: false, personId: '' });
  public relationError = signal<string | null>(null);
  public relationSaving = signal(false);

  /** Quick-add modal for a new sibling (child of the person's parents). */
  public siblingModalVisible = signal(false);
  public siblingError = signal<string | null>(null);
  public siblingSaving = signal(false);
  public siblingDraft = { firstName: '', lastName: '', gender: 'U', birthYear: '' };

  public config = {
    is_horizontal: false,
    ancestry_depth: 2,
    progeny_depth: 2,
    node_separation: 250,
    level_separation: 150,
    single_parent_empty_card: true,
    show_siblings: true,
    card_design: 'imageRect' as 'imageRect' | 'imageCircle' | 'rect'
  };

  private readonly STORAGE_KEY_CONFIG = 'heritago_tree_config_v6';
  private readonly FOCUS_PERSON_KEY = 'heritago_last_focus_person';

  private f3Chart: any;

  ngOnInit() {
    this.loadSavedConfig();
    this.loadTreePermission();
    this.loadChartData();
  }

  /**
   * Loads the chart data of the active tree and renders the chart.
   * Reused after mutations (e.g. inserting a sibling) to refresh the tree.
   */
  private loadChartData() {
    const treeName = this.authService.currentTree()?.name;
    
    if (treeName) {
      this.http.get<any>(`${environment.apiUrl}/tree/${treeName}/chart-data`, { withCredentials: true }).subscribe({
        next: (res) => {
          if (res.success) {
            this.treeData.set(res.data?.nodes ?? []);
            this.defaultMainPersonId = res.data?.mainPersonId ?? '';
            if (this.chartElement) {
              this.renderChart();
            }
          }
        },
        error: (err) => {
          console.error('Error fetching chart data', err);
          this.chartError.set('Der Stammbaum konnte nicht geladen werden.');
        }
      });
    }
  }

  ngAfterViewInit() {
    if (this.treeData().length > 0) {
      this.renderChart();
    }
  }

  ngOnDestroy() {
    // The delegated card listeners live on the chart container; releasing them
    // explicitly prevents keeping the component alive through its own closures.
    const container = this.chartElement?.nativeElement;
    if (container) {
      d3.select(container).on('dblclick', null).on('contextmenu', null);
    }

    if (this.actionMessageTimer) {
      clearTimeout(this.actionMessageTimer);
      this.actionMessageTimer = null;
    }
  }

  /**
   * Resolves the current user's access level for the active tree. Only used to
   * gate the write actions of the card context menu - the backend remains the
   * enforcing authority.
   */
  private loadTreePermission() {
    const activeTree = this.authService.currentTree();
    if (activeTree?.permission) {
      this.treePermission.set(activeTree.permission);
      return;
    }

    this.authService.getTrees().subscribe({
      next: (trees) => {
        const match = trees.find(t => t.id === activeTree?.id || t.name === activeTree?.name);
        this.treePermission.set(match?.permission ?? null);
      },
      error: () => this.treePermission.set(null)
    });
  }

  /**
   * Resolves the person behind a chart card from a DOM event.
   *
   * family-chart binds the tree datum to the card *container* (`div.card_cont`),
   * while the visible `div.card` is injected via `innerHTML` and therefore carries
   * no datum of its own. The datum is a d3 hierarchy node whose `.data` holds the
   * chart node (`{ id, data, rels }`). Placeholder cards ("add relative", unknown,
   * new relation) carry no person id and are ignored.
   */
  private resolveCardPerson(event: Event): { personId: string; node: any } | null {
    const target = event.target as Element | null;
    const cardContainer = target?.closest?.('.card_cont');
    if (!cardContainer) return null;

    const datum: any = d3.select(cardContainer).datum();
    const chartNode = datum?.data;
    const personId = chartNode?.id;
    if (!personId) return null;
    if (chartNode.to_add || chartNode.unknown || chartNode._new_rel_data) return null;

    const id = String(personId);
    // The chart library mutates its own copy of the nodes (positions, `main`, ...),
    // so the pristine payload from the backend is preferred for display data.
    const node = this.treeData().find(entry => String(entry.id) === id) ?? chartNode;

    return { personId: id, node };
  }

  /** Opens the context menu for a card, anchored at the cursor position. */
  public openContextMenu(x: number, y: number, node: any) {
    const personId = String(node?.id ?? '');
    if (!personId) return;

    this.menuProfile.set(null);
    this.contextMenu.set({
      visible: true,
      x,
      y,
      personId,
      title: this.getNodeDisplayName(node),
      subtitle: this.getNodeLifeSpan(node)
    });
    this.loadMenuProfile(personId);
  }

  public closeContextMenu() {
    this.contextMenu.update(state => ({ ...state, visible: false }));
  }

  /** Menu entries, gated by the user's access level on the active tree. */
  public contextMenuItems = computed<ContextMenuItem[]>(() => {
    const items: ContextMenuItem[] = [
      { id: 'open', label: 'Person öffnen' },
      { id: 'focus', label: 'Als Startperson setzen' },
      {
        id: 'ancestry',
        label: 'Vorfahren erweitern',
        hint: this.config.ancestry_depth >= 6 ? 'Maximale Tiefe erreicht' : `Aktuell ${this.config.ancestry_depth} Generationen`,
        disabled: this.config.ancestry_depth >= 6
      },
      {
        id: 'progeny',
        label: 'Nachfahren erweitern',
        hint: this.config.progeny_depth >= 6 ? 'Maximale Tiefe erreicht' : `Aktuell ${this.config.progeny_depth} Generationen`,
        disabled: this.config.progeny_depth >= 6
      },
      { id: 'copyId', label: 'Personen-ID kopieren' }
    ];

    if (this.canEditChart()) {
      const birthFamily = this.birthFamilyOfMenuPerson();

      items.push({ id: 'addRelation', label: 'Beziehung hinzufügen…', groupStart: true });
      items.push({
        id: 'addSibling',
        label: 'Geschwister einfügen…',
        disabled: !birthFamily,
        hint: birthFamily
          ? 'Neues Kind derselben Eltern'
          : (this.menuProfileLoading() ? 'Eltern werden geladen…' : 'Nur möglich, wenn die Person Eltern hat')
      });
      items.push({ id: 'manageRelations', label: 'Beziehungen verwalten' });
    }

    return items;
  });

  public onContextMenuAction(itemId: string) {
    const personId = this.contextMenu().personId;
    if (!personId) return;

    switch (itemId) {
      case 'open':
      case 'manageRelations':
        this.router.navigate(['/person', personId]);
        break;
      case 'focus':
        this.setAsMainPerson(personId);
        break;
      case 'ancestry':
        this.config.ancestry_depth = Math.min(6, this.config.ancestry_depth + 1);
        this.updateTree();
        break;
      case 'progeny':
        this.config.progeny_depth = Math.min(6, this.config.progeny_depth + 1);
        this.updateTree();
        break;
      case 'copyId':
        this.copyPersonId(personId);
        break;
      case 'addRelation':
        this.openRelationModal(personId);
        break;
      case 'addSibling':
        this.openSiblingModal(personId);
        break;
    }
  }

  public navigateToPerson(personId: string) {
    this.router.navigate(['/person', personId]);
  }

  /** Makes the given person the anchor of the rendered chart. */
  private setAsMainPerson(personId: string) {
    localStorage.setItem(this.FOCUS_PERSON_KEY, personId);
    if (this.f3Chart) {
      this.f3Chart.updateMainId(personId).updateTree({ initial: true });
    }
  }

  private async copyPersonId(personId: string) {
    try {
      await navigator.clipboard.writeText(personId);
      this.setActionMessage('success', 'Personen-ID wurde in die Zwischenablage kopiert.');
    } catch {
      this.setActionMessage('error', 'Die Personen-ID konnte nicht kopiert werden.');
    }
  }

  /** Loads the full profile that backs the profile dependent menu actions. */
  private loadMenuProfile(personId: string) {
    const treeName = this.authService.currentTree()?.name;
    if (!treeName || !personId) return;

    this.menuProfileLoading.set(true);
    this.personService.getFullProfile(treeName, personId).subscribe({
      next: (profile) => {
        this.menuProfileLoading.set(false);
        this.menuProfile.set(profile);
      },
      error: () => {
        this.menuProfileLoading.set(false);
        this.menuProfile.set(null);
      }
    });
  }

  /**
   * Birth family of the person the menu was opened for. A sibling can only be
   * added when that person has at least one parent (shared family).
   */
  private birthFamilyOfMenuPerson(): { familyId: string; parentRelations: RelationDraft[] } | null {
    const profile: any = this.menuProfile();
    const relations: any[] = Array.isArray(profile?.relations) ? profile.relations : [];
    const parentTypes = ['FATHER', 'MOTHER', 'PARENT'];

    const parents = relations.filter(rel => parentTypes.includes(rel.type) && rel.personId && rel.familyId);
    if (parents.length === 0) return null;

    const familyId = String(parents[0].familyId);
    const familyParents = parents.filter(rel => String(rel.familyId) === familyId);

    // Every parent keeps its GEDCOM role; parents with an unknown role ("PARENT")
    // are assigned to the remaining free slot deterministically.
    let fatherUsed = familyParents.some(rel => rel.type === 'FATHER');
    let motherUsed = familyParents.some(rel => rel.type === 'MOTHER');

    const parentRelations: RelationDraft[] = familyParents.map(rel => {
      let type = rel.type;
      if (type === 'PARENT') {
        if (!fatherUsed) {
          type = 'FATHER';
          fatherUsed = true;
        } else if (!motherUsed) {
          type = 'MOTHER';
          motherUsed = true;
        } else {
          type = 'FATHER';
        }
      }
      return { type, personId: String(rel.personId), familyId } as RelationDraft;
    });

    return { familyId, parentRelations };
  }

  // ---------------------------------------------------------------------
  // Add relation
  // ---------------------------------------------------------------------

  /**
   * The context menu only *adds* relations, so the modal always starts with an
   * empty draft (the modal re-initializes on every `visible` change).
   */
  public readonly relationDraftInput: RelationDraft | null = null;

  public relationModalVisible = computed(() => this.relationModal().visible);

  private openRelationModal(personId: string) {
    this.relationError.set(null);
    this.relationModal.set({ visible: true, personId });
    this.loadMenuProfile(personId);
  }

  public closeRelationModal() {
    this.relationModal.update(state => ({ ...state, visible: false }));
    this.relationError.set(null);
  }

  public saveRelationFromChart(draft: RelationDraft) {
    const treeName = this.authService.currentTree()?.name;
    const treeId = this.authService.currentTree()?.id;
    const personId = this.relationModal().personId;
    const profile: any = this.menuProfile();

    if (!treeName || !treeId || !personId || !profile) {
      this.relationError.set('Die Person konnte nicht geladen werden. Bitte erneut versuchen.');
      return;
    }

    const person = profile.person ?? {};
    const existingRelations: any[] = Array.isArray(profile.relations) ? profile.relations : [];

    this.relationError.set(null);
    this.relationSaving.set(true);

    // The write service replaces the complete relation set of the person, so the
    // existing relations are resent together with the new one.
    this.personService.savePerson(treeName, {
      ...person,
      id: personId,
      treeId,
      relations: [...existingRelations, draft]
    }).subscribe({
      next: (data: any) => {
        this.relationSaving.set(false);
        this.closeRelationModal();
        this.loadChartData();
        this.reportWriteResult(data, 'Beziehung wurde gespeichert.');
      },
      error: (err) => {
        this.relationSaving.set(false);
        this.relationError.set(err?.error?.message || 'Die Beziehung konnte nicht gespeichert werden.');
      }
    });
  }

  // ---------------------------------------------------------------------
  // Insert sibling
  // ---------------------------------------------------------------------

  private openSiblingModal(personId: string) {
    const node = this.treeData().find(entry => entry.id === personId);
    this.siblingDraft = {
      firstName: '',
      lastName: node?.data?.['last name'] ?? '',
      gender: 'U',
      birthYear: ''
    };
    this.siblingError.set(null);
    this.siblingModalVisible.set(true);
    this.loadMenuProfile(personId);
  }

  public closeSiblingModal() {
    this.siblingModalVisible.set(false);
    this.siblingError.set(null);
  }

  /** Names of the parents the new sibling will be attached to. */
  public siblingParentLabel = computed(() => {
    const profile: any = this.menuProfile();
    const relations: any[] = Array.isArray(profile?.relations) ? profile.relations : [];
    const names = relations
      .filter(rel => ['FATHER', 'MOTHER', 'PARENT'].includes(rel.type) && rel.personName)
      .map(rel => rel.personName);

    return names.length > 0 ? names.join(' & ') : 'den Eltern';
  });

  /**
   * Creates a new person as a child of the selected person's birth family.
   * Non-owners only create a change request (surfaced as a pending message).
   */
  public saveSibling() {
    const treeName = this.authService.currentTree()?.name;
    const treeId = this.authService.currentTree()?.id;
    const birthFamily = this.birthFamilyOfMenuPerson();

    const firstName = this.siblingDraft.firstName.trim();
    if (!firstName) {
      this.siblingError.set('Bitte einen Vornamen angeben.');
      return;
    }
    if (!treeName || !treeId || !birthFamily) {
      this.siblingError.set('Die Eltern der Person konnten nicht ermittelt werden.');
      return;
    }

    const birthYear = this.siblingDraft.birthYear.trim();

    this.siblingError.set(null);
    this.siblingSaving.set(true);

    this.personService.savePerson(treeName, {
      treeId,
      firstName,
      lastName: this.siblingDraft.lastName.trim(),
      sex: this.siblingDraft.gender,
      relations: birthFamily.parentRelations,
      // Only sent when a year was entered; an empty timeline would clear nothing.
      timeline: birthYear ? [{ tag: 'BIRT', dateText: birthYear }] : []
    }).subscribe({
      next: (data: any) => {
        this.siblingSaving.set(false);
        this.closeSiblingModal();
        this.loadChartData();
        this.reportWriteResult(data, 'Geschwister wurde eingefügt.');
      },
      error: (err) => {
        this.siblingSaving.set(false);
        this.siblingError.set(err?.error?.message || 'Das Geschwister konnte nicht eingefügt werden.');
      }
    });
  }

  // ---------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------

  /** Owners write directly, every other role produces a change request. */
  private reportWriteResult(data: any, successText: string) {
    if (data?.pending) {
      this.setActionMessage('pending', 'Der Vorschlag wurde gespeichert und wartet auf die Bestätigung des Baum-Besitzers.');
      return;
    }
    this.setActionMessage('success', successText);
  }

  private setActionMessage(type: 'success' | 'pending' | 'error', text: string) {
    this.actionMessage.set({ type, text });
    if (this.actionMessageTimer) {
      clearTimeout(this.actionMessageTimer);
    }
    this.actionMessageTimer = setTimeout(() => this.actionMessage.set(null), 6000);
  }

  /** Write actions are hidden only when the access level is known to be read-only. */
  private canEditChart(): boolean {
    const permission = this.treePermission();
    return permission === null || permission === 'OWNER' || permission === 'EDITOR';
  }

  private getNodeDisplayName(node: any): string {
    const name = [node?.data?.['first name'], node?.data?.['last name']].filter(Boolean).join(' ').trim();
    return name || 'Unbekannte Person';
  }

  private getNodeLifeSpan(node: any): string {
    const birth = node?.data?.birthday;
    const death = node?.data?.death;
    if (!birth && !death) return '';
    return `${birth || '?'} – ${death || '?'}`;
  }

  /** Options for the relation modal's person autocomplete (all persons in the tree). */
  public chartPersonOptions = computed(() => this.treeData()
    .filter(node => node?.id && node?.data)
    .map(node => ({
      id: String(node.id),
      displayName: this.getNodeDisplayName(node)
    })));

  public toggleConfig() {
    this.configOpen.set(!this.configOpen());
  }

  public setCardDesign(design: 'imageRect' | 'imageCircle' | 'rect') {
    this.config.card_design = design;
    this.updateTree();
  }

  private loadSavedConfig() {
    const saved = localStorage.getItem(this.STORAGE_KEY_CONFIG);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.config = { ...this.config, ...parsed };
      } catch (e) {
        console.error('Error parsing saved tree config', e);
      }
    }
  }

  public updateTree() {
    localStorage.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    if (this.treeData().length > 0) {
      this.renderChart();
    }
  }

  /**
   * Renders the chart and keeps the failure inside this component: the chart
   * library aborts on inconsistent data, which previously left the user with an
   * empty page and no feedback at all.
   */
  private renderChart() {
    try {
      this.drawChart();
      this.chartError.set(null);
    } catch (e) {
      console.error('Family chart rendering failed', e);
      this.f3Chart = undefined;
      this.chartError.set('Der Stammbaum konnte nicht gezeichnet werden.');
    }
  }

  private drawChart() {
    const data = JSON.parse(JSON.stringify(this.treeData()));
    
    // Resolve avatar URLs
    data.forEach((d: any) => {
      if (d.data.avatar) {
        d.data.avatar = this.mediaService.getMediaUrl(d.data.avatar, 'thumbs');
      } else {
        const gender = d.data.gender === 'M' ? 'male' : (d.data.gender === 'F' ? 'female' : 'unknown');
        d.data.avatar = `assets/avatars/${gender}.svg`;
      }
    });

    const cont = this.chartElement.nativeElement;
    cont.innerHTML = '';

    const storedMainId = localStorage.getItem(this.FOCUS_PERSON_KEY);
    const storedNode = storedMainId ? data.find((d: any) => d.id === storedMainId) : undefined;

    // A remembered person without any relation would render a nearly empty chart
    // (e.g. a person whose GEDCOM links were never imported). In that case fall
    // back to the entry point computed by the backend.
    const storedIsConnected = !!storedNode && (
      storedNode.rels.parents.length > 0 ||
      storedNode.rels.spouses.length > 0 ||
      storedNode.rels.children.length > 0
    );

    const mainId = storedIsConnected
      ? (storedMainId as string)
      : (this.defaultMainPersonId || data[0]?.id || '');

    if (mainId) {
      localStorage.setItem(this.FOCUS_PERSON_KEY, mainId);
    }

    // Initialize the chart
    this.f3Chart = f3.createChart(cont, data)
      .setTransitionTime(800)
      .setCardXSpacing(this.config.node_separation)
      .setCardYSpacing(this.config.level_separation)
      .setAncestryDepth(this.config.ancestry_depth)
      .setProgenyDepth(this.config.progeny_depth)
      .setShowSiblingsOfMain(this.config.show_siblings)
      .setSingleParentEmptyCard(this.config.single_parent_empty_card, { label: 'ADD' });

    if (this.config.is_horizontal) this.f3Chart.setOrientationHorizontal();
    else this.f3Chart.setOrientationVertical();

    // Setup HTML Cards
    const f3Card = this.f3Chart.setCardHtml()
      .setCardDim({}) // Use library defaults or style via CSS
      .setMiniTree(true)
      .setStyle(this.config.card_design)
      .setCardDisplay([["first name"], ["last name"]])
      .setOnCardClick((e: any, d: any) => {
        // Debounce / Check for double click manually if needed, 
        // but often updateMainId is enough for visual focus
        localStorage.setItem(this.FOCUS_PERSON_KEY, d.data.id);
        this.f3Chart.updateMainId(d.data.id).updateTree({});
      });

    // Card interactions the library does not cover itself. Delegated on the chart
    // container, so they survive every re-render triggered by updateTree().
    d3.select(cont)
      .on('dblclick', (e: any) => {
        const resolved = this.resolveCardPerson(e);
        if (resolved) {
          this.navigateToPerson(resolved.personId);
        }
      })
      .on('contextmenu', (e: any) => {
        const resolved = this.resolveCardPerson(e);
        if (!resolved) return; // outside a person card: keep the native menu
        e.preventDefault();
        this.openContextMenu(e.clientX, e.clientY, resolved.node);
      });

    this.f3Chart.editTree();
    this.f3Chart.updateMainId(mainId).updateTree({ initial: true });
    this.setupSearch(data);
  }

  private setupSearch(data: any[]) {
    const all_select_options = data.map(d => ({
      label: `${d.data["first name"]} ${d.data["last name"]}`,
      value: d.id
    })).filter((v, i, a) => a.findIndex(t => t.value === v.value) === i);

    const search_cont = d3.select(this.chartElement.nativeElement).append("div")
      .attr("class", "fc-search-container");

    const search_input = search_cont.append("input")
      .attr("class", "fc-search-input")
      .attr("type", "text")
      .attr("placeholder", "Person suchen...")
      .on("input", (event: any) => {
        const val = event.target.value.toLowerCase();
        const options = val ? all_select_options.filter(o => o.label.toLowerCase().includes(val)) : [];
        updateSearchDropdown(options);
      });

    const dropdown = search_cont.append("div")
      .attr("class", "fc-search-dropdown");

    const updateSearchDropdown = (options: any[]) => {
      dropdown.selectAll("div").data(options).join("div")
        .attr("class", "fc-search-item")
        .text(d => d.label)
        .on("mouseover", (event: any) => { d3.select(event.currentTarget).style("background", "var(--fc-primary)").style("color", "white"); })
        .on("mouseout", (event: any) => { d3.select(event.currentTarget).style("background", "transparent").style("color", "var(--fc-text-soft)"); })
        .on("click", (e, d) => {
          localStorage.setItem(this.FOCUS_PERSON_KEY, d.value);
          this.f3Chart.updateMainId(d.value).updateTree({ initial: true });
          dropdown.selectAll("div").remove();
          search_input.property("value", "");
        });
    }
  }
}
