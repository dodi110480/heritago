import { Component, inject, signal, OnInit, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ChangeRequestService } from '../../core/services/change-request.service';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';

@Component({
    selector: 'app-change-requests',
    standalone: true,
    imports: [CommonModule, FormsModule, AppPageHeaderComponent],
    changeDetection: ChangeDetectionStrategy.Eager,
    templateUrl: './change-requests.html'
})
export class ChangeRequests implements OnInit {
    authService = inject(AuthService);
    private changeRequestService = inject(ChangeRequestService);
    private route = inject(ActivatedRoute);

    requests = signal<any[]>([]);
    selected = signal<any | null>(null);
    loading = signal(true);
    replyText = '';
    rejectReason = '';
    showReject = signal(false);

    pending = computed(() => this.requests().filter(r => r.status === 'PENDING'));
    done = computed(() => this.requests().filter(r => r.status !== 'PENDING'));

    private fieldLabels: Record<string, string> = {
        firstName: 'Vorname',
        lastName: 'Nachname',
        gender: 'Geschlecht',
        sex: 'Geschlecht',
        birthDate: 'Geburtsdatum',
        deathDate: 'Sterbedatum',
        birthPlace: 'Geburtsort',
        deathPlace: 'Sterbeort',
        occupation: 'Beruf',
        note: 'Notiz',
        description: 'Beschreibung'
    };

    ngOnInit() {
        this.loadRequests();
        const openId = this.route.snapshot.queryParamMap.get('open');
        if (openId) this.selectRequest(openId);
    }

    loadRequests() {
        this.loading.set(true);
        this.changeRequestService.myRequests().subscribe(list => {
            this.requests.set(list);
            this.loading.set(false);
        });
    }

    selectRequest(id: string) {
        this.changeRequestService.getChangeRequest(id).subscribe(cr => {
            this.selected.set(cr);
            this.showReject.set(false);
            this.rejectReason = '';
        });
    }

    isProposer(cr: any): boolean {
        return cr?.userId === this.authService.currentUser()?.id;
    }

    /** True when the current user is the owner and still has to decide. */
    isActionable(cr: any): boolean {
        return cr?.status === 'PENDING' && !this.isProposer(cr);
    }

    statusLabel(status: string): string {
        switch (status) {
            case 'PENDING': return 'Ausstehend';
            case 'APPROVED': return 'Bestätigt';
            case 'REJECTED': return 'Abgelehnt';
            case 'CANCELLED': return 'Storniert';
            default: return status;
        }
    }

    operationLabel(operation: string): string {
        switch (operation) {
            case 'CREATE': return 'Anlegen';
            case 'UPDATE': return 'Bearbeiten';
            case 'DELETE': return 'Löschen';
            default: return operation;
        }
    }

    entityLabel(entityType: string): string {
        switch (entityType) {
            case 'PERSON': return 'Person';
            case 'FAMILY': return 'Familie';
            default: return entityType;
        }
    }

    fieldLabel(key: string): string {
        return this.fieldLabels[key] || key;
    }

    payloadEntries(cr: any): { key: string; value: string }[] {
        const p = cr?.payload || {};
        const skip = new Set(['id', 'treeId', 'userId', 'createdAt', 'updatedAt']);
        return Object.entries(p)
            .filter(([k, v]) => !skip.has(k) && v !== null && v !== undefined && v !== '' && v !== false)
            .map(([k, v]) => ({ key: this.fieldLabel(k), value: Array.isArray(v) ? v.join(', ') : String(v) }));
    }

    sendReply() {
        const cr = this.selected();
        if (!cr || !this.replyText.trim()) return;
        this.changeRequestService.addMessage(cr.id, this.replyText).subscribe(success => {
            if (success) {
                this.replyText = '';
                this.selectRequest(cr.id);
            }
        });
    }

    approve() {
        const cr = this.selected();
        if (!cr) return;
        this.changeRequestService.approve(cr.tree.name, cr.id).subscribe(success => {
            if (success) {
                this.selectRequest(cr.id);
                this.loadRequests();
            }
        });
    }

    reject() {
        const cr = this.selected();
        if (!cr) return;
        this.changeRequestService.reject(cr.tree.name, cr.id, this.rejectReason).subscribe(success => {
            if (success) {
                this.showReject.set(false);
                this.rejectReason = '';
                this.selectRequest(cr.id);
                this.loadRequests();
            }
        });
    }

    cancel() {
        const cr = this.selected();
        if (!cr) return;
        this.changeRequestService.cancel(cr.id).subscribe(success => {
            if (success) {
                this.selectRequest(cr.id);
                this.loadRequests();
            }
        });
    }
}
