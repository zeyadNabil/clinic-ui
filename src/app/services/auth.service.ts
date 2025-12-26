import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { TokenService } from './token.service';

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
  token: string | null; // null for registration, string for login
  expiresIn: number;
  email?: string;
  username?: string;
  name?: string;
  role?: string; // Add role from backend
}

export interface VerifyRequest {
  email: string;
  verificationCode: string;
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
  private tokenSubject: BehaviorSubject<string | null>;
  public token$: Observable<string | null>;

  constructor(
    private http: HttpClient,
    private tokenService: TokenService
  ) {
    // Initialize after tokenService is available
    this.tokenSubject = new BehaviorSubject<string | null>(this.tokenService.getToken());
    this.token$ = this.tokenSubject.asObservable();
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        // Validate response has required fields
        if (!response.token) {
          throw new Error('Login response missing token');
        }

        // Store token using TokenService (handles expiry)
        this.tokenService.setToken(response.token, response.expiresIn);
        this.tokenSubject.next(response.token);

        // Prepare user data from response
        // Backend sends: email, username, name, role
        const userData = {
          email: response.email || '',
          username: response.username || response.name || '',
          name: response.name || response.username || 'User',
          role: response.role || this.tokenService.getRoleFromToken() || 'PATIENT'
        };

        // Store user data and role using TokenService (stores in 'userData' key)
        this.tokenService.setUserData(userData);
        if (userData.role) {
          this.tokenService.setUserRole(userData.role);
        }
      }),
      catchError(this.handleError)
    );
  }

  register(userData: RegisterRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/signup`, userData).pipe(
      tap(response => {
        // Registration response has token: null and expiresIn: 0
        // User needs to verify account before login

        // Store user data (but no token yet since registration doesn't return a token)
        const registeredUserData = {
          email: response.email || userData.email,
          username: response.username || userData.username,
          name: response.name || response.username || userData.username,
          role: response.role || userData.role || 'PATIENT'
        };

        // Store user data (but not token since it's null)
        // TokenService stores in 'userData' key
        this.tokenService.setUserData(registeredUserData);
        if (registeredUserData.role) {
          this.tokenService.setUserRole(registeredUserData.role);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Verify user account with verification code
  verifyAccount(request: VerifyRequest): Observable<string> {
    return this.http.post<string>(`${this.apiUrl}/verify`, request, {
      responseType: 'text' as 'json'
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Resend verification code
  resendVerificationCode(email: string): Observable<string> {
    return this.http.post<string>(`${this.apiUrl}/resend?email=${encodeURIComponent(email)}`, {}, {
      responseType: 'text' as 'json'
    }).pipe(
      catchError(this.handleError)
    );
  }

  logout(): void {
    // Use TokenService to clear ALL auth data (includes token, role, userData, tokenExpiry)
    this.tokenService.clearAll();

    // Update BehaviorSubject to notify subscribers that user is logged out
    this.tokenSubject.next(null);
  }

  getToken(): string | null {
    return this.tokenService.getToken();
  }

  isAuthenticated(): boolean {
    return this.tokenService.isTokenValid();
  }

  getUserRole(): 'ADMIN' | 'PATIENT' | 'DOCTOR' | null {
    // First try to get role from TokenService stored role
    const storedRole = this.tokenService.getUserRole();
    if (storedRole && ['ADMIN', 'PATIENT', 'DOCTOR'].includes(storedRole)) {
      return storedRole as 'ADMIN' | 'PATIENT' | 'DOCTOR';
    }

    // Fallback to getting role from token
    const roleFromToken = this.tokenService.getRoleFromToken();
    if (roleFromToken && ['ADMIN', 'PATIENT', 'DOCTOR'].includes(roleFromToken)) {
      // Store it for future use
      this.tokenService.setUserRole(roleFromToken);
      return roleFromToken as 'ADMIN' | 'PATIENT' | 'DOCTOR';
    }

    // Fallback to user data
    const userData = this.tokenService.getUserData();
    if (userData?.role && ['ADMIN', 'PATIENT', 'DOCTOR'].includes(userData.role.toUpperCase())) {
      return userData.role.toUpperCase() as 'ADMIN' | 'PATIENT' | 'DOCTOR';
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

