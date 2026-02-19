import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-tree-selector',
    standalone: true,
    imports: [CommonModule, RouterModule],
    template: `
        <div class="placeholder-container">
            <div class="glass-card">
                <div class="header">
                    <h1>Stammbaum wechseln</h1>
                    <p>Wähle aus, an welcher Familiengeschichte du arbeiten möchtest.</p>
                </div>
                <div class="content">
                    <p>Hier wird demnächst eine Liste aller verfügbaren Stammbäume angezeigt, zwischen denen du nahtlos wechseln kannst.</p>
                </div>
                <div class="back-link">
                    <a routerLink="/settings" class="back-btn">Zurück zu den Einstellungen</a>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .placeholder-container { display: flex; justify-content: center; align-items: center; min-height: calc(100vh - 64px); padding: 20px; }
        .glass-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 3rem; width: 100%; max-width: 800px; text-align: center; }
        .header h1 { font-size: 2.5rem; background: linear-gradient(to right, #60a5fa, #a855f7); -webkit-background-clip: text; background-clip: text; color: transparent; margin-bottom: 0.5rem; }
        .header p { color: #94a3b8; margin-bottom: 2rem; }
        .content { color: #f1f5f9; line-height: 1.6; margin-bottom: 3rem; }
        .back-btn { color: #60a5fa; text-decoration: none; border: 1px solid rgba(96, 165, 250, 0.3); padding: 0.75rem 1.5rem; border-radius: 12px; transition: all 0.2s; }
        .back-btn:hover { background: rgba(96, 165, 250, 0.1); border-color: #60a5fa; }
    `]
})
export class TreeSelector { }
