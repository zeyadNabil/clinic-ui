import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppointmentService, Appointment } from '../../appointments/appointment.service';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ChangeDetectorRef } from '@angular/core';


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
  showAppointments = true;
  appointments: Appointment[] = [];
  loadingAppointments = false;
  appointmentsError: string | null = null;

  constructor(private appointmentSvc: AppointmentService, private datePipe: DatePipe,   private router: Router, private cd: ChangeDetectorRef ) {}

  ngOnInit(): void {
  if (this.doctorId) {
    this.loadAppointments();
  }

  this.router.events
    .pipe(filter(event => event instanceof NavigationEnd))
    .subscribe(() => {
      if (this.doctorId) this.loadAppointments();
    });
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
        this.cd.detectChanges(); 

      },
      error: (err) => {
        console.error('Failed to load appointments', err);
        this.appointmentsError = err?.message || 'Failed to load appointments';
        this.loadingAppointments = false;
        // Retry after 2 seconds if failed
        setTimeout(() => {
          this.loadAppointments();
        }, 2000);
      }
    });
  }

  toggleManageAppointments() {
  this.showAppointments = !this.showAppointments;
  if (this.showAppointments) {
    this.loadAppointments();
  }
}


  getInitials(name?: string): string {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  formatDateTime(value?: string): string {
    if (!value) return '';
    try {
      const transformed = this.datePipe.transform(value, 'short');
      return transformed ?? value;
    } catch (e) {
      return value;
    }
  }
}
