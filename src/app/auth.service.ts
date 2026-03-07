import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of, catchError, map } from 'rxjs';
import { environment } from './environment';

export interface User {
    id: string;
    username: string;
    email: string;
    isAdmin: boolean;
}

export interface Tree {
    id: string; // Changed to string for UUID support
    name: string;
    title: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private http = inject(HttpClient);
    // New base URL for Node.js
    private apiUrl = environment.apiUrl;

    currentUser = signal<User | null>(null);
    currentTree = signal<Tree | null>(null);

    constructor() {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            this.currentUser.set(JSON.parse(savedUser));
        }

        const savedTree = localStorage.getItem('activeTree');
        if (savedTree) {
            try {
                const parsed = JSON.parse(savedTree);
                // Ensure it's an object with a name property
                if (parsed && typeof parsed === 'object' && parsed.name) {
                    this.currentTree.set(parsed);
                } else if (typeof parsed === 'string') {
                    // Backwards compatibility/migration: if it was just a string, we might need to find the full tree object later
                    // But for now, let's just not set it to avoid broken states
                    console.warn('Saved tree was a string, expected an object. Resetting.');
                    localStorage.removeItem('activeTree');
                }
            } catch (e) {
                console.error('Error parsing saved tree:', e);
                localStorage.removeItem('activeTree');
            }
        }
    }

    selectTree(tree: Tree) {
        this.currentTree.set(tree);
        localStorage.setItem('activeTree', JSON.stringify(tree));
    }

    login(username: string, password: string): Observable<boolean> {
        return this.http.post<any>(`${this.apiUrl}/auth/login`,
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

    register(username: string, email: string, password: string): Observable<{ success: boolean, message?: string }> {
        return this.http.post<any>(`${this.apiUrl}/auth/register`,
            { username, email, password },
            { withCredentials: true }
        ).pipe(
            map(response => {
                if (response.success) {
                    this.currentUser.set(response.user);
                    localStorage.setItem('user', JSON.stringify(response.user));
                    return { success: true };
                }
                return { success: false, message: response.message };
            }),
            catchError(err => of({ success: false, message: err.error?.message || 'Registrierung fehlgeschlagen.' }))
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
        return this.http.get<any>(`${this.apiUrl}/trees`, { withCredentials: true }).pipe(
            map(response => response.success ? response.trees : []),
            catchError(() => of([]))
        );
    }

    createTree(name: string, title: string, firstName: string, lastName: string, gender: string, birthDate: string, userId?: string): Observable<{ success: boolean; message?: string; tree?: Tree }> {
        return this.http.post<any>(`${this.apiUrl}/tree/create`,
            { name, title, firstName, lastName, gender, birthDate, userId },
            { withCredentials: true }
        ).pipe(
            map(response => ({ success: response.success, message: response.message, tree: response.tree })),
            catchError(err => of({ success: false, message: err.error?.message || 'Ein unbekannter Fehler ist aufgetreten.' }))
        );
    }

    updateTree(id: string, data: { title?: string, description?: string }): Observable<any> {
        return this.http.put<any>(`${this.apiUrl}/tree/${id}`, data, { withCredentials: true });
    }

    deleteTree(id: string): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}/tree/${id}`, { withCredentials: true });
    }

    // Admin Methods
    getUsers(): Observable<any[]> {
        return this.http.get<any>(`${this.apiUrl}/admin/users`, { withCredentials: true }).pipe(
            map(response => response.success ? response.users : []),
            catchError(() => of([]))
        );
    }

    deleteUser(id: string): Observable<boolean> {
        return this.http.delete<any>(`${this.apiUrl}/admin/users/${id}`, { withCredentials: true }).pipe(
            map(response => response.success),
            catchError(() => of(false))
        );
    }

    updateUserRole(id: string, role: string): Observable<boolean> {
        return this.http.patch<any>(`${this.apiUrl}/admin/users/${id}/role`, { role }, { withCredentials: true }).pipe(
            map(response => response.success),
            catchError(() => of(false))
        );
    }
}
