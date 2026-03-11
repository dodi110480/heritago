import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GedcomService } from '../../core/services/gedcom.service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environment';
import { RouterLink } from '@angular/router';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';

@Component({
    selector: 'app-gedcom-io',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, AppPageHeaderComponent],
    templateUrl: './gedcom-io.html'
})
export class GedcomIo {
    private gedcomService = inject(GedcomService);
    private http = inject(HttpClient);

    isImporting = false;
    isExporting = false;
    message = signal<string | null>(null);
    isError = signal(false);

    selectedFile: File | null = null;

    onFileSelected(event: any) {
        this.selectedFile = event.target.files[0];
    }

    async importGedcom() {
        if (!this.selectedFile) return;

        const treeData = await firstValueFrom(this.gedcomService.getTreeData());
        const treeName = treeData?.meta?.tree;
        if (!treeName) {
            this.showMsg('Fehler: Kein aktiver Stammbaum gefunden.', true);
            return;
        }

        this.isImporting = true;
        this.showMsg('Import läuft...', false);

        const formData = new FormData();
        formData.append('file', this.selectedFile);

        try {
            const res: any = await firstValueFrom(this.http.post(`${environment.apiUrl}/tree/${treeName}/import`, formData));
            if (res.success) {
                this.showMsg('Import erfolgreich!', false);
            } else {
                this.showMsg('Import fehlgeschlagen: ' + res.message, true);
            }
        } catch (err: any) {
            this.showMsg('Fehler beim Import: ' + (err.error?.message || err.message), true);
        } finally {
            this.isImporting = false;
        }
    }

    async exportGedcom() {
        const treeData = await firstValueFrom(this.gedcomService.getTreeData());
        const treeName = treeData?.meta?.tree;
        if (!treeName) {
            this.showMsg('Fehler: Kein aktiver Stammbaum gefunden.', true);
            return;
        }

        this.isExporting = true;
        this.showMsg('Export läuft...', false);

        try {
            const blob = await firstValueFrom(this.http.get(`${environment.apiUrl}/tree/${treeName}/export.ged`, {
                responseType: 'blob'
            }));
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${treeName}.ged`;
            a.click();
            window.URL.revokeObjectURL(url);
            this.showMsg('Export erfolgreich!', false);
        } catch (err: any) {
            this.showMsg('Fehler beim Export: ' + (err.error?.message || err.message), true);
        } finally {
            this.isExporting = false;
        }
    }

    private showMsg(msg: string, error: boolean) {
        this.message.set(msg);
        this.isError.set(error);
        if (!error) {
            setTimeout(() => this.message.set(null), 5000);
        }
    }
}
