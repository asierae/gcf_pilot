import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

export interface User {
  username: string;
  role: 'admin' | 'applicant';
}

const SESSION_USER_KEY = 'current_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private router: Router) {
    const savedUser = sessionStorage.getItem(SESSION_USER_KEY);
    if (savedUser) {
      this.currentUserSubject.next(JSON.parse(savedUser));
    }
  }

  login(username: string, pass: string): boolean {
    if (username === 'hatyja' && pass === 'asier') {
      const user: User = { username, role: 'admin' };
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
      this.currentUserSubject.next(user);
      return true;
    } else if (username === 'hatyja2' && pass === 'asier') {
      const user: User = { username, role: 'applicant' };
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
      this.currentUserSubject.next(user);
      return true;
    }
    return false;
  }

  logout() {
    sessionStorage.removeItem(SESSION_USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }
}
