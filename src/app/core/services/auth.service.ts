import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, of, catchError, map } from 'rxjs';
import { environment } from '../../environment';

export interface User {
    id: string;
    username: string;
    email: string;
    isAdmin: boolean;
}

export type TreeAccessLevel = 'OWNER' | 'EDITOR' | 'VIEWER' | 'COMMENTER';

export interface Tree {
    id: string; // Changed to string for UUID support
    name: string;
    title: string;
    description?: string;
    isPublic?: boolean;
    /**
     * Own access level for this tree. Delivered by `GET /api/trees`
     * (see .clinerules/auth-rbac.md) and used to gate write actions in the UI.
     */
    permission?: TreeAccessLevel | null;
    _count?: { persons?: number; families?: number; media?: number };
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);
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

    init(): Promise<void> {
        return new Promise((resolve) => {
            this.http.get<any>(`${this.apiUrl}/auth/me`, { withCredentials: true }).subscribe({
                next: (response) => {
                    const user = response?.data ?? response?.user;
                    if (response?.success && user) {
                        this.currentUser.set(user);
                        localStorage.setItem('user', JSON.stringify(user));
                        resolve();
                    } else {
                        // Try refresh
                        this.refresh().subscribe({
                            next: (success) => {
                                if (success) {
                                    this.http.get<any>(`${this.apiUrl}/auth/me`, { withCredentials: true }).subscribe({
                                        next: (res2) => {
                                            const u2 = res2?.data ?? res2?.user;
                                            this.currentUser.set(u2);
                                            localStorage.setItem('user', JSON.stringify(u2));
                                            resolve();
                                        },
                                        error: () => { resolve(); }
                                    });
                                } else {
                                    resolve();
                                }
                            },
                            error: () => resolve()
                        });
                    }
                },
                error: () => {
                   this.refresh().subscribe(() => resolve());
                }
            });
        });
    }

    refresh(): Observable<boolean> {
        return this.http.post<any>(`${this.apiUrl}/auth/refresh`, {}, { withCredentials: true }).pipe(
            map(res => !!res.success),
            catchError(() => of(false))
        );
    }

    selectTree(tree: Tree) {
        this.currentTree.set(tree);
        localStorage.setItem('activeTree', JSON.stringify(tree));
    }

    login(username: string, password: string): Observable<{ success: boolean, message?: string }> {
        return this.http.post<any>(`${this.apiUrl}/auth/login`,
            { username, password },
            { withCredentials: true }
        ).pipe(
            map(response => {
                if (response.success) {
                    const user = response?.data ?? response?.user;
                    this.currentUser.set(user);
                    localStorage.setItem('user', JSON.stringify(user));
                    return { success: true };
                }
                return { success: false, message: response.message || 'Ungültige Anmeldedaten.' };
            }),
            catchError(err => of({ success: false, message: err.error?.message || 'Ungültige Anmeldedaten.' }))
        );
    }

    register(username: string, email: string, password: string, website?: string): Observable<{ success: boolean, message?: string }> {
        return this.http.post<any>(`${this.apiUrl}/auth/register`,
            { username, email, password, website },
            { withCredentials: true }
        ).pipe(
            map(response => {
                if (response.success) {
                    return { success: true, message: response.data?.message };
                }
                return { success: false, message: response.message };
            }),
            catchError(err => of({ success: false, message: err.error?.message || 'Registrierung fehlgeschlagen.' }))
        );
    }

    logout() {
        this.http.post<any>(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true }).subscribe({
            error: () => {}
        });
        this.currentUser.set(null);
        localStorage.removeItem('user');
        this.currentTree.set(null);
        localStorage.removeItem('activeTree');
        this.router.navigate(['/login']);
    }

    isAuthenticated(): boolean {
        return this.currentUser() !== null;
    }

    getTrees(): Observable<Tree[]> {
        if (!environment.production) {
            console.log(`[AuthService] Fetching trees from ${this.apiUrl}/trees`);
        }
        return this.http.get<any>(`${this.apiUrl}/trees`, { withCredentials: true }).pipe(
            map(response => {
                if (!environment.production) {
                    console.log('[AuthService] getTrees response:', response);
                }
                return response.success ? (response.data ?? response.trees ?? []) : [];
            }),
            catchError((err) => {
                console.error('[AuthService] Error fetching trees:', err);
                return of([]);
            })
        );
    }

    createTree(name: string, title: string, firstName: string, lastName: string, gender: string, birthDate: string): Observable<{ success: boolean; message?: string; tree?: Tree }> {
        return this.http.post<any>(`${this.apiUrl}/trees`,
            { name, title, firstName, lastName, gender, birthDate },
            { withCredentials: true }
        ).pipe(
            map(response => ({ success: response.success, message: response.message, tree: response.data ?? response.tree })),
            catchError(err => of({ success: false, message: err.error?.message || 'Ein unbekannter Fehler ist aufgetreten.' }))
        );
    }

    updateTree(id: string, data: { title?: string, description?: string }): Observable<any> {
        return this.http.put<any>(`${this.apiUrl}/tree/${id}`, data, { withCredentials: true }).pipe(
            catchError(err => of({ success: false, message: err.error?.message || 'Update fehlgeschlagen.' }))
        );
    }

    deleteTree(id: string): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}/tree/${id}`, { withCredentials: true }).pipe(
            catchError(err => of({ success: false, message: err.error?.message || 'Löschen fehlgeschlagen.' }))
        );
    }

    // Admin Methods
    getUsers(): Observable<any[]> {
        return this.http.get<any>(`${this.apiUrl}/admin/users`, { withCredentials: true }).pipe(
            map(response => response.success ? (response.data ?? response.users ?? []) : []),
            catchError(() => of([]))
        );
    }

    deleteUser(id: string): Observable<{ success: boolean; message?: string }> {
        return this.http.delete<any>(`${this.apiUrl}/admin/users/${id}`, { withCredentials: true }).pipe(
            map(response => ({ success: response.success, message: response.message })),
            catchError(err => of({ success: false, message: err.error?.message || 'Löschen fehlgeschlagen.' }))
        );
    }

    updateUserRole(id: string, role: string): Observable<boolean> {
        return this.http.patch<any>(`${this.apiUrl}/admin/users/${id}/role`, { role }, { withCredentials: true }).pipe(
            map(response => response.success),
            catchError(() => of(false))
        );
    }

    setUserSuspended(id: string, suspended: boolean): Observable<boolean> {
        return this.http.patch<any>(`${this.apiUrl}/admin/users/${id}/suspend`, { suspended }, { withCredentials: true }).pipe(
            map(response => response.success),
            catchError(() => of(false))
        );
    }

    setUserMaxTrees(id: string, maxTrees: number): Observable<boolean> {
        return this.http.patch<any>(`${this.apiUrl}/admin/users/${id}/max-trees`, { maxTrees }, { withCredentials: true }).pipe(
            map(response => response.success),
            catchError(() => of(false))
        );
    }

    // Admin tree administration (metadata only — no genealogy payload).
    getAllTrees(): Observable<any[]> {
        return this.http.get<any>(`${this.apiUrl}/admin/trees`, { withCredentials: true }).pipe(
            map(response => response.success ? (response.data ?? response.trees ?? []) : []),
            catchError(() => of([]))
        );
    }

    reassignTreeOwner(treeId: string, userId: string): Observable<boolean> {
        return this.http.patch<any>(`${this.apiUrl}/admin/trees/${treeId}/owner`, { userId }, { withCredentials: true }).pipe(
            map(response => response.success),
            catchError(() => of(false))
        );
    }

    verifyEmail(token: string): Observable<{ success: boolean, message?: string }> {
        return this.http.post<any>(`${this.apiUrl}/auth/verify-email`, { token }, { withCredentials: true }).pipe(
            map(response => ({ success: response.success, message: response.message })),
            catchError(err => of({ success: false, message: err.error?.message || 'Verifizierung fehlgeschlagen.' }))
        );
    }

    forgotPassword(email: string): Observable<{ success: boolean, message?: string }> {
        return this.http.post<any>(`${this.apiUrl}/auth/forgot-password`, { email }, { withCredentials: true }).pipe(
            map(response => ({ success: response.success, message: response.message })),
            catchError(err => of({ success: false, message: err.error?.message || 'Anfrage fehlgeschlagen.' }))
        );
    }

    resetPassword(token: string, password: string): Observable<{ success: boolean, message?: string }> {
        return this.http.post<any>(`${this.apiUrl}/auth/reset-password`, { token, password }, { withCredentials: true }).pipe(
            map(response => ({ success: response.success, message: response.message })),
            catchError(err => of({ success: false, message: err.error?.message || 'Zurücksetzen fehlgeschlagen.' }))
        );
    }
}
