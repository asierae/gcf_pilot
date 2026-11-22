import { Component, DestroyRef, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { TranslatePipe } from "@ngx-translate/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ApiService } from "../../../services/api.service";
import {
  OrganizationRecord,
  RiskSkill,
} from "../../../models/organization.model";
import { NotificationService } from "../../../services/notification.service";
import { BreadcrumbService } from "../../../services/breadcrumb.service";
import { TranslateService } from "@ngx-translate/core";

interface OrgRow extends OrganizationRecord {}

@Component({
  selector: "app-admin-organizations-list",
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, TranslatePipe],
  templateUrl: "./admin-organizations-list.component.html",
  styleUrl: "./admin-organizations-list.component.css",
})
export class AdminOrganizationsListComponent {
  private api = inject(ApiService);
  private notification = inject(NotificationService);
  private breadcrumb = inject(BreadcrumbService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  organizations: OrgRow[] = [];
  search = "";
  loading = true;
  loadError = "";
  deletingId: string | null = null;

  // Global risk-analysis skills
  skills: RiskSkill[] = [];
  skillsLoading = false;
  skillSaving = false;
  showSkillForm = false;
  editingSkillId: string | null = null;
  skillDraft = { title: "", description: "" };

  // Inline risk score + AI analysis
  editingScoreId: string | null = null;
  scoreDraft: number | null = null;
  savingScoreId: string | null = null;
  analyzingId: string | null = null;

  constructor() {
    this.breadcrumb.setContext("ADMIN_ORGANIZATIONS.TITLE");
  }

  ngOnInit(): void {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.breadcrumb.setContext("ADMIN_ORGANIZATIONS.TITLE");
        this.loadOrganizations();
      });
    this.loadOrganizations();
    this.loadSkills();
  }

  ngOnDestroy(): void {
    this.breadcrumb.clearContext();
  }

  async loadOrganizations(): Promise<void> {
    this.loading = true;
    this.loadError = "";

    try {
      this.organizations = await this.api.getOrganizationsAdmin();
    } catch (error) {
      this.loadError =
        error instanceof Error ? error.message : "Could not load organizations.";
    } finally {
      this.loading = false;
    }
  }

  async loadSkills(): Promise<void> {
    this.skillsLoading = true;
    try {
      this.skills = await this.api.getRiskSkills();
    } catch (error) {
      this.notification.error(
        error instanceof Error ? error.message : "Could not load risk skills.",
      );
    } finally {
      this.skillsLoading = false;
    }
  }

  startNewSkill(): void {
    this.editingSkillId = null;
    this.skillDraft = { title: "", description: "" };
    this.showSkillForm = true;
  }

  startEditSkill(skill: RiskSkill): void {
    this.editingSkillId = skill.id;
    this.skillDraft = { title: skill.title, description: skill.description };
    this.showSkillForm = true;
  }

  cancelSkill(): void {
    this.showSkillForm = false;
    this.editingSkillId = null;
    this.skillDraft = { title: "", description: "" };
  }

  async saveSkill(): Promise<void> {
    if (this.skillSaving) return;
    const title = this.skillDraft.title.trim();
    const description = this.skillDraft.description.trim();
    if (!title || !description) {
      this.notification.warning(
        this.translate.instant("ADMIN_ORGANIZATIONS.SKILL_REQUIRED"),
      );
      return;
    }

    this.skillSaving = true;
    try {
      if (this.editingSkillId) {
        const updated = await this.api.updateRiskSkill(this.editingSkillId, {
          title,
          description,
        });
        this.skills = this.skills.map((skill) =>
          skill.id === updated.id ? updated : skill,
        );
      } else {
        const created = await this.api.createRiskSkill({ title, description });
        this.skills = [...this.skills, created];
      }
      this.notification.success(
        this.translate.instant("ADMIN_ORGANIZATIONS.SKILL_SAVED"),
      );
      this.cancelSkill();
    } catch (error) {
      this.notification.error(
        error instanceof Error ? error.message : "Could not save the skill.",
      );
    } finally {
      this.skillSaving = false;
    }
  }

  async deleteSkill(skill: RiskSkill): Promise<void> {
    if (
      !confirm(
        this.translate.instant("ADMIN_ORGANIZATIONS.SKILL_DELETE_CONFIRM", {
          title: skill.title,
        }),
      )
    ) {
      return;
    }
    try {
      await this.api.deleteRiskSkill(skill.id);
      this.skills = this.skills.filter((item) => item.id !== skill.id);
      if (this.editingSkillId === skill.id) this.cancelSkill();
      this.notification.success(
        this.translate.instant("ADMIN_ORGANIZATIONS.SKILL_DELETED"),
      );
    } catch (error) {
      this.notification.error(
        error instanceof Error ? error.message : "Could not delete the skill.",
      );
    }
  }

  startEditScore(org: OrgRow): void {
    this.editingScoreId = org.id;
    this.scoreDraft = org.riskScore;
  }

  cancelScore(): void {
    this.editingScoreId = null;
    this.scoreDraft = null;
  }

  async commitScore(org: OrgRow): Promise<void> {
    if (this.savingScoreId || this.editingScoreId !== org.id) return;
    const raw = this.scoreDraft;
    this.editingScoreId = null;
    const score =
      raw === null || raw === undefined || Number.isNaN(raw)
        ? null
        : Math.max(0, Math.min(100, Math.round(raw)));
    if (score === org.riskScore) {
      this.cancelScore();
      return;
    }

    this.savingScoreId = org.id;
    try {
      const updated = await this.api.updateOrganizationAdmin(org.id, {
        riskScore: score,
      });
      this.applyOrganizationUpdate(org, updated);
      this.notification.success(
        this.translate.instant("ADMIN_ORGANIZATIONS.RISK_SCORE_SAVED"),
      );
    } catch (error) {
      this.notification.error(
        error instanceof Error ? error.message : "Could not save the risk score.",
      );
    } finally {
      this.savingScoreId = null;
      this.cancelScore();
    }
  }

  async analyzeRisk(org: OrgRow): Promise<void> {
    if (this.analyzingId) return;
    this.analyzingId = org.id;
    try {
      const { organization, analysis } = await this.api.analyzeOrganizationRisk(
        org.id,
      );
      this.applyOrganizationUpdate(org, organization);
      this.notification.success(
        this.translate.instant("ADMIN_ORGANIZATIONS.AI_ANALYZED", {
          score: analysis.score,
        }),
      );
    } catch (error) {
      this.notification.error(
        error instanceof Error ? error.message : "AI risk analysis failed.",
      );
    } finally {
      this.analyzingId = null;
    }
  }

  private applyOrganizationUpdate(org: OrgRow, updated: OrganizationRecord): void {
    this.organizations = this.organizations.map((item) =>
      item.id === org.id ? { ...item, ...updated } : item,
    );
  }

  get filteredOrganizations(): OrgRow[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.organizations;
    return this.organizations.filter(
      (org) =>
        org.name.toLowerCase().includes(q) ||
        (org.acronym ?? "").toLowerCase().includes(q) ||
        org.country.toLowerCase().includes(q) ||
        org.id.toLowerCase().includes(q),
    );
  }

  get countMessage(): string {
    const count = this.filteredOrganizations.length;
    return this.translate.instant("ADMIN_ORGANIZATIONS.COUNT", {
      count,
      plural: count === 1 ? "" : "s",
    });
  }

  riskBand(score: number | null): string {
    if (score === null) return "low";
    if (score >= 75) return "high";
    if (score >= 60) return "elevated";
    if (score >= 40) return "moderate";
    return "low";
  }

  entityLabel(entityType: string): string {
    return entityType || "—";
  }

  accreditationStatusClass(status: string): string {
    if (!status) return "pending";
    return status.replace("_", "-");
  }

  accreditationStatusLabel(status: string): string {
    if (!status) return "—";
    const key = `ADMIN_ORGANIZATION_EDIT.ACCR_STATUS_${status.toUpperCase().replace("-", "_")}`;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  priorityLabel(priority: string | null): string {
    if (!priority) return "—";
    const key = `ADMIN_ORGANIZATION_EDIT.PRIORITY_${priority.toUpperCase()}`;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : priority;
  }

  async deleteOrganization(org: OrgRow): Promise<void> {
    if (!confirm(`Delete organization "${org.name}"? This cannot be undone.`)) {
      return;
    }

    this.deletingId = org.id;
    try {
      // Organizations cannot be deleted via API - just show notification
      this.notification.info("Organizations cannot be deleted.");
    } catch (error) {
      this.notification.error(
        error instanceof Error ? error.message : "Could not delete organization.",
      );
    } finally {
      this.deletingId = null;
    }
  }

  refresh(): void {
    this.search = "";
    void this.loadOrganizations();
  }

  formatDate(iso?: string): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
}