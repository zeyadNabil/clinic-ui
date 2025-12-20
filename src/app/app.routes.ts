import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./authentication/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./home/dashboard/dashboard').then(c => c.Dashboard)
  },
  {
    path: 'appointments',
    loadComponent: () => import('./home/appointments/appointments').then(c => c.Appointments)
  },
  {
    path: 'payments',
    loadComponent: () => import('./home/payments/payments').then(c => c.PaymentsComponent)
  },
  {
    path: 'patient-list',
    loadComponent: () => import('./home/patient-list/patient-list').then(c => c.PatientListComponent)
  },
  {
    path: 'message',  
    loadComponent: () => import('./home/message/message').then(c => c.MessagesComponent)
  },
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/auth/login' }               
];
