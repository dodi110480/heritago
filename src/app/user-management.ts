import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { AppPageHeaderComponent } from './shared/components/ui/app-page-header';

@Component({
    selector: 'app-user-management',
    standalone: true,
    imports: [CommonModule, RouterModule, AppPageHeaderComponent],
    template: `
        <app-page-header title="Benutzerverwaltung" description="Verwalte alle registrierten Benutzer und deren Rollen.">
            <div actions>
                <a routerLink="/settings" class="btn-ghost !py-2">Zurück</a>
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
                            <th class="px-6 py-4 font-semibold">Beigetreten</th>
                            <th class="px-6 py-4 font-semibold">Stammbäume</th>
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
                                    (change)="updateRole(user.id, $any($event.target).value)"
                                    class="bg-canvas-black/30 border border-canvas-white/10 rounded-lg px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:border-brand-500">
                                    <option value="USER">USER</option>
                                    <option value="ADMIN">ADMIN</option>
                                </select>
                            </td>
                            <td class="px-6 py-4 text-neutral-400 text-xs">{{ user.createdAt | date:'mediumDate' }}</td>
                            <td class="px-6 py-4">
                                <span class="px-2 py-1 rounded-full bg-canvas-white/10 text-neutral-300 text-[10px] font-bold">
                                    {{ user._count.permissions }}
                                </span>
                            </td>
                            <td class="px-6 py-4 text-right">
                                <button 
                                    (click)="deleteUser(user)"
                                    [disabled]="user.username === 'Dodi'"
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

    updateRole(userId: string, role: string) {
        this.authService.updateUserRole(userId, role).subscribe(success => {
            if (success) {
                this.loadUsers();
            } else {
                alert('Fehler beim Aktualisieren der Rolle.');
            }
        });
    }

    deleteUser(user: any) {
        if (user.username === 'Dodi') return;
        
        if (confirm(`Möchten Sie den Benutzer "${user.username}" wirklich löschen? Alle verknüpften Daten im System bleiben bestehen, aber der Zugang wird entzogen.`)) {
            this.authService.deleteUser(user.id).subscribe(success => {
                if (success) {
                    this.loadUsers();
                } else {
                    alert('Fehler beim Löschen des Benutzers.');
                }
            });
        }
    }
}
