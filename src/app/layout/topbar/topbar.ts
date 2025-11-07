import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-topbar',
  imports: [CommonModule, RouterModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css',
})
export class Topbar {
  userProfile = {
    name: 'Dr. Mark James',
    role: 'Dentist',
    avatar: ''
  };

  notificationCount: number = 5;

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
}
