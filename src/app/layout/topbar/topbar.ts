import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserService } from '../../services/user.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-topbar',
  imports: [CommonModule, RouterModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css',
})
export class Topbar implements OnInit, OnDestroy {
  userProfile = {
    name: '',
    role: '',
    avatar: ''
  };

  notificationCount: number = 5;
  private subscriptions = new Subscription();

  notifications = [
    {
      title: 'New appointment booked',
      time: '5 minutes ago',
      type: 'success',
      icon: 'fas fa-calendar-check'
    },
    {
      title: 'Payment received from John Doe',
      time: '1 hour ago',
      type: 'info',
      icon: 'fas fa-dollar-sign'
    },
    {
      title: 'New message from Patient',
      time: '2 hours ago',
      type: 'warning',
      icon: 'fas fa-envelope'
    },
    {
      title: 'Prescription results are ready',
      time: '3 hours ago',
      type: 'info',
      icon: 'fa-solid fa-file'
    },
    {
      title: 'Appointment cancelled by patient',
      time: '5 hours ago',
      type: 'error',
      icon: 'fas fa-calendar-times'
    }
  ];

  constructor(private userService: UserService) {}

  ngOnInit() {
    // Subscribe to user changes
    const userSub = this.userService.currentUser$.subscribe(user => {
      this.userProfile.name = this.userService.getDisplayName();
      this.userProfile.role = this.userService.getRoleDisplayText();
    });
    this.subscriptions.add(userSub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  // Switch user role (for testing)
  switchRole(role: 'admin' | 'doctor' | 'patient') {
    this.userService.setUserRole(role);
  }
}
