import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { TokenService } from '../services/token.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const router = inject(Router);

  // Get token from TokenService
  const token = tokenService.getToken();

  // Skip adding token for auth endpoints (login, register, verify)
  const isAuthEndpoint = req.url.includes('/auth/login') || 
                         req.url.includes('/auth/signup') || 
                         req.url.includes('/auth/verify') ||
                         req.url.includes('/auth/resend');

  // Clone request and add Authorization header if token exists and is valid
  if (token && tokenService.isTokenValid() && !isAuthEndpoint) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    return next(cloned).pipe(
      catchError((error: HttpErrorResponse) => {
        // Handle 401 Unauthorized - token expired or invalid
        if (error.status === 401) {
          console.error('401 Unauthorized - token expired or invalid');
          // Clear token and redirect to login
          tokenService.clearAll();
          router.navigate(['/login']);
        }
        // Handle 403 Forbidden - user doesn't have permission
        if (error.status === 403) {
          console.error('403 Forbidden - user does not have permission for this action');
          console.error('Request URL:', req.url);
          console.error('User role from token:', tokenService.getRoleFromToken());
        }
        return throwError(() => error);
      })
    );
  }
  
  // If token exists but is invalid, log warning
  if (token && !tokenService.isTokenValid() && !isAuthEndpoint) {
    console.warn('Token exists but is invalid/expired. Request will be sent without Authorization header.');
  }

  // If token exists but is invalid, clear it
  if (token && !tokenService.isTokenValid()) {
    tokenService.clearAll();
  }

  return next(req);
};

