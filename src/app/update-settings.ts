import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-update-settings',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './update-settings.html',
    styleUrl: './update-settings.css'
})
export class UpdateSettings implements OnInit {
    public systemInfo: any = null;
    public updateStatus: any = null;
    public updateResult: any = null;
    public checking = false;
    public updating = false;
    public error: string | null = null;
    public currentVersion: string = '...';

    private apiUrl = `http://${window.location.hostname}:3000/api/system`;

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
            }
        } catch (err) {
            console.error('Failed to load system info', err);
        }
    }

    async loadCurrentVersion() {
        try {
            // Quick check to get the current version without full update check
            const res = await fetch(`${this.apiUrl}/check-update`);
            const data = await res.json();
            if (data.success) {
                this.currentVersion = data.currentVersion || '...';
            }
        } catch (err) {
            console.error('Failed to load current version', err);
        }
    }

    async checkUpdate() {
        this.checking = true;
        this.error = null;
        this.updateStatus = null;
        this.updateResult = null;

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
        }
    }

    async performUpdate() {
        if (!this.updateStatus?.latestVersion) {
            this.error = 'Keine Ziel-Version gefunden. Bitte zuerst auf Updates prüfen.';
            return;
        }

        this.updating = true;
        this.error = null;

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
                // Reload system info to see new version
                setTimeout(() => this.loadSystemInfo(), 2000);
            } else {
                this.error = data.message;
            }
        } catch (err) {
            this.error = 'Update-Prozess fehlgeschlagen.';
        } finally {
            this.updating = false;
        }
    }
}
