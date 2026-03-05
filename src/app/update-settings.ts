import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { environment } from './environment';
import { AppPageContainerComponent } from './ui/app-page-container';
import { AppPageHeaderComponent } from './ui/app-page-header';

@Component({
    selector: 'app-update-settings',
    standalone: true,
    imports: [CommonModule, RouterModule, AppPageContainerComponent, AppPageHeaderComponent],
    templateUrl: './update-settings.html'
})
export class UpdateSettings implements OnInit {
    public systemInfo: any = null;
    public updateStatus: any = null;
    public updateResult: any = null;
    public checking = false;
    public updating = false;
    public error: string | null = null;
    public currentVersion: string = '...';

    private apiUrl = `${environment.apiUrl}/system`;
    private cdr = inject(ChangeDetectorRef);

    ngOnInit() {
        this.loadSystemInfo();
        this.checkUpdate();
    }

    async loadSystemInfo() {
        try {
            const res = await fetch(`${this.apiUrl}/info`);
            const data = await res.json();
            if (data.success) {
                this.systemInfo = data;
                this.cdr.detectChanges();
            }
        } catch (err) {
            console.error('Failed to load system info', err);
        }
    }

    async checkUpdate() {
        this.checking = true;
        this.error = null;
        this.updateStatus = null;
        this.updateResult = null;
        this.cdr.detectChanges();

        try {
            const res = await fetch(`${this.apiUrl}/check-update`);
            const data = await res.json();
            if (data.success) {
                this.updateStatus = data;
                this.currentVersion = data.currentVersion || this.currentVersion;
            } else {
                this.error = data.message;
            }
        } catch (err) {
            this.error = 'Verbindung zum Server fehlgeschlagen.';
        } finally {
            this.checking = false;
            this.cdr.detectChanges();
        }
    }

    async performUpdate() {
        if (!this.updateStatus?.latestVersion) {
            this.error = 'Keine Ziel-Version gefunden. Bitte zuerst auf Updates prüfen.';
            this.cdr.detectChanges();
            return;
        }

        this.updating = true;
        this.error = null;
        this.cdr.detectChanges();

        try {
            const res = await fetch(`${this.apiUrl}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag: this.updateStatus.latestVersion })
            });
            const data = await res.json();
            if (data.success) {
                this.updateResult = data;
                this.currentVersion = this.updateStatus.latestVersion;
                this.updateStatus = null;
                setTimeout(() => this.loadSystemInfo(), 2000);
            } else {
                this.error = data.message;
            }
        } catch (err) {
            this.error = 'Update-Prozess fehlgeschlagen.';
        } finally {
            this.updating = false;
            this.cdr.detectChanges();
        }
    }
}
