import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environment';

@Injectable({
    providedIn: 'root'
})
export class SourceService {
    private http = inject(HttpClient);
    private baseApiUrl = `${environment.apiUrl}/tree/`;

    getSource(treeName: string, id: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/source/${id}`, { withCredentials: true });
    }

    getSourceUsage(treeName: string, sourceId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/source/${sourceId}/usage`, { withCredentials: true });
    }

    getSources(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/source`, { withCredentials: true });
    }

    saveSource(treeName: string, payload: any): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/source`, payload, { withCredentials: true });
    }

    mergeSources(treeName: string, sourceId: string, targetId: string): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/source/merge`, { sourceId, targetId }, { withCredentials: true });
    }

    getRepositories(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/repository`, { withCredentials: true });
    }

    saveRepository(treeName: string, payload: any): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/repository`, payload, { withCredentials: true });
    }
}
