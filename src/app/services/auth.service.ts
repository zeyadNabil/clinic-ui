import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { jwtDecode } from 'jwt-decode';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role?: string; // 'ADMIN' or 'PATIENT'
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
  email?: string;
  username?: string;
  name?: string;
  role?: string; // Add role from backend
}

export interface User {
  id?: number;
  username?: string;
  email: string;
  role?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private tokenSubject = new BehaviorSubject<string | null>(this.getToken());
  public token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {}

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        this.setToken(response.token);
        this.tokenSubject.next(response.token);
        // Store full user info from login response including role
        // The backend sends: email, username, name, role
        // Prioritize username (which is the actual username field), then name, never email
        console.log('Login response received:', response);
        const displayName = response.username || response.name || 'User';
        console.log('Display name determined:', displayName, 'from username:', response.username, 'name:', response.name);
        const userInfo = {
          email: response.email || '',
          username: response.username || displayName, // Always store username from response
          name: displayName, // Use username first, then name, never email
          role: response.role || 'PATIENT' // Default to PATIENT if not provided
        };
        console.log('Storing user info in localStorage:', userInfo);
        localStorage.setItem('currentUser', JSON.stringify(userInfo));
        localStorage.setItem('userInfo', JSON.stringify(userInfo));
      }),
      catchError(this.handleError)
    );
  }

  register(userData: RegisterRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/signup`, userData).pipe(
      catchError(this.handleError)
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('currentUser');
    this.tokenSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  private setToken(token: string): void {
    localStorage.setItem('token', token);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getUserRole(): 'ADMIN' | 'PATIENT' | 'DOCTOR' | null {
    const token = this.getToken();
    if (token) {
      try {
        const decodedToken: any = jwtDecode(token);
        console.log('Decoded token role:', decodedToken.role);
        // Handle both 'ROLE_PATIENT', 'ROLE_ROLE_PATIENT', and 'PATIENT' formats
        let role = decodedToken.role || null;
        if (role) {
          // Remove ALL ROLE_ prefixes (case-insensitive) - handles ROLE_ROLE_PATIENT case
          // Use a while loop to remove all occurrences at the start
          while (role && /^ROLE_/i.test(role)) {
            role = role.replace(/^ROLE_/i, '');
          }
          role = role.toUpperCase();
          console.log('Role after removing all ROLE_ prefixes:', role);
          // Validate it's one of the expected roles
          if (['ADMIN', 'PATIENT', 'DOCTOR'].includes(role)) {
            return role as 'ADMIN' | 'PATIENT' | 'DOCTOR';
          } else {
            console.warn('Unknown role format after normalization:', role);
          }
        }
        return null;
      } catch (e) {
        console.error('Error decoding token for role:', e);
        return null;
      }
    }
    return null;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.error) {
        // Try different ways to extract the error message
        if (typeof error.error === 'string') {
          errorMessage = error.error;
        } else if (error.error.message) {
          errorMessage = error.error.message;
        } else if (error.error.error) {
          errorMessage = error.error.error;
        } else if (error.error.status === 409 || error.status === 409) {
          errorMessage = 'Email already registered. Please use a different email or try logging in.';
        }
      }

      // Fallback to status-based messages
      if (errorMessage === 'An unknown error occurred') {
        switch (error.status) {
          case 409:
            errorMessage = 'Email already registered. Please use a different email or try logging in.';
            break;
          case 400:
            errorMessage = 'Invalid request. Please check your input.';
            break;
          case 401:
            errorMessage = 'Invalid email or password.';
            break;
          case 500:
            errorMessage = 'Server error. Please try again later.';
            break;
          default:
            errorMessage = `Error: ${error.status} - ${error.message}`;
        }
      }
    }

    return throwError(() => new Error(errorMessage));
  }
}

