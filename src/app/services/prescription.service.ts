import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Prescription {
  id?: number;
  doctor?: {
    id: number;
    name: string;
    email: string;
    specialty: string;
  };
  patient?: {
    id: number;
    username: string;
    email: string;
  };
  medications: string;
  instructions: string;
  diagnosis: string;
  notes: string;
  createdAt?: string;
}

export interface BackendPrescription {
  id?: number;
  doctor?: {
    id: number;
    name: string;
    email: string;
    specialty: string;
  };
  patient?: {
    id: number;
    username: string;
    email: string;
  };
  medications: string;
  instructions: string;
  diagnosis: string;
  notes: string;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PrescriptionService {
  private apiUrl = `${environment.apiUrl}/prescriptions`;
  private prescriptions$ = new BehaviorSubject<Prescription[]>([]);
  public prescriptions = this.prescriptions$.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Create a new prescription (DOCTOR only)
  createPrescription(prescription: Prescription): Observable<Prescription> {
    return this.http.post<BackendPrescription>(this.apiUrl, prescription, { headers: this.getHeaders() })
      .pipe(
        map(backend => {
          const mapped = this.mapBackendToFrontend(backend);
          // Update local state immediately - component will auto-update via subscription
          const current = this.prescriptions$.value;
          this.prescriptions$.next([...current, mapped]);
          return mapped;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Create prescription error:', error);
          const errorMessage = error.error?.message || error.message || 'Failed to create prescription';
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Get all prescriptions for current user
  loadPrescriptions(): Observable<Prescription[]> {
    const role = this.authService.getUserRole();
    let endpoint = '';

    if (role === 'PATIENT') {
      endpoint = `${this.apiUrl}/my-prescriptions`;
    } else {
      // Invalid role - return empty array instead of throwing error
      console.warn('Invalid role for loading prescriptions:', role);
      this.prescriptions$.next([]);
      return of([]);
    }

    return this.http.get<BackendPrescription[]>(endpoint, { headers: this.getHeaders() })
      .pipe(
        map(backendPrescriptions => {
          const prescriptions = (backendPrescriptions || []).map(bp => this.mapBackendToFrontend(bp));
          // Always update BehaviorSubject, even if empty array
          this.prescriptions$.next(prescriptions);
          return prescriptions;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Load prescriptions error:', error);
          // Set empty array on error so UI shows "no prescriptions" message
          this.prescriptions$.next([]);
          // Return empty array Observable instead of throwing error, so component can show empty state
          return of([]);
        })
      );
  }

  // Get prescription by ID
  getPrescriptionById(id: number): Observable<Prescription> {
    return this.http.get<BackendPrescription>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() })
      .pipe(
        map(backend => this.mapBackendToFrontend(backend)),
        catchError((error: HttpErrorResponse) => {
          console.error('Get prescription error:', error);
          return throwError(() => new Error(error.error?.message || 'Failed to get prescription'));
        })
      );
  }

  // Delete prescription (DOCTOR only)
  deletePrescription(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() })
      .pipe(
        map(() => {
          // Update local state immediately - component will auto-update via subscription
          const current = this.prescriptions$.value;
          const updated = current.filter(p => p.id !== id);
          this.prescriptions$.next(updated);
          return undefined;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Delete prescription error:', error);
          return throwError(() => new Error(error.error?.message || 'Failed to delete prescription'));
        })
      );
  }

  // Map backend prescription to frontend format
  private mapBackendToFrontend(backend: BackendPrescription): Prescription {
    return {
      id: backend.id,
      doctor: backend.doctor,
      patient: backend.patient,
      medications: backend.medications || '',
      instructions: backend.instructions || '',
      diagnosis: backend.diagnosis || '',
      notes: backend.notes || '',
      createdAt: backend.createdAt
    };
  }
}

