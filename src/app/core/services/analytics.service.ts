import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, of } from 'rxjs';
import { environment } from '../../environment';

@Injectable({
    providedIn: 'root'
})
export class AnalyticsService {
    private http = inject(HttpClient);
    private baseApiUrl = `${environment.apiUrl}/tree/`;

    getCalendarEvents(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/calendar`, { withCredentials: true });
    }

    getMapData(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/map`, { withCredentials: true });
    }

    getStatistics(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/statistics`, { withCredentials: true });
    }

    getChangeLog(treeName: string): Observable<any[]> {
        return this.http.get<{ success: boolean, logs: any[] }>(`${this.baseApiUrl}${treeName}/changelog`, { withCredentials: true }).pipe(
            switchMap(res => of(res.logs || []))
        );
    }

    getDiagnostics(treeName: string): Observable<any> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/diagnostics`, { withCredentials: true });
    }
}
