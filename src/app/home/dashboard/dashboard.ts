import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UserService, User } from '../../services/user.service';
import { AppointmentService, Appointment } from '../../services/appointment.service';
import { DoctorService } from '../../services/doctor.service';
import { PrescriptionService, Prescription } from '../../services/prescription.service';
import { Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  user: User | null = null;
  appointments: Appointment[] = [];
  showAddDoctorModal = false;
  showPrescriptionModal = false;
  savingPrescription = false;
  availablePatients: Array<{ id: number; name: string; email: string }> = [];
  private subscriptions = new Subscription();

  doctorFormData = {
    name: '',
    email: '',
    specialty: '',
    password: ''
  };

  prescriptionFormData = {
    patientId: '',
    diagnosis: '',
    medications: '',
    instructions: '',
    notes: ''
  };

  constructor(
    private userService: UserService,
    private appointmentService: AppointmentService,
    private doctorService: DoctorService,
    private prescriptionService: PrescriptionService,
    private router: Router
  ) {}

  ngOnInit() {
    // Subscribe to appointments first - this is the main data source
    const appointmentsSub = this.appointmentService.appointments$.subscribe(appointments => {
      this.appointments = appointments;
    });
    this.subscriptions.add(appointmentsSub);

    // Wait for user to be loaded before loading data
    const userSub = this.userService.currentUser$.subscribe(async user => {
      this.user = user;

      // Only load data if user is authenticated
      if (user) {
        // Small delay to ensure everything is initialized
        await new Promise(resolve => setTimeout(resolve, 100));

        // Load appointments when user is available (async)
        try {
          await this.appointmentService.loadAppointments();
        } catch (error) {
          console.error('Error loading appointments in dashboard:', error);
          // Retry once after a delay
          setTimeout(async () => {
            try {
              await this.appointmentService.loadAppointments();
            } catch (retryError) {
              console.error('Error retrying appointments load:', retryError);
            }
          }, 1000);
        }
      } else {
        // Clear data if user is not authenticated
        this.appointments = [];
      }
    });
    this.subscriptions.add(userSub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  // Get recent appointments (last 5)
  get recentAppointments(): Appointment[] {
    return this.appointments.slice(0, 5);
  }

  // Get today's appointments count
  get todayAppointmentsCount(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.appointments.filter(apt => apt.date === today).length;
  }

  // Get total appointments count
  get totalAppointmentsCount(): number {
    return this.appointments.length;
  }

  // Get completed appointments count
  get completedAppointmentsCount(): number {
    return this.appointments.filter(apt => apt.status === 'completed').length;
  }

  // Get upcoming appointments count
  get upcomingAppointmentsCount(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.appointments.filter(apt => apt.date >= today && apt.status !== 'completed' && apt.status !== 'cancelled').length;
  }

  // Navigate to appointments page (for booking new appointment)
  navigateToAppointments(): void {
    this.router.navigate(['/appointments'], { queryParams: { action: 'create' } });
  }

  // Open add doctor modal
  openAddDoctorModal(): void {
    this.doctorFormData = {
      name: '',
      email: '',
      specialty: '',
      password: ''
    };
    this.showAddDoctorModal = true;
  }

  // Close add doctor modal
  closeAddDoctorModal(): void {
    this.showAddDoctorModal = false;
    this.doctorFormData = {
      name: '',
      email: '',
      specialty: '',
      password: ''
    };
  }

  // Save new doctor
  saveDoctor(): void {
    if (!this.doctorFormData.name || !this.doctorFormData.email || !this.doctorFormData.specialty || !this.doctorFormData.password) {
      alert('Please fill in all fields');
      return;
    }

    const sub = this.doctorService.createDoctor({
      name: this.doctorFormData.name,
      email: this.doctorFormData.email,
      specialty: this.doctorFormData.specialty,
      password: this.doctorFormData.password
    }).subscribe({
      next: () => {
        alert('Doctor created successfully!');
        this.closeAddDoctorModal();
      },
      error: (error: HttpErrorResponse | Error) => {
        const errorMessage = error instanceof Error ? error.message : (error.error?.message || error.message || 'Unknown error');
        alert('Failed to create doctor: ' + errorMessage);
        console.error('Create doctor error:', error);
      }
    });
    this.subscriptions.add(sub);
  }

  // Open prescription modal
  openPrescriptionModal(): void {
    // Get unique patients from appointments
    const patientMap = new Map<number, { id: number; name: string; email: string }>();

    // Extract unique patients from appointments
    this.appointments.forEach(apt => {
      if (apt.patientId && apt.patientName) {
        // Use patient ID as key to ensure uniqueness
        if (!patientMap.has(apt.patientId)) {
          patientMap.set(apt.patientId, {
            id: apt.patientId,
            name: apt.patientName,
            email: apt.email || ''
          });
        }
      }
    });

    this.availablePatients = Array.from(patientMap.values());
    this.prescriptionFormData = {
      patientId: '',
      diagnosis: '',
      medications: '',
      instructions: '',
      notes: ''
    };
    this.showPrescriptionModal = true;
  }

  // Close prescription modal
  closePrescriptionModal(): void {
    this.showPrescriptionModal = false;
    this.prescriptionFormData = {
      patientId: '',
      diagnosis: '',
      medications: '',
      instructions: '',
      notes: ''
    };
  }

  // Save prescription
  savePrescription(): void {
    if (!this.prescriptionFormData.patientId ||
        !this.prescriptionFormData.diagnosis ||
        !this.prescriptionFormData.medications ||
        !this.prescriptionFormData.instructions) {
      alert('Please fill in all required fields');
      return;
    }

    this.savingPrescription = true;

    const prescription: Prescription = {
      patient: {
        id: parseInt(this.prescriptionFormData.patientId),
        username: '',
        email: ''
      },
      diagnosis: this.prescriptionFormData.diagnosis,
      medications: this.prescriptionFormData.medications,
      instructions: this.prescriptionFormData.instructions,
      notes: this.prescriptionFormData.notes
    };

    const sub = this.prescriptionService.createPrescription(prescription).subscribe({
      next: () => {
        alert('Prescription sent successfully!');
        this.closePrescriptionModal();
        this.savingPrescription = false;
      },
      error: (error: HttpErrorResponse | Error) => {
        const errorMessage = error instanceof Error ? error.message : (error.error?.message || error.message || 'Unknown error');
        alert('Failed to send prescription: ' + errorMessage);
        console.error('Create prescription error:', error);
        this.savingPrescription = false;
      }
    });
    this.subscriptions.add(sub);
  }
}
