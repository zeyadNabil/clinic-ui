import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./authentication/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./home/dashboard/dashboard').then(c => c.Dashboard),
    canActivate: [authGuard]
  },
  {
    path: 'appointments',
    loadComponent: () => import('./home/appointments/appointments').then(c => c.Appointments),
    canActivate: [authGuard]
  },
  {
    path: 'payments',
    loadComponent: () => import('./home/payments/payments').then(c => c.PaymentsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'doctors',
    loadComponent: () => import('./home/doctors/doctors').then(c => c.Doctors),
    canActivate: [authGuard]
  },
  {
    path: 'prescriptions',
    loadComponent: () => import('./home/prescriptions/prescriptions').then(c => c.Prescriptions),
    canActivate: [authGuard]
  },
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/auth/login' }
];
