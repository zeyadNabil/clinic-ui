import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, timer } from 'rxjs';
import { catchError, tap, map, retry, retryWhen, delayWhen, take, first } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { UserService } from './user.service';

export interface Appointment {
  id: number;
  patientName: string;
  patientId?: number;
  patientInitials: string;
  doctor: string;
  doctorId?: number;
  date: string;
  time: string;
  type: string;
  reason?: string;
  status: 'pending_approval' | 'accepted' | 'scheduled' | 'completed' | 'cancelled' | 'denied';
  phone?: string;
  email?: string;
  cancellationMessage?: string;
  cancelledBy?: string;
  amount?: number;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  paymentMethod?: 'CASH' | 'VISA';
  paymentId?: number;
}

// Backend appointment structure
interface BackendAppointment {
  id: number;
  reason: string;
  appointmentTime: string; // ISO datetime string
  patient: {
    id: number;
    username: string;
    email: string;
  };
  doctor: {
    id: number;
    name: string;
    email: string;
    specialty: string;
  };
  status: string;
  paymentMethod?: string;
  amount?: number;
  paymentStatus?: string;
}

interface AppointmentRequest {
  doctorId: number;
  appointmentTime: string; // ISO datetime string
  reason: string;
  paymentMethod?: string;
  amount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private apiUrl = `${environment.apiUrl}/appointments`;
  private appointmentsSubject = new BehaviorSubject<Appointment[]>([]);
  public appointments$: Observable<Appointment[]> = this.appointmentsSubject.asObservable();
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();

  private loadAttempted = false;
  private autoLoadTimeout: any = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private userService: UserService
  ) {
    // Subscribe to user changes to auto-load on refresh
    this.userService.currentUser$.subscribe(user => {
      if (user && this.authService.isAuthenticated()) {
        // Clear any existing timeout
        if (this.autoLoadTimeout) {
          clearTimeout(this.autoLoadTimeout);
        }
        
        // If we have no appointments and haven't loaded yet, auto-load
        if (this.appointmentsSubject.value.length === 0 && !this.isLoadingSubject.value) {
          this.autoLoadTimeout = setTimeout(() => {
            this.loadAppointments().catch(err => {
              console.error('Auto-load appointments error:', err);
            });
          }, 300);
        }
      }
    });
  }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Wait for authentication and user to be ready
  private waitForAuth(maxRetries = 20, delayMs = 150): Promise<boolean> {
    return new Promise((resolve) => {
      let retries = 0;
      const checkAuth = () => {
        const token = this.authService.getToken();
        const isAuth = this.authService.isAuthenticated();
        const user = this.userService.getCurrentUser();
        const role = this.authService.getUserRole();
        
        // Need token, auth status, user object, and role
        if (isAuth && token && user && role) {
          resolve(true);
          return;
        }
        if (retries < maxRetries) {
          retries++;
          setTimeout(checkAuth, delayMs);
        } else {
          resolve(false);
        }
      };
      checkAuth();
    });
  }


  // Convert backend appointment to frontend format
  private mapBackendToFrontend(backend: BackendAppointment): Appointment {
    // Handle null appointmentTime
    let appointmentTime: Date;
    if (backend.appointmentTime) {
      appointmentTime = new Date(backend.appointmentTime);
    } else {
      // Fallback to current date/time if null
      appointmentTime = new Date();
    }
    
    const date = appointmentTime.toISOString().split('T')[0];
    const hours = appointmentTime.getHours();
    const minutes = appointmentTime.getMinutes();
    const hour12 = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const time = `${hour12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    
    // Get patient name - prioritize username field (actual username, not email)
    // Only fall back to email if username is null, empty, or looks like an email
    let patientName: string;
    const username = backend.patient?.username;
    const email = backend.patient?.email;
    
    if (username && username.trim() !== '' && !username.includes('@')) {
      // Use username if it exists, is not empty, and doesn't look like an email
      patientName = username.trim();
    } else if (email) {
      // Fall back to email only if username is not available
      patientName = email;
    } else {
      // Last resort fallback
      patientName = 'Unknown';
    }
    const initials = patientName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);

    // Handle null doctor
    const doctorName = backend.doctor?.name || 'Unknown Doctor';
    const doctorId = backend.doctor?.id || 0;

    // Map backend status to frontend status
    let status: Appointment['status'] = 'scheduled';
    const backendStatus = backend.status?.toLowerCase() || '';
    if (backendStatus.includes('scheduled')) status = 'scheduled';
    else if (backendStatus.includes('cancelled')) status = 'cancelled';
    else if (backendStatus.includes('completed')) status = 'completed';
    else status = 'scheduled';

    return {
      id: backend.id,
      patientName: patientName,
      patientId: backend.patient?.id,
      patientInitials: initials,
      doctor: doctorName,
      doctorId: doctorId,
      date: date,
      time: time,
      type: backend.reason || '', // Using reason as type for now
      reason: backend.reason || '',
      status: status,
      email: backend.patient?.email || '',
      paymentMethod: (backend.paymentMethod as 'CASH' | 'VISA') || 'CASH',
      amount: backend.amount || 100.0,
      paymentStatus: (backend.paymentStatus as 'pending' | 'paid' | 'failed') || 'pending'
    };
  }

  // Convert frontend appointment to backend format
  private mapFrontendToBackend(appointment: Partial<Appointment>): AppointmentRequest {
    // Combine date and time into ISO datetime string
    const dateTime = new Date(`${appointment.date}T${appointment.time}`);
    return {
      doctorId: appointment.doctorId || 0,
      appointmentTime: dateTime.toISOString(),
      reason: appointment.reason || appointment.type || '',
      paymentMethod: appointment.paymentMethod || 'CASH',
      amount: appointment.amount || 100.0
    };
  }

  // Load appointments from backend
  async loadAppointments(): Promise<void> {
    // Prevent multiple simultaneous loads
    if (this.isLoadingSubject.value) {
      return;
    }

    // Mark that we've attempted to load
    this.loadAttempted = true;

    // Set loading state
    this.isLoadingSubject.next(true);

    try {
      // Wait for authentication to be ready (with retry)
      const isAuthenticated = await this.waitForAuth();
      if (!isAuthenticated) {
        console.warn('Authentication not ready after retries');
        this.appointmentsSubject.next([]);
        this.isLoadingSubject.next(false);
        return;
      }

      // Check authentication
      const token = this.authService.getToken();
      if (!token) {
        console.warn('No token available');
        this.appointmentsSubject.next([]);
        this.isLoadingSubject.next(false);
        return;
      }

      if (!this.authService.isAuthenticated()) {
        console.warn('User not authenticated');
        this.appointmentsSubject.next([]);
        this.isLoadingSubject.next(false);
        return;
      }

      // Get and normalize user role
      let userRole = this.authService.getUserRole();
      if (!userRole) {
        console.warn('No user role found');
        this.appointmentsSubject.next([]);
        this.isLoadingSubject.next(false);
        return;
      }

      // Normalize role - remove all ROLE_ prefixes
      while (userRole && /^ROLE_/i.test(userRole)) {
        userRole = userRole.replace(/^ROLE_/i, '') as 'ADMIN' | 'PATIENT' | 'DOCTOR' | null;
      }
      userRole = userRole?.toUpperCase() as 'ADMIN' | 'PATIENT' | 'DOCTOR' | null;
      
      // Determine endpoint based on role
      let endpoint: string;
      if (userRole === 'PATIENT') {
        endpoint = `${this.apiUrl}/my`;
      } else if (userRole === 'DOCTOR') {
        endpoint = `${this.apiUrl}/doctor/my`;
      } else if (userRole === 'ADMIN') {
        endpoint = this.apiUrl;
      } else {
        console.warn('Unknown user role:', userRole);
        this.appointmentsSubject.next([]);
        this.isLoadingSubject.next(false);
        return;
      }

      // Fetch and map appointments
      this.http.get<BackendAppointment[]>(endpoint, { headers: this.getHeaders() }).pipe(
        map((appointments) => {
          if (!appointments || !Array.isArray(appointments)) {
            return [];
          }
          const mapped = appointments.map(apt => {
            try {
              return this.mapBackendToFrontend(apt);
            } catch (error) {
              console.error('Error mapping appointment:', apt, error);
              return null;
            }
          }).filter(apt => apt !== null) as Appointment[];
          return mapped;
        }),
        catchError((error) => {
          console.error('Failed to load appointments:', error);
          return throwError(() => error);
        })
      ).subscribe({
        next: (appointments) => {
          this.appointmentsSubject.next(appointments);
          this.isLoadingSubject.next(false);
        },
        error: (error) => {
          console.error('Error in appointments subscription:', error);
          this.appointmentsSubject.next([]);
          this.isLoadingSubject.next(false);
        }
      });
    } catch (error) {
      console.error('Error setting up appointments request:', error);
      this.appointmentsSubject.next([]);
      this.isLoadingSubject.next(false);
    }
  }

  // Get all appointments
  getAppointments(): Appointment[] {
    return this.appointmentsSubject.value;
  }

  // Get appointment by ID
  getAppointmentById(id: number): Appointment | undefined {
    return this.appointmentsSubject.value.find(apt => apt.id === id);
  }

  // Create new appointment
  createAppointment(appointment: { doctorId: number; date: string; time: string; reason: string; paymentMethod?: 'CASH' | 'VISA'; amount?: number }): Observable<Appointment> {
    const request = this.mapFrontendToBackend({
      doctorId: appointment.doctorId,
      date: appointment.date,
      time: appointment.time,
      reason: appointment.reason,
      paymentMethod: appointment.paymentMethod,
      amount: appointment.amount
    });

    console.log('Creating appointment with request:', request);
    console.log('Headers:', this.getHeaders());

    return this.http.post<BackendAppointment>(this.apiUrl, request, { 
      headers: this.getHeaders()
    }).pipe(
      map((backendAppt) => {
        console.log('Appointment creation response:', backendAppt);
        if (!backendAppt) {
          throw new Error('Empty response from server');
        }
        const mapped = this.mapBackendToFrontend(backendAppt);
        // Update local state immediately for instant UI update
        const current = this.appointmentsSubject.value;
        this.appointmentsSubject.next([...current, mapped]);
        return mapped;
      }),
      tap(() => {
        // Reload appointments to ensure sync with backend (after immediate update)
        this.loadAppointments().catch(err => console.error('Error reloading after create:', err));
      }),
      catchError((error) => {
        console.error('Error creating appointment - full error:', error);
        console.error('Error status:', error.status);
        console.error('Error body:', error.error);
        console.error('Error message:', error.message);
        // Handle JSON parsing errors specifically
        if (error.error instanceof ProgressEvent || error.name === 'HttpErrorResponse') {
          if (error.status === 200) {
            // This is a parsing error with 200 status
            console.error('JSON parsing error - response might be empty or invalid JSON');
            return throwError(() => new Error('Server returned invalid response. Please check backend logs.'));
          }
        }
        return this.handleError(error);
      })
    );
  }

  // Add new appointment (wrapper for backward compatibility)
  addAppointment(appointment: Omit<Appointment, 'id' | 'paymentStatus'>): Appointment {
    // This is a synchronous method for backward compatibility
    // But we should use createAppointment instead
    const appointments = this.appointmentsSubject.value;
    const newId = appointments.length > 0 
      ? Math.max(...appointments.map(a => a.id)) + 1 
      : 1;
    
    const newAppointment: Appointment = {
      ...appointment,
      id: newId,
      paymentStatus: 'pending',
      amount: appointment.amount || 0
    };
    
    const updatedAppointments = [...appointments, newAppointment];
    this.appointmentsSubject.next(updatedAppointments);
    return newAppointment;
  }

  // Update appointment
  updateAppointment(id: number, updates: Partial<Appointment>): void {
    // Map frontend updates to backend format
    const appointment = this.getAppointmentById(id);
    if (!appointment) {
      console.error('Appointment not found:', id);
      return;
    }

    // Build the update payload - backend expects Appointment entity
    // Backend will merge this with existing appointment
    const updatePayload: any = {
      id: id,
      reason: updates.reason || updates.type || appointment.reason || appointment.type || '',
      status: this.mapStatusToBackend(updates.status || appointment.status)
    };

    // If date/time is being updated, convert to ISO datetime
    if (updates.date && updates.time) {
      // Convert time from 24-hour format to Date
      const [hours, minutes] = updates.time.split(':');
      const dateTime = new Date(updates.date);
      dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      updatePayload.appointmentTime = dateTime.toISOString();
    } else if (updates.date || updates.time) {
      // If only one is updated, combine with existing
      const existingDate = updates.date || appointment.date;
      let existingTime = updates.time || appointment.time;
      
      // Convert 12-hour time to 24-hour if needed
      if (existingTime.includes('AM') || existingTime.includes('PM')) {
        const [time, modifier] = existingTime.split(' ');
        let [hours, minutes] = time.split(':');
        if (modifier === 'PM' && hours !== '12') {
          hours = (parseInt(hours) + 12).toString();
        } else if (modifier === 'AM' && hours === '12') {
          hours = '00';
        }
        existingTime = `${hours.padStart(2, '0')}:${minutes}`;
      }
      
      const dateTime = new Date(`${existingDate}T${existingTime}`);
      updatePayload.appointmentTime = dateTime.toISOString();
    }

    // If doctor is being updated, include doctor object
    if (updates.doctorId && updates.doctorId !== 0) {
      updatePayload.doctor = { id: updates.doctorId };
    }

    this.http.put<BackendAppointment>(`${this.apiUrl}/${id}`, updatePayload, {
      headers: this.getHeaders()
    }).pipe(
      map((backendAppt) => {
        // Map backend response to frontend format
        const mapped = this.mapBackendToFrontend(backendAppt);
        // Update local state immediately
        const current = this.appointmentsSubject.value;
        const updated = current.map(apt => apt.id === id ? mapped : apt);
        this.appointmentsSubject.next(updated);
        return mapped;
      }),
      catchError(this.handleError)
    ).subscribe({
      next: () => {
        // Reload appointments to ensure sync with backend
        this.loadAppointments().catch(err => console.error('Error reloading after update:', err));
      },
      error: (error) => {
        console.error('Failed to update appointment:', error);
      }
    });
  }

  // Map frontend status to backend status
  private mapStatusToBackend(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending_approval': 'Scheduled',
      'accepted': 'Scheduled',
      'scheduled': 'Scheduled',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'denied': 'Cancelled'
    };
    return statusMap[status] || 'Scheduled';
  }

  // Delete appointment
  deleteAppointment(id: number): void {
    // Determine endpoint based on user role
    const role = this.authService.getUserRole();
    let normalizedRole: string | null = role;
    
    // Normalize role - remove all ROLE_ prefixes
    while (normalizedRole && /^ROLE_/i.test(normalizedRole)) {
      normalizedRole = normalizedRole.replace(/^ROLE_/i, '');
    }
    normalizedRole = normalizedRole ? normalizedRole.toUpperCase() : null;
    
    // Use admin endpoint for ADMIN, regular endpoint for PATIENT
    const isAdmin = normalizedRole === 'ADMIN';
    const endpoint = isAdmin 
      ? `${this.apiUrl}/admin/${id}`
      : `${this.apiUrl}/${id}`;
    
    this.http.delete(endpoint, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    ).subscribe({
      next: () => {
        // Remove from local state immediately
        const current = this.appointmentsSubject.value;
        const updated = current.filter(apt => apt.id !== id);
        this.appointmentsSubject.next(updated);
        
        // Reload appointments to ensure sync with backend
        this.loadAppointments().catch(err => console.error('Error reloading after delete:', err));
      },
      error: (error) => {
        console.error('Failed to delete appointment:', error);
        // Show error to user
        alert('Failed to delete appointment: ' + (error.error?.message || error.message || 'Unknown error'));
      }
    });
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      if (error.error && typeof error.error === 'string') {
        errorMessage = error.error;
      } else if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else {
        errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }

  // Get today's appointments
  getTodayAppointments(): Appointment[] {
    const today = new Date().toISOString().split('T')[0];
    return this.appointmentsSubject.value.filter(apt => apt.date === today);
  }

  // Get appointments by status
  getAppointmentsByStatus(status: Appointment['status']): Appointment[] {
    return this.appointmentsSubject.value.filter(apt => apt.status === status);
  }

  // Get appointments by doctor
  getAppointmentsByDoctor(doctorName: string): Appointment[] {
    return this.appointmentsSubject.value.filter(apt => apt.doctor === doctorName);
  }

  // Get appointments by patient
  getAppointmentsByPatient(patientName: string): Appointment[] {
    return this.appointmentsSubject.value.filter(apt => apt.patientName === patientName);
  }
}

