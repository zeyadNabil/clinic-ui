// src/app/authentication/login/login.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
  host: {
    'style': 'display: block; position: fixed; inset: 0; width: 100vw; height: 100vh; height: 100dvh; overflow: hidden;'
  }
})
export class Login implements OnInit, OnDestroy {
  form: FormGroup;
  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder, 
    private router: Router,
    private authService: AuthService,
    private userService: UserService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit() {
    // Prevent body scroll when login page is active
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }

  ngOnDestroy() {
    // Restore body scroll when leaving login page
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    
    this.loading = true;
    this.errorMessage = '';

    const credentials = {
      email: this.form.value.email,
      password: this.form.value.password
    };

    this.authService.login(credentials).subscribe({
      next: (response) => {
        this.loading = false;
        // User info is already stored in auth service
        // Update user service with the response - prioritize username field from response
        console.log('Login response received in component:', response);
        // Prioritize username field (which is the actual username), then name
        const userName = response.username || response.name || 'User';
        console.log('Using username/name:', userName, 'username field:', response.username, 'name field:', response.name);
        if (response.email && response.role) {
          const userData = {
            name: userName, // Use username from response first, then name, never email
            email: response.email,
            role: response.role.toUpperCase() as 'ADMIN' | 'DOCTOR' | 'PATIENT',
            doctorName: response.role === 'DOCTOR' ? userName : undefined
          };
          console.log('Setting current user with name (not email):', userData);
          this.userService.setCurrentUser(userData);
        }
        // Navigate to dashboard
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.message || 'Login failed. Please check your credentials.';
        console.error('Login error:', error);
      }
    });
  }

  hasError(field: string): boolean {
    const control = this.form.get(field);
    return !!(control && control.invalid && control.touched);
  }
}