import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-user-management',
    standalone: true,
    imports: [CommonModule, RouterModule],
    template: `
        <div class="flex justify-center items-center min-h-[calc(100vh-64px)] p-5">
            <div class="bg-neutral-800/70 backdrop-blur-xl border border-canvas-white/10 rounded-[24px] p-12 w-full max-w-[800px] text-center">
                <div class="mb-8">
                    <h1 class="text-[2.5rem] font-bold bg-gradient-to-r from-blue-400 to-accent-highlight-500 bg-clip-text text-transparent mb-2">Benutzerverwaltung</h1>
                    <p class="text-neutral-400">Hier kannst du bald Benutzer und Rollen verwalten.</p>
                </div>
                <div class="text-neutral-100 leading-relaxed mb-12">
                    <p>Die Benutzerverwaltung wird in Kürze verfügbar sein. Hier kannst du neue Nutzer einladen, Passwörter zurücksetzen und Berechtigungen verwalten.</p>
                </div>
                <div>
                    <a routerLink="/settings" class="btn-ghost !w-auto !py-3 !px-6">Zurück zu den Einstellungen</a>
                </div>
            </div>
        </div>
    `
})
export class UserManagement { }
