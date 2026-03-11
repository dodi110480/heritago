import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GedcomService } from '../../../../core/services/gedcom.service';
import { AuthService } from '../../../../core/services/auth.service';
import { AppModalShell } from '../app-modal-shell';
import { PlaceDisplayPipe } from '../../../pipes/place-display.pipe';
import { AppNotesList } from '../app-notes-list/app-notes-list';
import { AppUsageList } from '../app-usage-list/app-usage-list';
import { DisplayNote, NoteCategory } from '../../../../core/models/models';

declare const L: any;

@Component({
    selector: 'app-place-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, AppNotesList, AppUsageList, AppModalShell],
    templateUrl: './place-modal.html'
})
export class PlaceModal implements OnInit {
    private gedcomService = inject(GedcomService);
    private authService = inject(AuthService);
    private router = inject(Router);

    @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

    @Input() visible = false;
    @Input() mode: 'add' | 'edit' = 'add';
    @Input() initialData: any = null;

    @Output() saved = new EventEmitter<any>();
    @Output() closed = new EventEmitter<void>();
    @Output() deleted = new EventEmitter<void>();
    @Output() merged = new EventEmitter<void>();

    isSaving = signal(false);
    errorMessage = signal<string | null>(null);
    currentTree = signal<string | null>(null);
    availableParents = signal<any[]>([]);

    // Notes signal
    notes = signal<DisplayNote[]>([]);
    showNoteSubModal = signal(false);
    activeNoteIndex = signal<number | null>(null);
    noteDraft = signal<DisplayNote>({
        id: '',
        text: '',
        noteType: 'COMMENT',
        createdAt: new Date(),
        isPrivate: false
    });

    modalData = {
        id: '',
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
        longitude: '',
        // Neue Felder aus dem Schema
        form: '',
        phrase: '',
        level: 'CITY',
        lang: '',
        formTemplate: '',
        translations: [] as any[],
        identifiers: [] as any[],
        notes: [] as any[]
    };

    placeLevels = [
        { value: 'BUILDING', label: 'Gebäude' },
        { value: 'STREET', label: 'Straße' },
        { value: 'DISTRICT', label: 'Bezirk' },
        { value: 'CITY', label: 'Stadt' },
        { value: 'MUNICIPALITY', label: 'Gemeinde' },
        { value: 'REGION', label: 'Region' },
        { value: 'STATE', label: 'Bundesland' },
        { value: 'COUNTRY', label: 'Land' },
        { value: 'CONTINENT', label: 'Kontinent' }
    ];

    usages = signal<any[]>([]);
    isLoadingUsage = signal(false);
    locationLabel = signal('');
    showMap = signal(true);
    activeTab = signal<'basics' | 'languages' | 'location' | 'notes' | 'links'>('basics');

    setTab(tab: 'basics' | 'languages' | 'location' | 'notes' | 'links') {
        this.activeTab.set(tab);
        if (tab === 'location' && this.showMap()) {
            setTimeout(() => this.initMap(), 50);
        }
        if (tab === 'links') {
            this.fetchUsage();
        }
    }

    private fetchUsage() {
        const tree = this.currentTree();
        if (!tree || !this.initialData?.id || this.mode !== 'edit') return;

        this.isLoadingUsage.set(true);
        this.gedcomService.getPlaceUsage(tree, this.initialData.id).subscribe({
            next: (res) => {
                this.isLoadingUsage.set(false);
                if (res.success) this.usages.set(res.usage || []);
            },
            error: () => this.isLoadingUsage.set(false)
        });
    }

    toggleMap() {
        this.showMap.set(!this.showMap());
        if (this.showMap()) {
            setTimeout(() => this.initMap(), 50);
        } else {
            this.destroyMap();
        }
    }

    ngOnInit() {
        const tree = this.authService.currentTree();
        if (tree) {
            this.currentTree.set(tree.name);
            this.loadParentOptions();
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['visible'] && this.visible) {
            // Recreate map each time the modal opens to avoid stale Leaflet container references.
            this.destroyMap();
            this.resetForm();
            if (this.initialData) {
                if (this.mode === 'edit' && this.initialData.id) {
                    const tree = this.authService.currentTree();
                    if (tree) {
                        this.gedcomService.getPlace(tree.name, this.initialData.id).subscribe({
                            next: (res: any) => {
                                if (res.success && res.place) {
                                    const p = res.place;
                                    this.modalData.id = p.id;
                                    this.modalData.description = p.name || '';
                                    this.modalData.latitude = p.latitude?.toString() || '';
                                    this.modalData.longitude = p.longitude?.toString() || '';
                                    this.modalData.jurisdiction = p.jurisdiction || '';
                                    this.modalData.historicNames = Array.isArray(p.historicNames)
                                        ? p.historicNames.join(', ')
                                        : (p.historicNames || '');
                                    this.modalData.parentId = p.parentId || '';
                                    this.modalData.old_name = p.name || '';
                                    this.modalData.form = p.form || '';
                                    this.modalData.phrase = p.phrase || '';
                                    this.modalData.level = p.level || 'CITY';
                                    this.modalData.lang = p.lang || '';
                                    this.modalData.formTemplate = p.formTemplate || '';
                                    this.modalData.translations = Array.isArray(p.translations)
                                        ? p.translations.map((t: any) => ({
                                            ...t,
                                            dateStart: t.dateStart ? new Date(t.dateStart).toISOString().split('T')[0] : '',
                                            dateEnd: t.dateEnd ? new Date(t.dateEnd).toISOString().split('T')[0] : ''
                                        }))
                                        : [];
                                    this.modalData.identifiers = Array.isArray(p.identifiers) ? [...p.identifiers] : [];
                                    this.notes.set(Array.isArray(p.notes) ? [...p.notes] : []);
                                    
                                    // Parse name into components, but keep full name as description fallback
                                    this.parsePlaceName(p.name || '');
                                    
                                    setTimeout(() => this.initMap(), 50);
                                } else {
                                    console.warn('Backend returned success:false for place fetch', res);
                                    this.fallbackToInitialData();
                                    setTimeout(() => this.initMap(), 50);
                                }
                            },
                            error: (err) => {
                                console.error('Error loading place from backend:', err);
                                this.fallbackToInitialData();
                                this.errorMessage.set('Details konnten nicht vom Server geladen werden. Zeige lokale Daten.');
                                setTimeout(() => this.initMap(), 50);
                            }
                        });
                    } else {
                        this.fallbackToInitialData();
                        setTimeout(() => this.initMap(), 50);
                    }
                } else {
                    // Pre-fill for add mode or fallback
                    const name = this.initialData.name || (typeof this.initialData === 'string' ? this.initialData : '');
                    this.parsePlaceName(name);
                    this.modalData.latitude = this.initialData.latitude?.toString() || '';
                    this.modalData.longitude = this.initialData.longitude?.toString() || '';
                    this.notes.set([]);
                    setTimeout(() => this.initMap(), 50);
                }
            } else {
                setTimeout(() => this.initMap(), 50);
            }
        } else if (changes['visible'] && !this.visible) {
            this.destroyMap();
        }
    }

    private fallbackToInitialData() {
        if (!this.initialData) return;
        const p = this.initialData;
        this.modalData.id = p.id || '';
        this.modalData.description = p.name || '';
        this.modalData.latitude = p.latitude?.toString() || '';
        this.modalData.longitude = p.longitude?.toString() || '';
        this.modalData.parentId = p.parentId || '';
        this.modalData.level = p.level || 'CITY';
        this.modalData.lang = p.lang || '';
        this.parsePlaceName(p.name || '');
    }

    private parsePlaceName(name: string) {
        const parts = (name || '').split(',').map((p: string) => p.trim());
        // GEDCOM style: country, region, district, city, locality
        this.modalData.country = parts[0] || '';
        this.modalData.region = parts[1] || '';
        this.modalData.district = parts[2] || '';
        this.modalData.city = parts[3] || '';

        // If we only have one part, use it as description/name
        if (parts.length === 1) {
            this.modalData.description = parts[0];
        } else {
            this.modalData.description = parts.slice(4).join(', ').trim() || parts[parts.length - 1];
        }
        this.modalData.old_name = name;
        this.locationLabel.set([this.modalData.city, this.modalData.district, this.modalData.region, this.modalData.country].filter(Boolean).join(', '));
    }

    resetForm() {
        this.modalData = {
            id: '',
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
            longitude: '',
            form: '',
            phrase: '',
            level: 'CITY',
            lang: '',
            formTemplate: '',
            translations: [],
            identifiers: [],
            notes: []
        };
        this.errorMessage.set(null);
        this.locationLabel.set('');
        this.usages.set([]);
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

    addTranslation() {
        this.modalData.translations.push({ name: '', lang: '', form: '' });
    }

    removeTranslation(index: number) {
        this.modalData.translations.splice(index, 1);
    }

    addIdentifier() {
        this.modalData.identifiers.push({ value: '', type: '' });
    }

    removeIdentifier(index: number) {
        this.modalData.identifiers.splice(index, 1);
    }

    onNoteCreateRequested() {
        this.activeNoteIndex.set(null);
        this.noteDraft.set({
            id: 'note-' + Date.now(),
            text: '',
            noteType: 'COMMENT' as NoteCategory,
            createdAt: new Date(),
            isPrivate: false
        });
        this.showNoteSubModal.set(true);
    }

    onNoteEditRequested(note: DisplayNote) {
        const index = this.notes().findIndex(n => n.id === note.id);
        if (index !== -1) {
            this.activeNoteIndex.set(index);
            this.noteDraft.set({ ...note });
            this.showNoteSubModal.set(true);
        }
    }

    onNoteSave() {
        const draft = this.noteDraft();
        if (!draft.text.trim()) return;

        const currentNotes = [...this.notes()];
        const index = this.activeNoteIndex();

        if (index !== null) {
            currentNotes[index] = draft;
        } else {
            currentNotes.push(draft);
        }

        this.notes.set(currentNotes);
        this.showNoteSubModal.set(false);
    }

    onNoteDeleted(noteId: string) {
        if (confirm('Möchtest du diese Notiz wirklich löschen?')) {
            this.notes.update(notes => notes.filter(n => n.id !== noteId));
        }
    }

    onNoteDeleteFromModal() {
        const idx = this.activeNoteIndex();
        if (idx !== null) {
            this.notes.update(notes => {
                const n = [...notes];
                n.splice(idx, 1);
                return n;
            });
            this.showNoteSubModal.set(false);
        }
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
            id: this.modalData.id || this.initialData?.id || undefined,
            name: name,
            old_name: this.mode === 'edit' ? this.modalData.old_name : undefined,
            parentId: this.modalData.parentId || null,
            jurisdiction: this.modalData.jurisdiction || null,
            historicNames: this.modalData.historicNames,
            latitude: this.modalData.latitude,
            longitude: this.modalData.longitude,
            // Neue Felder
            form: this.modalData.form || null,
            phrase: this.modalData.phrase || null,
            level: this.modalData.level,
            lang: this.modalData.lang || null,
            formTemplate: this.modalData.formTemplate || null,
            translations: this.modalData.translations,
            identifiers: this.modalData.identifiers,
            notes: this.notes()
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



    openPersonProfile(personId?: string | null) {
        if (!personId) return;
        this.router.navigate(['/person', personId]);
        this.closeModal();
    }
}
