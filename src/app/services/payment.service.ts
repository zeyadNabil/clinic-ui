import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { AppointmentService, Appointment } from './appointment.service';

export interface Payment {
  id: number;
  appointmentId: number;
  appointment?: Appointment; // Full appointment object from backend
  patientName: string;
  doctor: string;
  date: string;
  time: string;
  amount: number;
  clinicTax: number; // 20% of amount
  doctorEarning: number; // 80% of amount
  status: 'pending' | 'paid' | 'failed';
  paymentDate?: string;
  paymentMethod: 'CASH' | 'VISA';
  cardLast4?: string;
  createdAt: string;
}

// Backend payment structure (matches API response)
interface BackendPayment {
  id: number;
  appointment: {
    id: number;
    appointmentTime: string;
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
    reason?: string; // Optional - may not be in payment response
    status?: string; // Optional - may not be in payment response
  };
  amount: number;
  paymentMethod: string; // "CASH" | "VISA"
  status: string; // "pending" | "paid" | "failed"
  cardLast4?: string | null; // Can be null for CASH payments
  paymentDate?: string | null; // Can be null for pending payments
  createdAt: string;
}

export interface CardInfo {
  id: number;
  cardNumber: string;
  cardHolder: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  last4: string;
  isDefault: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private apiUrl = `${environment.apiUrl}/payments`;
  private paymentsSubject = new BehaviorSubject<Payment[]>([]);
  public payments$: Observable<Payment[]> = this.paymentsSubject.asObservable();

  private cardsSubject = new BehaviorSubject<CardInfo[]>([]);
  public cards$: Observable<CardInfo[]> = this.cardsSubject.asObservable();

  private readonly CLINIC_TAX_RATE = 0.20; // 20%
  private readonly DOCTOR_EARNING_RATE = 0.80; // 80%

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private appointmentService: AppointmentService
  ) {
    this.loadInitialCards();
    // Don't auto-load payments - let components decide when to load
    // Only load if authenticated
    if (this.authService.isAuthenticated()) {
      this.loadPayments().subscribe({
        error: (err) => console.error('Auto-load payments error:', err)
      });
    }
  }

  /**
   * Get HTTP headers with authentication token
   * Note: The auth interceptor automatically injects the token for all HTTP requests,
   * but we keep this method for explicit header control and as a fallback.
   * Content-Type is only needed for POST/PUT requests with bodies.
   */
  private getHeaders(includeContentType: boolean = true): HttpHeaders {
    const token = this.authService.getToken();
    const headers: { [key: string]: string } = {};

    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return new HttpHeaders(headers);
  }

  // Load payments from backend based on user role
  loadPayments(): Observable<Payment[]> {
    // Check authentication first
    if (!this.authService.isAuthenticated()) {
      console.warn('User not authenticated - cannot load payments');
      this.paymentsSubject.next([]);
      return of([]);
    }

    const role = this.authService.getUserRole();
    let endpoint = '';

    // Determine endpoint based on role (according to API docs)
    if (role === 'ADMIN') {
      endpoint = this.apiUrl; // GET /payments - Get all payments
    } else if (role === 'PATIENT') {
      endpoint = `${this.apiUrl}/my-pending`; // GET /payments/my-pending - Get patient's pending Visa payments
    } else if (role === 'DOCTOR') {
      endpoint = `${this.apiUrl}/doctor/my`; // GET /payments/doctor/my - Get doctor's payments
    } else {
      console.warn(`Unknown role: ${role} - cannot load payments`);
      this.paymentsSubject.next([]);
      return of([]);
    }


    return this.http.get<BackendPayment[]>(endpoint, {
      headers: this.getHeaders(false), // GET requests don't need Content-Type
      observe: 'body'
    }).pipe(
      map((backendPayments) => {
        // Log the raw response for debugging

        // Handle null or undefined response - treat as empty array
        if (backendPayments === null || backendPayments === undefined) {
          console.warn('⚠️ Backend returned null or undefined for payments - treating as empty array');
          console.warn('This might indicate:');
          console.warn('1. Backend endpoint issue - check backend logs');
          console.warn('2. No payments exist for this user');
          console.warn('3. Serialization issue on backend');
          this.paymentsSubject.next([]);
          return [];
        }

        // Handle non-array response (might be wrapped in an object)
        if (!Array.isArray(backendPayments)) {
          console.error('⚠️ Invalid payments response format - expected array but got:', typeof backendPayments);
          console.error('Response value:', backendPayments);
          // Try to extract array from response object
          if (typeof backendPayments === 'object' && 'data' in backendPayments) {
            const data = (backendPayments as any).data;
            if (Array.isArray(data)) {
              backendPayments = data as BackendPayment[];
            } else {
              console.error('Could not extract array from response object');
              this.paymentsSubject.next([]);
              return [];
            }
          } else {
            this.paymentsSubject.next([]);
            return [];
          }
        }


        if (backendPayments.length === 0) {
        }

        const payments = backendPayments.map(bp => {
          try {
            return this.mapBackendToFrontend(bp);
          } catch (error) {
            console.error('Error mapping payment:', bp, error);
            return null;
          }
        }).filter(p => p !== null) as Payment[];

        this.paymentsSubject.next(payments);
        return payments;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('✗ Load payments error:', error);
        console.error('Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error,
          url: error.url
        });
        this.paymentsSubject.next([]);
        return of([]);
      })
    );
  }

  // Get pending payments (Admin only)
  // According to API: GET /payments/pending
  getPendingPayments(): Observable<Payment[]> {
    return this.http.get<BackendPayment[]>(`${this.apiUrl}/pending`, { headers: this.getHeaders(false) })
      .pipe(
        map(backendPayments => {
          if (!backendPayments || !Array.isArray(backendPayments)) {
            return [];
          }
          return backendPayments.map(bp => this.mapBackendToFrontend(bp));
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Get pending payments error:', error);
          return of([]);
        })
      );
  }

  // Get payments by method (Admin only)
  // According to API: GET /payments/method/{method}
  getPaymentsByMethod(method: 'CASH' | 'VISA'): Observable<Payment[]> {
    return this.http.get<BackendPayment[]>(`${this.apiUrl}/method/${method}`, { headers: this.getHeaders(false) })
      .pipe(
        map(backendPayments => {
          if (!backendPayments || !Array.isArray(backendPayments)) {
            return [];
          }
          return backendPayments.map(bp => this.mapBackendToFrontend(bp));
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Get payments by method error:', error);
          return of([]);
        })
      );
  }

  // Get payment by ID
  // According to API: GET /payments/{id}
  getPaymentById(id: number): Observable<Payment> {
    return this.http.get<BackendPayment>(`${this.apiUrl}/${id}`, { headers: this.getHeaders(false) })
      .pipe(
        map(backend => {
          return this.mapBackendToFrontend(backend);
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Get payment by ID error:', error);
          let errorMessage = 'Failed to get payment';
          if (error.error) {
            if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error.error.message) {
              errorMessage = error.error.message;
            }
          }
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Map backend payment to frontend format
  private mapBackendToFrontend(backend: BackendPayment): Payment {
    const appointmentTime = new Date(backend.appointment.appointmentTime);
    const date = appointmentTime.toISOString().split('T')[0];
    const hours = appointmentTime.getHours();
    const minutes = appointmentTime.getMinutes();
    const hour12 = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const time = `${hour12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;

    const amount = backend.amount || 0;
    const clinicTax = amount * this.CLINIC_TAX_RATE;
    const doctorEarning = amount * this.DOCTOR_EARNING_RATE;

    return {
      id: backend.id,
      appointmentId: backend.appointment.id,
      patientName: backend.appointment.patient?.username || backend.appointment.patient?.email || 'Unknown',
      doctor: backend.appointment.doctor?.name || 'Unknown Doctor',
      date: date,
      time: time,
      amount: amount,
      clinicTax: clinicTax,
      doctorEarning: doctorEarning,
      status: (backend.status as 'pending' | 'paid' | 'failed') || 'pending',
      paymentDate: backend.paymentDate || undefined, // Convert null to undefined
      paymentMethod: (backend.paymentMethod as 'CASH' | 'VISA') || 'CASH',
      cardLast4: backend.cardLast4 || undefined, // Convert null to undefined
      createdAt: backend.createdAt || date
    };
  }

  private loadInitialCards() {
    // Sample saved cards
    const cards: CardInfo[] = [
      {
        id: 1,
        cardNumber: '4242424242424242',
        cardHolder: 'John Doe',
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '123',
        last4: '4242',
        isDefault: true
      }
    ];
    this.cardsSubject.next(cards);
  }

  // Calculate clinic tax and doctor earning
  calculatePaymentBreakdown(amount: number): { clinicTax: number; doctorEarning: number } {
    return {
      clinicTax: amount * this.CLINIC_TAX_RATE,
      doctorEarning: amount * this.DOCTOR_EARNING_RATE
    };
  }

  // Create payment from appointment (for Visa payments)
  // According to API: POST /payments
  createPayment(appointmentId: number, cardInfo: CardInfo): Observable<Payment> {
    const request = {
      appointmentId: appointmentId,
      paymentMethod: 'VISA',
      cardLast4: cardInfo.last4
    };

    return this.http.post<BackendPayment>(this.apiUrl, request, { headers: this.getHeaders() })
      .pipe(
        map(backend => {
          const payment = this.mapBackendToFrontend(backend);
          // Update local state immediately
          const current = this.paymentsSubject.value;
          this.paymentsSubject.next([...current, payment]);
          // Reload payments to ensure consistency with backend
          this.loadPayments().subscribe({
            error: (err) => console.error('Failed to reload payments after create:', err)
          });
          return payment;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Create payment error:', error);
          let errorMessage = 'Failed to create payment';
          if (error.error) {
            if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error.error.message) {
              errorMessage = error.error.message;
            }
          }
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Approve payment (Admin only) - Mark payment as paid (for cash payments)
  // According to API: PUT /payments/{id}/approve
  approvePayment(paymentId: number): Observable<Payment> {
    return this.http.put<BackendPayment>(`${this.apiUrl}/${paymentId}/approve`, {}, { headers: this.getHeaders() })
      .pipe(
        map(backend => {
          const payment = this.mapBackendToFrontend(backend);
          // Update local state immediately
          const current = this.paymentsSubject.value;
          const updated = current.map(p => p.id === paymentId ? payment : p);
          this.paymentsSubject.next(updated);
          // Reload payments to ensure consistency
          this.loadPayments().subscribe({
            error: (err) => console.error('Failed to reload payments after approve:', err)
          });
          return payment;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Approve payment error:', error);
          let errorMessage = 'Failed to approve payment';
          if (error.error) {
            if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error.error.message) {
              errorMessage = error.error.message;
            }
          }
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Mark payment as paid (alias for approvePayment for backward compatibility)
  markPaymentAsPaid(paymentId: number): Observable<Payment> {
    return this.approvePayment(paymentId);
  }

  // Deny payment (Admin only) - Mark payment as failed
  // According to API: PUT /payments/{id}/deny
  denyPayment(paymentId: number): Observable<Payment> {
    return this.http.put<BackendPayment>(`${this.apiUrl}/${paymentId}/deny`, {}, { headers: this.getHeaders() })
      .pipe(
        map(backend => {
          const payment = this.mapBackendToFrontend(backend);
          // Update local state immediately
          const current = this.paymentsSubject.value;
          const updated = current.map(p => p.id === paymentId ? payment : p);
          this.paymentsSubject.next(updated);
          // Reload payments to ensure consistency
          this.loadPayments().subscribe({
            error: (err) => console.error('Failed to reload payments after deny:', err)
          });
          return payment;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Deny payment error:', error);
          let errorMessage = 'Failed to deny payment';
          if (error.error) {
            if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error.error.message) {
              errorMessage = error.error.message;
            }
          }
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Delete payment (Admin only)
  // According to API: DELETE /payments/{id}
  deletePayment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders(false) })
      .pipe(
        tap(() => {
          // Remove from local state immediately
          const current = this.paymentsSubject.value;
          const updated = current.filter(p => p.id !== id);
          this.paymentsSubject.next(updated);
          // Reload payments to ensure consistency
          this.loadPayments().subscribe({
            error: (err) => console.error('Failed to reload payments after delete:', err)
          });
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Delete payment error:', error);
          let errorMessage = 'Failed to delete payment';
          if (error.error) {
            if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error.error.message) {
              errorMessage = error.error.message;
            }
          }
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // Get today's payments
  getTodayPayments(): Payment[] {
    const today = new Date().toISOString().split('T')[0];
    return this.paymentsSubject.value.filter(p => p.date === today);
  }

  // Get all payments
  getPayments(): Payment[] {
    return this.paymentsSubject.value;
  }

  // Get payments by doctor
  getPaymentsByDoctor(doctorName: string): Payment[] {
    return this.paymentsSubject.value.filter(p => p.doctor === doctorName);
  }

  // Get payments by patient
  getPaymentsByPatient(patientName: string): Payment[] {
    return this.paymentsSubject.value.filter(p => p.patientName === patientName);
  }

  // Get doctor statistics
  getDoctorStatistics(doctorName: string): {
    totalEarnings: number;
    totalAppointments: number;
    clinicTaxTotal: number;
    netEarnings: number;
    payments: Payment[];
  } {
    const payments = this.getPaymentsByDoctor(doctorName).filter(p => p.status === 'paid');
    const totalEarnings = payments.reduce((sum, p) => sum + p.amount, 0);
    const clinicTaxTotal = payments.reduce((sum, p) => sum + p.clinicTax, 0);
    const netEarnings = payments.reduce((sum, p) => sum + p.doctorEarning, 0);

    return {
      totalEarnings,
      totalAppointments: payments.length,
      clinicTaxTotal,
      netEarnings,
      payments
    };
  }

  // Add card
  addCard(cardInfo: Omit<CardInfo, 'id' | 'last4'>): CardInfo {
    const cards = this.cardsSubject.value;
    const last4 = cardInfo.cardNumber.slice(-4);
    const newId = cards.length > 0
      ? Math.max(...cards.map(c => c.id)) + 1
      : 1;

    // If this is set as default, unset others
    if (cardInfo.isDefault) {
      cards.forEach(c => c.isDefault = false);
    }

    const newCard: CardInfo = {
      ...cardInfo,
      id: newId,
      last4
    };

    const updatedCards = [...cards, newCard];
    this.cardsSubject.next(updatedCards);
    return newCard;
  }

  // Get cards
  getCards(): CardInfo[] {
    return this.cardsSubject.value;
  }

  // Delete card
  deleteCard(cardId: number): boolean {
    const cards = this.cardsSubject.value;
    const filtered = cards.filter(c => c.id !== cardId);

    if (filtered.length === cards.length) return false;

    this.cardsSubject.next(filtered);
    return true;
  }

  // Set default card
  setDefaultCard(cardId: number): boolean {
    const cards = this.cardsSubject.value;
    const card = cards.find(c => c.id === cardId);
    if (!card) return false;

    cards.forEach(c => c.isDefault = c.id === cardId);
    this.cardsSubject.next([...cards]);
    return true;
  }
}

