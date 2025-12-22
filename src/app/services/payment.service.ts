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

// Backend payment structure
interface BackendPayment {
  id: number;
  appointment: {
    id: number;
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
    appointmentTime: string;
    reason: string;
    status: string;
  };
  amount: number;
  paymentMethod: string;
  status: string;
  cardLast4?: string;
  paymentDate?: string;
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
    // Load payments when service is created
    this.loadPayments().subscribe();
  }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Load payments from backend
  loadPayments(): Observable<Payment[]> {
    const role = this.authService.getUserRole();
    let endpoint = '';

    if (role === 'ADMIN') {
      endpoint = this.apiUrl; // Get all payments
    } else if (role === 'PATIENT') {
      endpoint = `${this.apiUrl}/my-pending`; // Get patient's pending Visa payments
    } else {
      // For doctors, we'll filter by doctor name in the component
      endpoint = this.apiUrl;
    }

    return this.http.get<BackendPayment[]>(endpoint, { headers: this.getHeaders() })
      .pipe(
        map(backendPayments => {
          const payments = (backendPayments || []).map(bp => this.mapBackendToFrontend(bp));
          this.paymentsSubject.next(payments);
          return payments;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Load payments error:', error);
          this.paymentsSubject.next([]);
          return of([]);
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
      paymentDate: backend.paymentDate,
      paymentMethod: (backend.paymentMethod as 'CASH' | 'VISA') || 'CASH',
      cardLast4: backend.cardLast4,
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
          // Reload to ensure sync
          this.loadPayments().subscribe();
          return payment;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Create payment error:', error);
          return throwError(() => new Error(error.error?.message || 'Failed to create payment'));
        })
      );
  }

  // Mark payment as paid (admin) - for cash payments
  markPaymentAsPaid(paymentId: number): Observable<Payment> {
    return this.http.put<BackendPayment>(`${this.apiUrl}/${paymentId}/approve`, {}, { headers: this.getHeaders() })
      .pipe(
        map(backend => {
          const payment = this.mapBackendToFrontend(backend);
          // Update local state immediately
          const current = this.paymentsSubject.value;
          const updated = current.map(p => p.id === paymentId ? payment : p);
          this.paymentsSubject.next(updated);
          // Reload to ensure sync
          this.loadPayments().subscribe();
          return payment;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Approve payment error:', error);
          return throwError(() => new Error(error.error?.message || 'Failed to approve payment'));
        })
      );
  }

  // Deny payment (admin) - mark as failed
  denyPayment(paymentId: number): Observable<Payment> {
    return this.http.put<BackendPayment>(`${this.apiUrl}/${paymentId}/deny`, {}, { headers: this.getHeaders() })
      .pipe(
        map(backend => {
          const payment = this.mapBackendToFrontend(backend);
          // Update local state immediately
          const current = this.paymentsSubject.value;
          const updated = current.map(p => p.id === paymentId ? payment : p);
          this.paymentsSubject.next(updated);
          // Reload to ensure sync
          this.loadPayments().subscribe();
          return payment;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Deny payment error:', error);
          return throwError(() => new Error(error.error?.message || 'Failed to deny payment'));
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

