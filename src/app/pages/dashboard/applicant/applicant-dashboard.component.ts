import { Component, DestroyRef, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { TranslatePipe, TranslateService } from "@ngx-translate/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ApiService } from "../../../services/api.service";
import { AuthService } from "../../../services/auth.service";
import { BreadcrumbService } from "../../../services/breadcrumb.service";
import {
  ApplicantAction,
  ApplicantActivity,
  ApplicantBudgetRow,
  ApplicantDashboard,
  ApplicantRiskFactor,
  ApplicantTimelineStep,
  TimelineStatus,
} from "../../../models/applicant-dashboard.model";
import { countryLabel } from "../../../shared/data/countries";
import { PROFILE_ENTITY_TYPES } from "../../profile-assessment/profile-assessment.component";

const LANGUAGE_LOCALES: Record<string, string> = {
  en: "en-US",
  ru: "ru-RU",
  es: "es-ES",
  fr: "fr-FR",
  zh: "zh-CN",
  ar: "ar",
  vi: "vi-VN",
};

const FACTOR_ORDER: ApplicantRiskFactor["key"][] = [
  "governance",
  "financial",
  "delivery",
  "climate",
  "transparency",
];

const FACTOR_LABEL_KEYS: Record<string, string> = {
  governance: "APPLICANT_DASHBOARD.FACTORS.GOVERNANCE",
  financial: "APPLICANT_DASHBOARD.FACTORS.FINANCIAL",
  delivery: "APPLICANT_DASHBOARD.FACTORS.DELIVERY",
  climate: "APPLICANT_DASHBOARD.FACTORS.CLIMATE",
  transparency: "APPLICANT_DASHBOARD.FACTORS.TRANSPARENCY",
};

const BUDGET_LABEL_KEYS: Record<string, string> = {
  international_consultants: "DASHBOARD.BUDGET.CATEGORIES.INTERNATIONAL_CONSULTANTS",
  national_consultants: "DASHBOARD.BUDGET.CATEGORIES.NATIONAL_CONSULTANTS",
  travel_per_diem: "DASHBOARD.BUDGET.CATEGORIES.TRAVEL",
  workshops_training: "DASHBOARD.BUDGET.CATEGORIES.WORKSHOPS",
  equipment_software: "DASHBOARD.BUDGET.CATEGORIES.EQUIPMENT",
  external_audit: "DASHBOARD.BUDGET.CATEGORIES.AUDIT",
  project_management_costs: "DASHBOARD.BUDGET.CATEGORIES.PROJECT_MANAGEMENT",
  other: "DASHBOARD.BUDGET.CATEGORIES.OTHER",
};

const TIMELINE_KEYS: Record<
  "accreditation" | "readiness",
  Record<string, string>
> = {
  accreditation: {
    profile: "PROFILE",
    prescreening: "PRESCREENING",
    review: "REVIEW",
    accreditation: "ACCREDITATION",
    decision: "DECISION",
  },
  readiness: {
    started: "STARTED",
    submitted: "SUBMITTED",
    review: "REVIEW",
  },
};

const RISK_BAND_KEYS: Record<string, string> = {
  low: "APPLICANT_DASHBOARD.RISK.BAND_LOW",
  moderate: "APPLICANT_DASHBOARD.RISK.BAND_MODERATE",
  elevated: "APPLICANT_DASHBOARD.RISK.BAND_ELEVATED",
  high: "APPLICANT_DASHBOARD.RISK.BAND_HIGH",
};

interface KpiCard {
  key: string;
  label: string;
  value: string;
  sub: string;
  icon: string;
  tone: string;
}

interface RadarAxis {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface RadarView {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  rings: string[];
  axes: RadarAxis[];
  valuePolygon: string;
  benchmarkPolygon: string;
  valuePoints: { x: number; y: number; key: string }[];
}

interface GaugeView {
  value: number;
  color: string;
}

interface BudgetViewRow {
  key: string;
  amount: number;
  amountLabel: string;
  pct: number;
  color: string;
}

@Component({
  selector: "app-applicant-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: "./applicant-dashboard.component.html",
  styleUrl: "./applicant-dashboard.component.css",
})
export class ApplicantDashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  dashboard: ApplicantDashboard | null = null;
  loading = true;
  error = "";
  noOrganization = false;
  lastUpdated = "";

  kpis: KpiCard[] = [];
  riskRadar: RadarView | null = null;
  riskGauge: GaugeView | null = null;
  budgetRows: BudgetViewRow[] = [];

  private organizationId: string | null = null;
  private lastUpdatedAt: Date | null = null;

  private readonly entityLabelKeys: Record<string, string> = Object.fromEntries(
    PROFILE_ENTITY_TYPES.map((label, index) => [
      label,
      `PROFILE.OPTIONS.ENTITY.${index}`,
    ]),
  );

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private breadcrumbService: BreadcrumbService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.breadcrumbService.setContext(
      this.translate.instant("APPLICANT_DASHBOARD.TITLE"),
    );

    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.breadcrumbService.setContext(
          this.translate.instant("APPLICANT_DASHBOARD.TITLE"),
        );
        this.syncUpdatedLabel();
        if (this.dashboard) this.render(this.dashboard);
      });

    this.organizationId =
      this.authService.currentUserValue?.organizationId ?? null;

    if (!this.organizationId) {
      this.noOrganization = true;
      this.loading = false;
      return;
    }

    void this.load();
  }

  async load(): Promise<void> {
    if (!this.organizationId) return;

    this.loading = true;
    this.error = "";

    try {
      const data = await this.api.getApplicantDashboard(this.organizationId);
      this.dashboard = data;
      this.lastUpdatedAt = new Date();
      this.syncUpdatedLabel();
      this.render(data);
    } catch {
      this.error = this.translate.instant("APPLICANT_DASHBOARD.LOAD_ERROR");
    } finally {
      this.loading = false;
    }
  }

  private syncUpdatedLabel(): void {
    if (!this.lastUpdatedAt) {
      this.lastUpdated = "";
      return;
    }
    this.lastUpdated = new Intl.DateTimeFormat(this.locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(this.lastUpdatedAt);
  }

  private render(data: ApplicantDashboard): void {
    this.kpis = this.buildKpis(data);
    this.riskRadar = this.buildRadar(data.risk.factors, data.risk.benchmark);
    this.riskGauge = {
      value: data.risk.overall,
      color: this.riskColor(data.risk.overall),
    };
    this.budgetRows = this.buildBudgetRows(data.budget?.rows ?? []);
  }

  /* ── Formatting ─────────────────────────────────────── */

  get locale(): string {
    return (
      LANGUAGE_LOCALES[this.translate.currentLang() ?? "en"] ?? "en-US"
    );
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat(this.locale, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat(this.locale).format(value);
  }

  formatDate(value: string | null): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(this.locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  countryName(name: string): string {
    return countryLabel(name, this.translate.currentLang() ?? "en");
  }

  entityLabel(value: string): string {
    const key = this.entityLabelKeys[value];
    if (!key) return value;
    const label = this.translate.instant(key);
    return label === key ? value : label;
  }

  /* ── KPIs ───────────────────────────────────────────── */

  private buildKpis(data: ApplicantDashboard): KpiCard[] {
    const readiness = data.readinessScore;
    const documents = data.readiness
      ? `${data.readiness.documentsAttached}/${data.readiness.documentsRequired}`
      : "—";

    return [
      {
        key: "readiness",
        label: this.translate.instant("APPLICANT_DASHBOARD.KPI.READINESS"),
        value: readiness === null ? "—" : `${readiness}`,
        sub:
          readiness === null
            ? this.translate.instant("APPLICANT_DASHBOARD.KPI.NO_READINESS")
            : this.translate.instant("APPLICANT_DASHBOARD.KPI.READINESS_SUB"),
        icon: "📋",
        tone: "gold",
      },
      {
        key: "risk",
        label: this.translate.instant("APPLICANT_DASHBOARD.KPI.RISK"),
        value: `${data.risk.overall}`,
        sub: this.translate.instant(RISK_BAND_KEYS[data.risk.riskBand]),
        icon: "🛡️",
        tone: data.risk.riskBand === "low" ? "green" : data.risk.riskBand === "high" ? "red" : "amber",
      },
      {
        key: "progress",
        label: this.translate.instant("APPLICANT_DASHBOARD.KPI.PROGRESS"),
        value: `${data.progress.overall}%`,
        sub: this.translate.instant("APPLICANT_DASHBOARD.KPI.PROGRESS_SUB", {
          accreditation: data.progress.accreditation,
          readiness: data.progress.readiness,
        }),
        icon: "🧭",
        tone: "blue",
      },
      {
        key: "funding",
        label: this.translate.instant("APPLICANT_DASHBOARD.KPI.FUNDING"),
        value: data.budget ? this.formatMoney(data.budget.requestedUSD) : "—",
        sub: data.budget
          ? this.translate.instant("APPLICANT_DASHBOARD.KPI.FUNDING_SUB", {
              amount: this.formatMoney(data.budget.totalUSD),
            })
          : this.translate.instant("APPLICANT_DASHBOARD.KPI.NO_READINESS"),
        icon: "💰",
        tone: "violet",
      },
      {
        key: "documents",
        label: this.translate.instant("APPLICANT_DASHBOARD.KPI.DOCUMENTS"),
        value: documents,
        sub: this.translate.instant("APPLICANT_DASHBOARD.KPI.DOCUMENTS_SUB"),
        icon: "📎",
        tone: "cyan",
      },
    ];
  }

  /* ── Risk & reputation ──────────────────────────────── */

  private buildRadar(
    factors: ApplicantRiskFactor[],
    benchmark: number,
  ): RadarView {
    const width = 210;
    const height = 196;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 80;
    const count = FACTOR_ORDER.length;
    const ordered = FACTOR_ORDER.map(
      (key) =>
        factors.find((factor) => factor.key === key) ?? {
          key,
          value: 0,
          weight: 0,
        },
    );

    const point = (index: number, value: number) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
      const scale = (Math.max(0, Math.min(100, value)) / 100) * radius;
      return {
        x: centerX + Math.cos(angle) * scale,
        y: centerY + Math.sin(angle) * scale,
      };
    };

    const polygon = (value: number) =>
      ordered
        .map((_, index) => {
          const p = point(index, value);
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join(" ");

    return {
      width,
      height,
      centerX,
      centerY,
      rings: [25, 50, 75, 100].map(polygon),
      axes: ordered.map((_, index) => {
        const outer = point(index, 100);
        return {
          x1: centerX,
          y1: centerY,
          x2: outer.x,
          y2: outer.y,
        };
      }),
      valuePolygon: ordered
        .map((factor, index) => {
          const p = point(index, factor.value);
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join(" "),
      benchmarkPolygon: polygon(benchmark),
      valuePoints: ordered.map((factor, index) => ({
        ...point(index, factor.value),
        key: factor.key,
      })),
    };
  }

  private riskColor(value: number): string {
    if (value >= 75) return "#34d399";
    if (value >= 60) return "#e8c06a";
    if (value >= 40) return "#fbbf24";
    return "#fb7185";
  }

  factorLabel(key: string): string {
    const translationKey = FACTOR_LABEL_KEYS[key];
    return translationKey
      ? this.translate.instant(translationKey)
      : key;
  }

  factor(key: string): ApplicantRiskFactor | null {
    return (
      this.dashboard?.risk.factors.find((item) => item.key === key) ?? null
    );
  }

  riskBandLabel(band: string): string {
    return this.translate.instant(
      RISK_BAND_KEYS[band] ?? "APPLICANT_DASHBOARD.RISK.BAND_MODERATE",
    );
  }

  riskComparison(): string {
    if (!this.dashboard) return "";
    const diff = this.dashboard.risk.overall - this.dashboard.risk.benchmark;
    if (Math.abs(diff) <= 2) {
      return this.translate.instant("APPLICANT_DASHBOARD.RISK.AT");
    }
    return this.translate.instant(
      diff > 0
        ? "APPLICANT_DASHBOARD.RISK.ABOVE"
        : "APPLICANT_DASHBOARD.RISK.BELOW",
      { value: Math.abs(diff) },
    );
  }

  confidenceLabel(): string {
    const value = this.dashboard?.risk.confidence ?? 0;
    const key =
      value >= 70
        ? "APPLICANT_DASHBOARD.RISK.CONFIDENCE_HIGH"
        : value >= 40
          ? "APPLICANT_DASHBOARD.RISK.CONFIDENCE_MEDIUM"
          : "APPLICANT_DASHBOARD.RISK.CONFIDENCE_LOW";
    return this.translate.instant(key);
  }

  /* ── Timeline ───────────────────────────────────────── */

  private timelineKey(
    scope: "accreditation" | "readiness",
    step: string,
  ): string {
    const suffix = TIMELINE_KEYS[scope][step] ?? step.toUpperCase();
    const group = scope === "accreditation" ? "ACC" : "READY";
    return `APPLICANT_DASHBOARD.TIMELINE.${group}.${suffix}`;
  }

  timelineTitle(scope: "accreditation" | "readiness", step: string): string {
    return this.translate.instant(`${this.timelineKey(scope, step)}.TITLE`);
  }

  timelineDesc(scope: "accreditation" | "readiness", step: string): string {
    return this.translate.instant(`${this.timelineKey(scope, step)}.DESC`);
  }

  stepStatusLabel(status: TimelineStatus): string {
    return this.translate.instant(
      `APPLICANT_DASHBOARD.TIMELINE.STATUS.${status.toUpperCase()}`,
    );
  }

  get accreditationSteps(): ApplicantTimelineStep[] {
    return this.dashboard?.timeline.accreditation ?? [];
  }

  get readinessSteps(): ApplicantTimelineStep[] {
    return this.dashboard?.timeline.readiness ?? [];
  }

  /* ── Actions & activity ─────────────────────────────── */

  actionTitle(key: string): string {
    return this.translate.instant(`APPLICANT_DASHBOARD.ACTIONS.${key.toUpperCase()}.TITLE`);
  }

  actionDesc(key: string): string {
    return this.translate.instant(`APPLICANT_DASHBOARD.ACTIONS.${key.toUpperCase()}.DESC`);
  }

  actionCta(key: string): string {
    return this.translate.instant(`APPLICANT_DASHBOARD.ACTIONS.${key.toUpperCase()}.CTA`);
  }

  get actions(): ApplicantAction[] {
    return this.dashboard?.actions ?? [];
  }

  /** The two weakest drivers: the factors that move the index the most. */
  get focusFactors(): ApplicantRiskFactor[] {
    return [...(this.dashboard?.risk.factors ?? [])]
      .sort((a, b) => a.value - b.value)
      .slice(0, 2);
  }

  activityLabel(key: string): string {
    return this.translate.instant(
      `APPLICANT_DASHBOARD.ACTIVITY.${key.toUpperCase()}`,
    );
  }

  get activity(): ApplicantActivity[] {
    return this.dashboard?.activity ?? [];
  }

  /* ── Budget ─────────────────────────────────────────── */

  private buildBudgetRows(rows: ApplicantBudgetRow[]): BudgetViewRow[] {
    const max = Math.max(1, ...rows.map((row) => row.amount));
    const palette = [
      "#e8c06a",
      "#38bdf8",
      "#34d399",
      "#a78bfa",
      "#fb7185",
      "#fbbf24",
      "#22d3ee",
      "#94a3b8",
    ];
    return rows.map((row, index) => ({
      key: row.key,
      amount: row.amount,
      amountLabel: this.formatMoney(row.amount),
      pct: Math.round((row.amount / max) * 100),
      color: palette[index % palette.length],
    }));
  }

  budgetLabel(key: string): string {
    const translationKey = BUDGET_LABEL_KEYS[key];
    return translationKey
      ? this.translate.instant(translationKey)
      : key;
  }

  varianceLabel(value: number): string {
    const sign = value > 0 ? "+" : value < 0 ? "−" : "";
    return `${sign}${this.formatMoney(Math.abs(value))}`;
  }

  stage2SubmittedLabel(): string {
    const submittedAt = this.dashboard?.accreditation.submittedAt;
    return submittedAt
      ? this.formatDate(submittedAt)
      : this.translate.instant("APPLICANT_DASHBOARD.SNAPSHOT.NOT_STARTED");
  }
}
