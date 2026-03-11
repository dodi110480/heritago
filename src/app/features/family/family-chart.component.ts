import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, inject, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GedcomService } from '../../core/services/gedcom.service';
import { transformToFamilyChart } from './family-chart-transformer';
import * as d3 from 'd3';
// @ts-ignore
import * as f3 from 'family-chart';
import 'family-chart/styles/family-chart.css';

@Component({
  selector: 'app-family-chart',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

      <div #familyChart class="f3 w-full h-full flex-1" id="FamilyChart"></div>
    </div>
  `,
  styles: [`

  .f3 {
    --female-color: theme('colors.gender.female');
    --male-color: theme('colors.gender.male');
    --genderless-color: theme('colors.gender.neutral');
    --background-color: transparent;
    --text-color: theme('colors.neutral.900');
    --fc-primary: theme('colors.accent-highlight.500');
    --fc-surface: theme('colors.glass.bg');
    --fc-surface-2: theme('colors.glass.bg');
    --fc-border: theme('colors.glass.border');
    --fc-text-muted: theme('colors.neutral.500');
    --fc-text-soft: theme('colors.neutral.700');
    --fc-toolbar-bg: theme('colors.glass.bg');
    --fc-toolbar-border: theme('colors.glass.border');
    --fc-overlay: rgba(0, 0, 0, 0.4);
    font-family: theme('fontFamily.body');
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
      color: #fff;
  }
    /* Gender colors from /persons */
    .f3-html-card.gender-F { border-color: theme('colors.gender.female'); }
    .f3-html-card.gender-M { border-color: theme('colors.gender.male'); }

    /* Default Avatar Styling */
    .f3 div.card-image-rect[style*="assets/avatars/"],
    .f3 div.card-image-circle[style*="assets/avatars/"] {
        background-size: 32px !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
    }

    .f3-html-card.gender-M div.card-image-rect[style*="assets/avatars/"],
    .f3-html-card.gender-M div.card-image-circle[style*="assets/avatars/"] {
        background-color: theme('colors.brand.500 / 15%') !important;
    }

    .f3-html-card.gender-F div.card-image-rect[style*="assets/avatars/"],
    .f3-html-card.gender-F div.card-image-circle[style*="assets/avatars/"] {
        background-color: theme('colors.gender.female / 15%') !important;
    }

    .f3-html-card.gender-U div.card-image-rect[style*="assets/avatars/"],
    .f3-html-card.gender-U div.card-image-circle[style*="assets/avatars/"],
    .f3-html-card.gender-X div.card-image-rect[style*="assets/avatars/"],
    .f3-html-card.gender-X div.card-image-circle[style*="assets/avatars/"] {
        background-color: theme('colors.neutral.500 / 15%') !important;
    }

    .f3 * { transition: none !important; }
    #FamilyChart { width: 100%; height: 100%; background-color: transparent; }
    `]
})
export class FamilyChartComponent implements OnInit, AfterViewInit {
  @ViewChild('familyChart') chartElement!: ElementRef;

  private gedcomService = inject(GedcomService);
  private router = inject(Router);

  private treeData = signal<any[]>([]);
  public configOpen = signal(false);

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
    this.gedcomService.getTreeData().subscribe(data => {
      if (data) {
        const transformedData = transformToFamilyChart(data);
        this.treeData.set(transformedData);
        if (this.chartElement) {
          this.renderChart();
        }
      }
    });
  }

  ngAfterViewInit() {
    if (this.treeData().length > 0) {
      this.renderChart();
    }
  }

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

  private renderChart() {
    const data = JSON.parse(JSON.stringify(this.treeData()));
    
    // Resolve avatar URLs
    data.forEach((d: any) => {
      if (d.data.avatar) {
        d.data.avatar = this.gedcomService.getMediaUrl(d.data.avatar, 'thumbs');
      } else {
        const gender = d.data.gender === 'M' ? 'male' : (d.data.gender === 'F' ? 'female' : 'unknown');
        d.data.avatar = `assets/avatars/${gender}.svg`;
      }
    });

    const cont = this.chartElement.nativeElement;
    cont.innerHTML = '';

    const storedMainId = localStorage.getItem(this.FOCUS_PERSON_KEY);
    const mainId = (storedMainId && data.find((d: any) => d.id === storedMainId))
      ? storedMainId
      : (data[0]?.id || '');

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

    // Handle single click navigation vs double click focus via a custom timer if desired
    // For now, we prefer the library's built-in focus behavior and add a small navigation hook
    d3.select(cont).on('dblclick', (e: any) => {
      const targetElement = (e.target as Element).closest('.f3-html-card');
      if (targetElement) {
        const d = d3.select(targetElement).datum() as any;
        this.router.navigate(['/person', d.data.id]);
      }
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
      .attr("style", "position: absolute; top: 20px; right: 20px; width: 220px; z-index: 1000;");

    const search_input = search_cont.append("input")
      .attr("style", "width: 100%; padding: 10px 18px; background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 20px; color: #1e293b; outline: none; box-shadow: 0 4px 12px rgba(0,0,0,0.05); font-weight: 500;")
      .attr("type", "text")
      .attr("placeholder", "Person suchen...")
      .on("input", (event: any) => {
        const val = event.target.value.toLowerCase();
        const options = val ? all_select_options.filter(o => o.label.toLowerCase().includes(val)) : [];
        updateSearchDropdown(options);
      });

    const dropdown = search_cont.append("div")
      .attr("style", "background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px); max-height: 300px; overflow-y: auto; border-radius: 16px; margin-top: 8px; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.1);");

    const updateSearchDropdown = (options: any[]) => {
      dropdown.selectAll("div").data(options).join("div")
        .attr("style", "padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #222; font-size: 13px; color: var(--fc-text-soft);")
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
