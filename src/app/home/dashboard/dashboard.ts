import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppointmentService, Appointment } from '../../appointments/appointment.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit {
  user = { role: 'doctor' }; 
  doctorId = '1';
  showAppointments = false;
  appointments: Appointment[] = [];
  loadingAppointments = false;
  appointmentsError: string | null = null;

  constructor(private appointmentSvc: AppointmentService, private datePipe: DatePipe) {}

  ngOnInit(): void {
    this.loadAppointments(); // load on page load for this doctor
  }

  toggleManageAppointments() {
    this.showAppointments = !this.showAppointments;
    if (this.showAppointments) this.loadAppointments();
  }

  loadAppointments() {
    this.loadingAppointments = true;
    this.appointmentsError = null;

    if (!this.doctorId) {
      this.appointmentsError = 'Doctor ID is required.';
      this.loadingAppointments = false;
      return;
    }

    this.appointmentSvc.getAppointmentsByDoctor(this.doctorId).subscribe({
      next: (list) => {
        console.log('Appointments response:', list);
        this.appointments = list;
        this.loadingAppointments = false;
      },
      error: (err) => {
        console.error('Failed to load appointments', err);
        this.appointmentsError = err?.message || 'Failed to load appointments';
        this.loadingAppointments = false;
      }
    });
  }

  getInitials(name?: string): string {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  formatDateTime(value?: string): string {
    if (!value) return '';
    // Try to transform using Angular DatePipe; fallback to the raw value.
    try {
      const transformed = this.datePipe.transform(value, 'short');
      return transformed ?? value;
    } catch (e) {
      return value;
    }
  }
}
