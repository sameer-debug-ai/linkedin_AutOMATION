import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="min-h-screen bg-surface flex items-center justify-center p-4">
      <div class="w-full max-w-md animate-slide-up">
        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-linkedin rounded-2xl mb-4 shadow-lg shadow-blue-900/30">
            <svg class="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-slate-100">LinkedIn Automation</h1>
          <p class="text-slate-500 text-sm mt-1">Lead generation platform</p>
        </div>

        <!-- Card -->
        <div class="card">
          <div class="flex gap-2 mb-6 bg-surface rounded-lg p-1">
            <button (click)="toggleMode('login')" [class]="mode() === 'login' ? 'flex-1 py-2 rounded-md bg-surface-card text-slate-100 text-sm font-medium transition-all' : 'flex-1 py-2 rounded-md text-slate-500 text-sm transition-all'">Sign In</button>
            <button (click)="toggleMode('register')" [class]="mode() === 'register' ? 'flex-1 py-2 rounded-md bg-surface-card text-slate-100 text-sm font-medium transition-all' : 'flex-1 py-2 rounded-md text-slate-500 text-sm transition-all'">Register</button>
          </div>

          <form (ngSubmit)="submit()" class="space-y-4">
            <div>
              <label class="label">Email address</label>
              <input [(ngModel)]="email" name="email" type="email" class="input" placeholder="you@example.com" required />
            </div>
            <div>
              <label class="label">Password</label>
              <input [(ngModel)]="password" name="password" type="password" class="input" placeholder="••••••••" required />
            </div>

            @if (error()) {
              <div class="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm animate-fade-in">
                {{ error() }}
              </div>
            }

            @if (successMessage()) {
              <div class="bg-emerald-950/30 border border-emerald-800 rounded-lg px-4 py-3 text-emerald-400 text-sm animate-fade-in">
                {{ successMessage() }}
              </div>
            }

            <button type="submit" class="btn-primary w-full py-3" [disabled]="loading()">
              {{ loading() ? 'Please wait...' : (mode() === 'login' ? 'Sign In' : 'Create Account') }}
            </button>
          </form>
        </div>

        <p class="text-center text-xs text-slate-600 mt-6">
          LinkedIn Automation Tool — Use responsibly within LinkedIn's Terms of Service.
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent {
  mode = signal<'login' | 'register'>('login');
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  successMessage = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  toggleMode(newMode: 'login' | 'register') {
    this.mode.set(newMode);
    this.error.set('');
    this.successMessage.set('');
  }

  submit() {
    this.error.set('');
    this.successMessage.set('');
    this.loading.set(true);

    if (this.mode() === 'login') {
      this.auth.login(this.email, this.password).subscribe({
        next: () => this.router.navigate(['/']),
        error: (e) => {
          this.error.set(e.error?.message || 'Authentication failed');
          this.loading.set(false);
        },
      });
    } else {
      this.auth.register(this.email, this.password).subscribe({
        next: () => {
          this.router.navigate(['/']);
        },
        error: (e) => {
          this.error.set(e.error?.message || 'Registration failed');
          this.loading.set(false);
        },
      });
    }
  }
}

