import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'doctor' | 'patient';
  doctorName?: string; // For doctor role
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  // Default users for each role
  private defaultUsers: { [key in User['role']]: User } = {
    admin: {
      id: 1,
      name: 'Admin User',
      email: 'admin@clinic.com',
      role: 'admin',
      doctorName: undefined
    },
    doctor: {
      id: 2,
      name: 'Dr. Smith',
      email: 'doctor@clinic.com',
      role: 'doctor',
      doctorName: 'Dr. Smith'
    },
    patient: {
      id: 3,
      name: 'John Doe',
      email: 'patient@email.com',
      role: 'patient',
      doctorName: undefined
    }
  };

  private currentUserSubject = new BehaviorSubject<User>(this.defaultUsers.admin);

  public currentUser$: Observable<User> = this.currentUserSubject.asObservable();

  constructor() {
    // Initialize with default user - in real app, this would come from auth service
    this.loadUser();
  }

  private loadUser() {
    // In a real app, you would load this from localStorage, auth service, or API
    // For now, we'll use a default user
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        this.currentUserSubject.next(JSON.parse(savedUser));
      } catch (e) {
        // Use default if parsing fails
        this.currentUserSubject.next(this.defaultUsers.admin);
      }
    } else {
      // Use default admin if no saved user
      this.currentUserSubject.next(this.defaultUsers.admin);
    }
  }

  // Get current user
  getCurrentUser(): User {
    return this.currentUserSubject.value;
  }

  // Set current user
  setCurrentUser(user: User): void {
    this.currentUserSubject.next(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  // Check if user is admin
  isAdmin(): boolean {
    return this.currentUserSubject.value.role === 'admin';
  }

  // Check if user is doctor
  isDoctor(): boolean {
    return this.currentUserSubject.value.role === 'doctor';
  }

  // Check if user is patient
  isPatient(): boolean {
    return this.currentUserSubject.value.role === 'patient';
  }

  // Get user role
  getUserRole(): User['role'] {
    return this.currentUserSubject.value.role;
  }

  // Update user role (for testing/demo purposes)
  setUserRole(role: User['role'], doctorName?: string, userName?: string): void {
    const defaultUser = this.defaultUsers[role];
    const finalDoctorName = doctorName || defaultUser.doctorName || defaultUser.name;
    const finalUserName = userName || defaultUser.name;

    this.setCurrentUser({
      ...defaultUser,
      name: finalUserName,
      role,
      doctorName: role === 'doctor' ? finalDoctorName : undefined
    });
  }

  // Get display name based on role
  getDisplayName(): string {
    const user = this.currentUserSubject.value;
    if (user.role === 'doctor' && user.doctorName) {
      return user.doctorName;
    }
    return user.name;
  }

  // Get role display text
  getRoleDisplayText(): string {
    const user = this.currentUserSubject.value;
    switch (user.role) {
      case 'admin':
        return 'Administrator';
      case 'doctor':
        return 'Doctor';
      case 'patient':
        return 'Patient';
      default:
        return 'User';
    }
  }
}

