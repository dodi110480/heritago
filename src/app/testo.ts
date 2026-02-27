import { Component, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import * as d3 from 'd3';
// @ts-ignore
import * as f3 from 'family-chart';
import 'family-chart/styles/family-chart.css';

@Component({
  selector: 'app-testo',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div style="background-color: #1a1a1a; padding: 10px; border-bottom: 1px solid #333;">
        <button routerLink="/" style="background: #448aff; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;">
            ← Zurück zum Dashboard
        </button>
        <span style="color: #448aff; margin-left: 20px; font-weight: bold;">Testo Labor: Stammbaum Experiment</span>
    </div>
    
    <div class="f3" id="FamilyChartTesto" style="width:100%; height:calc(100vh - 60px); margin:auto; background-color:rgb(33,33,33); color:#fff;"></div>
  `,
  styles: [`
    :host { display: block; overflow: hidden; height: 100vh; }
  `]
})
export class TestoComponent implements OnInit {
  constructor(private elementRef: ElementRef) { }

  ngOnInit() {
    // Wir rufen die Logik auf, sobald die Seite lädt
    this.renderTestTree(this.getSampleData());
  }

  private renderTestTree(data: any) {
    // Wichtig: Wir nutzen eine eigene ID (#FamilyChartTesto), um Konflikte zu vermeiden
    const f3Chart = f3.createChart('#FamilyChartTesto', data)
      .setTransitionTime(1500)
      .setCardXSpacing(260)
      .setCardYSpacing(210)
      .setSingleParentEmptyCard(true, { label: 'ADD' })
      .setShowSiblingsOfMain(false)
      .setOrientationVertical()
      .setAncestryDepth(6)
      .setProgenyDepth(6)

    const f3Card = f3Chart.setCardHtml()
      .setCardDisplay([["first name", "last name"], ["birthday"], ["death year"]])
      .setCardDim({})
      .setMiniTree(true)
      .setStyle('imageCircle')
      .setOnHoverPathToMain()

    const f3EditTree = f3Chart.editTree()
      .fixed()
      .setFields(["first name", "last name", "birthday", "death year"])
      .setEditFirst(false)
      .setCardClickOpen(f3Card)

    f3EditTree.setEdit();

    f3Chart.updateTree({ initial: true });
    f3EditTree.open(f3Chart.getMainDatum());
    f3Chart.updateTree({ initial: true });
  }

  private getSampleData() {
    return [
      {
        "id": "0",
        "rels": {
          "spouses": ["7e4ac963-ad43-4455-8456-5e63f2db2a76"],
          "children": ["7789c4c5-79b5-4ece-a7f8-7059776cd390"]
        },
        "data": {
          "first name": "Name",
          "last name": "Surname",
          "birthday": 1970,
          "avatar": "https://static8.depositphotos.com/1009634/988/v/950/depositphotos_9883921-stock-illustration-no-user-profile-picture.jpg",
          "gender": "M"
        }
      },
      {
        "id": "7e4ac963-ad43-4455-8456-5e63f2db2a76",
        "data": {
          "gender": "F",
          "first name": "hgfgh",
          "last name": "gfhfgh",
          "birthday": "01.01.1900",
          "avatar": "fdgdf",
          "death year": "01.11.1910",
          "death place": ""
        },
        "rels": {
          "children": ["7789c4c5-79b5-4ece-a7f8-7059776cd390"],
          "spouses": ["0"]
        }
      },
      {
        "id": "7789c4c5-79b5-4ece-a7f8-7059776cd390",
        "data": {
          "gender": "M",
          "first name": "Hans",
          "last name": "Wanneman",
          "birthday": "12.04.1921",
          "avatar": "",
          "death year": "15.03.1954",
          "death place": ""
        },
        "rels": {
          "parents": ["7e4ac963-ad43-4455-8456-5e63f2db2a76", "0"]
        }
      }
    ];
  }
}