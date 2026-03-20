import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, map } from 'rxjs';
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
        }).pipe(map(res => res?.data ?? res));
    }

    getFullProfile(treeName: string, personId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/person/${personId}/full-profile`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getTimeline(treeName: string, xref: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/timeline/${xref}`, { withCredentials: true });
    }

    savePerson(treeName: string, data: any): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/person`, data, { withCredentials: true }).pipe(
            map(res => res?.data ?? res),
            tap({
                error: (err) => console.error('[PersonService] savePerson error', err)
            }),
            catchError(err => { throw err; })
        );
    }

    deletePerson(treeName: string, id: string): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/person`, { mode: 'delete', id }, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    deletePersonById(treeName: string, id: string): Observable<any> {
        return this.http.delete<any>(`${this.baseApiUrl}${treeName}/person/${id}`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getChildren(treeName: string, personId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/person/${personId}/children`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getSpouses(treeName: string, personId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/person/${personId}/spouses`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getParents(treeName: string, personId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/person/${personId}/parents`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getSiblings(treeName: string, personId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/person/${personId}/siblings`, { withCredentials: true });
    }

    getFamilyOverview(treeName: string, personId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/person/${personId}/family-overview`, { withCredentials: true });
    }

    getFamiliesOfPerson(treeName: string, personId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/person/${personId}/families`, { withCredentials: true });
    }

    getFamilyById(treeName: string, familyId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/family/${familyId}`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }
}
