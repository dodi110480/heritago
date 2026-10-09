import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { environment } from '../../environment';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';

@Component({
    selector: 'app-update-settings',
    standalone: true,
    imports: [CommonModule, RouterModule, AppPageHeaderComponent],
    changeDetection: ChangeDetectionStrategy.Eager,
    templateUrl: './update-settings.html'
})
export class UpdateSettings implements OnInit {
    public systemInfo: any = null;
    public updateStatus: any = null;
    public updateResult: any = null;
    public checking = false;
    public updating = false;
    public error: string | null = null;

    /**
     * Installed revision, resolved from the local git checkout via /api/system/info.
     * Values stay available even while the GitHub API is unreachable or rate limited.
     */
    public currentVersion: string = '…';
    public currentCommit: string | null = null;
    public currentBranch: string | null = null;
    public currentCommitDate: string | null = null;
    public repositoryUrl: string | null = null;

    private apiUrl = `${environment.apiUrl}/system`;
    private cdr = inject(ChangeDetectorRef);

    ngOnInit() {
        this.loadSystemInfo();
        this.checkUpdate();
    }

    async loadSystemInfo() {
        try {
            const res = await fetch(`${this.apiUrl}/info`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                this.systemInfo = data.data;
                this.applyInstalledInfo(data.data);
                this.cdr.detectChanges();
            }
        } catch (err) {
            console.error('Failed to load system info', err);
        }
    }

    /** Link to the installed commit on GitHub (null while unknown). */
    get commitUrl(): string | null {
        return this.repositoryUrl && this.currentCommit
            ? `${this.repositoryUrl}/commit/${this.currentCommit}`
            : null;
    }

    /**
     * Copies the revision metadata into the view model. The backend already delivers
     * prepared display values (backend-first), so nothing is formatted here.
     *
     * Fallback semantics: loadSystemInfo() and checkUpdate() run concurrently, and
     * /check-update does not carry the git fields. Anything missing must therefore
     * keep the value already resolved by /info instead of resetting it to null.
     */
    private applyInstalledInfo(info: any): void {
        if (!info) return;

        // Prefer the release tag, then the commit hash, then the package version.
        this.currentVersion =
            info.gitTag || info.currentVersion || info.gitCommit || info.version || this.currentVersion;
        this.currentCommit = info.gitCommit || this.currentCommit;
        this.currentBranch = info.gitBranch || this.currentBranch;
        this.currentCommitDate = info.gitCommitDate || this.currentCommitDate;
        this.repositoryUrl = info.repositoryUrl || this.repositoryUrl;
    }

    async checkUpdate() {
        this.checking = true;
        this.error = null;
        this.updateStatus = null;
        this.updateResult = null;
        this.cdr.detectChanges();

        try {
            const res = await fetch(`${this.apiUrl}/check-update`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                this.updateStatus = data.data;
                this.applyInstalledInfo(data.data);
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
                credentials: 'include',
                body: JSON.stringify({ tag: this.updateStatus.latestVersion })
            });
            const data = await res.json();
            if (data.success) {
                this.updateResult = data.data;
                this.updateStatus = null;
                // Re-read the revision metadata - the checkout is already updated on disk.
                await this.loadSystemInfo();
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
