import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService, Tree } from './auth.service';

@Component({
    selector: 'app-tree-selector',
    standalone: true,
    imports: [CommonModule, RouterModule],
    template: `
        <div class="selector-container">
            <div class="glass-card">
                <div class="header">
                    <h1>Stammbaum wechseln</h1>
                    <p>Wähle aus, an welcher Familiengeschichte du arbeiten möchtest.</p>
                </div>
                
                <div class="tree-grid">
                    <div *ngFor="let tree of availableTrees()" 
                         class="tree-card" 
                         [class.active]="tree.name === authService.currentTree()?.name"
                         (click)="selectTree(tree)">
                        <div class="tree-info">
                            <h3>{{ tree.title }}</h3>
                            <span class="tree-slug">{{ tree.name }}</span>
                        </div>
                        <div class="status-badge" *ngIf="tree.name === authService.currentTree()?.name">
                            Aktiv
                        </div>
                    </div>
                </div>

                <div class="actions">
                    <a routerLink="/create-tree" class="btn-create">Neuen Stammbaum erstellen</a>
                </div>

                <div class="back-link">
                    <a routerLink="/settings" class="back-btn">Zurück zu den Einstellungen</a>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .selector-container { display: flex; justify-content: center; align-items: center; min-height: calc(100vh - 64px); padding: 40px; }
        .glass-card { background: rgba(30, 41, 59, 0.5); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 3rem; width: 100%; max-width: 900px; }
        .header { text-align: center; margin-bottom: 3rem; }
        .header h1 { font-size: 2.5rem; background: linear-gradient(to right, #60a5fa, #a855f7); -webkit-background-clip: text; background-clip: text; color: transparent; margin-bottom: 0.5rem; }
        .header p { color: #94a3b8; }
        
        .tree-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
        .tree-card { 
            background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); 
            border-radius: 16px; padding: 1.5rem; cursor: pointer; transition: all 0.3s;
            display: flex; justify-content: space-between; align-items: center;
        }
        .tree-card:hover { background: rgba(255, 255, 255, 0.1); transform: translateY(-2px); border-color: #60a5fa; }
        .tree-card.active { border-color: #60a5fa; background: rgba(59, 130, 246, 0.1); }
        
        .tree-info h3 { color: #f1f5f9; margin: 0; font-size: 1.2rem; }
        .tree-slug { color: #94a3b8; font-size: 0.85rem; font-family: monospace; }
        
        .status-badge { background: #3b82f6; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; }
        
        .actions { text-align: center; margin-bottom: 2rem; }
        .btn-create { 
            display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); 
            color: white; text-decoration: none; padding: 0.75rem 2rem; border-radius: 12px; 
            font-weight: 600; transition: all 0.3s;
        }
        .btn-create:hover { transform: scale(1.05); filter: brightness(1.1); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
        
        .back-link { text-align: center; }
        .back-btn { color: #94a3b8; text-decoration: none; font-size: 0.9rem; }
        .back-btn:hover { color: #60a5fa; }
    `]
})
export class TreeSelector implements OnInit {
    authService = inject(AuthService);
    private router = inject(Router);
    availableTrees = signal<Tree[]>([]);

    ngOnInit() {
        this.authService.getTrees().subscribe(trees => {
            this.availableTrees.set(trees.filter(t => t.name !== 'DEFAULT_TREE'));
        });
    }

    selectTree(tree: Tree) {
        this.authService.selectTree(tree);
        this.router.navigate(['/dashboard']);
    }
}
