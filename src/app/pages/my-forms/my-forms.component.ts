import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { TranslatePipe } from "@ngx-translate/core";
import { AuthService } from "../../services/auth.service";
import { OrganizationService } from "../../services/organization.service";
import { OrganizationForms } from "../../models/organization.model";
import { BreadcrumbService } from "../../services/breadcrumb.service";

interface FormCard {
  key: "stage1" | "readiness";
  title: string;
  description: string;
  route: string;
  submittedAt: string | null;
  draftAt: string | null;
  summary: { label: string; value: string }[];
  json: string;
}

@Component({
  selector: "app-my-forms",
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: "./my-forms.component.html",
  styleUrl: "./my-forms.component.css",
})
export class MyFormsComponent implements OnInit {
  organizationId: string | null = null;
  organizationName = "";
  organizationAcronym = "";

  loading = true;
  error: string | null = null;
  cards: FormCard[] = [];
  expanded: Record<string, boolean> = {};

  constructor(
    private authService: AuthService,
    private organizationService: OrganizationService,
    private breadcrumbService: BreadcrumbService,
  ) {}

  ngOnInit(): void {
    this.breadcrumbService.setContext("My forms");

    const user = this.authService.currentUserValue;
    this.organizationId = user?.organizationId ?? null;
    this.organizationName = user?.organizationName ?? "";
    this.organizationAcronym = user?.organizationAcronym ?? "";

    if (!this.organizationId) {
      this.loading = false;
      this.error =
        "Your account is not linked to an organization yet. Contact the GCF team to link it.";
      return;
    }

    void this.load();
  }

  private async load(): Promise<void> {
    if (!this.organizationId) return;

    this.loading = true;
    this.error = null;

    try {
      const forms = await this.organizationService.forms(this.organizationId);
      this.organizationName =
        forms.organization?.name || this.organizationName;
      this.organizationAcronym =
        forms.organization?.acronym || this.organizationAcronym;
      this.cards = this.buildCards(forms);
    } catch {
      this.error = "Could not load your forms. Please try again.";
    } finally {
      this.loading = false;
    }
  }

  private buildCards(forms: OrganizationForms): FormCard[] {
    return [
      this.card(
        "stage1",
        "Pre-screening",
        "Stage 1 general information, legal status and fast-track eligibility.",
        "/stage1",
        forms.stage1?.submittedAt ?? null,
        forms.drafts.stage1,
        forms.stage1?.data ?? null,
        ["applicantName", "applicantAcronym", "headquartersCountry", "typeOfEntity"],
      ),
      this.card(
        "readiness",
        "Readiness application",
        "GCF Readiness 2024–2027 proposal, budget, FMCA and supporting documents.",
        "/readiness",
        forms.readiness?.submittedAt ?? null,
        forms.drafts.readiness,
        forms.readiness?.data ?? null,
        ["metadata.proposalTitle", "metadata.country", "metadata.requestedAmountUSD"],
      ),
    ];
  }

  private card(
    key: "stage1" | "readiness",
    title: string,
    description: string,
    route: string,
    submittedAt: string | null,
    draftAt: string | null,
    data: Record<string, unknown> | null,
    summaryKeys: string[],
  ): FormCard {
    const source = (data ?? {}) as Record<string, unknown>;
    const summary = summaryKeys
      .map((path) => ({
        label: this.labelFor(path),
        value: this.readPath(source, path),
      }))
      .filter((row) => row.value.length > 0);

    return {
      key,
      title,
      description,
      route,
      submittedAt,
      draftAt,
      summary,
      json: data ? JSON.stringify(data, null, 2) : "",
    };
  }

  private labelFor(path: string): string {
    const labels: Record<string, string> = {
      applicantName: "Organization",
      applicantAcronym: "Acronym",
      headquartersCountry: "Country",
      typeOfEntity: "Entity type",
      "metadata.proposalTitle": "Proposal",
      "metadata.country": "Country",
      "metadata.requestedAmountUSD": "Requested amount",
    };
    return labels[path] ?? path;
  }

  private readPath(source: Record<string, unknown>, path: string): string {
    let current: unknown = source;
    for (const segment of path.split(".")) {
      if (!current || typeof current !== "object") return "";
      current = (current as Record<string, unknown>)[segment];
    }
    if (current === undefined || current === null) return "";
    if (typeof current === "number") {
      return current.toLocaleString("en-US", { style: "currency", currency: "USD" });
    }
    return String(current);
  }

  /** True once the organization has a submission or a saved draft. */
  get hasActivity(): boolean {
    return this.cards.some(
      (card) => card.submittedAt !== null || card.draftAt !== null,
    );
  }

  statusOf(card: FormCard): "submitted" | "draft" | "empty" {
    if (card.submittedAt) return "submitted";
    if (card.draftAt) return "draft";
    return "empty";
  }

  statusLabel(card: FormCard): string {
    const status = this.statusOf(card);
    if (status === "submitted") return "Submitted";
    if (status === "draft") return "Draft";
    return "Not started";
  }

  toggle(card: FormCard): void {
    this.expanded[card.key] = !this.expanded[card.key];
  }

  isExpanded(card: FormCard): boolean {
    return this.expanded[card.key] === true;
  }

  reload(): void {
    void this.load();
  }
}
