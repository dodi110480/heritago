import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environment';

@Injectable({
    providedIn: 'root'
})
export class SourceService {
    private http = inject(HttpClient);
    private baseApiUrl = `${environment.apiUrl}/tree/`;

    getSource(treeName: string, id: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/source/${id}`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getSourceUsage(treeName: string, sourceId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/source/${sourceId}/usage`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getSources(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/source`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    saveSource(treeName: string, payload: any): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/source`, payload, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    mergeSources(treeName: string, sourceId: string, targetId: string): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/source/merge`, { sourceId, targetId }, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getRepositories(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/repository`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    saveRepository(treeName: string, payload: any): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/repository`, payload, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }
}
