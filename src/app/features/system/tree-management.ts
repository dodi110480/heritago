import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, Tree } from '../../core/services/auth.service';
import { InvitationService } from '../../core/services/invitation.service';
import { ChangeRequestService } from '../../core/services/change-request.service';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';

@Component({
    selector: 'app-tree-management',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, AppPageHeaderComponent],
    changeDetection: ChangeDetectionStrategy.Eager,
    templateUrl: './tree-management.html'
})
export class TreeManagement implements OnInit {
    authService = inject(AuthService);
    private router = inject(Router);
    private invitationService = inject(InvitationService);
    private changeRequestService = inject(ChangeRequestService);

    availableTrees = signal<Tree[]>([]);
    loading = signal(true);

    // Create/Edit state
    showForm = signal<'none' | 'create' | 'edit'>('none');
    editingTree = signal<Tree | null>(null);

    // Form fields
    title = '';
    description = '';
    firstName = '';
    lastName = '';
    gender = 'M';
    birthDate = '';

    error = signal<string | null>(null);

    // Share / invite state
    showShare = signal(false);
    shareTree = signal<Tree | null>(null);
    invitations = signal<any[]>([]);
    inviteEmail = '';
    inviteLevel = 'VIEWER';
    inviteLoading = signal(false);
    inviteError = signal<string | null>(null);
    inviteSuccess = signal<string | null>(null);

    // Change request review state
    showChanges = signal(false);
    changeRequests = signal<any[]>([]);
    myRequests = signal<any[]>([]);

    ngOnInit() {
        this.loadTrees();
    }

    loadTrees() {
        this.loading.set(true);
        this.authService.getTrees().subscribe(trees => {
            this.availableTrees.set(trees.filter(t => t.name !== 'DEFAULT_TREE'));
            this.loading.set(false);
        });
    }

    selectTree(tree: Tree) {
        this.authService.selectTree(tree);
        // Maybe stay on the page or go to dashboard? User said "switch" is part of management.
        // Let's just update the local state to show it's active.
    }

    openCreate() {
        this.resetForm();
        this.showForm.set('create');
    }

    openEdit(tree: Tree) {
        this.resetForm();
        this.editingTree.set(tree);
        this.title = tree.title;
        // @ts-ignore
        this.description = tree.description || '';
        this.showForm.set('edit');
    }

    resetForm() {
        this.title = '';
        this.description = '';
        this.firstName = '';
        this.lastName = '';
        this.gender = 'M';
        this.birthDate = '';
        this.error.set(null);
        this.editingTree.set(null);
    }

    cancelForm() {
        this.showForm.set('none');
    }

    saveTree() {
        if (!this.title) {
            this.error.set('Titel ist erforderlich.');
            return;
        }

        if (this.showForm() === 'create') {
            if (!this.firstName || !this.lastName) {
                this.error.set('Vorname und Nachname der Startperson sind erforderlich.');
                return;
            }

            const normalizedName = this.title
                .toLowerCase()
                .trim()
                .replace(/\s+/g, '-')
                .replace(/[^-a-z0-9]/g, '')
                .replace(/-+/g, '-');

            this.authService.createTree(normalizedName, this.title, this.firstName, this.lastName, this.gender, this.birthDate).subscribe(result => {
                if (result.success) {
                    if (result.tree) {
                        this.authService.selectTree(result.tree);
                    }
                    this.loadTrees();
                    this.showForm.set('none');
                    this.router.navigate(['/persons']);
                } else {
                    const msg = result.message || 'Fehler beim Erstellen.';
                    if (msg.toLowerCase().includes('benutzer nicht gefunden') || msg.toLowerCase().includes('neu einloggen')) {
                        this.authService.logout();
                        this.router.navigate(['/login']);
                        return;
                    }
                    this.error.set(msg);
                }
            });
        } else if (this.showForm() === 'edit' && this.editingTree()) {
            this.authService.updateTree(this.editingTree()!.id, { title: this.title, description: this.description }).subscribe(result => {
                if (result.success) {
                    this.loadTrees();
                    // Update current tree if it was the one edited
                    if (this.authService.currentTree()?.id === this.editingTree()!.id) {
                        this.authService.selectTree(result.tree);
                    }
                    this.showForm.set('none');
                } else {
                    this.error.set('Fehler beim Speichern.');
                }
            });
        }
    }

    deleteTree(tree: Tree) {
        if (!confirm(`Möchten Sie den Stammbaum "${tree.title}" wirklich unwiderruflich löschen? Alle zugehörigen Personen, Medien und Daten gehen verloren.`)) {
            return;
        }

        this.authService.deleteTree(tree.id).subscribe(result => {
            if (result.success) {
                this.loadTrees();
                // If the deleted tree was active, clear it
                if (this.authService.currentTree()?.id === tree.id) {
                    localStorage.removeItem('activeTree');
                    // @ts-ignore
                    this.authService.currentTree.set(null);
                }
            } else {
                alert('Fehler beim Löschen.');
            }
        });
    }

    openShare(tree: Tree) {
        this.shareTree.set(tree);
        this.invitations.set([]);
        this.inviteEmail = '';
        this.inviteLevel = 'VIEWER';
        this.inviteError.set(null);
        this.inviteSuccess.set(null);
        this.showShare.set(true);
        this.loadInvitations();
    }

    closeShare() {
        this.showShare.set(false);
        this.shareTree.set(null);
    }

    loadInvitations() {
        const tree = this.shareTree();
        if (!tree) return;
        this.invitationService.listInvitations(tree.name).subscribe(list => this.invitations.set(list));
    }

    sendInvitation() {
        const tree = this.shareTree();
        if (!tree || !this.inviteEmail) return;
        this.inviteLoading.set(true);
        this.inviteError.set(null);
        this.inviteSuccess.set(null);
        this.invitationService.invite(tree.name, this.inviteEmail, this.inviteLevel).subscribe(result => {
            this.inviteLoading.set(false);
            if (result.success) {
                this.inviteSuccess.set(`Einladung an ${this.inviteEmail} gesendet.`);
                this.inviteEmail = '';
                this.loadInvitations();
            } else {
                this.inviteError.set(result.message || 'Einladung fehlgeschlagen.');
            }
        });
    }

    revokeInvitation(id: string) {
        const tree = this.shareTree();
        if (!tree) return;
        this.invitationService.revokeInvitation(tree.name, id).subscribe(success => {
            if (success) this.loadInvitations();
        });
    }

    openChanges(tree: Tree) {
        this.shareTree.set(tree);
        this.changeRequests.set([]);
        this.myRequests.set([]);
        this.showChanges.set(true);
        this.loadChangeRequests();
        this.loadMyRequests();
    }

    closeChanges() {
        this.showChanges.set(false);
    }

    loadChangeRequests() {
        const tree = this.shareTree();
        if (!tree) return;
        this.changeRequestService.listForOwner(tree.name).subscribe(list => this.changeRequests.set(list));
    }

    loadMyRequests() {
        this.changeRequestService.myRequests().subscribe(list => this.myRequests.set(list));
    }

    approveChange(id: string) {
        const tree = this.shareTree();
        if (!tree) return;
        this.changeRequestService.approve(tree.name, id).subscribe(success => { if (success) this.loadChangeRequests(); });
    }

    rejectChange(id: string) {
        const tree = this.shareTree();
        if (!tree) return;
        this.changeRequestService.reject(tree.name, id).subscribe(success => { if (success) this.loadChangeRequests(); });
    }

    cancelMyChange(id: string) {
        this.changeRequestService.cancel(id).subscribe(success => { if (success) this.loadMyRequests(); });
    }
}
