import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
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
  private authService = inject(AuthService);
  private subscriptions = new Subscription();

  userName: string = '';
  userRole: string = '';

  navItems: Array<{ label: string; route: string; icon: string; roles?: string[] }> = [
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
      icon: 'fas fa-users',
      roles: ['ADMIN', 'DOCTOR']
    },
    {
      label: 'My Prescriptions',
      route: '/prescriptions',
      icon: 'fas fa-file-medical',
      roles: ['PATIENT']
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

  get filteredNavItems() {
    return this.navItems.filter(item => {
      if (!item.roles || item.roles.length === 0) return true; // Show item for all roles if no roles specified
      // Normalize both userRole and item roles to uppercase for comparison
      const normalizedUserRole = this.userRole.toUpperCase();
      return item.roles.some(role => role.toUpperCase() === normalizedUserRole);
    });
  }

  ngOnInit() {
    // Subscribe to user changes
    const userSub = this.userService.currentUser$.subscribe(user => {
      this.userName = this.userService.getDisplayName();
      // Normalize role to uppercase to ensure matching
      this.userRole = (user?.role || '').toUpperCase();
    });
    this.subscriptions.add(userSub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  logout() {
    // Clear authentication token and all localStorage
    this.authService.logout();
    localStorage.clear();
    
    // Navigate to login page
    this.router.navigate(['/auth/login']);
  }
}
