import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, of } from 'rxjs';
import { TreeData } from './models';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class GedcomService {
    private http = inject(HttpClient);
    private authService = inject(AuthService);
    // New clean base URL for the Node.js server
    private baseApiUrl = `http://${window.location.hostname}:3000/api/tree/`;
    private baseMediaUrl = `http://${window.location.hostname}:3000`;

    getMediaUrl(url: string): string {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${this.baseMediaUrl}${url}`;
    }

    getTreeData(treeName?: string): Observable<TreeData | null> {
        const timestamp = new Date().getTime();
        if (treeName) {
            return this.http.get<TreeData>(`${this.baseApiUrl}${treeName}?t=${timestamp}`, { withCredentials: true });
        }

        // 1. Try active tree from AuthService
        const activeTree = this.authService.currentTree();
        if (activeTree) {
            return this.http.get<TreeData>(`${this.baseApiUrl}${activeTree.name}?t=${timestamp}`, { withCredentials: true });
        }

        // 2. Fallback: load first available tree
        return this.authService.getTrees().pipe(
            switchMap(trees => {
                if (trees.length > 0) {
                    const validTrees = trees.filter(t => t.name !== 'DEFAULT_TREE');
                    if (validTrees.length > 0) {
                        const sperlichTree = validTrees.find(t => t.name.toLowerCase() === 'sperlich');
                        const treeToLoad = sperlichTree || validTrees[0];
                        // Also set it as active if none was set
                        this.authService.selectTree(treeToLoad);
                        return this.http.get<TreeData>(`${this.baseApiUrl}${treeToLoad.name}?t=${timestamp}`, { withCredentials: true });
                    }
                }
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
        return this.http.get<any>(`http://${window.location.hostname}:3000/api/media`, {
            params: { treeId, type: type || '', search: search || '' },
            withCredentials: true
        });
    }

    uploadMedia(treeId: string, file: File, title?: string, description?: string): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('treeId', treeId);
        if (title) formData.append('title', title);
        if (description) formData.append('description', description);

        return this.http.post<any>(`http://${window.location.hostname}:3000/api/media/upload`, formData, { withCredentials: true });
    }

    deleteMedia(id: string): Observable<any> {
        return this.http.delete<any>(`http://${window.location.hostname}:3000/api/media/${id}`, { withCredentials: true });
    }

    linkMedia(mediaId: string, linkData: { individualId?: string, familyId?: string, isPrimary?: boolean }): Observable<any> {
        return this.http.post<any>(`http://${window.location.hostname}:3000/api/media/${mediaId}/link`, linkData, { withCredentials: true });
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

    deletePlace(treeName: string, placeName: string): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/place`, { mode: 'delete', name: placeName }, { withCredentials: true });
    }

    getDiagnostics(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/diagnostics`, { withCredentials: true });
    }
}
