import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-appointments',
  imports: [CommonModule, FormsModule],
  templateUrl: './appointments.html',
  styleUrl: './appointments.css',
})
export class Appointments {
  user = {
    role: 'doctor' // Can be 'admin', 'doctor', or 'patient'
  };

  // Stats
  stats = {
    total: 156,
    today: 12,
    pending: 8,
    completed: 148
  };

  // Filter and search
  searchTerm = '';
  statusFilter = 'all'; // 'all', 'pending', 'scheduled', 'completed', 'cancelled'
  dateFilter = 'all'; // 'all', 'today', 'week', 'month'

  // Appointments data
  appointments = [
    {
      id: 1,
      patientName: 'John Doe',
      patientInitials: 'JD',
      doctor: 'Dr. Smith',
      date: '2024-01-15',
      time: '09:00 AM',
      type: 'Checkup',
      status: 'completed',
      phone: '+1 234-567-8900',
      email: 'john.doe@email.com'
    },
    {
      id: 2,
      patientName: 'Sarah Miller',
      patientInitials: 'SM',
      doctor: 'Dr. Johnson',
      date: '2024-01-15',
      time: '10:30 AM',
      type: 'Consultation',
      status: 'pending',
      phone: '+1 234-567-8901',
      email: 'sarah.miller@email.com'
    },
    {
      id: 3,
      patientName: 'Robert Johnson',
      patientInitials: 'RJ',
      doctor: 'Dr. Williams',
      date: '2024-01-15',
      time: '02:00 PM',
      type: 'Treatment',
      status: 'scheduled',
      phone: '+1 234-567-8902',
      email: 'robert.johnson@email.com'
    },
    {
      id: 4,
      patientName: 'Emily Davis',
      patientInitials: 'ED',
      doctor: 'Dr. Brown',
      date: '2024-01-16',
      time: '11:00 AM',
      type: 'Follow-up',
      status: 'scheduled',
      phone: '+1 234-567-8903',
      email: 'emily.davis@email.com'
    },
    {
      id: 5,
      patientName: 'Michael Wilson',
      patientInitials: 'MW',
      doctor: 'Dr. Smith',
      date: '2024-01-16',
      time: '03:30 PM',
      type: 'Checkup',
      status: 'pending',
      phone: '+1 234-567-8904',
      email: 'michael.wilson@email.com'
    },
    {
      id: 6,
      patientName: 'Lisa Anderson',
      patientInitials: 'LA',
      doctor: 'Dr. Johnson',
      date: '2024-01-17',
      time: '09:30 AM',
      type: 'Consultation',
      status: 'scheduled',
      phone: '+1 234-567-8905',
      email: 'lisa.anderson@email.com'
    }
  ];

  // Modal state
  showModal = false;
  editingAppointment: any = null;
  modalMode = 'create'; // 'create' or 'edit'

  // Form data for modal
  formData = {
    patientName: '',
    doctor: '',
    date: '',
    time: '',
    type: '',
    status: 'scheduled',
    phone: '',
    email: ''
  };

  // Get filtered appointments
  get filteredAppointments() {
    let filtered = [...this.appointments];

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
      'pending': 'bg-warning',
      'scheduled': 'bg-info',
      'cancelled': 'bg-danger'
    };
    return statusMap[status] || 'bg-secondary';
  }

  // Get status display text
  getStatusText(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  // Open create modal
  openCreateModal() {
    this.modalMode = 'create';
    this.editingAppointment = null;
    this.formData = {
      patientName: '',
      doctor: '',
      date: '',
      time: '',
      type: '',
      status: 'scheduled',
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
  openEditModal(appointment: any) {
    this.modalMode = 'edit';
    this.editingAppointment = appointment;
    this.formData = {
      patientName: appointment.patientName,
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
    this.editingAppointment = null;
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
        id: this.appointments.length + 1,
        patientName: this.formData.patientName,
        patientInitials: initials,
        doctor: this.formData.doctor,
        date: this.formData.date,
        time: displayTime,
        type: this.formData.type,
        status: this.formData.status,
        phone: this.formData.phone,
        email: this.formData.email
      };
      this.appointments.push(newAppointment);
    } else if (this.modalMode === 'edit' && this.editingAppointment) {
      // Update existing appointment
      const index = this.appointments.findIndex(apt => apt.id === this.editingAppointment.id);
      if (index !== -1) {
        this.appointments[index] = {
          ...this.appointments[index],
          patientName: this.formData.patientName,
          doctor: this.formData.doctor,
          date: this.formData.date,
          time: displayTime,
          type: this.formData.type,
          status: this.formData.status,
          phone: this.formData.phone,
          email: this.formData.email
        };
      }
    }
    this.closeModal();
  }

  // Delete appointment
  deleteAppointment(appointment: any) {
    if (confirm(`Are you sure you want to delete the appointment for ${appointment.patientName}?`)) {
      const index = this.appointments.findIndex(apt => apt.id === appointment.id);
      if (index !== -1) {
        this.appointments.splice(index, 1);
      }
    }
  }
}

