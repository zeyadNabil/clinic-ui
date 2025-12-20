import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, User } from '../../services/user.service';
import { Subscription } from 'rxjs';

interface Patient {
  id: number;
  patientName: string;
  patientInitials: string;
  phone: string;
  email: string;
  age: number;
  gender: 'Male' | 'Female';
  registeredDate: string;
}

@Component({
  selector: 'app-patient-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './patient-list.html',
  styleUrl: './patient-list.css',
})
export class PatientListComponent implements OnInit, OnDestroy {
  user: User | null = null;

  patients: Patient[] = [];
  filteredPatients: Patient[] = [];

  stats = {
    total: 0,
    active: 0,
    newThisMonth: 0
  };

  searchTerm = '';
  showModal = false;
  modalMode: 'create' | 'edit' = 'create';
  editingPatient: Patient | null = null;

  formData = {
    patientName: '',
    phone: '',
    email: '',
    age: 0,
    gender: '' as 'Male' | 'Female'
  };

  private subscriptions = new Subscription();

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.subscriptions.add(
      this.userService.currentUser$.subscribe(user => {
        this.user = user;
      })
    );

    this.loadPatients();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  // Load patients from localStorage, or use sample data if none saved
  private loadPatients() {
    const saved = localStorage.getItem('clinic-patients');
    if (saved) {
      this.patients = JSON.parse(saved);
    } else {
      // Only use sample data the first time
      this.patients = [
        {
          id: 1,
          patientName: 'John Doe',
          patientInitials: 'JD',
          phone: '+1 234-567-8900',
          email: 'john.doe@email.com',
          age: 34,
          gender: 'Male',
          registeredDate: '2024-12-15'
        },
        {
          id: 2,
          patientName: 'Sarah Miller',
          patientInitials: 'SM',
          phone: '+1 234-567-8901',
          email: 'sarah.miller@email.com',
          age: 28,
          gender: 'Female',
          registeredDate: '2024-12-16'
        },
        {
          id: 3,
          patientName: 'Robert Johnson',
          patientInitials: 'RJ',
          phone: '+1 234-567-8902',
          email: 'robert.johnson@email.com',
          age: 45,
          gender: 'Male',
          registeredDate: '2024-12-17'
        },
        {
          id: 4,
          patientName: 'Emily Davis',
          patientInitials: 'ED',
          phone: '+1 234-567-8903',
          email: 'emily.davis@email.com',
          age: 31,
          gender: 'Female',
          registeredDate: '2024-12-18'
        },
        {
          id: 5,
          patientName: 'Michael Wilson',
          patientInitials: 'MW',
          phone: '+1 234-567-8904',
          email: 'michael.wilson@email.com',
          age: 52,
          gender: 'Male',
          registeredDate: '2024-12-19'
        },
        {
          id: 6,
          patientName: 'Lisa Anderson',
          patientInitials: 'LA',
          phone: '+1 234-567-8905',
          email: 'lisa.anderson@email.com',
          age: 29,
          gender: 'Female',
          registeredDate: '2024-12-20'
        }
      ];
      this.savePatients(); // Save sample data first time
    }

    this.filteredPatients = this.patients;
    this.updateStats();
  }

  // Save to localStorage after any change
  private savePatients() {
    localStorage.setItem('clinic-patients', JSON.stringify(this.patients));
  }

  get isAdmin(): boolean {
    return this.user?.role === 'admin';
  }

  openCreateModal() {
    if (!this.isAdmin) return;
    this.modalMode = 'create';
    this.editingPatient = null;
    this.formData = {
      patientName: '',
      phone: '',
      email: '',
      age: 0,
      gender: '' as any
    };
    this.showModal = true;
  }

  openEditModal(patient: Patient) {
    if (!this.isAdmin) return;
    this.modalMode = 'edit';
    this.editingPatient = patient;
    this.formData = {
      patientName: patient.patientName,
      phone: patient.phone,
      email: patient.email,
      age: patient.age,
      gender: patient.gender
    };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  savePatient() {
    if (!this.formData.patientName.trim() || !this.formData.phone.trim() || this.formData.age <= 0 || !this.formData.gender) {
      alert('Please fill all required fields');
      return;
    }

    const initials = this.formData.patientName.trim().split(' ').map(n => n[0]).join('').toUpperCase();

    if (this.modalMode === 'create') {
      const newPatient: Patient = {
        id: this.patients.length ? Math.max(...this.patients.map(p => p.id)) + 1 : 1,
        patientName: this.formData.patientName.trim(),
        patientInitials: initials,
        phone: this.formData.phone,
        email: this.formData.email || '',
        age: this.formData.age,
        gender: this.formData.gender,
        registeredDate: new Date().toISOString().split('T')[0]
      };
      this.patients = [...this.patients, newPatient];
    } else if (this.modalMode === 'edit' && this.editingPatient) {
      this.patients = this.patients.map(p =>
        p.id === this.editingPatient!.id
          ? {
              ...p,
              patientName: this.formData.patientName.trim(),
              patientInitials: initials,
              phone: this.formData.phone,
              email: this.formData.email || '',
              age: this.formData.age,
              gender: this.formData.gender
            }
          : p
      );
    }

    this.savePatients(); // ← This saves your new patient permanently
    this.filteredPatients = this.patients;
    this.updateStats();
    this.closeModal();
  }

  deletePatient(patient: Patient) {
    if (!this.isAdmin) return;
    if (confirm(`Delete ${patient.patientName}?`)) {
      this.patients = this.patients.filter(p => p.id !== patient.id);
      this.savePatients(); // ← Save after delete
      this.filteredPatients = this.patients;
      this.updateStats();
    }
  }

  applyFilters() {
    let list = [...this.patients];
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      list = list.filter(p =>
        p.patientName.toLowerCase().includes(term) ||
        p.phone.includes(term) ||
        p.email.toLowerCase().includes(term)
      );
    }
    this.filteredPatients = list;
  }

  updateStats() {
    this.stats.total = this.patients.length;
    this.stats.active = this.patients.length;
    const now = new Date();
    this.stats.newThisMonth = this.patients.filter(p => {
      const regDate = new Date(p.registeredDate);
      return regDate.getMonth() === now.getMonth() && regDate.getFullYear() === now.getFullYear();
    }).length;
  }

  viewPatientDetails(patient: Patient) {
    alert(`Name: ${patient.patientName}\nAge: ${patient.age}\nGender: ${patient.gender}\nPhone: ${patient.phone}`);
  }
}