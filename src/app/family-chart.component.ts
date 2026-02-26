import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, inject, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GedcomService } from './gedcom.service';
import { transformToFamilyChart } from './family-chart-transformer';
import * as d3 from 'd3';
import f3 from '../../family-chart-master/src/index';

@Component({
  selector: 'app-family-chart',
  standalone: true,
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="f3-literal-wrapper">
      <button class="toggle-btn" (click)="toggleConfig()">Configure</button>
      
      <div id="ConfigPanel" [style.display]="configOpen() ? 'block' : 'none'" [style.left.px]="310">
        <h3>Tree Configuration</h3>

        <div class="config-group">
            <label class="config-label">Layout</label>
            <div class="config-row">
                <span>Horizontal</span>
                <input type="checkbox" [(ngModel)]="config.is_horizontal" (change)="updateTree()">
            </div>
        </div>

        <div class="config-group">
            <label class="config-label">Depth (Generations)</label>
            <div class="config-row">
                <span>Ancestry</span>
                <input type="number" [(ngModel)]="config.ancestry_depth" (change)="updateTree()" min="0" max="10">
            </div>
            <div class="config-row">
                <span>Progeny</span>
                <input type="number" [(ngModel)]="config.progeny_depth" (change)="updateTree()" min="0" max="10">
            </div>
        </div>

        <div class="config-group">
            <label class="config-label">Separation</label>
            <div class="config-row">
                <span>Nodes</span>
                <input type="range" [(ngModel)]="config.node_separation" (input)="updateTree()" min="150" max="500">
            </div>
            <div class="config-row">
                <span>Levels</span>
                <input type="range" [(ngModel)]="config.level_separation" (input)="updateTree()" min="100" max="400">
            </div>
        </div>

        <div class="config-group">
            <label class="config-label">Card Style</label>
            <select [(ngModel)]="config.card_style" (change)="updateTree()">
                <option value="rect">SVG Cards (Standard)</option>
                <option value="circle">SVG Kreise</option>
            </select>
        </div>

        <div class="config-group">
            <div class="config-row">
                <span>Single Parent Placeholders</span>
                <input type="checkbox" [(ngModel)]="config.single_parent_empty_card" (change)="updateTree()">
            </div>
        </div>
      </div>

      <div #familyChart class="f3" id="FamilyChart"></div>
    </div>
  `,
  styles: [`
    @import "../../family-chart-master/src/styles/family-chart.css";

    .f3-literal-wrapper {
        position: relative;
        width: 100%;
        height: calc(100vh - 64px);
        background-color: #121212;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        color: #fff;
        margin: 0;
        overflow: hidden;
    }

    #ConfigPanel {
        position: absolute;
        top: 10px;
        background: rgba(45, 45, 45, 0.95);
        border: 1px solid #444;
        padding: 15px;
        border-radius: 8px;
        z-index: 2000;
        width: 280px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
        max-height: 80vh;
        overflow-y: auto;
    }

    #ConfigPanel h3 {
        margin-top: 0;
        font-size: 16px;
        border-bottom: 1px solid #555;
        padding-bottom: 5px;
        color: #448aff;
    }

    .config-group { margin-bottom: 15px; }
    .config-label { display: block; font-size: 12px; margin-bottom: 5px; color: #bbb; }
    .config-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }

    input[type="range"] { width: 100%; cursor: pointer; }
    input[type="number"] { width: 50px; background: #333; color: white; border: 1px solid #555; border-radius: 3px; }
    select { width: 100%; background: #333; color: white; border: 1px solid #555; padding: 4px; border-radius: 3px; }

    .toggle-btn {
        position: absolute;
        top: 10px;
        left: 10px;
        padding: 8px 15px;
        background: #448aff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        z-index: 2001;
        font-weight: bold;
        transition: left 0.3s;
    }
    .toggle-btn:hover { background: #2979ff; }

    #FamilyChart {
        width: 100%;
        height: 100%;
        background-color: rgb(33, 33, 33);
    }
    
    /* Ensure no global transitions interfere with D3 */
    .f3 *, .f3 {
      transition: none !important;
    }
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
    card_style: 'rect' as 'rect' | 'circle',
    single_parent_empty_card: true
  };

  private readonly FOCUS_PERSON_KEY = 'heritago_last_focus_person';

  private store: any;
  private svg: any;

  ngOnInit() {
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
    const btn = document.querySelector('.toggle-btn') as HTMLElement;
    if (btn) {
      btn.style.left = this.configOpen() ? '300px' : '10px';
    }
  }

  public updateTree() {
    if (this.treeData().length > 0) {
      this.renderChart();
    }
  }

  private renderChart() {
    const data = JSON.parse(JSON.stringify(this.treeData())); // Clone to avoid in-place mutations by the library
    const cont = this.chartElement.nativeElement;
    cont.innerHTML = '';

    const svgCont = f3.createSvg(cont);
    this.svg = svgCont;

    const storedMainId = localStorage.getItem(this.FOCUS_PERSON_KEY);
    const mainId = (storedMainId && data.find((d: any) => d.id === storedMainId))
      ? storedMainId
      : (data[0]?.id || '');

    if (mainId) {
      localStorage.setItem(this.FOCUS_PERSON_KEY, mainId);
    }

    this.store = f3.createStore({
      data,
      main_id: mainId,
      node_separation: this.config.node_separation,
      level_separation: this.config.level_separation,
      is_horizontal: this.config.is_horizontal,
      ancestry_depth: this.config.ancestry_depth,
      progeny_depth: this.config.progeny_depth,
      single_parent_empty_card: this.config.single_parent_empty_card
    } as any);

    const isCircle = this.config.card_style === 'circle';
    const cardDim = isCircle
      ? { w: 80, h: 80, text_x: 40, text_y: 85, img_w: 70, img_h: 70, img_x: 5, img_y: 5 }
      : { w: 220, h: 70, text_x: 75, text_y: 15, img_w: 60, img_h: 60, img_x: 5, img_y: 5 };

    let lastClickTime = 0;
    const Card = f3.elements.CardSvg({
      store: this.store,
      svg: this.svg,
      card_dim: cardDim,
      card_display: (isCircle
        ? [((d: any) => d.data["first name"])]
        : [((d: any) => `${d.data["first name"]} ${d.data["last name"]}`), ((d: any) => d.data["birthday"] || "")]) as any,
      mini_tree: true,
      link_break: false,
      onCardClick: (e: any, d: any) => {
        const currentTime = new Date().getTime();
        const clickGap = currentTime - lastClickTime;
        lastClickTime = currentTime;

        if (clickGap < 400) {
          this.router.navigate(['/person', d.data.id]);
        } else {
          localStorage.setItem(this.FOCUS_PERSON_KEY, d.data.id);
          this.store.updateMainId(d.data.id);
          this.store.updateTree({});
        }
      }
    });

    this.store.setOnUpdate((props: any) => f3.view(this.store.getTree(), this.svg, Card, props || {}));
    this.store.updateMainId(mainId);
    this.store.updateTree({ initial: true });

    this.setupSearch(data);
  }

  private setupSearch(data: any[]) {
    const all_select_options: any[] = [];
    data.forEach(d => {
      if (all_select_options.find(d0 => d0.value === d["id"])) return;
      all_select_options.push({ label: `${d.data["first name"]} ${d.data["last name"]}`, value: d["id"] });
    });

    const search_cont = d3.select(this.chartElement.nativeElement).append("div")
      .attr("style", "position: absolute; top: 10px; right: 20px; width: 200px; z-index: 1000;");

    const search_input = search_cont.append("input")
      .attr("style", "width: 100%; padding: 10px; background: rgba(30,30,30,0.9); border: 1px solid #444; border-radius: 4px; color: white;")
      .attr("type", "text")
      .attr("placeholder", "Search...")
      .on("input", (event: any) => {
        const val = event.target.value.toLowerCase();
        const options = all_select_options.filter(o => o.label.toLowerCase().includes(val));
        updateSearchDropdown(options);
      });

    const dropdown = search_cont.append("div")
      .attr("style", "background: #1e1e1e; max-height: 300px; overflow-y: auto; border: 1px solid #444; border-top: none; shadow: 0 4px 10px rgba(0,0,0,0.5);");

    const self = this;
    const updateSearchDropdown = (options: any[]) => {
      dropdown.selectAll("div").data(options).join("div")
        .attr("style", "padding: 10px; cursor: pointer; border-bottom: 1px solid #333; font-size: 14px; color: white;")
        .text(d => d.label)
        .on("mouseover", (event) => { d3.select(event.currentTarget).style("background", "#448aff"); })
        .on("mouseout", (event) => { d3.select(event.currentTarget).style("background", "transparent"); })
        .on("click", (e, d) => {
          localStorage.setItem(this.FOCUS_PERSON_KEY, d.value);
          self.store.updateMainId(d.value);
          self.store.updateTree({ initial: true });
          dropdown.selectAll("div").remove();
          search_input.property("value", "");
        });
    }
  }
}
