import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environment';

@Injectable({
    providedIn: 'root'
})
export class FamilyService {
    private http = inject(HttpClient);
    private baseApiUrl = `${environment.apiUrl}/tree/`;

    saveFamily(treeName: string, data: any): Observable<any> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/family`, data, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getFullProfile(treeName: string, familyId: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/family/${familyId}/full-profile`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    deleteFamily(treeName: string, familyId: string): Observable<any> {
        return this.http.delete<any>(`${this.baseApiUrl}${treeName}/family/${familyId}`, { withCredentials: true });
    }
}
