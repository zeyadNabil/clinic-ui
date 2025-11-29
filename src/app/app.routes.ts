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
  // Default route now goes to dashboard
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  // Wildcard route stays as a fallback
  { path: '**', redirectTo: '/dashboard' }
];
