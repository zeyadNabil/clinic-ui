import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { UserService } from '../../services/user.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit, OnDestroy {
  private router = inject(Router);
  private userService = inject(UserService);
  private subscriptions = new Subscription();

  userName: string = '';

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
      route: '/patient-list',
      icon: 'fas fa-users'
    },
    {
      label: 'Message',
      route: '/message',
      icon: 'fas fa-comment-alt'
    },
    {
      label: 'Payments',
      route: '/payments',
      icon: 'fas fa-dollar-sign'
    }
  ];

  ngOnInit() {
    // Subscribe to user changes
    const userSub = this.userService.currentUser$.subscribe(() => {
      this.userName = this.userService.getDisplayName();
    });
    this.subscriptions.add(userSub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  logout() {
    // Navigate to login page
    this.router.navigate(['/auth/login']);
  }
}
