import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';

@Component({
    selector: 'app-tree-administration',
    standalone: true,
    imports: [CommonModule, RouterModule, AppPageHeaderComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <app-page-header title="Stammbaumverwaltung" description="Übersicht aller Stammbäume, ihrer Besitzer und Mitarbeiter. Verwaiste Bäume können hier neu zugewiesen werden.">
            <div actions>
                <a routerLink="/settings" class="btn-ghost py-2!">Zurück</a>
            </div>
        </app-page-header>

        <div class="glass-card overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-canvas-white/10 text-neutral-400 text-xs uppercase tracking-wider">
                            <th class="px-6 py-4 font-semibold">Stammbaum</th>
                            <th class="px-6 py-4 font-semibold">Öffentlich</th>
                            <th class="px-6 py-4 font-semibold">Besitzer</th>
                            <th class="px-6 py-4 font-semibold">Mitarbeiter</th>
                            <th class="px-6 py-4 font-semibold">Personen</th>
                            <th class="px-6 py-4 font-semibold">Medien</th>
                            <th class="px-6 py-4 font-semibold">Status</th>
                            <th class="px-6 py-4 font-semibold text-right">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-canvas-white/5">
                        @for (tree of trees(); track tree.id) {
                            <tr class="hover:bg-canvas-white/5 transition-colors">
                                <td class="px-6 py-4">
                                    <div class="font-medium text-canvas-white">{{ tree.title || tree.name }}</div>
                                    <div class="text-xs text-neutral-500">{{ tree.name }}</div>
                                </td>
                                <td class="px-6 py-4 text-neutral-300 text-sm">
                                    {{ tree.isPublic ? 'Ja' : 'Nein' }}
                                </td>
                                <td class="px-6 py-4 text-neutral-300 text-sm">
                                    @if (tree.owners?.length) {
                                        <span>{{ ownerLabel(tree) }}</span>
                                    } @else {
                                        <span class="text-accent-danger-400 font-bold">Verwaist</span>
                                    }
                                </td>
                                <td class="px-6 py-4 text-neutral-300 text-sm">
                                    {{ collaboratorLabel(tree) || '–' }}
                                </td>
                                <td class="px-6 py-4 text-neutral-300 text-sm">{{ tree.counts?.persons ?? 0 }}</td>
                                <td class="px-6 py-4 text-neutral-300 text-sm">{{ tree.counts?.media ?? 0 }}</td>
                                <td class="px-6 py-4">
                                    @if (tree.isOrphaned) {
                                        <span class="badge badge-xs bg-accent-danger-500/15 text-accent-danger-400">Verwaist</span>
                                    } @else {
                                        <span class="badge badge-xs bg-accent-success-500/15 text-accent-success-400">Aktiv</span>
                                    }
                                </td>
                                <td class="px-6 py-4">
                                    <div class="flex items-center justify-end gap-2">
                                        <select
                                            [value]="selectedOwner()[tree.id] ?? ''"
                                            (change)="selectOwner(tree.id, $any($event.target).value)"
                                            class="bg-canvas-black/30 border border-canvas-white/10 rounded-lg px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:border-brand-500">
                                            <option value="">Besitzer wählen…</option>
                                            @for (user of users(); track user.id) {
                                                <option [value]="user.id">{{ user.username }}</option>
                                            }
                                        </select>
                                        <button
                                            (click)="reassign(tree)"
                                            class="px-3 py-1 rounded-lg bg-brand-500/15 text-brand-400 hover:bg-brand-500/25 text-xs font-semibold transition-colors">
                                            Zuweisen
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        }
                    </tbody>
                </table>
            </div>

            @if (loading()) {
                <div class="p-12 flex justify-center">
                    <div class="w-8 h-8 border-4 border-brand-500/20 border-l-brand-500 rounded-full animate-spin"></div>
                </div>
            }

            @if (!loading() && trees().length === 0) {
                <div class="p-12 text-center text-neutral-500">
                    Keine Stammbäume gefunden.
                </div>
            }
        </div>
    `
})
export class TreeAdministration implements OnInit {
    private authService = inject(AuthService);

    trees = signal<any[]>([]);
    users = signal<any[]>([]);
    loading = signal(true);
    selectedOwner = signal<Record<string, string>>({});

    ngOnInit() {
        this.load();
    }

    load() {
        this.loading.set(true);
        this.authService.getAllTrees().subscribe(trees => {
            this.trees.set(trees);
            this.loading.set(false);
        });
        this.authService.getUsers().subscribe(users => {
            this.users.set(users);
        });
    }

    ownerLabel(tree: any): string {
        return tree.owners?.map((o: any) => o.username).join(', ') || '';
    }

    collaboratorLabel(tree: any): string {
        return tree.collaborators?.map((c: any) => `${c.username} (${c.level})`).join(', ') || '';
    }

    selectOwner(treeId: string, userId: string) {
        const map = { ...this.selectedOwner() };
        map[treeId] = userId;
        this.selectedOwner.set(map);
    }

    reassign(tree: any) {
        const userId = this.selectedOwner()[tree.id];
        if (!userId) {
            alert('Bitte einen Benutzer als neuen Besitzer auswählen.');
            return;
        }
        if (!confirm(`Den Stammbaum "${tree.title || tree.name}" an den ausgewählten Benutzer übertragen?`)) {
            return;
        }
        this.authService.reassignTreeOwner(tree.id, userId).subscribe(success => {
            if (success) {
                this.load();
            } else {
                alert('Fehler beim Übertragen des Stammbaums.');
            }
        });
    }
}
