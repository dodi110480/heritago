import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TreeService } from './tree.service';

export interface ValidationResult {
    type: 'error' | 'warning';
    message: string;
    involvedIds: string[];
}

@Injectable({
    providedIn: 'root'
})
export class GenealogyValidationService {
    private treeService = inject(TreeService);

    validateTree(treeName: string): Observable<ValidationResult[]> {
        return this.treeService.getTreeValidation(treeName);
    }
}
