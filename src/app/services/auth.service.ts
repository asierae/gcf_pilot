import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

export interface User {
  username: string;
  role: 'admin' | 'applicant';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private router: Router) {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      this.currentUserSubject.next(JSON.parse(savedUser));
    }
  }

  login(username: string, pass: string): boolean {
    if (username === 'hatyja' && pass === 'asier') {
      const user: User = { username, role: 'admin' };
      localStorage.setItem('current_user', JSON.stringify(user));
      this.currentUserSubject.next(user);
      return true;
    } else if (username === 'hatyja2' && pass === 'asier') {
      const user: User = { username, role: 'applicant' };
      localStorage.setItem('current_user', JSON.stringify(user));
      this.currentUserSubject.next(user);
      return true;
    }
    return false;
  }

  logout() {
    localStorage.removeItem('current_user');
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
