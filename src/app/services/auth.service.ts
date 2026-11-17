import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { ApiService } from "./api.service";
import { UserService } from "./user.service";

export interface User {
  id: string;
  username: string;
  email: string;
  role: "admin" | "applicant";
  /** Organization the account belongs to (applicant accounts only). */
  organizationId?: string;
  organizationName?: string;
  organizationAcronym?: string;
}

export interface LoginResult {
  ok: boolean;
  message?: string;
}

const SESSION_USER_KEY = "current_user";

@Injectable({ providedIn: "root" })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private router: Router,
    private userService: UserService,
    private apiService: ApiService,
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

  /**
   * Admin accounts are validated by the Worker, which returns the API token
   * used for every admin request. Applicant accounts stay local-only: their
   * submissions go through the public stage endpoints.
   */
  async login(username: string, pass: string): Promise<LoginResult> {
    const knownUser = this.userService
      .getUsers()
      .find((user) => user.username === username && user.status === "active");

    if (knownUser && knownUser.role !== "admin") {
      if (knownUser.password !== pass) {
        return { ok: false };
      }
      return this.startSession({
        id: knownUser.id,
        username: knownUser.username,
        email: knownUser.email,
        role: knownUser.role,
        organizationId: knownUser.organizationId,
        organizationName: knownUser.organizationName,
        organizationAcronym: knownUser.organizationAcronym,
      });
    }

    try {
      // The Worker is the source of truth for admin credentials.
      const token = await this.apiService.login(username, pass);
      this.apiService.setToken(token);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not sign in to the server.";
      return { ok: false, message };
    }

    return this.startSession({
      id: knownUser?.id ?? `api-${username}`,
      username,
      email: knownUser?.email ?? "",
      role: "admin",
    });
  }

  private startSession(user: User): LoginResult {
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
    return { ok: true };
  }

  logout(): void {
    sessionStorage.removeItem(SESSION_USER_KEY);
    this.apiService.clearToken();
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
