import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, of, map } from 'rxjs';
import { environment } from '../../environment';

@Injectable({
    providedIn: 'root'
})
export class AnalyticsService {
    private http = inject(HttpClient);
    private baseApiUrl = `${environment.apiUrl}/tree/`;

    getCalendarEvents(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/calendar`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getMapData(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/map`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getStatistics(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/statistics`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getChangeLog(treeName: string): Observable<any[]> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/changelog`, { withCredentials: true }).pipe(
            switchMap(res => of(res?.data ?? res?.logs ?? []))
        );
    }

    getDiagnostics(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/diagnostics`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }

    getDiagnosticsSummary(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/validation/summary`, { withCredentials: true }).pipe(
            map(res => res?.data ?? res)
        );
    }
}
