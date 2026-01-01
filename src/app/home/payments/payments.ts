import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService, Payment, CardInfo } from '../../services/payment.service';
import { AppointmentService, Appointment } from '../../services/appointment.service';
import { UserService, User } from '../../services/user.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-payments',
  imports: [CommonModule, FormsModule],
  templateUrl: './payments.html',
  styleUrl: './payments.css'
})
export class PaymentsComponent implements OnInit, OnDestroy {
  user: User | null = null;
  payments: Payment[] = [];
  todayPayments: Payment[] = [];
  appointments: Appointment[] = [];
  cards: CardInfo[] = [];
  private subscriptions = new Subscription();

  // Admin/Doctor filters
  statusFilter = 'all';
  dateFilter = 'all';
  paymentMethodFilter: 'all' | 'CASH' | 'VISA' = 'all';
  searchTerm = '';

  // Admin stats
  adminStats = {
    total: 0,
    paid: 0,
    pending: 0,
    totalAmount: 0
  };

  // Doctor statistics
  doctorStats = {
    totalEarnings: 0,
    totalAppointments: 0,
    clinicTaxTotal: 0,
    netEarnings: 0,
    payments: [] as Payment[]
  };

  // User modal states
  showCardModal = false;
  showPaymentModal = false;
  selectedAppointment: Appointment | null = null;

  // Card form
  cardForm = {
    cardNumber: '',
    cardHolder: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    isDefault: false
  };

  // Payment form
  paymentForm = {
    cardId: 0,
    useNewCard: false,
    newCard: {
      cardNumber: '',
      cardHolder: '',
      expiryMonth: '',
      expiryYear: '',
      cvv: ''
    }
  };

  constructor(
    private paymentService: PaymentService,
    private appointmentService: AppointmentService,
    private userService: UserService
  ) {}

  ngOnInit() {
    // Subscribe to user
    const userSub = this.userService.currentUser$.subscribe(user => {
      this.user = user;
      if (user) {
        // Load payments when user is available
        const loadSub = this.paymentService.loadPayments().subscribe({
          next: (payments) => {
          },
          error: (err) => {
            console.error('Failed to load payments:', err);
          }
        });
        this.subscriptions.add(loadSub);
        // Also load appointments if needed
        if (user.role === 'PATIENT') {
          this.appointmentService.loadAppointments().subscribe();
        }
      }
      this.updateData();
    });
    this.subscriptions.add(userSub);

    // Subscribe to payments
    const paymentsSub = this.paymentService.payments$.subscribe(payments => {
      this.payments = payments;
      this.updateData();
    });
    this.subscriptions.add(paymentsSub);

    // Subscribe to appointments
    const appointmentsSub = this.appointmentService.appointments$.subscribe(appointments => {
      this.appointments = appointments;
      this.updateData();
    });
    this.subscriptions.add(appointmentsSub);

    // Subscribe to cards
    const cardsSub = this.paymentService.cards$.subscribe(cards => {
      this.cards = cards;
    });
    this.subscriptions.add(cardsSub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  updateData() {
    if (!this.user) return;

    if (this.user.role === 'ADMIN') {
      // Admin sees all payments, but filter to show cash payments that need approval
      this.updateTodayPayments();
      this.updateAdminStats();
    } else if (this.user.role === 'DOCTOR') {
      this.updateDoctorStats();
    } else if (this.user.role === 'PATIENT') {
      // Patient sees their pending Visa payments
      this.updatePatientAppointments();
    }
  }

  // Admin methods
  updateTodayPayments() {
    // Show ALL payments (both CASH and VISA) - admin sees everything
    this.todayPayments = this.payments;
  }

  updateAdminStats() {
    this.adminStats.total = this.payments.length;
    this.adminStats.paid = this.payments.filter(p => p.status === 'paid').length;
    this.adminStats.pending = this.payments.filter(p => p.status === 'pending').length;
    this.adminStats.totalAmount = this.payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);
  }

  get filteredAdminPayments() {
    let filtered = [...this.todayPayments];

    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === this.statusFilter);
    }

    if (this.paymentMethodFilter !== 'all') {
      filtered = filtered.filter(p => p.paymentMethod === this.paymentMethodFilter);
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.patientName.toLowerCase().includes(term) ||
        p.doctor.toLowerCase().includes(term) ||
        p.amount.toString().includes(term) ||
        p.paymentMethod.toLowerCase().includes(term)
      );
    }

    return filtered;
  }

  markAsPaid(payment: Payment) {
    if (confirm(`Approve cash payment of ${this.formatCurrency(payment.amount)} for ${payment.patientName}?`)) {
      const sub = this.paymentService.markPaymentAsPaid(payment.id).subscribe({
        next: (updatedPayment) => {
          alert('Payment approved successfully!');
          // Reload payments to get latest data
          this.paymentService.loadPayments().subscribe({
            error: (err) => console.error('Failed to reload payments:', err)
          });
        },
        error: (error) => {
          alert('Failed to approve payment: ' + (error.message || 'Unknown error'));
          console.error('Approve payment error:', error);
        }
      });
      this.subscriptions.add(sub);
    }
  }

  denyPayment(payment: Payment) {
    if (confirm(`Deny cash payment of ${this.formatCurrency(payment.amount)} for ${payment.patientName}? This will mark the payment as failed.`)) {
      const sub = this.paymentService.denyPayment(payment.id).subscribe({
        next: (updatedPayment) => {
          alert('Payment denied successfully!');
          // Reload payments to get latest data
          this.paymentService.loadPayments().subscribe({
            error: (err) => console.error('Failed to reload payments:', err)
          });
        },
        error: (error) => {
          alert('Failed to deny payment: ' + (error.message || 'Unknown error'));
          console.error('Deny payment error:', error);
        }
      });
      this.subscriptions.add(sub);
    }
  }

  // Doctor methods
  updateDoctorStats() {
    if (this.user?.doctorName) {
      // Ensure payments are loaded for doctors
      if (this.payments.length === 0 && this.user.role === 'DOCTOR') {
        this.paymentService.loadPayments().subscribe({
          error: (err) => console.error('Failed to load doctor payments:', err)
        });
      }
      this.doctorStats = this.paymentService.getDoctorStatistics(this.user.doctorName);
    }
  }

  get filteredDoctorPayments() {
    let filtered = [...this.doctorStats.payments];

    if (this.dateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      filtered = filtered.filter(payment => {
        const paymentDate = new Date(payment.date);
        paymentDate.setHours(0, 0, 0, 0);

        if (this.dateFilter === 'today') {
          return paymentDate.getTime() === today.getTime();
        } else if (this.dateFilter === 'week') {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return paymentDate >= weekAgo && paymentDate <= today;
        } else if (this.dateFilter === 'month') {
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return paymentDate >= monthAgo && paymentDate <= today;
        } else if (this.dateFilter === 'year') {
          const yearAgo = new Date(today);
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          return paymentDate >= yearAgo && paymentDate <= today;
        }
        return true;
      });
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.patientName.toLowerCase().includes(term) ||
        p.date.includes(term) ||
        p.amount.toString().includes(term)
      );
    }

    return filtered;
  }

  // Patient methods
  updatePatientAppointments() {
    if (this.user) {
      // Show appointments with pending Visa payments
      this.appointments = this.appointments.filter(apt =>
        apt.patientName === this.user!.name
      );
    }
  }

  openCardModal() {
    this.cardForm = {
      cardNumber: '',
      cardHolder: '',
      expiryMonth: '',
      expiryYear: '',
      cvv: '',
      isDefault: false
    };
    this.showCardModal = true;
  }

  closeCardModal() {
    this.showCardModal = false;
    this.cardForm = {
      cardNumber: '',
      cardHolder: '',
      expiryMonth: '',
      expiryYear: '',
      cvv: '',
      isDefault: false
    };
  }

  saveCard() {
    if (!this.validateCardForm()) {
      alert('Please fill in all card details correctly.');
      return;
    }

    this.paymentService.addCard(this.cardForm);
    this.closeCardModal();
    alert('Card added successfully!');
  }

  validateCardForm(): boolean {
    return !!(
      this.cardForm.cardNumber &&
      this.cardForm.cardNumber.length >= 13 &&
      this.cardForm.cardHolder &&
      this.cardForm.expiryMonth &&
      this.cardForm.expiryYear &&
      this.cardForm.cvv &&
      this.cardForm.cvv.length >= 3
    );
  }

  openPaymentModal(appointment: Appointment) {
    this.selectedAppointment = appointment;
    this.paymentForm = {
      cardId: this.cards.find(c => c.isDefault)?.id || 0,
      useNewCard: false,
      newCard: {
        cardNumber: '',
        cardHolder: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: ''
      }
    };
    this.showPaymentModal = true;
  }

  closePaymentModal() {
    this.showPaymentModal = false;
    this.selectedAppointment = null;
  }

  processPayment() {
    if (!this.selectedAppointment) return;

    let cardToUse: CardInfo | null = null;

    if (this.paymentForm.useNewCard) {
      if (!this.validateNewCard()) {
        alert('Please fill in all card details correctly.');
        return;
      }

      const last4 = this.paymentForm.newCard.cardNumber.slice(-4);
      cardToUse = {
        id: 0,
        cardNumber: this.paymentForm.newCard.cardNumber,
        cardHolder: this.paymentForm.newCard.cardHolder,
        expiryMonth: this.paymentForm.newCard.expiryMonth,
        expiryYear: this.paymentForm.newCard.expiryYear,
        cvv: this.paymentForm.newCard.cvv,
        last4,
        isDefault: false
      };

      const savedCard = this.paymentService.addCard({
        cardNumber: cardToUse.cardNumber,
        cardHolder: cardToUse.cardHolder,
        expiryMonth: cardToUse.expiryMonth,
        expiryYear: cardToUse.expiryYear,
        cvv: cardToUse.cvv,
        isDefault: false
      });
      cardToUse = savedCard;
    } else {
      cardToUse = this.cards.find(c => c.id === this.paymentForm.cardId) || null;
      if (!cardToUse) {
        alert('Please select a card.');
        return;
      }
    }

    const sub = this.paymentService.createPayment(
      this.selectedAppointment.id,
      cardToUse
    ).subscribe({
      next: (payment) => {
        alert(`Payment of ${this.formatCurrency(this.selectedAppointment!.amount!)} processed successfully!`);
        this.closePaymentModal();
        // Reload payments to get latest data
        this.paymentService.loadPayments().subscribe({
          error: (err) => console.error('Failed to reload payments:', err)
        });
        // Also reload appointments to update payment status
        this.appointmentService.loadAppointments().subscribe({
          error: (err) => console.error('Failed to reload appointments:', err)
        });
      },
      error: (error) => {
        alert('Payment failed: ' + (error.message || 'Unknown error'));
        console.error('Process payment error:', error);
      }
    });
    this.subscriptions.add(sub);
  }

  validateNewCard(): boolean {
    const card = this.paymentForm.newCard;
    return !!(
      card.cardNumber &&
      card.cardNumber.length >= 13 &&
      card.cardHolder &&
      card.expiryMonth &&
      card.expiryYear &&
      card.cvv &&
      card.cvv.length >= 3
    );
  }

  deleteCard(cardId: number) {
    if (confirm('Are you sure you want to delete this card?')) {
      this.paymentService.deleteCard(cardId);
    }
  }

  setDefaultCard(cardId: number) {
    this.paymentService.setDefaultCard(cardId);
  }

  maskCardNumber(cardNumber: string): string {
    if (cardNumber.length <= 4) return cardNumber;
    return '**** **** **** ' + cardNumber.slice(-4);
  }

  getYears(): number[] {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let i = 0; i < 10; i++) {
      years.push(currentYear + i);
    }
    return years;
  }

  // Utility methods
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'paid': 'bg-success',
      'pending': 'bg-warning',
      'failed': 'bg-danger'
    };
    return statusMap[status] || 'bg-secondary';
  }

  getStatusText(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  getPercentage(value: number, total: number): number {
    if (total === 0) return 0;
    return (value / total) * 100;
  }
}
