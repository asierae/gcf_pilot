import { Component, DestroyRef, effect, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink, NavigationEnd } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { filter } from "rxjs/operators";
import { BreadcrumbService } from "../../../services/breadcrumb.service";

export interface Crumb {
  label: string;
  link?: string;
}

interface CrumbDef {
  key: string;
  link?: string;
}

const ROUTE_MAP: Record<string, CrumbDef[]> = {
  "/pricing": [{ key: "NAV.PRICING" }],
  "/stage1": [{ key: "NAV.PRESCREENING" }],
  "/stage2": [{ key: "NAV.ACCREDITATION" }],
  "/my-organization": [{ key: "NAV.MY_ORGANIZATION" }],
  "/dashboard/overview": [{ key: "DASHBOARD.TITLE" }],
  "/dashboard/applicant": [{ key: "APPLICANT_DASHBOARD.TITLE" }],
  "/dashboard": [{ key: "NAV.ACCREDITATION_SUBM" }],
  "/dashboard/accreditation": [
    { key: "DASHBOARD.TITLE", link: "/dashboard/overview" },
    { key: "ACCREDITATION_SUBMISSIONS.TITLE" },
  ],
  "/dashboard/readiness": [
    { key: "DASHBOARD.TITLE", link: "/dashboard/overview" },
    { key: "NAV.READINESS_SUBM" },
  ],
  "/dashboard/leads": [
    { key: "DASHBOARD.TITLE", link: "/dashboard/overview" },
    { key: "NAV.LEADS" },
  ],
  "/settings/users": [
    { key: "NAV.SETTINGS" },
    { key: "NAV.USER_MANAGEMENT" },
  ],
  "/settings/send-email": [
    { key: "NAV.SETTINGS" },
    { key: "NAV.SEND_EMAIL" },
  ],
  "/my-forms": [{ key: "NAV.MY_FORMS" }],
  "/readiness": [{ key: "NAV.READINESS" }],
  "/admin/organizations": [{ key: "ADMIN_ORGANIZATIONS.TITLE" }],
  "/admin/organizations/edit": [{ key: "ADMIN_ORGANIZATION_EDIT.TITLE" }],
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
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  crumbs: Crumb[] = [];

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.buildCrumbs());
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.buildCrumbs());
    effect(() => {
      // Pages publish a contextual title after navigation; reflect it here.
      this.breadcrumbService.context();
      this.buildCrumbs();
    });
  }

  private buildCrumbs(): void {
    const [url, search = ""] = this.router.url.split("?");
    const params = new URLSearchParams(search);

    // Full form opened from the admin Accreditation Submissions table.
    if (url === "/stage2" && params.has("submission")) {
      this.crumbs = [
        {
          label: this.translate.instant("ACCREDITATION_SUBMISSIONS.TITLE"),
          link: "/dashboard/accreditation",
        },
        {
          label:
            this.breadcrumbService.context()?.trim() ||
            this.translate.instant("BREADCRUMB.STAGE2_REVIEW"),
        },
      ];
      return;
    }

    // Admin readiness editor.
    if (url.startsWith("/dashboard/readiness/")) {
      this.crumbs = [
        {
          label: this.translate.instant("NAV.READINESS_SUBM"),
          link: "/dashboard/readiness",
        },
        {
          label:
            this.breadcrumbService.context()?.trim() ||
            this.translate.instant("BREADCRUMB.READINESS_EDIT"),
        },
      ];
      return;
    }

    // Submission detail: /dashboard/submission/:id
    if (url.startsWith("/dashboard/submission/")) {
      const ctx = this.breadcrumbService.context();
      this.crumbs = [
        {
          label: this.translate.instant("NAV.ACCREDITATION_SUBM"),
          link: "/dashboard",
        },
        { label: ctx ?? this.translate.instant("NAV.SUBMISSION") },
      ];
      return;
    }

    // Admin organizations edit: /admin/organizations/:id
    if (url.startsWith("/admin/organizations/") && url !== "/admin/organizations") {
      this.crumbs = [
        {
          label: this.translate.instant("ADMIN_ORGANIZATIONS.TITLE"),
          link: "/admin/organizations",
        },
        {
          label:
            this.breadcrumbService.context()?.trim() ||
            this.translate.instant("ADMIN_ORGANIZATION_EDIT.TITLE"),
        },
      ];
      return;
    }

    const defs = ROUTE_MAP[url];
    if (!defs?.length) {
      this.crumbs = [{ label: this.fallbackLabel(url) }];
      return;
    }

    this.crumbs = defs.map((def) => ({
      label: this.translate.instant(def.key),
      link: def.link,
    }));
  }

  /** Unmapped routes still get a breadcrumb instead of an empty gap. */
  private fallbackLabel(url: string): string {
    const context = this.breadcrumbService.context()?.trim();
    if (context) {
      return context;
    }
    const segment = url.split("/").filter(Boolean).pop() ?? "";
    return segment
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  get visible(): boolean {
    return this.crumbs.length > 0;
  }
}
