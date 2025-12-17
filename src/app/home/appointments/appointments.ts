import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppointmentService, Appointment } from '../../services/appointment.service';
import { UserService, User } from '../../services/user.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-appointments',
  imports: [CommonModule, FormsModule],
  templateUrl: './appointments.html',
  styleUrl: './appointments.css',
})
export class Appointments implements OnInit, OnDestroy {
  user: User | null = null;

  // Static list of doctors (will be replaced with backend data later)
  doctors = [
    'Dr. Smith',
    'Dr. Johnson',
    'Dr. Williams',
    'Dr. Brown',
    'Dr. Davis',
    'Dr. Wilson',
    'Dr. Anderson',
    'Dr. Martinez',
    'Dr. Taylor',
    'Dr. Thomas'
  ];

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
    private userService: UserService
  ) {}

  ngOnInit() {
    // Subscribe to user
    const userSub = this.userService.currentUser$.subscribe(user => {
      this.user = user;
      this.updateStats();
    });
    this.subscriptions.add(userSub);

    // Subscribe to appointments
    const appointmentsSub = this.appointmentService.appointments$.subscribe(appointments => {
      this.appointments = appointments;
      this.updateStats();
    });
    this.subscriptions.add(appointmentsSub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }


  // Modal state
  showModal = false;
  showCancelModal = false;
  showMessageModal = false;
  editingAppointment: Appointment | null = null;
  cancellingAppointment: Appointment | null = null;
  viewingMessageAppointment: Appointment | null = null;
  modalMode = 'create'; // 'create' or 'edit'

  // Form data for modal
  formData = {
    patientName: '',
    doctor: '',
    date: '',
    time: '',
    type: '',
    status: 'pending_approval', // New appointments start as pending_approval
    phone: '',
    email: ''
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
    this.stats.pending = this.appointments.filter(apt => apt.status === 'pending_approval').length;
    this.stats.completed = this.appointments.filter(apt => apt.status === 'completed').length;
  }

  // Get filtered appointments based on role
  get filteredAppointments() {
    if (!this.user) return [];
    
    let filtered = [...this.appointments];

    // Role-based filtering
    if (this.user?.role === 'doctor') {
      // Doctors only see their own appointments
      filtered = filtered.filter(apt => apt.doctor === this.user?.doctorName);
    } else if (this.user?.role === 'patient') {
      // Patients only see their own appointments
      filtered = filtered.filter(apt => apt.patientName === this.user?.name);
    }
    // Admin sees all appointments

    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(apt =>
        apt.patientName.toLowerCase().includes(term) ||
        apt.doctor.toLowerCase().includes(term) ||
        apt.type.toLowerCase().includes(term)
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

  // Check if appointment is today (for doctor cancellation restriction)
  isAppointmentToday(appointment: Appointment): boolean {
    const today = new Date().toISOString().split('T')[0];
    return appointment.date === today;
  }

  // Check if user can cancel appointment
  canCancelAppointment(appointment: Appointment): boolean {
    if (!this.user) return false;
    
    if (this.user.role === 'doctor') {
      // Doctor cannot cancel on the same day
      return !this.isAppointmentToday(appointment) &&
             appointment.status !== 'cancelled' &&
             appointment.status !== 'completed';
    } else if (this.user.role === 'patient') {
      // Patient cannot cancel if time has passed
      return !this.isAppointmentTimePassed(appointment) &&
             appointment.status !== 'cancelled' &&
             appointment.status !== 'completed' &&
             appointment.status !== 'denied';
    }
    return false;
  }

  // Check if user can edit appointment
  canEditAppointment(appointment: Appointment): boolean {
    if (!this.user) return false;
    
    if (this.user.role === 'patient') {
      // Patient cannot edit if time has passed or if denied/cancelled/completed
      return !this.isAppointmentTimePassed(appointment) &&
             appointment.status !== 'cancelled' &&
             appointment.status !== 'completed' &&
             appointment.status !== 'denied';
    }
    return false;
  }

  // Open create modal
  openCreateModal() {
    if (!this.user) return;
    
    this.modalMode = 'create';
    this.editingAppointment = null;
    this.formData = {
      patientName: this.user.role === 'patient' ? this.user.name : '',
      doctor: '',
      date: '',
      time: '',
      type: '',
      status: 'pending_approval', // New appointments need approval
      phone: '',
      email: ''
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

  // Open edit modal
  openEditModal(appointment: Appointment) {
    if (!this.user) return;
    
    // Check if user can edit
    if (this.user.role === 'patient' && !this.canEditAppointment(appointment)) {
      if (this.isAppointmentTimePassed(appointment)) {
        alert('You cannot edit appointments that have already passed.');
      } else {
        alert('You cannot edit this appointment.');
      }
      return;
    }

    if (!this.user) return;
    
    this.modalMode = 'edit';
    this.editingAppointment = appointment;
    this.formData = {
      patientName: this.user.role === 'patient' ? this.user.name : appointment.patientName,
      doctor: appointment.doctor,
      date: appointment.date,
      time: this.convertTo24Hour(appointment.time),
      type: appointment.type,
      status: appointment.status,
      phone: appointment.phone,
      email: appointment.email
    };
    this.showModal = true;
  }

  // Close modal
  closeModal() {
    this.showModal = false;
    this.showCancelModal = false;
    this.showMessageModal = false;
    this.editingAppointment = null;
    this.cancellingAppointment = null;
    this.viewingMessageAppointment = null;
    this.cancellationForm.message = '';
  }

  // Open cancel modal
  openCancelModal(appointment: Appointment) {
    if (!this.user) return;
    
    if (!this.canCancelAppointment(appointment)) {
      if (this.user.role === 'doctor' && this.isAppointmentToday(appointment)) {
        alert('You cannot cancel appointments on the same day.');
      } else if (this.user.role === 'patient' && this.isAppointmentTimePassed(appointment)) {
        alert('You cannot cancel appointments that have already passed.');
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
    this.appointmentService.updateAppointment(appointment.id, { status: 'accepted' });
  }

  // Deny appointment (Admin only)
  denyAppointment(appointment: Appointment) {
    if (confirm(`Are you sure you want to deny the appointment for ${appointment.patientName}?`)) {
      this.appointmentService.updateAppointment(appointment.id, { status: 'denied' });
    }
  }

  // Save appointment (create or update)
  saveAppointment() {
    // Convert time to 12-hour format for display
    const displayTime = this.convertTo12Hour(this.formData.time);

    if (this.modalMode === 'create') {
      // Generate initials from patient name
      const initials = this.formData.patientName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase();

      const newAppointment = {
        patientName: this.formData.patientName,
        patientInitials: initials,
        doctor: this.formData.doctor,
        date: this.formData.date,
        time: displayTime,
        type: this.formData.type,
        status: 'pending_approval' as const,
        phone: this.formData.phone,
        email: this.formData.email,
        amount: 150 // Default amount, can be made configurable
      };
      this.appointmentService.addAppointment(newAppointment);
    } else if (this.modalMode === 'edit' && this.editingAppointment) {
      // Update existing appointment (only for patients)
      if (!this.canEditAppointment(this.editingAppointment)) {
        alert('You cannot edit this appointment.');
        return;
      }

      if (!this.user) return;
      
      // For patients, ensure patient name is always their own name
      const patientName = this.user.role === 'patient' ? this.user.name : this.formData.patientName;
      const initials = patientName.split(' ').map(n => n[0]).join('').toUpperCase();

      this.appointmentService.updateAppointment(this.editingAppointment.id, {
        patientName: patientName,
        patientInitials: initials,
        doctor: this.formData.doctor,
        date: this.formData.date,
        time: displayTime,
        type: this.formData.type,
        status: 'pending_approval', // Changes need re-approval
        phone: this.formData.phone,
        email: this.formData.email
      });
    }
    this.closeModal();
  }

  // Cancel appointment with message
  confirmCancelAppointment() {
    if (!this.user) return;
    
    if (!this.cancellationForm.message.trim()) {
      alert('Please provide a reason for cancellation.');
      return;
    }

    if (this.cancellingAppointment) {
      this.appointmentService.updateAppointment(this.cancellingAppointment.id, {
        status: 'cancelled',
        cancellationMessage: this.cancellationForm.message,
        cancelledBy: this.user.role
      });
    }
    this.closeModal();
  }

  // Delete appointment (Admin only - permanent delete)
  deleteAppointment(appointment: Appointment) {
    if (confirm(`Are you sure you want to permanently delete the appointment for ${appointment.patientName}?`)) {
      this.appointmentService.deleteAppointment(appointment.id);
    }
  }
}

