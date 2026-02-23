import { Component, inject, signal, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GedcomService } from './gedcom.service';
import { AuthService } from './auth.service';

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

    @Input() visible = false;
    @Input() mode: 'add' | 'edit' = 'add';
    @Input() initialData: any = null;

    @Output() saved = new EventEmitter<any>();
    @Output() closed = new EventEmitter<void>();

    isSaving = signal(false);
    errorMessage = signal<string | null>(null);
    currentTree = signal<string | null>(null);

    modalData = {
        detail: '',
        city: '',
        district: '',
        region: '',
        country: '',
        old_name: '',
        latitude: '',
        longitude: ''
    };

    ngOnInit() {
        const tree = this.authService.currentTree();
        if (tree) this.currentTree.set(tree.name);
    }

    ngOnChanges() {
        if (this.visible) {
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
                    this.modalData.old_name = this.initialData.name || '';
                }
            }
        }
    }

    private parsePlaceName(name: string) {
        const parts = (name || '').split(',').map((p: string) => p.trim());
        const fullParts = new Array(5).fill('');
        const offset = Math.max(0, 5 - parts.length);
        for (let i = 0; i < parts.length; i++) {
            if (i + offset < 5) fullParts[i + offset] = parts[i];
        }
        this.modalData.detail = fullParts[0];
        this.modalData.city = fullParts[1];
        this.modalData.district = fullParts[2];
        this.modalData.region = fullParts[3];
        this.modalData.country = fullParts[4];
        this.modalData.old_name = name;
    }

    resetForm() {
        this.modalData = {
            detail: '',
            city: '',
            district: '',
            region: '',
            country: '',
            old_name: '',
            latitude: '',
            longitude: ''
        };
        this.errorMessage.set(null);
    }

    closeModal() {
        this.closed.emit();
    }

    save() {
        const tree = this.currentTree();
        if (!tree) {
            this.errorMessage.set('Kein aktiver Stammbaum gefunden.');
            return;
        }

        const name = [
            this.modalData.detail.trim(),
            this.modalData.city.trim(),
            this.modalData.district.trim(),
            this.modalData.region.trim(),
            this.modalData.country.trim()
        ].join(', ');

        const payload = {
            name: name,
            old_name: this.mode === 'edit' ? this.modalData.old_name : undefined,
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
}
