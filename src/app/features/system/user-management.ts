import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';

@Component({
    selector: 'app-user-management',
    standalone: true,
    imports: [CommonModule, RouterModule, AppPageHeaderComponent],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
        <app-page-header title="Benutzerverwaltung" description="Verwalte alle registrierten Benutzer und deren Rollen.">
            <div actions>
                <a routerLink="/settings" class="btn-ghost py-2!">Zurück</a>
            </div>
        </app-page-header>

        <div class="glass-card overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-canvas-white/10 text-neutral-400 text-xs uppercase tracking-wider">
                            <th class="px-6 py-4 font-semibold">Benutzer</th>
                            <th class="px-6 py-4 font-semibold">Email</th>
                            <th class="px-6 py-4 font-semibold">Rolle</th>
                            <th class="px-6 py-4 font-semibold">Verifiziert</th>
                            <th class="px-6 py-4 font-semibold">Bäume</th>
                            <th class="px-6 py-4 font-semibold">maxTrees</th>
                            <th class="px-6 py-4 font-semibold">Status</th>
                            <th class="px-6 py-4 font-semibold text-right">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-canvas-white/5">
                        <tr *ngFor="let user of users()" class="hover:bg-canvas-white/5 transition-colors">
                            <td class="px-6 py-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-xs">
                                        {{ user.username.substring(0, 2).toUpperCase() }}
                                    </div>
                                    <span class="font-medium text-canvas-white">{{ user.username }}</span>
                                </div>
                            </td>
                            <td class="px-6 py-4 text-neutral-300 text-sm">{{ user.email }}</td>
                            <td class="px-6 py-4">
                                <select
                                    [value]="user.globalRole"
                                    (change)="updateRole(user, $any($event.target).value)"
                                    [disabled]="isSelf(user)"
                                    class="bg-canvas-black/30 border border-canvas-white/10 rounded-lg px-2 py-1 text-xs text-neutral-300 focus:outline-hidden focus:border-brand-500 disabled:opacity-40">
                                    <option value="USER">USER</option>
                                    <option value="ADMIN">ADMIN</option>
                                </select>
                            </td>
                            <td class="px-6 py-4">
                                <span *ngIf="user.isEmailVerified" class="text-accent-success-400 font-bold">✓</span>
                                <span *ngIf="!user.isEmailVerified" class="text-amber-400 font-bold">✗</span>
                            </td>
                            <td class="px-6 py-4">
                                <span class="px-2 py-1 rounded-full bg-canvas-white/10 text-neutral-300 text-[10px] font-bold">{{ user._count.permissions }}</span>
                            </td>
                            <td class="px-6 py-4">
                                <input type="number" [value]="user.maxTrees" min="0"
                                    (change)="updateMaxTrees(user, $any($event.target).value)"
                                    class="w-16 bg-canvas-black/30 border border-canvas-white/10 rounded-lg px-2 py-1 text-xs text-neutral-300 focus:outline-hidden focus:border-brand-500">
                            </td>
                            <td class="px-6 py-4">
                                <button (click)="toggleSuspend(user)" [disabled]="isSelf(user)"
                                    class="px-2 py-1 rounded-full text-[10px] font-bold transition-colors disabled:opacity-40"
                                    [class.bg-accent-danger-500/20]="user.isSuspended"
                                    [class.text-accent-danger-400]="user.isSuspended"
                                    [class.bg-accent-success-500/20]="!user.isSuspended"
                                    [class.text-accent-success-400]="!user.isSuspended">
                                    {{ user.isSuspended ? 'Gesperrt' : 'Aktiv' }}
                                </button>
                            </td>
                            <td class="px-6 py-4 text-right">
                                <button
                                    (click)="deleteUser(user)"
                                    [disabled]="isSelf(user)"
                                    class="p-2 text-accent-danger-400 hover:bg-accent-danger-500/10 rounded-lg transition-colors disabled:opacity-30">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div *ngIf="loading()" class="p-12 flex justify-center">
                <div class="w-8 h-8 border-4 border-brand-500/20 border-l-brand-500 rounded-full animate-spin"></div>
            </div>

            <div *ngIf="!loading() && users().length === 0" class="p-12 text-center text-neutral-500">
                Keine Benutzer gefunden.
            </div>
        </div>
    `
})
export class UserManagement implements OnInit {
    private authService = inject(AuthService);
    
    users = signal<any[]>([]);
    loading = signal(true);

    ngOnInit() {
        this.loadUsers();
    }

    loadUsers() {
        this.loading.set(true);
        this.authService.getUsers().subscribe(users => {
            this.users.set(users);
            this.loading.set(false);
        });
    }

    isSelf(user: any): boolean {
        return user.id === this.authService.currentUser()?.id;
    }

    updateRole(user: any, role: string) {
        if (this.isSelf(user)) return;
        this.authService.updateUserRole(user.id, role).subscribe(success => {
            if (success) {
                this.loadUsers();
            } else {
                alert('Fehler beim Aktualisieren der Rolle.');
            }
        });
    }

    updateMaxTrees(user: any, value: string) {
        const maxTrees = parseInt(value, 10);
        if (isNaN(maxTrees) || maxTrees < 0) return;
        this.authService.setUserMaxTrees(user.id, maxTrees).subscribe(success => {
            if (success) {
                this.loadUsers();
            } else {
                alert('Fehler beim Aktualisieren des Baum-Limits.');
            }
        });
    }

    toggleSuspend(user: any) {
        if (this.isSelf(user)) return;
        this.authService.setUserSuspended(user.id, !user.isSuspended).subscribe(success => {
            if (success) {
                this.loadUsers();
            } else {
                alert('Fehler beim Aktualisieren des Sperrstatus.');
            }
        });
    }

    deleteUser(user: any) {
        if (this.isSelf(user)) return;
        if (confirm(`Möchten Sie den Benutzer "${user.username}" wirklich löschen? Der Zugang wird entzogen.`)) {
            this.authService.deleteUser(user.id).subscribe(result => {
                if (result.success) {
                    this.loadUsers();
                } else {
                    alert(result.message || 'Fehler beim Löschen des Benutzers.');
                }
            });
        }
    }
}
