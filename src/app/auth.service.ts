import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of, catchError, map } from 'rxjs';

export interface User {
    id: number;
    username: string;
    realName: string;
    isAdmin: boolean;
}

export interface Tree {
    id: number;
    name: string;
    title: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private http = inject(HttpClient);
    private apiUrl = `http://${window.location.hostname}:8000/index.php?route=`;

    currentUser = signal<User | null>(null);
    currentTree = signal<Tree | null>(null);

    constructor() {
        // Try to restore session from localStorage if needed, or check status endpoint
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            this.currentUser.set(JSON.parse(savedUser));
        }
    }

    login(username: string, password: string): Observable<boolean> {
        return this.http.post<any>(`${this.apiUrl}%2Fapi%2Fauth%2Flogin`,
            { username, password },
            { withCredentials: true }
        ).pipe(
            map(response => {
                if (response.success) {
                    this.currentUser.set(response.user);
                    localStorage.setItem('user', JSON.stringify(response.user));
                    return true;
                }
                return false;
            }),
            catchError(() => of(false))
        );
    }

    logout() {
        this.currentUser.set(null);
        localStorage.removeItem('user');
    }

    isAuthenticated(): boolean {
        return this.currentUser() !== null;
    }

    getTrees(): Observable<Tree[]> {
        return this.http.get<any>(`${this.apiUrl}%2Fapi%2Ftrees`, { withCredentials: true }).pipe(
            map(response => response.success ? response.trees : []),
            catchError(() => of([]))
        );
    }

    createTree(name: string, title: string, firstName: string, lastName: string, gender: string, birthDate: string): Observable<{ success: boolean; message?: string }> {
        return this.http.post<any>(`${this.apiUrl}%2Fapi%2Ftree%2Fcreate`,
            { name, title, firstName, lastName, gender, birthDate },
            { withCredentials: true }
        ).pipe(
            map(response => ({ success: response.success, message: response.message })),
            catchError(err => of({ success: false, message: err.error?.message || 'Ein unbekannter Fehler ist aufgetreten.' }))
        );
    }
}
