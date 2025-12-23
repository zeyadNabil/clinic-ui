import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService, User } from '../../services/user.service';
import { PrescriptionService, Prescription } from '../../services/prescription.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-prescriptions',
  imports: [CommonModule],
  templateUrl: './prescriptions.html',
  styleUrl: './prescriptions.css',
})
export class Prescriptions implements OnInit, OnDestroy {
  user: User | null = null;
  prescriptions: Prescription[] = [];
  loading = false;
  private subscriptions = new Subscription();

  constructor(
    private userService: UserService,
    private prescriptionService: PrescriptionService
  ) {}

  ngOnInit() {
    // Initialize loading state
    this.loading = true;

    // Subscribe to user first
    const userSub = this.userService.currentUser$.subscribe(user => {
      this.user = user;
      
      if (user && user.role === 'PATIENT') {
        // Load prescriptions when user is available
        this.loadPrescriptions();
      } else {
        this.prescriptions = [];
        this.loading = false;
      }
    });
    this.subscriptions.add(userSub);

    // Subscribe to prescriptions - this ensures we get updates automatically
    const prescriptionsSub = this.prescriptionService.prescriptions.subscribe(prescriptions => {
      this.prescriptions = prescriptions || [];
      // Stop loading when we receive data (even if empty)
      this.loading = false;
    });
    this.subscriptions.add(prescriptionsSub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadPrescriptions(): void {
    this.loading = true;
    
    // Use subscribe instead of firstValueFrom for better error handling
    const sub = this.prescriptionService.loadPrescriptions().subscribe({
      next: (prescriptions) => {
        // Prescriptions are already updated via subscription, but ensure we have the data
        this.prescriptions = prescriptions || [];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading prescriptions:', error);
        // On error, set empty array and stop loading
        this.prescriptions = [];
        this.loading = false;
      }
    });
    this.subscriptions.add(sub);

    // Safety timeout - ensure loading stops after 5 seconds
    setTimeout(() => {
      if (this.loading) {
        console.warn('Loading timeout - setting loading to false');
        this.loading = false;
      }
    }, 5000);
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getMedicationsList(medications: string): string[] {
    if (!medications) return [];
    return medications.split(/[,\n]/)
      .map(m => m.trim())
      .filter(m => m.length > 0);
  }

  getDoctorDisplayName(doctorName?: string): string {
    if (!doctorName) return 'Unknown Doctor';
    // If name already starts with "Dr." or "Dr ", don't add it again
    const trimmedName = doctorName.trim();
    if (trimmedName.toLowerCase().startsWith('dr.')) {
      return trimmedName;
    }
    if (trimmedName.toLowerCase().startsWith('dr ')) {
      return trimmedName;
    }
    return `Dr. ${trimmedName}`;
  }

  deletePrescription(id: number): void {
    if (!confirm('Are you sure you want to delete this prescription? This action cannot be undone.')) {
      return;
    }

    const sub = this.prescriptionService.deletePrescription(id).subscribe({
      next: () => {
        // Prescription will be automatically removed via BehaviorSubject subscription
        alert('Prescription deleted successfully!');
      },
      error: (error) => {
        console.error('Error deleting prescription:', error);
        const errorMessage = error instanceof Error ? error.message : (error.error?.message || 'Failed to delete prescription');
        alert('Failed to delete prescription: ' + errorMessage);
      }
    });
    this.subscriptions.add(sub);
  }
}

