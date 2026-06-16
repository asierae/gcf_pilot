import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { AuthService } from "../services/auth.service";
import { LanguageService } from "../services/language.service";
import { TranslatePipe } from '@ngx-translate/core';
import { BreadcrumbComponent } from "../shared/components/breadcrumb/breadcrumb.component";
import { ChatComponent } from "../shared/components/chat/chat.component";

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
  ],
  templateUrl: "./layout.component.html",
  styleUrl: "./layout.component.css",
})
export class LayoutComponent {
  sidebarCollapsed = false;
  gearMenuOpen = false;
  profileMenuOpen = false;

  constructor(
    public authService: AuthService,
    public languageService: LanguageService,
    private router: Router,
  ) {}

  logout(): void {
    this.authService.logout();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
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

  changeLanguage(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.languageService.setLanguage(selectElement.value);
  }
}
