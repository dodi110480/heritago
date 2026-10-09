import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../environment';

@Injectable({ providedIn: 'root' })
export class NotificationService {
    private http = inject(HttpClient);
    private apiUrl = environment.apiUrl;

    unreadCount = signal(0);

    refresh(): Observable<{ notifications: any[]; unread: number }> {
        return this.http.get<any>(`${this.apiUrl}/notifications`, { withCredentials: true }).pipe(
            map(res => {
                const data = res?.data ?? { notifications: [], unread: 0 };
                this.unreadCount.set(data.unread ?? 0);
                return data;
            }),
            catchError(() => of({ notifications: [], unread: 0 }))
        );
    }

    markRead(id: string): Observable<boolean> {
        return this.http.post<any>(`${this.apiUrl}/notifications/${id}/read`, {}, { withCredentials: true }).pipe(
            map(() => true),
            catchError(() => of(false))
        );
    }

    markAllRead(): Observable<boolean> {
        return this.http.post<any>(`${this.apiUrl}/notifications/read-all`, {}, { withCredentials: true }).pipe(
            map(() => true),
            catchError(() => of(false))
        );
    }
}
