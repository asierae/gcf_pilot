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
   * Portal accounts are validated by the Worker against the D1 `users` table.
   * Admin accounts also receive the API token used for admin requests. The
   * bundled demo accounts stay as an offline fallback for local development.
   */
  async login(username: string, pass: string): Promise<LoginResult> {
    let message = "";

    try {
      const result = await this.apiService.login(username, pass);
      if (result.token) {
        this.apiService.setToken(result.token);
      } else {
        this.apiService.clearToken();
      }

      const account = result.user;
      return this.startSession({
        id: account.id,
        username: account.username,
        email: account.email,
        role: account.role,
        organizationId: account.organizationId,
        organizationName: account.organizationName,
        organizationAcronym: account.organizationAcronym,
      });
    } catch (error) {
      message =
        error instanceof Error
          ? error.message
          : "Could not sign in to the server.";

      // Only fall back when the Worker cannot be reached; wrong credentials
      // must fail with the server's message.
      if (!message.startsWith("Could not reach the server")) {
        return { ok: false, message };
      }
    }

    const knownUser = this.userService
      .getUsers()
      .find((user) => user.username === username && user.status === "active");

    if (knownUser && knownUser.password === pass) {
      if (knownUser.role === "admin") {
        this.apiService.setToken("local-dev-token");
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

    return { ok: false, message };
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
    void this.router.navigate(["/home"]);
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }
}
