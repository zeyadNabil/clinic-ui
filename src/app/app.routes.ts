import { Routes } from '@angular/router';
import { Dashboard } from './home/dashboard/dashboard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard' ,pathMatch:'full'},
  { path: 'dashboard', component: Dashboard },
  { path: 'auth',
    loadChildren:()=> import('./authentication/auth.routes').then(r=>r.AUTH_ROUTES)
  }
];
