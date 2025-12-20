import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, User } from '../../services/user.service';
import { Subscription } from 'rxjs';

interface Message {
  id: number;
  title: string;
  message: string;
  timeAgo: string;
  type: 'appointment' | 'payment' | 'message' | 'prescription' | 'cancel';
  read: boolean;
  sentDate: string;
}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './message.html',
  styleUrl: './message.css'
})
export class MessagesComponent implements OnInit, OnDestroy {
  user: User | null = null;
  allMessages: Message[] = [];
  displayedMessages: Message[] = [];

  // Stats for the cards
  stats = {
    total: 0,
    today: 0,
    unread: 0,
    read: 0
  };

  showSendModal = false;
  showReplyModal = false;
  replyingTo: Message | null = null;

  sendForm = {
    title: '',
    message: '',
    type: 'message' as 'appointment' | 'payment' | 'message' | 'prescription' | 'cancel'
  };

  private subscriptions = new Subscription();

  private sampleMessages: Message[] = [
    {
      id: 1,
      title: 'New appointment booked',
      message: 'John Doe booked a checkup with Dr. Smith',
      timeAgo: '5 minutes ago',
      type: 'appointment',
      read: false,
      sentDate: '2024-12-20'
    },
    {
      id: 2,
      title: 'Payment received',
      message: 'Payment received from John Doe - $150.00',
      timeAgo: '1 hour ago',
      type: 'payment',
      read: false,
      sentDate: '2024-12-20'
    },
    {
      id: 3,
      title: 'New message from patient',
      message: 'Sarah Miller sent you a message',
      timeAgo: '2 hours ago',
      type: 'message',
      read: false,
      sentDate: '2024-12-20'
    },
    {
      id: 4,
      title: 'Prescription ready',
      message: 'Prescription results are ready for Emily Davis',
      timeAgo: '3 hours ago',
      type: 'prescription',
      read: false,
      sentDate: '2024-12-20'
    },
    {
      id: 5,
      title: 'Appointment cancelled',
      message: 'Michael Wilson cancelled their appointment',
      timeAgo: '5 hours ago',
      type: 'cancel',
      read: true,
      sentDate: '2024-12-20'
    }
  ];

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.subscriptions.add(
      this.userService.currentUser$.subscribe(user => {
        this.user = user;
        this.filterMessagesByRole();
      })
    );

    this.loadMessages();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private loadMessages() {
    const saved = localStorage.getItem('clinic-messages');
    if (saved) {
      this.allMessages = JSON.parse(saved);
    } else {
      this.allMessages = this.sampleMessages;
      this.saveMessages();
    }
    this.updateStats();
    this.filterMessagesByRole();
  }

  private saveMessages() {
    localStorage.setItem('clinic-messages', JSON.stringify(this.allMessages));
  }

  
  updateStats() {
    const today = new Date().toISOString().split('T')[0];
    this.stats.total = this.allMessages.length;
    this.stats.today = this.allMessages.filter(m => m.sentDate === today).length;
    this.stats.unread = this.allMessages.filter(m => !m.read).length;
    this.stats.read = this.allMessages.filter(m => m.read).length;
  }

  filterMessagesByRole() {
    if (!this.user) {
      this.displayedMessages = [];
      return;
    }

    let filtered = [...this.allMessages];

    if (this.user.role === 'doctor') {
      filtered = filtered.filter(m =>
        m.type === 'appointment' ||
        m.type === 'cancel' ||
        m.type === 'message' ||
        m.message.toLowerCase().includes(this.user?.doctorName?.toLowerCase() || '')
      );
    } else if (this.user.role === 'patient') {
      filtered = filtered.filter(m =>
        m.message.toLowerCase().includes(this.user?.name?.toLowerCase() || '')
      );
    }

    this.displayedMessages = filtered;
  }

  getIconClass(type: string): string {
    switch (type) {
      case 'appointment': return 'fas fa-calendar-check text-success';
      case 'payment': return 'fas fa-dollar-sign text-primary';
      case 'message': return 'fas fa-comment-alt text-warning';
      case 'prescription': return 'fas fa-file-medical text-info';
      case 'cancel': return 'fas fa-times-circle text-danger';
      default: return 'fas fa-bell text-secondary';
    }
  }

  markAsRead(id: number) {
    this.allMessages = this.allMessages.map(m =>
      m.id === id ? { ...m, read: true } : m
    );
    this.saveMessages();
    this.updateStats();
    this.filterMessagesByRole();
  }

  deleteMessage(id: number) {
    if (this.user?.role !== 'admin') return;
    if (confirm('Delete this message permanently?')) {
      this.allMessages = this.allMessages.filter(m => m.id !== id);
      this.saveMessages();
      this.updateStats();
      this.filterMessagesByRole();
    }
  }

  openSendModal() {
    if (this.user?.role !== 'admin') return;
    this.sendForm = { title: '', message: '', type: 'message' };
    this.showSendModal = true;
  }

  openReplyModal(message: Message) {
    if (this.user?.role !== 'admin') return;
    this.replyingTo = message;
    this.sendForm = {
      title: `Re: ${message.title}`,
      message: '',
      type: message.type
    };
    this.showSendModal = true;
  }

  closeSendModal() {
    this.showSendModal = false;
    this.replyingTo = null;
  }

  sendMessage() {
    if (!this.sendForm.title.trim() || !this.sendForm.message.trim()) {
      alert('Please fill title and message');
      return;
    }

    const newMessage: Message = {
      id: this.allMessages.length ? Math.max(...this.allMessages.map(m => m.id)) + 1 : 1,
      title: this.sendForm.title.trim(),
      message: this.sendForm.message.trim(),
      timeAgo: 'Just now',
      type: this.sendForm.type,
      read: false,
      sentDate: new Date().toISOString().split('T')[0]
    };

    this.allMessages = [newMessage, ...this.allMessages];
    this.saveMessages();
    this.updateStats();
    this.filterMessagesByRole();
    this.closeSendModal();
  }
}