import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
  host: {
    'style': 'display: block; position: fixed; inset: 0; width: 100vw; height: 100vh; height: 100dvh; overflow: hidden;'
  }
})
export class Register implements OnInit, OnDestroy {
  form: FormGroup;
  loading = false;
  passwordMismatch = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {
    this.form = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    });

    this.form.get('confirmPassword')?.valueChanges.subscribe(() => {
      this.passwordMismatch =
        this.form.get('password')?.value !== this.form.get('confirmPassword')?.value;
    });
  }

  ngOnInit() {
    // Prevent body scroll when register page is active
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }

  ngOnDestroy() {
    // Restore body scroll when leaving register page
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  onSubmit() {
    if (this.form.invalid || this.passwordMismatch) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const userData = {
      username: this.form.value.username,
      email: this.form.value.email,
      password: this.form.value.password
    };

    this.authService.register(userData).subscribe({
      next: (response) => {
        this.loading = false;
        this.successMessage = 'Account created successfully! Welcome to CLINIC';
        this.form.reset();
        // Navigate to login page after successful registration
        setTimeout(() => {
          this.router.navigate(['/auth/login']);
        }, 2000);
      },
      error: (error) => {
        this.loading = false;
        const errorMsg = error.message || 'Registration failed. Please try again.';
        this.errorMessage = errorMsg;

        // If email already exists, suggest logging in
        if (errorMsg.toLowerCase().includes('already registered') || errorMsg.toLowerCase().includes('email already')) {
          this.errorMessage = errorMsg + ' You can try logging in instead.';
        }

        console.error('Registration error:', error);
      }
    });
  }

  hasError(field: string): boolean {
    const control = this.form.get(field);
    return !!(control && control.invalid && control.touched);
  }
}
