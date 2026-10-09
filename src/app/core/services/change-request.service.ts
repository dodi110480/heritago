import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../environment';

@Injectable({ providedIn: 'root' })
export class ChangeRequestService {
    private http = inject(HttpClient);
    private apiUrl = environment.apiUrl;

    listForOwner(treeName: string): Observable<any[]> {
        return this.http.get<any>(`${this.apiUrl}/tree/${treeName}/change-requests`, { withCredentials: true }).pipe(
            map(res => res?.data ?? []),
            catchError(() => of([]))
        );
    }

    approve(treeName: string, id: string): Observable<boolean> {
        return this.http.post<any>(`${this.apiUrl}/tree/${treeName}/change-requests/${id}/approve`, {}, { withCredentials: true }).pipe(
            map(res => res.success),
            catchError(() => of(false))
        );
    }

    reject(treeName: string, id: string, reason?: string): Observable<boolean> {
        return this.http.post<any>(`${this.apiUrl}/tree/${treeName}/change-requests/${id}/reject`, { reason }, { withCredentials: true }).pipe(
            map(res => res.success),
            catchError(() => of(false))
        );
    }

    getChangeRequest(id: string): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/change-requests/${id}`, { withCredentials: true }).pipe(
            map(res => res?.data ?? null),
            catchError(() => of(null))
        );
    }

    addMessage(id: string, body: string): Observable<boolean> {
        return this.http.post<any>(`${this.apiUrl}/change-requests/${id}/messages`, { body }, { withCredentials: true }).pipe(
            map(res => res.success),
            catchError(() => of(false))
        );
    }

    myRequests(): Observable<any[]> {
        return this.http.get<any>(`${this.apiUrl}/change-requests`, { withCredentials: true }).pipe(
            map(res => res?.data ?? []),
            catchError(() => of([]))
        );
    }

    cancel(id: string): Observable<boolean> {
        return this.http.delete<any>(`${this.apiUrl}/change-requests/${id}`, { withCredentials: true }).pipe(
            map(res => res.success),
            catchError(() => of(false))
        );
    }
}
