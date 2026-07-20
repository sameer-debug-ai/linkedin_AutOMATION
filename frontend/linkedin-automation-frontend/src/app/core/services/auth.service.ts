import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { WebSocketService } from './websocket.service';

export interface AuthUser {
  _id: string;
  email: string;
  dailyLimit: number;
  timezone: string;
}

interface AuthResponse { success: boolean; token: string; user: AuthUser; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<AuthUser | null>(null);
  private _token = signal<string | null>(localStorage.getItem('token'));

  user = this._user.asReadonly();
  token = this._token.asReadonly();
  isLoggedIn = computed(() => !!this._token());

  constructor(private api: ApiService, private router: Router, private ws: WebSocketService) {
    const stored = localStorage.getItem('user');
    if (stored) {
      const user = JSON.parse(stored);
      this._user.set(user);
      this.ws.connect(user._id);
    }
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/login', { email, password }).pipe(
      tap((res) => this.setSession(res))
    );
  }

  register(email: string, password: string): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/register', { email, password }).pipe(
      tap((res) => this.setSession(res))
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this._token.set(null);
    this._user.set(null);
    this.ws.disconnect();
    this.router.navigate(['/login']);
  }

  private setSession(res: AuthResponse): void {
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    this._token.set(res.token);
    this._user.set(res.user);
    this.ws.connect(res.user._id);
  }
}
