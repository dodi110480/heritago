import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, throwError, switchMap, BehaviorSubject, filter, take, Observable } from 'rxjs';
import { environment } from '../../environment';

let isRefreshing = false;
const refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const apiUrl = environment.apiUrl;

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // If it's a 401 and not already a login/refresh attempt
      if (error.status === 401 && !req.url.includes('/auth/login') && !req.url.includes('/auth/refresh')) {
        return handle401Error(req, next, authService, apiUrl);
      }
      return throwError(() => error);
    })
  );
};

function handle401Error(request: HttpRequest<any>, next: HttpHandlerFn, authService: AuthService, apiUrl: string) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refresh().pipe(
      switchMap((success) => {
        isRefreshing = false;
        if (success) {
          refreshTokenSubject.next(true);
          return next(request);
        } else {
          authService.logout();
          return throwError(() => new Error('Session expired'));
        }
      }),
      catchError((err) => {
        isRefreshing = false;
        authService.logout();
        return throwError(() => err);
      })
    );
  } else {
    // Wait for the refresh to complete
    return refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(() => next(request))
    );
  }
}
