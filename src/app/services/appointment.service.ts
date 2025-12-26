import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of, timer } from 'rxjs';
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

// Backend appointment structure (matches API response)
interface BackendAppointment {
  id: number;
  reason: string;
  appointmentTime: string; // ISO datetime string
  dateTime?: string; // ISO datetime string (sometimes included in response)
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
  status: string; // PENDING, APPROVED, DENIED, CANCELLED, COMPLETED, SCHEDULED
  paymentMethod?: string; // CASH or VISA
  amount?: number;
  paymentStatus?: string; // pending, paid, failed
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
            this.loadAppointments().subscribe({
              next: () => {
                console.log('Auto-loaded appointments successfully');
              },
              error: (err) => {
                console.error('Auto-load appointments error:', err);
              }
            });
          }, 300);
        }
      }
    });
  }

  /**
   * Get HTTP headers with authentication token
   * Note: The auth interceptor automatically injects the token for all HTTP requests,
   * but we keep this method for explicit header control and as a fallback
   */
  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return new HttpHeaders(headers);
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
    // Backend: PENDING, APPROVED, DENIED, CANCELLED, COMPLETED, SCHEDULED
    // Frontend: pending_approval, accepted, scheduled, completed, cancelled, denied
    let status: Appointment['status'] = 'scheduled';
    const backendStatus = backend.status?.toUpperCase() || '';
    if (backendStatus === 'PENDING') {
      status = 'pending_approval';
    } else if (backendStatus === 'APPROVED' || backendStatus === 'SCHEDULED') {
      status = 'scheduled';
    } else if (backendStatus === 'DENIED') {
      status = 'denied';
    } else if (backendStatus === 'CANCELLED') {
      status = 'cancelled';
    } else if (backendStatus === 'COMPLETED') {
      status = 'completed';
    } else {
      status = 'pending_approval'; // Default to pending for unknown statuses
    }

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
  // According to API: appointmentTime should be ISO datetime string (e.g., "2024-12-25T10:00:00")
  private mapFrontendToBackend(appointment: Partial<Appointment>): AppointmentRequest {
    let appointmentTime: string;

    if (appointment.date && appointment.time) {
      // Handle time format - could be "10:00 AM" or "10:00:00"
      let timeStr = appointment.time.trim();
      let hours: number, minutes: number;

      // Check if it's 12-hour format (contains AM/PM)
      if (timeStr.includes('AM') || timeStr.includes('PM')) {
        const [time, modifier] = timeStr.split(' ');
        const [h, m] = time.split(':');
        hours = parseInt(h, 10);
        minutes = parseInt(m, 10);

        if (modifier === 'PM' && hours !== 12) {
          hours += 12;
        } else if (modifier === 'AM' && hours === 12) {
          hours = 0;
        }
      } else {
        // 24-hour format
        const [h, m] = timeStr.split(':');
        hours = parseInt(h, 10);
        minutes = parseInt(m, 10);
      }

      // Create ISO datetime string: "YYYY-MM-DDTHH:mm:ss"
      const dateStr = appointment.date; // Should be in format "YYYY-MM-DD"
      appointmentTime = `${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
    } else {
      // Fallback to current time if date/time not provided
      appointmentTime = new Date().toISOString();
    }

    return {
      doctorId: appointment.doctorId || 0,
      appointmentTime: appointmentTime,
      reason: appointment.reason || appointment.type || '',
      paymentMethod: appointment.paymentMethod || 'CASH',
      amount: appointment.amount || 100.0
    };
  }

  // Load appointments from backend
  loadAppointments(): Observable<Appointment[]> {
    // Prevent multiple simultaneous loads
    if (this.isLoadingSubject.value) {
      return this.appointments$;
    }

    // Set loading state
    this.isLoadingSubject.next(true);
    this.loadAttempted = true;

    // Check authentication first
    if (!this.authService.isAuthenticated()) {
      console.warn('User not authenticated - cannot load appointments');
      this.appointmentsSubject.next([]);
      this.isLoadingSubject.next(false);
      return this.appointments$;
    }

    const token = this.authService.getToken();
    if (!token) {
      console.warn('No token available - cannot load appointments');
      this.appointmentsSubject.next([]);
      this.isLoadingSubject.next(false);
      return this.appointments$;
    }

    // Get and normalize user role
    let userRole = this.authService.getUserRole();
    if (!userRole) {
      console.warn('No user role found - cannot determine endpoint');
      this.appointmentsSubject.next([]);
      this.isLoadingSubject.next(false);
      return this.appointments$;
    }

    // Normalize role - remove all ROLE_ prefixes
    while (userRole && /^ROLE_/i.test(userRole)) {
      userRole = userRole.replace(/^ROLE_/i, '') as 'ADMIN' | 'PATIENT' | 'DOCTOR' | null;
    }
    userRole = userRole?.toUpperCase() as 'ADMIN' | 'PATIENT' | 'DOCTOR' | null;

    // Determine endpoint based on role (according to API docs)
    let endpoint: string;
    if (userRole === 'PATIENT') {
      endpoint = `${this.apiUrl}/my`; // GET /appointments/my
    } else if (userRole === 'DOCTOR') {
      endpoint = `${this.apiUrl}/doctor/my`; // GET /appointments/doctor/my
    } else if (userRole === 'ADMIN') {
      endpoint = `${this.apiUrl}/admin/all`; // GET /appointments/admin/all
    } else {
      console.warn('Unknown user role:', userRole);
      this.appointmentsSubject.next([]);
      this.isLoadingSubject.next(false);
      return this.appointments$;
    }

    console.log(`Loading appointments from endpoint: ${endpoint} for role: ${userRole}`);

    // Fetch and map appointments
    return this.http.get<BackendAppointment[]>(endpoint, {
      headers: this.getHeaders()
    }).pipe(
      map((appointments) => {
        // Handle null or undefined response (backend issue)
        if (appointments === null || appointments === undefined) {
          console.error('⚠️ Backend returned null or undefined response');
          console.error('This indicates a backend issue - the endpoint should return at least an empty array []');
          console.error('Please check:');
          console.error('1. Backend endpoint implementation for GET /appointments/my');
          console.error('2. Backend logs for errors');
          console.error('3. Database query is returning results');
          this.appointmentsSubject.next([]);
          this.isLoadingSubject.next(false);
          return [];
        }

        // Check if response is an array
        if (!Array.isArray(appointments)) {
          console.error('⚠️ Backend response is not an array:', appointments);
          console.error('Response type:', typeof appointments);
          console.error('Expected: Array of appointments');
          console.error('Received:', appointments);
          this.appointmentsSubject.next([]);
          this.isLoadingSubject.next(false);
          return [];
        }

        console.log(`✓ Received ${appointments.length} appointments from backend`);

        if (appointments.length === 0) {
          console.log('ℹ️ Backend returned empty array - user has no appointments');
          this.appointmentsSubject.next([]);
          this.isLoadingSubject.next(false);
          return [];
        }

        const mapped = appointments.map((apt, index) => {
          try {
            return this.mapBackendToFrontend(apt);
          } catch (error) {
            console.error(`✗ Error mapping appointment ${index + 1}:`, apt, error);
            return null;
          }
        }).filter(apt => apt !== null) as Appointment[];

        console.log(`✓ Successfully mapped ${mapped.length} appointments`);

        // Update local state
        this.appointmentsSubject.next(mapped);
        this.isLoadingSubject.next(false);

        return mapped;
      }),
      catchError((error) => {
        console.error('✗ Failed to load appointments:', error);
        console.error('Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error,
          url: error.url
        });

        this.appointmentsSubject.next([]);
        this.isLoadingSubject.next(false);

        // Return empty array instead of throwing to prevent breaking the app
        return of([]);
      })
    );
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
        this.loadAppointments().subscribe({
          error: (err) => console.error('Error reloading after create:', err)
        });
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
        this.loadAppointments().subscribe({
          error: (err) => console.error('Error reloading after update:', err)
        });
      },
      error: (error) => {
        console.error('Failed to update appointment:', error);
      }
    });
  }

  // Map frontend status to backend status
  // Backend expects: PENDING, APPROVED, DENIED, CANCELLED, COMPLETED, SCHEDULED
  private mapStatusToBackend(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending_approval': 'PENDING',
      'accepted': 'APPROVED',
      'scheduled': 'SCHEDULED',
      'completed': 'COMPLETED',
      'cancelled': 'CANCELLED',
      'denied': 'DENIED'
    };
    return statusMap[status] || 'PENDING';
  }

  // Delete appointment (Cancel appointment)
  // According to API: DELETE /appointments/{id} - PATIENT can only cancel their own
  // Token interceptor will automatically add Authorization header
  deleteAppointment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, {
      headers: this.getHeaders()
    }).pipe(
      tap(() => {
        // Remove from local state immediately
        const current = this.appointmentsSubject.value;
        const updated = current.filter(apt => apt.id !== id);
        this.appointmentsSubject.next(updated);

        // Reload appointments to ensure sync with backend
        this.loadAppointments().subscribe({
          error: (err) => console.error('Error reloading after delete:', err)
        });
      }),
      catchError(this.handleError)
    );
  }

  // Approve appointment (Admin only)
  // According to API: PUT /appointments/admin/{id}/approve
  approveAppointment(id: number): Observable<Appointment> {
    return this.http.put<BackendAppointment>(`${this.apiUrl}/admin/${id}/approve`, {}, {
      headers: this.getHeaders()
    }).pipe(
      map((backendAppt) => {
        const mapped = this.mapBackendToFrontend(backendAppt);
        // Update local state immediately
        const current = this.appointmentsSubject.value;
        const updated = current.map(apt => apt.id === id ? mapped : apt);
        this.appointmentsSubject.next(updated);
        return mapped;
      }),
      tap(() => {
        // Reload appointments to ensure sync with backend
        this.loadAppointments().subscribe({
          error: (err) => console.error('Error reloading after approve:', err)
        });
      }),
      catchError(this.handleError)
    );
  }

  // Deny appointment (Admin only)
  // According to API: PUT /appointments/admin/{id}/deny
  denyAppointment(id: number): Observable<Appointment> {
    return this.http.put<BackendAppointment>(`${this.apiUrl}/admin/${id}/deny`, {}, {
      headers: this.getHeaders()
    }).pipe(
      map((backendAppt) => {
        const mapped = this.mapBackendToFrontend(backendAppt);
        // Update local state immediately
        const current = this.appointmentsSubject.value;
        const updated = current.map(apt => apt.id === id ? mapped : apt);
        this.appointmentsSubject.next(updated);
        return mapped;
      }),
      tap(() => {
        // Reload appointments to ensure sync with backend
        this.loadAppointments().subscribe({
          error: (err) => console.error('Error reloading after deny:', err)
        });
      }),
      catchError(this.handleError)
    );
  }

  // Fetch appointments by status from API (Admin only)
  // According to API: GET /appointments/admin/status/{status}
  // Note: This fetches from the backend API. For local filtering, use getAppointmentsByStatus() instead.
  fetchAppointmentsByStatusFromApi(status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED' | 'COMPLETED' | 'SCHEDULED'): Observable<Appointment[]> {
    return this.http.get<BackendAppointment[]>(`${this.apiUrl}/admin/status/${status}`, {
      headers: this.getHeaders()
    }).pipe(
      map((appointments) => {
        if (!appointments || !Array.isArray(appointments)) {
          return [];
        }
        const mapped = appointments.map(apt => this.mapBackendToFrontend(apt));
        // Optionally update local state with fetched appointments
        const current = this.appointmentsSubject.value;
        const updated = [...current];
        mapped.forEach(apt => {
          const index = updated.findIndex(a => a.id === apt.id);
          if (index >= 0) {
            updated[index] = apt;
          } else {
            updated.push(apt);
          }
        });
        this.appointmentsSubject.next(updated);
        return mapped;
      }),
      catchError(this.handleError)
    );
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

  // Get appointments by status from local state (filters already loaded appointments)
  // For fetching from API with backend status, use fetchAppointmentsByStatusFromApi()
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

