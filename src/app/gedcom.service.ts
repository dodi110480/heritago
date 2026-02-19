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
    private baseApiUrl = `http://${window.location.hostname}:8000/index.php?route=%2Fapi%2Ftree%2F`;

    getTreeData(treeName?: string): Observable<TreeData | null> {
        const timestamp = new Date().getTime();
        if (treeName) {
            return this.http.get<TreeData>(`${this.baseApiUrl}${treeName}&t=${timestamp}`, { withCredentials: true });
        }

        return this.authService.getTrees().pipe(
            switchMap(trees => {
                if (trees.length > 0) {
                    // Filter out the broken DEFAULT_TREE
                    const validTrees = trees.filter(t => t.name !== 'DEFAULT_TREE');

                    if (validTrees.length > 0) {
                        // Prioritize 'sperlich' if it exists
                        const sperlichTree = validTrees.find(t => t.name.toLowerCase() === 'sperlich');
                        const treeToLoad = sperlichTree || validTrees[0];

                        return this.http.get<TreeData>(`${this.baseApiUrl}${treeToLoad.name}&t=${timestamp}`, { withCredentials: true });
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
        // Defaults to current date on backend if not provided
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/calendar`, { withCredentials: true });
    }

    getMapData(treeName: string): Observable<any> {
        // Fix URL construction: remove .php?route=... from baseApiUrl and use clean route if possible,
        // or just append correctly. The baseApiUrl already has ?route=...
        // baseApiUrl is 'http://localhost:8000/index.php?route=%2Fapi%2Ftree%2F'
        // So we need: http://localhost:8000/index.php?route=/api/tree/{treeName}/map
        // The current implementation appends treeName directly to baseApiUrl
        // e.g. ...%2Fapi%2Ftree%2Fsperlich
        // To append /map, we need to append encoded /map
        return this.http.get<any>(`${this.baseApiUrl}${treeName}%2Fmap`, { withCredentials: true });
    }

    getMedia(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/media`, { withCredentials: true });
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
}
