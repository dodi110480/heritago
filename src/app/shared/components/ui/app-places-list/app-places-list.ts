import { Component, computed, input, output, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlaceDisplayPipe } from '../../../pipes/place-display.pipe';
import { AppEntityCard } from '../app-entity-card';
import { AppListViewComponent } from '../app-list-view';

@Component({
  selector: 'app-places-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PlaceDisplayPipe, AppEntityCard, AppListViewComponent],
  templateUrl: './app-places-list.html',
  encapsulation: ViewEncapsulation.None
})
export class AppPlacesList {
  placesDisplay = input.required<any[]>();
  isLoading = input<boolean>(false);
  placeholder = input<string>('Orte durchsuchen...');

  placeEditRequested = output<any>();
  placeCreateRequested = output<void>();

  searchQuery = signal('');

  filteredHierarchy = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const hierarchy = this.placesDisplay();

    if (!query) return hierarchy;

    const filterNodes = (nodes: any[]): any[] => {
      return nodes
        .map(node => {
          const matches =
            node.name.toLowerCase().includes(query) ||
            (node.phrase && node.phrase.toLowerCase().includes(query));

          const filteredChildren = node.children ? filterNodes(node.children) : [];

          if (matches || filteredChildren.length > 0) {
            return { ...node, children: filteredChildren };
          }
          return null;
        })
        .filter((n): n is any => n !== null);
    };

    return filterNodes(hierarchy);
  });

  flattenHierarchy(nodes: any[], depth = 0): any[] {
    const out: any[] = [];
    for (const n of nodes) {
      out.push({ ...n, depth });
      out.push(...this.flattenHierarchy(n.children || [], depth + 1));
    }
    return out;
  }
}
