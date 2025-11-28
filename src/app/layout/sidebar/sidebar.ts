import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  private router = inject(Router);

  navItems = [
    {
      label: 'Dashboard',
      route: '/dashboard',
      icon: 'fas fa-th-large'
    },
    {
      label: 'Appointments',
      route: '/appointments',
      icon: 'fas fa-calendar-alt'
    },
    {
      label: 'Patient List',
      route: '/patients',
      icon: 'fas fa-users'
    },
    {
      label: 'Message',
      route: '/messages',
      icon: 'fas fa-comment-alt'
    },
    {
      label: 'Payments',
      route: '/payments',
      icon: 'fas fa-dollar-sign'
    }
  ];

  logout() {
    // Navigate to login page
    this.router.navigate(['/auth/login']);
  }
}
