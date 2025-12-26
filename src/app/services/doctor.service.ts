import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, firstValueFrom, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

// Helper to wait for authentication
async function waitForAuth(authService: AuthService, maxRetries = 5, delayMs = 200): Promise<boolean> {
  return new Promise((resolve) => {
    let retries = 0;
    const checkAuth = () => {
      if (authService.isAuthenticated() && authService.getToken()) {
        resolve(true);
      } else if (retries < maxRetries) {
        retries++;
        setTimeout(checkAuth, delayMs);
      } else {
        resolve(false);
      }
    };
    checkAuth();
  });
}

export interface Doctor {
  id: number;
  name: string;
  email: string;
  specialty: string;
  consultationFee?: number;
  createdAt?: string;
}

export interface DoctorNameDto {
  id: number;
  name: string;
  consultationFee?: number;
}

@Injectable({
  providedIn: 'root'
})
export class DoctorService {
  private apiUrl = `${environment.apiUrl}/doctors`;
  private doctorsSubject = new BehaviorSubject<Doctor[]>([]);
  public doctors$ = this.doctorsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // Get list of doctors (for patients - simplified list)
  // For admins/doctors, use getAllDoctors() instead
  getDoctorsList(): Observable<DoctorNameDto[]> {
    const userRole = this.authService.getUserRole();
    const token = this.authService.getToken();

    // If user is admin or doctor, use the main endpoint and map to DTO
    if (userRole === 'ADMIN' || userRole === 'DOCTOR') {
      if (!token) {
        console.error('No token available for ADMIN/DOCTOR');
        return throwError(() => new Error('Not authenticated'));
      }

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });

      return this.http.get<Doctor[]>(this.apiUrl, { headers }).pipe(
        tap((doctors: Doctor[] | null) => {
          // Handle null or undefined response
          if (!doctors || !Array.isArray(doctors)) {
            console.warn('Doctors response is null or not an array:', doctors);
            this.doctorsSubject.next([]);
            return;
          }
          // Update BehaviorSubject with full doctor objects
          this.doctorsSubject.next(doctors);
        }),
        map((doctors: Doctor[] | null) => {
          // Handle null or undefined response
          if (!doctors || !Array.isArray(doctors)) {
            console.warn('Doctors response is null or not an array in map:', doctors);
            return [];
          }
          const mapped = doctors.map(d => ({
            id: d.id,
            name: d.name,
            consultationFee: d.consultationFee || 100.0
          }));
          return mapped;
        }),
        catchError((error) => {
          console.error('Error fetching doctors from /doctors:', error);
          return this.handleError(error);
        })
      );
    }

    // For patients, use the /list endpoint
    if (!token) {
      console.error('No token available for PATIENT');
      return throwError(() => new Error('Not authenticated'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return this.http.get<DoctorNameDto[]>(`${this.apiUrl}/list`, { headers }).pipe(
      map((doctors: DoctorNameDto[] | null | undefined) => {
        // Handle null or undefined response
        if (doctors == null) {
          console.warn('Doctors response is null or undefined');
          this.doctorsSubject.next([]);
          return [];
        }

        if (!Array.isArray(doctors)) {
          console.warn('Doctors response is not an array:', typeof doctors, doctors);
          this.doctorsSubject.next([]);
          return [];
        }

        // Update BehaviorSubject for patients (convert to Doctor format)
        try {
          const fullDoctors: Doctor[] = doctors.map(d => ({
            id: d.id,
            name: d.name,
            email: '',
            specialty: '',
            consultationFee: d.consultationFee || 100.0
          }));
          this.doctorsSubject.next(fullDoctors);
        } catch (mapError) {
          console.error('Error mapping doctors in tap:', mapError);
          this.doctorsSubject.next([]);
        }

        // Map to DTO format for return
        try {
          const mapped = doctors.map(d => ({
            id: d.id,
            name: d.name,
            consultationFee: d.consultationFee || 100.0
          }));
          return mapped;
        } catch (mapError) {
          console.error('Error mapping doctors in map:', mapError);
          return [];
        }
      }),
      catchError((error: any) => {
        console.error('Error fetching doctors from /list:', error);
        // Set empty array on error and return empty array observable
        this.doctorsSubject.next([]);
        // Return empty array instead of throwing error
        return of([]);
      })
    );
  }

  // Load doctors and update BehaviorSubject
  async loadDoctors(): Promise<void> {
    try {
      const userRole = this.authService.getUserRole();

      if (userRole === 'ADMIN' || userRole === 'DOCTOR') {
        const doctors = await this.getAllDoctorsAsync();
        this.doctorsSubject.next(doctors || []);
      } else if (userRole === 'PATIENT') {
        // For patients, use getDoctorsList which calls /list endpoint
        try {
          const doctorDtos = await firstValueFrom(this.getDoctorsList());
          if (!doctorDtos || !Array.isArray(doctorDtos)) {
            console.warn('getDoctorsList returned null or not an array:', doctorDtos);
            this.doctorsSubject.next([]);
            return;
          }
          const doctors: Doctor[] = doctorDtos.map(d => ({
            id: d.id,
            name: d.name,
            email: '',
            specialty: '',
            consultationFee: d.consultationFee || 100.0
          }));
          this.doctorsSubject.next(doctors);
        } catch (error) {
          console.error('Error in loadDoctors for PATIENT:', error);
          this.doctorsSubject.next([]);
        }
      } else {
        console.warn('loadDoctors - Unknown role:', userRole);
        this.doctorsSubject.next([]);
      }
    } catch (error) {
      console.error('Error loading doctors:', error);
      this.doctorsSubject.next([]);
    }
  }

  // Get all doctors (for admin/doctor)
  async getAllDoctorsAsync(): Promise<Doctor[]> {
    // Wait for authentication
    const isAuthenticated = await waitForAuth(this.authService);
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No token available');
    }

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    return new Promise((resolve, reject) => {
      this.http.get<Doctor[]>(this.apiUrl, { headers }).pipe(
        tap(doctors => {
          // Update BehaviorSubject immediately
          this.doctorsSubject.next(doctors || []);
        }),
        catchError(this.handleError)
      ).subscribe({
        next: (doctors) => resolve(doctors || []),
        error: (error) => reject(error)
      });
    });
  }

  // Get all doctors (for admin/doctor) - Observable version
  getAllDoctors(): Observable<Doctor[]> {
    const token = this.authService.getToken();
    if (!token || !this.authService.isAuthenticated()) {
      return throwError(() => new Error('Not authenticated'));
    }

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    return this.http.get<Doctor[]>(this.apiUrl, { headers }).pipe(
      tap(doctors => {
        // Update BehaviorSubject immediately
        this.doctorsSubject.next(doctors || []);
      }),
      catchError(this.handleError)
    );
  }

  // Get doctor by ID
  getDoctorById(id: number): Observable<Doctor> {
    return this.http.get<Doctor>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  // Create a new doctor (Admin only)
  createDoctor(doctor: { name: string; email: string; specialty: string; password: string }): Observable<Doctor> {
    const token = this.authService.getToken();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    return this.http.post<Doctor>(this.apiUrl, doctor, { headers }).pipe(
      tap(newDoctor => {
        // Update BehaviorSubject immediately - add new doctor to list
        const current = this.doctorsSubject.value;
        this.doctorsSubject.next([...current, newDoctor]);
        // Also reload to ensure sync
        this.getAllDoctors().subscribe();
      }),
      catchError(this.handleError)
    );
  }

  // Update a doctor (Admin only)
  updateDoctor(id: number, doctor: { name?: string; email?: string; specialty?: string; password?: string }): Observable<Doctor> {
    const token = this.authService.getToken();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    return this.http.put<Doctor>(`${this.apiUrl}/${id}`, doctor, { headers }).pipe(
      tap(updatedDoctor => {
        // Update BehaviorSubject immediately - update doctor in list
        const current = this.doctorsSubject.value;
        const updated = current.map(d => d.id === id ? updatedDoctor : d);
        this.doctorsSubject.next(updated);
        // Also reload to ensure sync
        this.getAllDoctors().subscribe();
      }),
      catchError(this.handleError)
    );
  }

  // Delete a doctor (Admin only)
  deleteDoctor(id: number): Observable<void> {
    const token = this.authService.getToken();
    const headers = {
      'Authorization': `Bearer ${token}`
    };
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers }).pipe(
      tap(() => {
        // Update BehaviorSubject immediately - remove doctor from list
        const current = this.doctorsSubject.value;
        const updated = current.filter(d => d.id !== id);
        this.doctorsSubject.next(updated);
        // Also reload to ensure sync
        this.getAllDoctors().subscribe();
      }),
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse | any): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (!error) {
      errorMessage = 'Unknown error occurred';
      return throwError(() => new Error(errorMessage));
    }

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else if (error instanceof HttpErrorResponse) {
      if (error.error && typeof error.error === 'string') {
        errorMessage = error.error;
      } else if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else {
        errorMessage = `Error Code: ${error.status || 'unknown'}\nMessage: ${error.message || 'Unknown error'}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = `Error: ${String(error)}`;
    }

    return throwError(() => new Error(errorMessage));
  }
}

