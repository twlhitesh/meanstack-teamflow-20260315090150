import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { UserProfile } from '../models/domain.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly tokenKey = 'teamflow_token';
  private readonly userKey = 'teamflow_user';
  private readonly userSubject = new BehaviorSubject<UserProfile | null>(this.readStoredUser());

  readonly user$ = this.userSubject.asObservable();

  constructor(private api: ApiService) {}

  get user(): UserProfile | null {
    return this.userSubject.value;
  }

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  get isAuthenticated(): boolean {
    return !!this.token;
  }

  register(payload: { name: string; email: string; password: string }): Observable<{ token: string; user: UserProfile }> {
    return this.api.register(payload).pipe(
      tap((response) => this.persistAuth(response.token, response.user))
    );
  }

  login(payload: { email: string; password: string }): Observable<{ token: string; user: UserProfile }> {
    return this.api.login(payload).pipe(
      tap((response) => this.persistAuth(response.token, response.user))
    );
  }

  loadProfile(): Observable<UserProfile> {
    return this.api.getMe().pipe(
      tap((user) => {
        localStorage.setItem(this.userKey, JSON.stringify(user));
        this.userSubject.next(user);
      })
    );
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.userSubject.next(null);
  }

  private persistAuth(token: string, user: UserProfile) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.userSubject.next(user);
  }

  private readStoredUser(): UserProfile | null {
    const raw = localStorage.getItem(this.userKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserProfile;
    } catch {
      return null;
    }
  }
}
