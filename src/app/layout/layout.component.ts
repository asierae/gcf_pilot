import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { AuthService } from "../services/auth.service";
import { OrganizationService } from "../services/organization.service";
import { SubmissionStatus } from "../models/applicant.model";
import { LanguageService } from "../services/language.service";
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BreadcrumbComponent } from "../shared/components/breadcrumb/breadcrumb.component";
import { ChatComponent } from "../shared/components/chat/chat.component";
import { LanguageSwitcherComponent } from "../shared/components/language-switcher/language-switcher.component";

@Component({
  selector: "app-layout",
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    BreadcrumbComponent,
    ChatComponent,
    TranslatePipe,
    LanguageSwitcherComponent,
  ],
  templateUrl: "./layout.component.html",
  styleUrl: "./layout.component.css",
})
export class LayoutComponent implements OnInit {
  private translate = inject(TranslateService);

  sidebarCollapsed = false;
  gearMenuOpen = false;
  profileMenuOpen = false;
  preScreeningStatus: SubmissionStatus = "Pending";
  organizationName = "";

  constructor(
    public authService: AuthService,
    public languageService: LanguageService,
    private organizationService: OrganizationService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.organizationName = this.authService.currentUserValue?.organizationName ?? "";
    void this.loadPreScreeningStatus();
  }

  private async loadPreScreeningStatus(): Promise<void> {
    const user = this.authService.currentUserValue;
    if (!user || user.role !== "applicant" || !user.organizationId) return;

    try {
      const forms = await this.organizationService.forms(user.organizationId);
      this.preScreeningStatus = forms.preScreeningStatus ?? "Pending";
      this.organizationName = forms.organization?.name || this.organizationName;
    } catch {
      // Keep the conservative default: Accreditation stays locked on failure.
    }
  }

  /** Admins always have access; applicants need a passed pre-screening. */
  get accreditationUnlocked(): boolean {
    return (
      this.authService.currentUserValue?.role === "admin" ||
      this.preScreeningStatus === "Passed"
    );
  }

  get preScreeningStatusLabel(): string {
    if (this.preScreeningStatus === "Passed") return "Passed";
    if (this.preScreeningStatus === "Failed") return "Failed";
    return "Pending";
  }

  get localizedPreScreeningStatus(): string {
    return this.translate.instant(
      `DASHBOARD.STATUS.${this.preScreeningStatusLabel.toUpperCase()}`,
    );
  }

  logout(): void {
    this.authService.logout();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  get chatVisible(): boolean {
    return !this.router.url.startsWith("/readiness");
  }

  toggleGearMenu(): void {
    this.gearMenuOpen = !this.gearMenuOpen;
  }

  closeGearMenu(): void {
    this.gearMenuOpen = false;
  }

  navigateTo(path: string): void {
    this.gearMenuOpen = false;
    void this.router.navigate([path]);
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen = !this.profileMenuOpen;
  }

  closeProfileMenu(): void {
    this.profileMenuOpen = false;
  }
}
