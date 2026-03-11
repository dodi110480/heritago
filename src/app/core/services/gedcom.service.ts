import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, of, catchError } from 'rxjs';
import { TreeData } from '../models/models';
import { AuthService } from './auth.service';
import { environment } from '../../environment';

@Injectable({
    providedIn: 'root'
})
export class GedcomService {
    private http = inject(HttpClient);
    private authService = inject(AuthService);
    private baseApiUrl = `${environment.apiUrl}/tree/`;

    currentTreeData = signal<TreeData | null>(null);

    getTreeData(treeName?: string): Observable<TreeData | null> {
        const timestamp = new Date().getTime();

        if (treeName) {
            return this.http.get<TreeData>(`${this.baseApiUrl}${treeName}?t=${timestamp}`, { withCredentials: true }).pipe(
                switchMap(data => {
                    this.currentTreeData.set(data);
                    return of(data);
                }),
                catchError(() => {
                    return this.loadFallbackTree(timestamp);
                })
            );
        }

        const activeTree = this.authService.currentTree();
        if (activeTree) {
            return this.http.get<TreeData>(`${this.baseApiUrl}${activeTree.name}?t=${timestamp}`, { withCredentials: true }).pipe(
                catchError(() => {
                    // If error (e.g. 404 because tree was deleted), clear active tree and try fallback
                    localStorage.removeItem('activeTree');
                    return this.loadFallbackTree(timestamp);
                })
            );
        }

        return this.loadFallbackTree(timestamp);
    }

    private loadFallbackTree(timestamp: number): Observable<TreeData | null> {
        return this.authService.getTrees().pipe(
            switchMap(trees => {
                if (trees.length > 0) {
                    const validTrees = trees.filter(t => t.name !== 'DEFAULT_TREE');
                    if (validTrees.length > 0) {
                        const treeToLoad = validTrees[0];
                        // Set it as active
                        this.authService.selectTree(treeToLoad);
                        return this.http.get<TreeData>(`${this.baseApiUrl}${treeToLoad.name}?t=${timestamp}`, { withCredentials: true }).pipe(
                            switchMap(data => {
                                this.currentTreeData.set(data);
                                return of(data);
                            })
                        );
                    }
                }
                this.currentTreeData.set(null);
                return of(null);
            })
        );
    }
}
