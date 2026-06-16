import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { UserService } from "./user.service";

export interface User {
  id: string;
  username: string;
  email: string;
  role: "admin" | "applicant";
}

const SESSION_USER_KEY = "current_user";

@Injectable({ providedIn: "root" })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private router: Router,
    private userService: UserService,
  ) {
    const saved = sessionStorage.getItem(SESSION_USER_KEY);
    if (saved) {
      try {
        this.currentUserSubject.next(JSON.parse(saved) as User);
      } catch {
        sessionStorage.removeItem(SESSION_USER_KEY);
      }
    }
  }

  login(username: string, pass: string): boolean {
    const appUser = this.userService.findByCredentials(username, pass);
    if (!appUser) return false;

    const user: User = {
      id: appUser.id,
      username: appUser.username,
      email: appUser.email,
      role: appUser.role,
    };
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
    return true;
  }

  logout(): void {
    sessionStorage.removeItem(SESSION_USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(["/login"]);
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }
}
