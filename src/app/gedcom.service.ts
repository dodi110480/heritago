import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, of, catchError } from 'rxjs';
import { TreeData } from './models';
import { AuthService } from './auth.service';
import { environment } from './environment';

@Injectable({
    providedIn: 'root'
})
export class GedcomService {
    private http = inject(HttpClient);
    private authService = inject(AuthService);
    // New clean base URL for the Node.js server
    private baseApiUrl = `${environment.apiUrl}/tree/`;
    private baseMediaUrl = environment.baseUrl;

    currentTreeData = signal<TreeData | null>(null);

    getMediaUrl(url: string | undefined): string {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${this.baseMediaUrl}${url}`;
    }

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

    searchIndividuals(treeName: string, query: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/search`, {
            params: { q: query },
            withCredentials: true
        });
    }

    getCalendarEvents(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/calendar`, { withCredentials: true });
    }

    getMapData(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/map`, { withCredentials: true });
    }

    getMedia(treeId: string, type?: string, search?: string): Observable<any> {
        return this.http.get<any>(`${environment.apiUrl}/media`, {
            params: { treeId, type: type || '', search: search || '' },
            withCredentials: true
        });
    }

    uploadMedia(treeId: string, file: File, title?: string, mediaType?: string): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('treeId', treeId);
        if (title) formData.append('title', title);
        if (mediaType) formData.append('mediaType', mediaType);

        return this.http.post<any>(`${environment.apiUrl}/media/upload`, formData, { withCredentials: true });
    }

    deleteMedia(id: string): Observable<any> {
        return this.http.delete<any>(`${environment.apiUrl}/media/${id}`, { withCredentials: true });
    }

    updateMedia(id: string, data: { title?: string, mediaType?: string }): Observable<any> {
        return this.http.put<any>(`${environment.apiUrl}/media/${id}`, data, { withCredentials: true });
    }

    linkMedia(mediaId: string, linkData: { treeId: string, personId?: string, familyId?: string, sourceId?: string, isPrimary?: boolean }): Observable<any> {
        return this.http.post<any>(`${environment.apiUrl}/media/${mediaId}/link`, linkData, { withCredentials: true });
    }

    unlinkMedia(linkId: string): Observable<any> {
        return this.http.delete<any>(`${environment.apiUrl}/media/link/${linkId}`, { withCredentials: true });
    }

    adoptOrphanMedia(treeId: string, filePath: string, title?: string, mediaType?: string): Observable<any> {
        return this.http.post<any>(`${environment.apiUrl}/media/adopt-orphan`, {
            treeId,
            filePath,
            title,
            mediaType
        }, { withCredentials: true });
    }

    deleteOrphanFile(filePath: string): Observable<any> {
        return this.http.request<any>('delete', `${environment.apiUrl}/media/orphan-file`, {
            body: { filePath },
            withCredentials: true
        });
    }

    getStatistics(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/statistics`, { withCredentials: true });
    }

    getTimeline(treeName: string, xref: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/timeline/${xref}`, { withCredentials: true });
    }

    savePerson(treeName: string, data: any): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/person`, data, { withCredentials: true });
    }

    deletePerson(treeName: string, id: string): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/person`, { mode: 'delete', id }, { withCredentials: true });
    }

    deletePersonById(treeName: string, id: string): Observable<any> {
        return this.http.delete<any>(`${this.baseApiUrl}${treeName}/person/${id}`, { withCredentials: true });
    }

    saveFamily(treeName: string, data: any): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/family`, data, { withCredentials: true });
    }

    searchPlaces(treeName: string, query: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/places/search`, {
            params: { q: query },
            withCredentials: true
        });
    }

    savePlace(treeName: string, data: any): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/place`, data, { withCredentials: true });
    }

    getPlaces(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/place`, { withCredentials: true });
    }

    getPlaceUsage(treeName: string, placeId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/place/${placeId}/usage`, { withCredentials: true });
    }

    mergePlaces(treeName: string, sourceId: string, targetId: string): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/place/merge`, { sourceId, targetId }, { withCredentials: true });
    }

    deletePlace(treeName: string, placeName: string): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/place`, { mode: 'delete', name: placeName }, { withCredentials: true });
    }

    getSources(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/source`, { withCredentials: true });
    }

    getSourceUsage(treeName: string, sourceId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/source/${sourceId}/usage`, { withCredentials: true });
    }

    saveSource(treeName: string, payload: any): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/source`, payload, { withCredentials: true });
    }

    mergeSources(treeName: string, sourceId: string, targetId: string): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/source/merge`, { sourceId, targetId }, { withCredentials: true });
    }

    getDiagnostics(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/diagnostics`, { withCredentials: true });
    }
}
