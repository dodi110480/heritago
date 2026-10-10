import { Component, input, output, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { PlaceDisplayPipe } from '../../../pipes/place-display.pipe';
import { AppEntityCard } from '../app-entity-card';
import { AppListViewComponent } from '../app-list-view';

@Component({
  selector: 'app-places-list',
  standalone: true,
  imports: [PlaceDisplayPipe, AppEntityCard, AppListViewComponent],
  templateUrl: './app-places-list.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  encapsulation: ViewEncapsulation.None
})
export class AppPlacesList {
  placesDisplay = input.required<any[]>();
  isLoading = input<boolean>(false);

  placeEditRequested = output<any>();

  flattenHierarchy(nodes: any[], depth = 0): any[] {
    const out: any[] = [];
    for (const n of nodes) {
      out.push({ ...n, depth });
      out.push(...this.flattenHierarchy(n.children || [], depth + 1));
    }
    return out;
  }

  /** Tooltip for the shared card badge: shows what the place is linked to. */
  usageTooltip(place: any): string {
    const usage = place?.usage;
    if (!usage) return '';
    return `Events: ${usage.eventCount || 0}, Fakten: ${usage.factCount || 0}, Ass.: ${usage.associationCount || 0}`;
  }
}
