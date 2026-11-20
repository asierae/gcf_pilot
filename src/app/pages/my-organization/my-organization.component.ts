import { Component, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TranslatePipe, TranslateService } from "@ngx-translate/core";
import { ApiService } from "../../services/api.service";
import { AuthService } from "../../services/auth.service";
import { NotificationService } from "../../services/notification.service";
import { BreadcrumbService } from "../../services/breadcrumb.service";
import { CountrySelectComponent } from "../../shared/components/country-select/country-select.component";
import { OrganizationRecord } from "../../models/organization.model";

interface OrgProfileForm {
  legalAddress: string;
  operationalAddress: string;
  website: string;
  country: string;
  entityType: string;
  contactName: string;
  contactPhone: string;
}

const ENTITY_TYPES = [
  "Bank / Financial institution",
  "Development finance institution",
  "Government / Public institution",
  "Private company / Investor",
  "NGO / Non-profit",
  "Project developer",
  "Other",
];

@Component({
  selector: "app-my-organization",
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, CountrySelectComponent],
  templateUrl: "./my-organization.component.html",
  styleUrl: "./my-organization.component.css",
})
export class MyOrganizationComponent implements OnInit {
  private api = inject(ApiService);
  private authService = inject(AuthService);
  private notification = inject(NotificationService);
  private breadcrumb = inject(BreadcrumbService);
  private translate = inject(TranslateService);

  organizationId: string | null = null;
  organization: OrganizationRecord | null = null;
  form: OrgProfileForm = this.emptyForm();
  entityTypes = ENTITY_TYPES;

  loading = true;
  saving = false;
  error = "";

  ngOnInit(): void {
    this.breadcrumb.setContext(this.translate.instant("MY_ORGANIZATION.TITLE"));
    this.organizationId = this.authService.currentUserValue?.organizationId ?? null;
    if (!this.organizationId) {
      this.loading = false;
      this.error = this.translate.instant("MY_ORGANIZATION.NO_ORGANIZATION");
      return;
    }
    void this.load();
  }

  async load(): Promise<void> {
    if (!this.organizationId) return;
    this.loading = true;
    this.error = "";
    try {
      const org = await this.api.getOrganization(this.organizationId);
      if (!org) {
        this.error = this.translate.instant("MY_ORGANIZATION.NO_ORGANIZATION");
        return;
      }
      this.organization = org;
      this.form = {
        legalAddress: org.legalAddress ?? "",
        operationalAddress: org.operationalAddress ?? "",
        website: org.website ?? "",
        country: org.country ?? "",
        entityType: org.entityType ?? "",
        contactName: org.contactName ?? "",
        contactPhone: org.contactPhone ?? "",
      };
    } catch {
      this.error = this.translate.instant("MY_ORGANIZATION.LOAD_ERROR");
    } finally {
      this.loading = false;
    }
  }

  async save(): Promise<void> {
    if (!this.organizationId || this.saving) return;
    this.saving = true;
    try {
      const updated = await this.api.updateOrganizationProfile(
        this.organizationId,
        this.form,
      );
      this.organization = updated;
      this.notification.success(this.translate.instant("MY_ORGANIZATION.SAVED"));
    } catch (error) {
      this.notification.error(
        error instanceof Error
          ? error.message
          : this.translate.instant("MY_ORGANIZATION.SAVE_ERROR"),
      );
    } finally {
      this.saving = false;
    }
  }

  private emptyForm(): OrgProfileForm {
    return {
      legalAddress: "",
      operationalAddress: "",
      website: "",
      country: "",
      entityType: "",
      contactName: "",
      contactPhone: "",
    };
  }
}
