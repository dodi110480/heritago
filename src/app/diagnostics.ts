import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { AuthService } from './auth.service';
import { GenealogyValidationService, ValidationResult } from './genealogy-validation.service';

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
    imports: [CommonModule, RouterLink],
    templateUrl: './diagnostics.html',
    styleUrl: './diagnostics.css'
})
export class Diagnostics implements OnInit {
    private gedcomService = inject(GedcomService);
    private validationService = inject(GenealogyValidationService);
    authService = inject(AuthService);

    errors = signal<GedcomError[]>([]);
    logicalErrors = signal<ValidationResult[]>([]);
    isLoading = signal<boolean>(true);
    treeName = signal<string>('');

    ngOnInit() {
        this.loadDiagnostics();
    }

    loadDiagnostics() {
        this.isLoading.set(true);
        this.authService.getTrees().subscribe(trees => {
            const validTrees = trees.filter(t => t.name !== 'DEFAULT_TREE');
            if (validTrees.length > 0) {
                const sperlichTree = validTrees.find(t => t.name.toLowerCase() === 'sperlich');
                const tree = sperlichTree || validTrees[0];
                this.treeName.set(tree.name);

                this.gedcomService.getDiagnostics(tree.name).subscribe({
                    next: (data) => {
                        this.errors.set(data.errors || []);
                        this.isLoading.set(false);
                    },
                    error: () => {
                        this.errors.set([]);
                        this.isLoading.set(false);
                    }
                });

                // Logical validation
                this.gedcomService.getTreeData(tree.name).subscribe(data => {
                    if (data) {
                        const results = this.validationService.validateTree(data);
                        this.logicalErrors.set(results);
                    }
                });
            }
        });
    }

    toggleExpand(error: GedcomError) {
        error.expanded = !error.expanded;
    }
}
