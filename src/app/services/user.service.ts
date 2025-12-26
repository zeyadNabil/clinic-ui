import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { jwtDecode } from 'jwt-decode';

export interface User {
  id?: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'DOCTOR' | 'PATIENT'; // Match backend roles
  doctorName?: string; // For doctor role, if applicable
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  constructor(private authService: AuthService) {
    // Load user immediately on service initialization
    this.loadUser();
    // Subscribe to token changes to update user info
    this.authService.token$.subscribe(token => {
      if (token) {
        this.loadUser();
      } else {
        this.currentUserSubject.next(null);
      }
    });
  }

  private loadUser() {
    // First try to get from userData (stored by TokenService)
    // TokenService uses 'userData' as the key
    const userDataStr = localStorage.getItem('userData');
    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        console.log('Loading user from localStorage (userData):', userData);
        // Prioritize name/username, never use email as name
        // Make sure we use name or username field, not email
        let displayName = userData.name || userData.username || 'User';
        // If displayName is the email, that's wrong - use username or default
        if (displayName === userData.email || displayName.includes('@')) {
          console.warn('Warning: Display name is email, fixing it. Original:', displayName);
          displayName = userData.username || 'User';
        }
        const user: User = {
          name: displayName,
          email: userData.email || '',
          role: (userData.role || 'PATIENT').toUpperCase() as User['role'],
          doctorName: userData.role === 'DOCTOR' ? displayName : undefined
        };
        console.log('Loaded user (name should not be email):', user);
        this.currentUserSubject.next(user);
        return;
      } catch (e) {
        console.error('Failed to parse userData:', e);
      }
    }

    // Fallback: Try to decode from JWT token
    const token = this.authService.getToken();
    if (token) {
      try {
        const decodedToken: any = jwtDecode(token);
        const role = decodedToken.role?.replace('ROLE_', '') || 'PATIENT';
        // Try to get name from token
        let userName = decodedToken.name || decodedToken.username;
        // Never use email as name - use username or empty string
        const displayName = userName || 'User';
        const user: User = {
          name: displayName,
          email: decodedToken.sub || decodedToken.email || '',
          role: role.toUpperCase() as User['role'],
          doctorName: role === 'DOCTOR' ? displayName : undefined
        };
        this.currentUserSubject.next(user);
        return;
      } catch (e) {
        console.error('Error decoding token:', e);
      }
    }

    // No user found
    this.currentUserSubject.next(null);
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // Set current user (called from login)
  // Note: User data should be stored via TokenService.setUserData() which uses 'userData' key
  // This method only updates the BehaviorSubject for immediate UI updates
  setCurrentUser(user: User): void {
    // Ensure name is never the email
    if (user.name === user.email || !user.name || user.name.trim() === '') {
      console.warn('Invalid name detected, using username or default:', user);
      user.name = user.name && user.name !== user.email ? user.name : (user.email ? 'User' : 'User');
    }
    console.log('Setting current user (updating BehaviorSubject):', user);
    this.currentUserSubject.next(user);
    // Note: Actual storage is handled by TokenService.setUserData() in AuthService
  }

  // Check if user is admin
  isAdmin(): boolean {
    const user = this.currentUserSubject.value;
    return user?.role === 'ADMIN';
  }

  // Check if user is doctor
  isDoctor(): boolean {
    const user = this.currentUserSubject.value;
    return user?.role === 'DOCTOR';
  }

  // Check if user is patient
  isPatient(): boolean {
    const user = this.currentUserSubject.value;
    return user?.role === 'PATIENT';
  }

  // Get user role
  getUserRole(): User['role'] | null {
    const user = this.currentUserSubject.value;
    return user?.role || null;
  }

  // Get display name based on role
  getDisplayName(): string {
    const user = this.currentUserSubject.value;
    if (!user) return '';
    if (user.role === 'DOCTOR' && user.doctorName) {
      return user.doctorName;
    }
    return user.name;
  }

  // Get role display text
  getRoleDisplayText(): string {
    const user = this.currentUserSubject.value;
    if (!user) return '';
    switch (user.role) {
      case 'ADMIN':
        return 'Administrator';
      case 'DOCTOR':
        return 'Doctor';
      case 'PATIENT':
        return 'Patient';
      default:
        return 'User';
    }
  }
}
