import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TreeService } from '../../core/services/tree.service';
import { AuthService } from '../../core/services/auth.service';
import { GenealogyValidationService, ValidationResult } from '../../core/services/genealogy-validation.service';
import { AppPageHeaderComponent } from '../../shared/components/ui/app-page-header';


import { AnalyticsService } from '../../core/services/analytics.service';
interface GedcomError {
    id: string;
    type: string;
    line: number;
    code: string;
    message: string;
    explanation: string;
    content: string;
    expanded?: boolean;
}

@Component({
    selector: 'app-diagnostics',
    standalone: true,
    imports: [CommonModule, RouterLink, AppPageHeaderComponent],
    templateUrl: './diagnostics.html'
})
export class Diagnostics implements OnInit {
    public analyticsService = inject(AnalyticsService);
    private treeService = inject(TreeService);
    private validationService = inject(GenealogyValidationService);
    authService = inject(AuthService);

    issues = signal<any[]>([]);
    isLoading = signal<boolean>(true);
    treeName = signal<string>('');
    filterType = signal<'ALL' | 'error' | 'warning' | 'todo'>('ALL');

    ngOnInit() {
        this.loadDiagnostics();
    }

    get filteredIssues() {
        const issues = this.issues();
        const type = this.filterType();
        if (type === 'ALL') return issues;
        return issues.filter(i => i.type === type);
    }

    getIssueCount(type: 'error' | 'warning' | 'todo' | 'ALL') {
        if (type === 'ALL') return this.issues().length;
        return this.issues().filter(i => i.type === type).length;
    }

    loadDiagnostics() {
        this.isLoading.set(true);
        const currentTree = this.authService.currentTree();
        if (currentTree) {
            this.treeName.set(currentTree.name);
            this.analyticsService.getDiagnostics(currentTree.name).subscribe({
                next: (data) => {
                    this.issues.set(data.issues || []);
                    this.isLoading.set(false);
                },
                error: (err) => {
                    console.error('Error loading diagnostics', err);
                    this.issues.set([]);
                    this.isLoading.set(false);
                }
            });
        }
    }

    toggleExpand(error: GedcomError) {
        error.expanded = !error.expanded;
    }
}
