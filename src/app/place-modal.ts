import { Component, inject, signal, Input, Output, EventEmitter, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GedcomService } from './gedcom.service';
import { AuthService } from './auth.service';

declare const L: any;

@Component({
    selector: 'app-place-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './place-modal.html',
    styleUrl: './place-modal.css'
})
export class PlaceModal implements OnInit {
    private gedcomService = inject(GedcomService);
    private authService = inject(AuthService);

    @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

    @Input() visible = false;
    @Input() mode: 'add' | 'edit' = 'add';
    @Input() initialData: any = null;

    @Output() saved = new EventEmitter<any>();
    @Output() closed = new EventEmitter<void>();

    isSaving = signal(false);
    errorMessage = signal<string | null>(null);
    currentTree = signal<string | null>(null);
    availableParents = signal<any[]>([]);

    modalData = {
        description: '',
        city: '',
        district: '',
        region: '',
        country: '',
        jurisdiction: '',
        historicNames: '',
        parentId: '',
        old_name: '',
        latitude: '',
        longitude: ''
    };

    locationLabel = signal('');

    ngOnInit() {
        const tree = this.authService.currentTree();
        if (tree) {
            this.currentTree.set(tree.name);
            this.loadParentOptions();
        }
    }

    ngOnChanges() {
        if (this.visible) {
            // Recreate map each time the modal opens to avoid stale Leaflet container references.
            this.destroyMap();
            this.resetForm();
            if (this.initialData) {
                if (typeof this.initialData === 'string') {
                    // It's just a name string, try to parse or just set as old_name
                    this.parsePlaceName(this.initialData);
                } else {
                    // It's a place object
                    this.parsePlaceName(this.initialData.name || '');
                    this.modalData.latitude = this.initialData.latitude?.toString() || '';
                    this.modalData.longitude = this.initialData.longitude?.toString() || '';
                    this.modalData.jurisdiction = this.initialData.jurisdiction || '';
                    this.modalData.historicNames = Array.isArray(this.initialData.historicNames)
                        ? this.initialData.historicNames.join(', ')
                        : '';
                    this.modalData.parentId = this.initialData.parentId || '';
                    this.modalData.old_name = this.initialData.name || '';
                }
            }
            setTimeout(() => this.initMap(), 50);
        } else {
            this.destroyMap();
        }
    }

    private parsePlaceName(name: string) {
        const parts = (name || '').split(',').map((p: string) => p.trim());
        // GEDCOM style: country, region, district, city, locality
        this.modalData.country = parts[0] || '';
        this.modalData.region = parts[1] || '';
        this.modalData.district = parts[2] || '';
        this.modalData.city = parts[3] || '';

        this.modalData.description = parts.slice(4).join(', ').trim();
        this.modalData.old_name = name;
        this.locationLabel.set([this.modalData.city, this.modalData.district, this.modalData.region, this.modalData.country].filter(Boolean).join(', '));
    }

    resetForm() {
        this.modalData = {
            description: '',
            city: '',
            district: '',
            region: '',
            country: '',
            jurisdiction: '',
            historicNames: '',
            parentId: '',
            old_name: '',
            latitude: '',
            longitude: ''
        };
        this.errorMessage.set(null);
        this.locationLabel.set('');
    }

    closeModal() {
        this.destroyMap();
        this.closed.emit();
    }

    private loadParentOptions() {
        const tree = this.currentTree();
        if (!tree) return;
        this.gedcomService.getPlaces(tree).subscribe({
            next: (res: any) => this.availableParents.set(res?.places || []),
            error: () => this.availableParents.set([])
        });
    }

    parentOptions() {
        const selfId = this.initialData?.id;
        return this.availableParents().filter((p: any) => !selfId || p.id !== selfId);
    }

    save() {
        const tree = this.currentTree();
        if (!tree) {
            this.errorMessage.set('Kein aktiver Stammbaum gefunden.');
            return;
        }

        // Build canonical GEDCOM-style place string: country, region, district, city, locality
        const name = [
            this.modalData.country.trim(),
            this.modalData.region.trim(),
            this.modalData.district.trim(),
            this.modalData.city.trim(),
            this.modalData.description.trim()
        ].filter(Boolean).join(', ');

        const payload = {
            id: this.initialData?.id || undefined,
            name: name,
            old_name: this.mode === 'edit' ? this.modalData.old_name : undefined,
            parentId: this.modalData.parentId || null,
            jurisdiction: this.modalData.jurisdiction || null,
            historicNames: this.modalData.historicNames,
            latitude: this.modalData.latitude,
            longitude: this.modalData.longitude
        };

        this.isSaving.set(true);
        this.errorMessage.set(null);

        this.gedcomService.savePlace(tree, payload).subscribe({
            next: (res: any) => {
                this.isSaving.set(false);
                if (res.success) {
                    this.saved.emit(payload);
                } else {
                    this.errorMessage.set(res.message);
                }
            },
            error: (err: any) => {
                this.isSaving.set(false);
                this.errorMessage.set(err.error?.message || 'Fehler beim Speichern.');
            }
        });
    }

    map: any;
    marker: any;

    private destroyMap() {
        if (this.map) {
            this.map.off();
            this.map.remove();
            this.map = null;
            this.marker = null;
        }
    }

    initMap() {
        if (!this.mapContainer?.nativeElement) return;
        const lat = parseFloat(this.modalData.latitude || '');
        const lng = parseFloat(this.modalData.longitude || '');
        const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

        this.map = L.map(this.mapContainer.nativeElement, { zoomControl: true })
            .setView(hasCoords ? [lat, lng] : [51.1657, 10.4515], hasCoords ? 14 : 6);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap-Mitwirkende',
            maxZoom: 19
        }).addTo(this.map);

        if (hasCoords) this.setMarker(lat, lng);

        this.map.on('click', (e: any) => {
            const { lat, lng } = e.latlng;
            this.setMarker(lat, lng);
        });
    }

    setMarker(lat: number, lng: number) {
        if (!this.map) return;
        if (!this.marker) {
            this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);
            this.marker.on('dragend', (e: any) => {
                const p = e.target.getLatLng();
                this.updateCoords(p.lat, p.lng);
            });
        } else {
            this.marker.setLatLng([lat, lng]);
        }
        this.updateCoords(lat, lng);
        this.map.flyTo([lat, lng], Math.max(this.map.getZoom(), 14), { duration: 0.4 });
        this.reverseGeocode(lat, lng);
    }

    useMyLocation() {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => this.setMarker(pos.coords.latitude, pos.coords.longitude),
            () => this.errorMessage.set('Standort konnte nicht bestimmt werden.')
        );
    }

    private updateCoords(lat: number, lng: number) {
        this.modalData.latitude = lat.toFixed(6);
        this.modalData.longitude = lng.toFixed(6);
    }

    private async reverseGeocode(lat: number, lng: number) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
            const res = await fetch(url, {
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) return;
            const data = await res.json();
            const a = data?.address || {};

            this.modalData.country = a.country || this.modalData.country;
            this.modalData.region = a.state || a.region || this.modalData.region;
            this.modalData.district = a.county || a.state_district || this.modalData.district;
            this.modalData.city = a.city || a.town || a.village || a.municipality || this.modalData.city;

            this.locationLabel.set([this.modalData.city, this.modalData.district, this.modalData.region, this.modalData.country].filter(Boolean).join(', '));
        } catch {
            // ignore reverse geocode failures, manual description still possible
        }
    }
}
