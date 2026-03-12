import { Component, inject, signal, computed, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TreeService } from '../../core/services/tree.service';

import { MediaService } from '../../core/services/media.service';
import { AnalyticsService } from '../../core/services/analytics.service';

import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';

declare const L: any;

@Component({
    selector: 'app-map-view',
    standalone: true,
    imports: [CommonModule, RouterLink, AppPageHeaderComponent],
    templateUrl: './map-view.html'
})
export class MapView implements OnInit {
    public mediaService = inject(MediaService);
    public analyticsService = inject(AnalyticsService);
    private treeService = inject(TreeService);

    @ViewChild('mapContainer') mapContainer!: ElementRef;

    map: any;
    markers = signal<any[]>([]);
    persons = signal<any[]>([]);
    listEntries = computed(() => {
        const persons = this.persons();
        if (persons.length > 0) return persons;
        return this.markers().map((m: any) => ({
            name: m.name,
            places: [m]
        }));
    });
    visibleCount = computed(() => this.listEntries().length);
    loading = signal(true);
    mapTheme = signal<'dark' | 'light'>((localStorage.getItem('heritago_map_theme') as 'dark' | 'light') || 'dark');
    private leafletMarkers: any[] = [];
    private baseLayer: any;

    ngOnInit() {
        this.loadMapData();
    }

    getAvatarUrl(profileImageUrl: string | undefined): string {
        return this.mediaService.getMediaUrl(profileImageUrl, 'thumbs');
    }

    loadMapData() {
        this.loading.set(true);
        this.treeService.getTreeData().subscribe(treeData => {
            if (treeData && treeData.meta && treeData.meta.tree) {
                this.analyticsService.getMapData(treeData.meta.tree).subscribe({
                    next: (res: any) => {
                        this.markers.set(res.markers || []);
                        this.persons.set(res.persons || []);
                        this.loading.set(false);
                        // Small timeout to ensure ViewChild is ready if it was hidden by *ngIf
                        setTimeout(() => this.initMap(), 100);
                    },
                    error: () => {
                        this.loading.set(false);
                    }
                });
            } else {
                this.loading.set(false);
            }
        });
    }

    initMap() {
        if (!this.mapContainer || this.map) return;

        // Dark-themed map via CartoDB Voyager or similar if preferred, but Standard OSM is fine
        this.map = L.map(this.mapContainer.nativeElement, {
            zoomControl: false // Move zoom control later or keep simple
        }).setView([51.1657, 10.4515], 5);

        this.applyBaseLayer();

        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);

        const markers = this.markers();
        const persons = this.persons();

        if (markers.length > 0) {
            const bounds = L.latLngBounds([]);
            markers.forEach((m: any) => {
                // Find persons associated with this place name (or coordinates)
                const personAtPlace = persons.filter(p => p.places.some((pl: any) => pl.name === m.name));
                
                let personsHtml = '';
                if (personAtPlace.length > 0) {
                    personsHtml = `
                        <div style="margin-top: 10px; border-top: 1px solid #eee; pt-2;">
                            <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #666; margin: 8px 0 4px 0;">Personen hier:</p>
                            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                                ${personAtPlace.map(p => `
                                    <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; background: #f0f0f0; border: 1px solid #ddd;" title="${p.firstName} ${p.lastName}">
                                        <img src="${this.getAvatarUrl(p.profileImageUrl)}" style="width: 100%; height: 100%; object-cover: true;">
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }

                const marker = L.marker([m.lat, m.lng])
                    .bindPopup(`
                        <div style="padding: 5px; min-width: 150px;">
                            <h4 style="margin: 0 0 5px 0; color: #1e293b;">${m.name}</h4>
                            <p style="margin: 0; font-size: 11px; color: #64748b;">${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}</p>
                            ${personsHtml}
                        </div>
                    `)
                    .addTo(this.map);

                this.leafletMarkers.push({ data: m, leaflet: marker });
                bounds.extend([m.lat, m.lng]);
            });

            this.map.fitBounds(bounds, { padding: [100, 100], maxZoom: 12 });
        }
    }

    toggleMapTheme() {
        const next = this.mapTheme() === 'dark' ? 'light' : 'dark';
        this.mapTheme.set(next);
        localStorage.setItem('heritago_map_theme', next);
        this.applyBaseLayer();
    }

    private applyBaseLayer() {
        if (!this.map) return;

        if (this.baseLayer) {
            this.map.removeLayer(this.baseLayer);
        }

        const isDark = this.mapTheme() === 'dark';
        const url = isDark
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

        this.baseLayer = L.tileLayer(url, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this.map);
    }

    focusPlace(place: any) {
        if (!this.map) return;

        this.map.flyTo([place.lat, place.lng], 14, {
            duration: 1.5
        });

        const found = this.leafletMarkers.find(lm =>
            lm.data.lat === place.lat &&
            lm.data.lng === place.lng &&
            lm.data.name === place.name
        );
        if (found) {
            found.leaflet.openPopup();
        }
    }

    focusPerson(person: any) {
        if (!this.map || !person.places || person.places.length === 0) return;

        if (person.places.length === 1) {
            this.focusPlace(person.places[0]);
        } else {
            const bounds = L.latLngBounds([]);
            person.places.forEach((p: any) => bounds.extend([p.lat, p.lng]));
            this.map.fitBounds(bounds, { padding: [100, 100], maxZoom: 12 });
        }
    }
}
