import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AppointmentService, Appointment } from '../../services/appointment.service';
import { UserService, User } from '../../services/user.service';
import { DoctorService, DoctorNameDto } from '../../services/doctor.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-appointments',
  imports: [CommonModule, FormsModule],
  templateUrl: './appointments.html',
  styleUrl: './appointments.css',
})
export class Appointments implements OnInit, OnDestroy {
  user: User | null = null;

  // Doctors list from backend
  doctors: DoctorNameDto[] = [];
  loadingDoctors = false;
  selectedDoctorFee: number = 0;

  // Appointment reason options
  appointmentReasons = [
    'General Checkup',
    'Consultation',
    'Follow-up',
    'Emergency',
    'Treatment',
    'Vaccination',
    'Lab Test',
    'X-Ray',
    'Prescription Refill',
    'Other'
  ];

  // Clinic hours: 9 AM to 9 PM
  clinicHours: string[] = [];

  // Get minimum date (today)
  get minDate(): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().split('T')[0];
  }

  // Initialize clinic hours (9 AM to 9 PM) - every 30 minutes
  initializeClinicHours(): void {
    this.clinicHours = [];
    // Generate times from 9 AM (09:00) to 9 PM (21:00) every 30 minutes
    for (let hour = 9; hour <= 21; hour++) {
      // Add :00 (top of the hour)
      const time24 = hour.toString().padStart(2, '0') + ':00';
      this.clinicHours.push(time24);

      // Add :30 (half past the hour), but not for 9 PM (21:00) as that's the closing time
      if (hour < 21) {
        const time24_30 = hour.toString().padStart(2, '0') + ':30';
        this.clinicHours.push(time24_30);
      }
    }
  }

  // Convert 24-hour time to 12-hour format for display
  formatTimeForDisplay(time24: string): string {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const hour12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  }

  // Handle date change - reset time if date is today and selected time has passed
  onDateChange(): void {
    if (!this.formData.date) return;

    const selectedDate = new Date(this.formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    // If selected date is today, check if selected time has passed
    if (selectedDate.getTime() === today.getTime() && this.formData.time) {
      const [hours, minutes] = this.formData.time.split(':');
      const selectedTime = new Date();
      selectedTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      const now = new Date();

      if (selectedTime < now) {
        // Time has passed, reset it
        this.formData.time = '';
        alert('The selected time has already passed. Please select a future time.');
      }
    }
  }

  // Stats
  stats = {
    total: 0,
    today: 0,
    pending: 0,
    completed: 0
  };

  // Filter and search
  searchTerm = '';
  statusFilter = 'all'; // 'all', 'pending_approval', 'accepted', 'scheduled', 'completed', 'cancelled', 'denied'
  dateFilter = 'all'; // 'all', 'today', 'week', 'month'

  // Appointments data
  appointments: Appointment[] = [];
  private subscriptions = new Subscription();

  constructor(
    private appointmentService: AppointmentService,
    private userService: UserService,
    private doctorService: DoctorService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    // Initialize clinic hours (9 AM to 9 PM)
    this.initializeClinicHours();

    // Subscribe to appointments first - this is the main data source
    const appointmentsSub = this.appointmentService.appointments$.subscribe(appointments => {
      this.appointments = appointments;
      this.updateStats();
    });
    this.subscriptions.add(appointmentsSub);

    // Subscribe to doctors from service (convert Doctor[] to DoctorNameDto[])
    const doctorsSub = this.doctorService.doctors$.subscribe(doctors => {
      this.doctors = (doctors || []).map(d => ({
        id: d.id,
        name: d.name,
        consultationFee: d.consultationFee || 100.0
      }));
    });
    this.subscriptions.add(doctorsSub);

    // Wait for user to be loaded before loading data
    const userSub = this.userService.currentUser$.subscribe(user => {
      this.user = user;
      this.updateStats();

      // Only load data if user is authenticated
      if (user) {
        // Load appointments when user is available
        // The appointments$ subscription will automatically update when data loads
        this.appointmentService.loadAppointments().subscribe({
          error: (error) => {
            console.error('Error loading appointments:', error);
          }
        });

        // Load doctors list
        this.loadDoctors();
        // Also trigger service load
        this.doctorService.loadDoctors().catch(err => {
          console.error('Error loading doctors from service:', err);
        });
      } else {
        // Clear data if user is not authenticated
        this.appointments = [];
        this.doctors = [];
        this.updateStats();
      }
    });
    this.subscriptions.add(userSub);

    // Check if we should open create modal (from dashboard quick action)
    this.route.queryParams.subscribe(params => {
      if (params['action'] === 'create' && this.user) {
        // Remove query param from URL
        this.router.navigate(['/appointments'], { replaceUrl: true });
        // Open create modal after a short delay to ensure everything is loaded
        setTimeout(() => {
          this.openCreateModal();
        }, 500);
      }
    });
  }

  loadDoctors() {
    // Only load if user is authenticated
    if (!this.user) {
      this.doctors = [];
      this.loadingDoctors = false;
      return;
    }

    this.loadingDoctors = true;

    // Try loading from service first (uses BehaviorSubject)
    this.doctorService.loadDoctors().catch(err => {
      console.error('Service loadDoctors failed:', err);
    });

    // Also call getDoctorsList directly
    const sub = this.doctorService.getDoctorsList().subscribe({
      next: (doctors) => {
        this.doctors = doctors || [];
        this.loadingDoctors = false;
      },
      error: (error) => {
        console.error('Failed to load doctors:', error);
        this.doctors = [];
        this.loadingDoctors = false;
      }
    });
    this.subscriptions.add(sub);
  }

  // Update amount when doctor is selected
  onDoctorChange() {
    const selectedDoctor = this.doctors.find(d => d.id === this.formData.doctorId);
    if (selectedDoctor && selectedDoctor.consultationFee) {
      this.selectedDoctorFee = selectedDoctor.consultationFee;
      this.formData.amount = selectedDoctor.consultationFee;
    } else {
      // Default fee if doctor doesn't have one set
      this.selectedDoctorFee = 100.0;
      this.formData.amount = 100.0;
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }


  // Modal state
  showModal = false;
  showCancelModal = false;
  showMessageModal = false;
  cancellingAppointment: Appointment | null = null;
  viewingMessageAppointment: Appointment | null = null;

  // Form data for modal
  formData = {
    patientName: '',
    doctorId: 0,
    doctor: '',
    date: '',
    time: '',
    type: '',
    reason: '',
    status: 'pending_approval',
    phone: '',
    email: '',
    paymentMethod: 'CASH' as 'CASH' | 'VISA',
    amount: 100.0
  };

  // Cancellation form
  cancellationForm = {
    message: ''
  };


  // Update stats based on appointments
  updateStats() {
    const today = new Date().toISOString().split('T')[0];
    this.stats.total = this.appointments.length;
    this.stats.today = this.appointments.filter(apt => apt.date === today).length;
    this.stats.pending = this.appointments.filter(apt =>
      apt.status === 'pending_approval' || apt.status === 'scheduled'
    ).length;
    this.stats.completed = this.appointments.filter(apt => apt.status === 'completed').length;
  }

  // Get filtered appointments based on role
  get filteredAppointments() {
    if (!this.user) return [];

    // Backend already handles role-based filtering, so we just use the appointments as-is
    let filtered = [...this.appointments];

    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(apt =>
        apt.patientName.toLowerCase().includes(term) ||
        apt.doctor.toLowerCase().includes(term) ||
        (apt.type && apt.type.toLowerCase().includes(term)) ||
        (apt.reason && apt.reason.toLowerCase().includes(term))
      );
    }

    // Filter by status
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.status === this.statusFilter);
    }

    // Filter by date
    if (this.dateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      filtered = filtered.filter(apt => {
        const aptDate = new Date(apt.date);
        aptDate.setHours(0, 0, 0, 0);

        if (this.dateFilter === 'today') {
          return aptDate.getTime() === today.getTime();
        } else if (this.dateFilter === 'week') {
          const weekFromNow = new Date(today);
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          return aptDate >= today && aptDate <= weekFromNow;
        } else if (this.dateFilter === 'month') {
          const monthFromNow = new Date(today);
          monthFromNow.setMonth(monthFromNow.getMonth() + 1);
          return aptDate >= today && aptDate <= monthFromNow;
        }
        return true;
      });
    }

    return filtered;
  }

  // Get status badge class
  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'completed': 'bg-success',
      'pending_approval': 'bg-warning',
      'accepted': 'bg-info',
      'scheduled': 'bg-info',
      'cancelled': 'bg-danger',
      'denied': 'bg-danger'
    };
    return statusMap[status] || 'bg-secondary';
  }

  // Get status display text
  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending_approval': 'Pending Approval',
      'accepted': 'Accepted',
      'scheduled': 'Scheduled',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'denied': 'Denied'
    };
    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
  }

  // Check if appointment time has passed
  isAppointmentTimePassed(appointment: Appointment): boolean {
    const now = new Date();
    const aptDate = new Date(appointment.date);
    const [time, modifier] = appointment.time.split(' ');
    let [hours, minutes] = time.split(':');

    // Convert to 24-hour format
    if (modifier === 'PM' && hours !== '12') {
      hours = (parseInt(hours) + 12).toString();
    } else if (modifier === 'AM' && hours === '12') {
      hours = '00';
    }

    aptDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    return now > aptDate;
  }

  // Check if user can cancel appointment (only for patients now)
  canCancelAppointment(appointment: Appointment): boolean {
    if (!this.user) return false;

    if (this.user.role === 'PATIENT') {
      // Patient can only cancel appointments that have been accepted by admin
      // Backend logic: only APPROVED appointments can be cancelled by patients
      return !this.isAppointmentTimePassed(appointment) &&
             appointment.status === 'accepted';
    }

    return false;
  }


  // Open create modal
  openCreateModal() {
    if (!this.user) return;

    // Always reload doctors to ensure they're available
    this.loadDoctors();

    this.selectedDoctorFee = 0;
    this.formData = {
      patientName: this.user.role === 'PATIENT' ? this.user.name : '',
      doctorId: 0,
      doctor: '',
      date: '',
      time: '',
      type: '',
      reason: '',
      status: 'pending_approval',
      phone: '',
      email: '',
      paymentMethod: 'CASH',
      amount: 100.0
    };
    this.showModal = true;
  }

  // Convert 12-hour time to 24-hour format for input
  convertTo24Hour(time12h: string): string {
    if (!time12h) return '';
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
      hours = '00';
    }
    if (modifier === 'PM') {
      hours = (parseInt(hours, 10) + 12).toString();
    }
    return `${hours.padStart(2, '0')}:${minutes}`;
  }

  // Convert 24-hour time to 12-hour format for display
  convertTo12Hour(time24h: string): string {
    if (!time24h) return '';
    const [hours, minutes] = time24h.split(':');
    const hour = parseInt(hours, 10);
    const modifier = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12.toString().padStart(2, '0')}:${minutes} ${modifier}`;
  }


  // Close modal
  closeModal() {
    this.showModal = false;
    this.showCancelModal = false;
    this.showMessageModal = false;
    this.cancellingAppointment = null;
    this.viewingMessageAppointment = null;
    this.cancellationForm.message = '';
  }

  // Open cancel modal
  openCancelModal(appointment: Appointment) {
    if (!this.user) return;

    if (!this.canCancelAppointment(appointment)) {
      if (this.user.role === 'PATIENT') {
        if (this.isAppointmentTimePassed(appointment)) {
          alert('You cannot cancel appointments that have already passed.');
        } else if (appointment.status !== 'accepted') {
          alert('You can only cancel appointments that have been accepted by the admin. Current status: ' + this.getStatusText(appointment.status));
        } else {
          alert('You cannot cancel this appointment.');
        }
      }
      return;
    }
    this.cancellingAppointment = appointment;
    this.cancellationForm.message = '';
    this.showCancelModal = true;
  }

  // Open message view modal (for admin to see doctor cancellation messages)
  openMessageModal(appointment: Appointment) {
    this.viewingMessageAppointment = appointment;
    this.showMessageModal = true;
  }

  // Accept appointment (Admin only)
  acceptAppointment(appointment: Appointment) {
    this.appointmentService.approveAppointment(appointment.id).subscribe({
      next: () => {
        alert('Appointment accepted successfully!');
      },
      error: (error) => {
        alert('Failed to accept appointment: ' + (error.error || error.message || 'Unknown error'));
        console.error('Accept appointment error:', error);
      }
    });
  }

  // Deny appointment (Admin only)
  denyAppointment(appointment: Appointment) {
    if (confirm(`Are you sure you want to deny the appointment for ${appointment.patientName}?`)) {
      this.appointmentService.denyAppointment(appointment.id).subscribe({
        next: () => {
          alert('Appointment denied successfully!');
        },
        error: (error) => {
          alert('Failed to deny appointment: ' + (error.error || error.message || 'Unknown error'));
          console.error('Deny appointment error:', error);
        }
      });
    }
  }

  // Save appointment (create only)
  saveAppointment() {
    if (!this.formData.doctorId || this.formData.doctorId === 0) {
      alert('Please select a doctor');
      return;
    }

    if (!this.formData.date || !this.formData.time) {
      alert('Please select date and time');
      return;
    }

    if (!this.formData.reason || this.formData.reason.trim() === '') {
      alert('Please select an appointment reason');
      return;
    }

    // Validate date is not in the past
    const selectedDate = new Date(this.formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      alert('Cannot book appointments for past dates. Please select today or a future date.');
      return;
    }

    // Validate time is within clinic hours (9 AM - 9 PM)
    if (!this.formData.time || this.formData.time.trim() === '') {
      alert('Please select a time');
      return;
    }

    const [hours, minutes] = this.formData.time.split(':');
    const hour = parseInt(hours, 10);
    if (hour < 9 || hour > 21) {
      alert('Clinic hours are from 9:00 AM to 9:00 PM. Please select a time within these hours.');
      return;
    }

    // If selected date is today, check if selected time has passed
    if (selectedDate.getTime() === today.getTime()) {
      const selectedTime = new Date();
      selectedTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      const now = new Date();

      if (selectedTime < now) {
        alert('Cannot book appointments for past times. Please select a future time.');
        return;
      }
    }

    // Create new appointment via backend
    this.appointmentService.createAppointment({
      doctorId: this.formData.doctorId,
      date: this.formData.date,
      time: this.formData.time,
      reason: this.formData.reason,
      paymentMethod: this.formData.paymentMethod,
      amount: this.formData.amount
    }).subscribe({
      next: (appointment) => {
        this.closeModal();
        alert('Appointment created successfully!');
      },
      error: (error) => {
        alert('Failed to create appointment: ' + (error.message || 'Unknown error'));
        console.error('Create appointment error:', error);
      }
    });
  }

  // Cancel appointment (delete from database)
  confirmCancelAppointment() {
    if (!this.user) return;

    if (!this.cancellationForm.message.trim()) {
      alert('Please provide a reason for cancellation.');
      return;
    }

    if (this.cancellingAppointment) {
      // Delete the appointment completely from database
      this.appointmentService.deleteAppointment(this.cancellingAppointment.id).subscribe({
        next: () => {
          alert('Appointment cancelled and removed successfully!');
          this.closeModal();
        },
        error: (error) => {
          alert('Failed to cancel appointment: ' + (error.error || error.message || 'Unknown error'));
          console.error('Cancel appointment error:', error);
        }
      });
    } else {
      this.closeModal();
    }
  }
}

