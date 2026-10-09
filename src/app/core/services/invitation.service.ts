import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../environment';

@Injectable({ providedIn: 'root' })
export class InvitationService {
    private http = inject(HttpClient);
    private baseApiUrl = `${environment.apiUrl}/tree/`;

    listInvitations(treeName: string): Observable<any[]> {
        return this.http.get<any>(`${this.baseApiUrl}${treeName}/invitations`, { withCredentials: true }).pipe(
            map(res => res?.data ?? []),
            catchError(() => of([]))
        );
    }

    invite(treeName: string, email: string, level: string): Observable<{ success: boolean; message?: string }> {
        return this.http.post<any>(`${this.baseApiUrl}${treeName}/invitations`, { email, level }, { withCredentials: true }).pipe(
            map(res => ({ success: res.success, message: res.message })),
            catchError(err => of({ success: false, message: err.error?.message || 'Einladung fehlgeschlagen.' }))
        );
    }

    revokeInvitation(treeName: string, id: string): Observable<boolean> {
        return this.http.delete<any>(`${this.baseApiUrl}${treeName}/invitations/${id}`, { withCredentials: true }).pipe(
            map(res => res.success),
            catchError(() => of(false))
        );
    }
}
