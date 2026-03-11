import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError } from 'rxjs';
import { environment } from '../../environment';

@Injectable({
    providedIn: 'root'
})
export class PersonService {
    private http = inject(HttpClient);
    private baseApiUrl = `${environment.apiUrl}/tree/`;

    searchIndividuals(treeName: string, query: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/search`, {
            params: { q: query },
            withCredentials: true
        });
    }

    getTimeline(treeName: string, xref: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/timeline/${xref}`, { withCredentials: true });
    }

    savePerson(treeName: string, data: any): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/person`, data, { withCredentials: true }).pipe(
            tap({
                error: (err) => console.error('[PersonService] savePerson error', err)
            }),
            catchError(err => { throw err; })
        );
    }

    deletePerson(treeName: string, id: string): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/person`, { mode: 'delete', id }, { withCredentials: true });
    }

    deletePersonById(treeName: string, id: string): Observable<any> {
        return this.http.delete<any>(`${this.baseApiUrl}${treeName}/person/${id}`, { withCredentials: true });
    }
}
