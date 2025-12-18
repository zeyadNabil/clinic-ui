import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AppointmentService, Appointment } from './appointment.service';

export interface Payment {
  id: number;
  appointmentId: number;
  patientName: string;
  doctor: string;
  date: string;
  time: string;
  amount: number;
  clinicTax: number; // 20% of amount
  doctorEarning: number; // 80% of amount
  status: 'pending' | 'paid' | 'failed';
  paymentDate?: string;
  paymentMethod?: string;
  cardLast4?: string;
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
  private paymentsSubject = new BehaviorSubject<Payment[]>([]);
  public payments$: Observable<Payment[]> = this.paymentsSubject.asObservable();

  private cardsSubject = new BehaviorSubject<CardInfo[]>([]);
  public cards$: Observable<CardInfo[]> = this.cardsSubject.asObservable();

  private readonly CLINIC_TAX_RATE = 0.20; // 20%
  private readonly DOCTOR_EARNING_RATE = 0.80; // 80%

  constructor(private appointmentService: AppointmentService) {
    this.loadInitialPayments();
    this.loadInitialCards();
  }

  private loadInitialPayments() {
    const appointments = this.appointmentService.getAppointments();
    const payments: Payment[] = appointments
      .filter(apt => apt.paymentStatus === 'paid' && apt.paymentId)
      .map(apt => {
        const clinicTax = apt.amount! * this.CLINIC_TAX_RATE;
        const doctorEarning = apt.amount! * this.DOCTOR_EARNING_RATE;
        
        return {
          id: apt.paymentId!,
          appointmentId: apt.id,
          patientName: apt.patientName,
          doctor: apt.doctor,
          date: apt.date,
          time: apt.time,
          amount: apt.amount!,
          clinicTax,
          doctorEarning,
          status: 'paid' as const,
          paymentDate: apt.date,
          paymentMethod: 'card',
          cardLast4: '4242',
          createdAt: apt.date
        };
      });
    
    this.paymentsSubject.next(payments);
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

  // Create payment from appointment
  createPayment(appointmentId: number, cardInfo: CardInfo): Payment | null {
    const appointment = this.appointmentService.getAppointmentById(appointmentId);
    if (!appointment || !appointment.amount) return null;

    const breakdown = this.calculatePaymentBreakdown(appointment.amount);
    const payments = this.paymentsSubject.value;
    const newId = payments.length > 0 
      ? Math.max(...payments.map(p => p.id)) + 1 
      : 1;

    const payment: Payment = {
      id: newId,
      appointmentId: appointment.id,
      patientName: appointment.patientName,
      doctor: appointment.doctor,
      date: appointment.date,
      time: appointment.time,
      amount: appointment.amount,
      clinicTax: breakdown.clinicTax,
      doctorEarning: breakdown.doctorEarning,
      status: 'paid',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'card',
      cardLast4: cardInfo.last4,
      createdAt: new Date().toISOString().split('T')[0]
    };

    // Update appointment payment status
    this.appointmentService.updateAppointment(appointmentId, {
      paymentStatus: 'paid',
      paymentId: newId
    });

    const updatedPayments = [...payments, payment];
    this.paymentsSubject.next(updatedPayments);
    return payment;
  }

  // Mark payment as paid (admin)
  markPaymentAsPaid(paymentId: number): boolean {
    const payments = this.paymentsSubject.value;
    const index = payments.findIndex(p => p.id === paymentId);
    
    if (index === -1) return false;

    const payment = payments[index];
    payment.status = 'paid';
    payment.paymentDate = new Date().toISOString().split('T')[0];

    // Update appointment
    this.appointmentService.updateAppointment(payment.appointmentId, {
      paymentStatus: 'paid',
      paymentId: payment.id
    });

    const updatedPayments = [...payments];
    updatedPayments[index] = payment;
    this.paymentsSubject.next(updatedPayments);
    return true;
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

