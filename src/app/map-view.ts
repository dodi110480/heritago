import { Component, inject, signal, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GedcomService } from './gedcom.service';

declare const L: any;

@Component({
    selector: 'app-map-view',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './map-view.html'
})
export class MapView implements OnInit {
    private gedcomService = inject(GedcomService);

    @ViewChild('mapContainer') mapContainer!: ElementRef;

    map: any;
    markers = signal<any[]>([]);
    persons = signal<any[]>([]);
    loading = signal(true);
    private leafletMarkers: any[] = [];

    ngOnInit() {
        this.loadMapData();
    }

    loadMapData() {
        this.loading.set(true);
        this.gedcomService.getTreeData().subscribe(treeData => {
            if (treeData && treeData.meta && treeData.meta.tree) {
                this.gedcomService.getMapData(treeData.meta.tree).subscribe({
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

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this.map);

        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);

        const markers = this.markers();
        if (markers.length > 0) {
            const bounds = L.latLngBounds([]);
            markers.forEach((m: any) => {
                const marker = L.marker([m.lat, m.lng])
                    .bindPopup(`
                        <div style="padding: 5px;">
                            <h4 style="margin: 0 0 5px 0;">${m.name}</h4>
                            <p style="margin: 0; font-size: 12px; color: #94a3b8;">${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}</p>
                        </div>
                    `)
                    .addTo(this.map);

                this.leafletMarkers.push({ data: m, leaflet: marker });
                bounds.extend([m.lat, m.lng]);
            });

            this.map.fitBounds(bounds, { padding: [100, 100], maxZoom: 12 });
        }
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
