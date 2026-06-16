import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink, NavigationEnd } from "@angular/router";
import { filter } from "rxjs/operators";
import { BreadcrumbService } from "../../../services/breadcrumb.service";

export interface Crumb {
  label: string;
  link?: string;
}

const ROUTE_MAP: Record<string, Crumb[]> = {
  "/pricing": [{ label: "Plans & Pricing" }],
  "/stage1": [{ label: "Stage 1" }],
  "/stage2": [{ label: "Stage 2" }],
  "/dashboard": [{ label: "Dashboard" }],
  "/dashboard/leads": [
    { label: "Dashboard", link: "/dashboard" },
    { label: "Leads" },
  ],
  "/settings/users": [{ label: "Settings" }, { label: "User Management" }],
};

@Component({
  selector: "app-breadcrumb",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./breadcrumb.component.html",
  styleUrl: "./breadcrumb.component.css",
})
export class BreadcrumbComponent {
  private router = inject(Router);
  private breadcrumbService = inject(BreadcrumbService);

  crumbs: Crumb[] = [];

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.buildCrumbs());
    this.buildCrumbs();
  }

  private buildCrumbs(): void {
    const url = this.router.url.split("?")[0];

    // Submission detail: /dashboard/submission/:id
    if (url.startsWith("/dashboard/submission/")) {
      const ctx = this.breadcrumbService.context();
      this.crumbs = [
        { label: "Dashboard", link: "/dashboard" },
        { label: ctx ?? "Submission" },
      ];
      return;
    }

    this.crumbs = ROUTE_MAP[url] ?? [];
  }

  get visible(): boolean {
    return this.crumbs.length > 0;
  }
}
