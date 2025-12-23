import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DoctorService, Doctor } from '../../services/doctor.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-doctors',
  imports: [CommonModule, FormsModule],
  templateUrl: './doctors.html',
  styleUrl: './doctors.css',
})
export class Doctors implements OnInit, OnDestroy {
  doctors: Doctor[] = [];
  loading = false;
  showModal = false;
  showEditModal = false;
  modalMode: 'create' | 'edit' = 'create';
  editingDoctor: Doctor | null = null;
  private subscriptions = new Subscription();

  formData = {
    name: '',
    email: '',
    specialty: '',
    password: ''
  };

  constructor(
    private doctorService: DoctorService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Subscribe to doctors observable for automatic updates
    const doctorsSub = this.doctorService.doctors$.subscribe(doctors => {
      this.doctors = doctors;
      this.cdr.detectChanges();
    });
    this.subscriptions.add(doctorsSub);

    // Wait a bit to ensure auth service is initialized
    // Then load doctors
    setTimeout(() => {
      this.loadDoctors();
    }, 100);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  async loadDoctors() {
    this.loading = true;
    
    try {
      // Try async version first (waits for auth)
      const doctors = await this.doctorService.getAllDoctorsAsync();
      this.doctors = doctors || [];
      this.loading = false;
      this.cdr.detectChanges();
    } catch (error: any) {
      console.error('Failed to load doctors (async):', error);
      // Fallback to Observable version
      const sub = this.doctorService.getAllDoctors().subscribe({
        next: (doctors) => {
          this.doctors = doctors || [];
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load doctors:', err);
          this.doctors = [];
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
      this.subscriptions.add(sub);
    }
  }

  openCreateModal() {
    this.modalMode = 'create';
    this.formData = {
      name: '',
      email: '',
      specialty: '',
      password: ''
    };
    this.showModal = true;
  }

  openEditModal(doctor: Doctor) {
    this.modalMode = 'edit';
    this.editingDoctor = doctor;
    this.formData = {
      name: doctor.name,
      email: doctor.email,
      specialty: doctor.specialty,
      password: '' // Don't pre-fill password
    };
    this.showEditModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.showEditModal = false;
    this.editingDoctor = null;
    this.formData = {
      name: '',
      email: '',
      specialty: '',
      password: ''
    };
  }

  saveDoctor() {
    if (!this.formData.name || !this.formData.email || !this.formData.specialty) {
      alert('Please fill in all required fields (Name, Email, Specialty)');
      return;
    }

    if (this.modalMode === 'create' && !this.formData.password) {
      alert('Password is required for new doctors');
      return;
    }

    if (this.modalMode === 'create') {
      const sub = this.doctorService.createDoctor({
        name: this.formData.name,
        email: this.formData.email,
        specialty: this.formData.specialty,
        password: this.formData.password
      }).subscribe({
        next: () => {
          alert('Doctor created successfully!');
          this.closeModal();
          // Service will update BehaviorSubject automatically, but reload to ensure sync
          this.loadDoctors();
        },
        error: (error) => {
          alert('Failed to create doctor: ' + (error.message || 'Unknown error'));
          console.error('Create doctor error:', error);
        }
      });
      this.subscriptions.add(sub);
    } else if (this.modalMode === 'edit' && this.editingDoctor) {
      const updateData: any = {
        name: this.formData.name,
        email: this.formData.email,
        specialty: this.formData.specialty
      };
      // Only include password if it was provided
      if (this.formData.password) {
        updateData.password = this.formData.password;
      }

      const sub = this.doctorService.updateDoctor(this.editingDoctor.id, updateData).subscribe({
        next: () => {
          alert('Doctor updated successfully!');
          this.closeModal();
          // Service will update BehaviorSubject automatically, but reload to ensure sync
          this.loadDoctors();
        },
        error: (error) => {
          alert('Failed to update doctor: ' + (error.message || 'Unknown error'));
          console.error('Update doctor error:', error);
        }
      });
      this.subscriptions.add(sub);
    }
  }

  deleteDoctor(doctor: Doctor) {
    if (confirm(`Are you sure you want to delete Dr. ${doctor.name}? This action cannot be undone.`)) {
      const sub = this.doctorService.deleteDoctor(doctor.id).subscribe({
        next: () => {
          alert('Doctor deleted successfully!');
          // Service will update BehaviorSubject automatically, but reload to ensure sync
          this.loadDoctors();
        },
        error: (error) => {
          alert('Failed to delete doctor: ' + (error.message || 'Unknown error'));
          console.error('Delete doctor error:', error);
        }
      });
      this.subscriptions.add(sub);
    }
  }
}

