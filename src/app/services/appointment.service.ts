import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Appointment {
  id: number;
  patientName: string;
  patientInitials: string;
  doctor: string;
  date: string;
  time: string;
  type: string;
  status: 'pending_approval' | 'accepted' | 'scheduled' | 'completed' | 'cancelled' | 'denied';
  phone: string;
  email: string;
  cancellationMessage?: string;
  cancelledBy?: string;
  amount?: number; // Payment amount for the appointment
  paymentStatus?: 'pending' | 'paid' | 'failed';
  paymentId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private appointmentsSubject = new BehaviorSubject<Appointment[]>([]);
  public appointments$: Observable<Appointment[]> = this.appointmentsSubject.asObservable();

  constructor() {
    // Initialize with sample data
    this.loadInitialAppointments();
  }

  private loadInitialAppointments() {
    const initialAppointments: Appointment[] = [
      {
        id: 1,
        patientName: 'John Doe',
        patientInitials: 'JD',
        doctor: 'Dr. Smith',
        date: '2024-12-20',
        time: '09:00 AM',
        type: 'Checkup',
        status: 'pending_approval',
        phone: '+1 234-567-8900',
        email: 'john.doe@email.com',
        amount: 150,
        paymentStatus: 'pending'
      },
      {
        id: 2,
        patientName: 'Sarah Miller',
        patientInitials: 'SM',
        doctor: 'Dr. Johnson',
        date: '2024-12-21',
        time: '10:30 AM',
        type: 'Consultation',
        status: 'accepted',
        phone: '+1 234-567-8901',
        email: 'sarah.miller@email.com',
        amount: 200,
        paymentStatus: 'paid',
        paymentId: 1
      },
      {
        id: 3,
        patientName: 'Robert Johnson',
        patientInitials: 'RJ',
        doctor: 'Dr. Williams',
        date: '2024-12-22',
        time: '02:00 PM',
        type: 'Treatment',
        status: 'scheduled',
        phone: '+1 234-567-8902',
        email: 'robert.johnson@email.com',
        amount: 300,
        paymentStatus: 'paid',
        paymentId: 2
      },
      {
        id: 4,
        patientName: 'Emily Davis',
        patientInitials: 'ED',
        doctor: 'Dr. Brown',
        date: '2024-12-23',
        time: '11:00 AM',
        type: 'Follow-up',
        status: 'accepted',
        phone: '+1 234-567-8903',
        email: 'emily.davis@email.com',
        amount: 100,
        paymentStatus: 'pending'
      },
      {
        id: 5,
        patientName: 'Michael Wilson',
        patientInitials: 'MW',
        doctor: 'Dr. Smith',
        date: '2024-12-24',
        time: '03:30 PM',
        type: 'Checkup',
        status: 'pending_approval',
        phone: '+1 234-567-8904',
        email: 'michael.wilson@email.com',
        amount: 150,
        paymentStatus: 'pending'
      },
      {
        id: 6,
        patientName: 'Lisa Anderson',
        patientInitials: 'LA',
        doctor: 'Dr. Johnson',
        date: '2024-12-25',
        time: '09:30 AM',
        type: 'Consultation',
        status: 'scheduled',
        phone: '+1 234-567-8905',
        email: 'lisa.anderson@email.com',
        amount: 200,
        paymentStatus: 'paid',
        paymentId: 3,
        cancellationMessage: 'Emergency case came up',
        cancelledBy: 'doctor'
      }
    ];
    this.appointmentsSubject.next(initialAppointments);
  }

  // Get all appointments
  getAppointments(): Appointment[] {
    return this.appointmentsSubject.value;
  }

  // Get appointment by ID
  getAppointmentById(id: number): Appointment | undefined {
    return this.appointmentsSubject.value.find(apt => apt.id === id);
  }

  // Add new appointment
  addAppointment(appointment: Omit<Appointment, 'id' | 'paymentStatus'>): Appointment {
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
  updateAppointment(id: number, updates: Partial<Appointment>): Appointment | null {
    const appointments = this.appointmentsSubject.value;
    const index = appointments.findIndex(apt => apt.id === id);
    
    if (index === -1) return null;
    
    const updatedAppointment = { ...appointments[index], ...updates };
    const updatedAppointments = [...appointments];
    updatedAppointments[index] = updatedAppointment;
    
    this.appointmentsSubject.next(updatedAppointments);
    return updatedAppointment;
  }

  // Delete appointment
  deleteAppointment(id: number): boolean {
    const appointments = this.appointmentsSubject.value;
    const filtered = appointments.filter(apt => apt.id !== id);
    
    if (filtered.length === appointments.length) return false;
    
    this.appointmentsSubject.next(filtered);
    return true;
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

