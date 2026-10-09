import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
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
export class UpdateSettings implements OnInit, OnDestroy {
    public systemInfo: any = null;
    public updateStatus: any = null;
    public checking = false;
    public updating = false;
    public error: string | null = null;

    /**
     * Progress of the running (or last) update, prepared by the backend. The whole
     * pipeline runs on the server, so the UI only renders what it is told here.
     */
    public updateProgress: any = null;

    private pollTimer: ReturnType<typeof setTimeout> | null = null;
    private pollFailures = 0;

    /** Poll interval while an update runs - the backend restarts once in between. */
    private readonly pollIntervalMs = 2500;

    /** Tolerated failed polls (the API is unreachable while the service restarts). */
    private readonly pollFailureLimit = 40;

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
        // Re-attach to an update that is already running (page reload, service restart).
        this.resumeUpdateStatus();
    }

    ngOnDestroy() {
        this.clearPollTimer();
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

    /**
     * Queues the update on the server and follows its progress. The backend performs
     * checkout, both builds and the service restart; the browser only polls the status.
     */
    async performUpdate() {
        if (!this.updateStatus?.latestVersion) {
            this.error = 'Keine Ziel-Version gefunden. Bitte zuerst auf Updates prüfen.';
            this.cdr.detectChanges();
            return;
        }

        this.updating = true;
        this.error = null;
        this.updateProgress = null;
        this.cdr.detectChanges();

        try {
            const res = await fetch(`${this.apiUrl}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ tag: this.updateStatus.latestVersion })
            });
            const data = await res.json();

            if (!data.success) {
                this.error = data.message;
                this.updating = false;
                this.cdr.detectChanges();
                return;
            }

            // The found-update card steps aside for the progress card.
            this.updateProgress = data.data;
            this.updateStatus = null;
            this.pollFailures = 0;
            this.schedulePoll();
        } catch (err) {
            this.error = 'Update-Prozess konnte nicht gestartet werden.';
            this.updating = false;
        }

        this.cdr.detectChanges();
    }

    /**
     * Re-attaches to an update that is already running (page reload, restart of the
     * browser tab). The server owns the state, so nothing is tracked in the client.
     */
    async resumeUpdateStatus() {
        const status = await this.fetchUpdateStatus();
        if (!status) return;

        if (status.running) {
            this.updateProgress = status;
            this.updating = true;
            this.updateStatus = null;
            this.pollFailures = 0;
            this.schedulePoll();
        } else if (status.status === 'success' || status.status === 'failed') {
            this.updateProgress = status;
        }

        this.cdr.detectChanges();
    }

    /** Hides the result card of a finished update. */
    dismissUpdateProgress() {
        this.updateProgress = null;
        this.error = null;
        this.cdr.detectChanges();
    }

    private async fetchUpdateStatus(): Promise<any | null> {
        try {
            const res = await fetch(`${this.apiUrl}/update/status`, { credentials: 'include' });
            const data = await res.json();
            return data.success ? data.data : null;
        } catch {
            // The service is restarting right now; the caller decides about retries.
            return null;
        }
    }

    private schedulePoll() {
        this.clearPollTimer();
        this.pollTimer = setTimeout(() => this.pollUpdate(), this.pollIntervalMs);
    }

    private clearPollTimer() {
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
    }

    private async pollUpdate() {
        this.pollTimer = null;

        const status = await this.fetchUpdateStatus();

        if (!status) {
            // Tolerate the window in which the backend restarts itself.
            this.pollFailures++;
            if (this.pollFailures > this.pollFailureLimit) {
                this.updating = false;
                this.error = 'Der Server ist nicht erreichbar. Bitte die Seite neu laden.';
                this.cdr.detectChanges();
                return;
            }
            this.schedulePoll();
            return;
        }

        this.pollFailures = 0;
        this.updateProgress = status;
        this.cdr.detectChanges();

        if (status.running) {
            this.schedulePoll();
            return;
        }

        await this.finishUpdate(status);
    }

    private async finishUpdate(status: any) {
        this.updating = false;
        this.clearPollTimer();

        if (status.status === 'failed') {
            this.error = status.error || 'Das Update ist fehlgeschlagen.';
            this.cdr.detectChanges();
            return;
        }

        // A successful update changed the revision on disk - re-read it.
        await this.loadSystemInfo();
        await this.checkUpdate();
        this.cdr.detectChanges();
    }
}
