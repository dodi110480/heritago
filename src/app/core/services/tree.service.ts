import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, of, catchError } from 'rxjs';
import { TreeData } from '../models/models';
import { AuthService } from './auth.service';
import { environment } from '../../environment';

@Injectable({
    providedIn: 'root'
})
export class TreeService {
    private http = inject(HttpClient);
    private authService = inject(AuthService);
    private baseApiUrl = `${environment.apiUrl}/tree/`;

    currentTreeData = signal<TreeData | null>(null);

    /**
     * Fetches the full tree data (individuals, families, etc.)
     * @param treeName Optional tree name. If not provided, uses the active tree from AuthService.
     */
    getTreeData(treeName?: string): Observable<TreeData | null> {
        const timestamp = new Date().getTime();

        if (treeName) {
            return this.http.get<any>(`${this.baseApiUrl}${treeName}?t=${timestamp}`, { withCredentials: true }).pipe(
                switchMap(res => {
                    const data = res?.data ?? res;
                    this.currentTreeData.set(data);
                    return of(data);
                }),
                catchError((err) => {
                    console.error('TreeService: Error fetching tree data for ' + treeName, err);
                    return this.loadFallbackTree(timestamp);
                })
            );
        }

        const activeTree = this.authService.currentTree();
        if (activeTree) {
            return this.http.get<any>(`${this.baseApiUrl}${activeTree.name}?t=${timestamp}`, { withCredentials: true }).pipe(
                switchMap(res => {
                    const data = res?.data ?? res;
                    this.currentTreeData.set(data);
                    return of(data);
                }),
                catchError((err) => {
                    console.error('TreeService: Error fetching tree data for ' + activeTree.name, err);
                    // If error (e.g. 404 because tree was deleted), clear active tree and try fallback
                    localStorage.removeItem('activeTree');
                    return this.loadFallbackTree(timestamp);
                })
            );
        }

        return this.loadFallbackTree(timestamp);
    }

    getMinimalIndividuals(treeName: string): Observable<any[]> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/individuals/minimal`, { withCredentials: true }).pipe(
            switchMap(res => of(res?.data ?? res)),
            catchError(() => of([]))
        );
    }

    searchIndividuals(treeName: string, query: string): Observable<any[]> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/individuals/search?q=${encodeURIComponent(query)}`, { withCredentials: true }).pipe(
            switchMap(res => of(res?.data ?? res)),
            catchError(() => of([]))
        );
    }

    getMinimalSources(treeName: string): Observable<any[]> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/sources/minimal`, { withCredentials: true }).pipe(
            switchMap(res => of(res?.data ?? res)),
            catchError(() => of([]))
        );
    }

    getTreeValidation(treeName: string): Observable<any[]> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/validation`, { withCredentials: true }).pipe(
            switchMap(res => of(res?.data ?? res)),
            catchError(() => of([]))
        );
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
                        return this.http.get<any>(`${this.baseApiUrl}${treeToLoad.name}?t=${timestamp}`, { withCredentials: true }).pipe(
                            switchMap(res => {
                                const data = res?.data ?? res;
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
