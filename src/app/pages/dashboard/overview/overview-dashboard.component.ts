import { Component, DestroyRef, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { TranslatePipe, TranslateService } from "@ngx-translate/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  arc,
  area,
  curveMonotoneX,
  geoEqualEarth,
  geoGraticule10,
  geoPath,
  interpolateRgb,
  line,
  pie,
  scaleBand,
  scaleLinear,
  scalePoint,
  scaleSqrt,
  type GeoPermissibleObjects,
} from "d3";
import { ApiService } from "../../../services/api.service";
import { BreadcrumbService } from "../../../services/breadcrumb.service";
import {
  AdminStats,
  CountryBreakdown,
  MapPoint,
  MonthlyActivity,
  StatRank,
} from "../../../models/admin-stats.model";
import { countryCode, countryLabel } from "../../../shared/data/countries";
import { countryCentroid } from "../../../shared/data/country-coordinates";
import { PROFILE_ENTITY_TYPES } from "../../profile-assessment/profile-assessment.component";

const MAP_WIDTH = 920;
const MAP_HEIGHT = 440;

const EN_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const LANGUAGE_LOCALES: Record<string, string> = {
  en: "en-US",
  ru: "ru-RU",
  es: "es-ES",
  fr: "fr-FR",
  zh: "zh-CN",
  ar: "ar",
  vi: "vi-VN",
};

const FUNNEL_LABEL_KEYS: Record<string, string> = {
  Enquiries: "DASHBOARD.FUNNEL.ENQUIRIES",
  Accreditation: "DASHBOARD.FUNNEL.ACCREDITATION",
  "Passed pre-screening": "DASHBOARD.FUNNEL.PASSED",
  "Stage 2 applications": "DASHBOARD.FUNNEL.STAGE2",
};

const SOURCE_LABEL_KEYS: Record<string, string> = {
  profile: "DASHBOARD.SOURCES.PROFILE",
  manual: "DASHBOARD.SOURCES.MANUAL",
  readiness: "DASHBOARD.SOURCES.READINESS",
  contact: "DASHBOARD.SOURCES.CONTACT",
};

type StreamKey = "accreditation" | "readiness" | "leads";

interface WorldFeature {
  type: "Feature";
  id: string | null;
  properties: { name: string };
  geometry: unknown;
}

interface WorldCollection {
  type: "FeatureCollection";
  features: WorldFeature[];
}

let worldCache: Promise<WorldCollection> | null = null;

function loadWorld(): Promise<WorldCollection> {
  if (!worldCache) {
    worldCache = fetch("assets/world-countries.geo.json")
      .then((response) => {
        if (!response.ok) throw new Error("World map unavailable");
        return response.json() as Promise<WorldCollection>;
      })
      .catch((error) => {
        worldCache = null;
        throw error;
      });
  }
  return worldCache;
}

interface KpiCard {
  label: string;
  value: string;
  icon: string;
  tone: string;
  sub: string;
  delta: number | null;
  sparkLine: string;
  sparkArea: string;
}

interface Spark {
  line: string;
  area: string;
}

interface ChartPoint {
  x: number;
  y: number;
  value: number;
  label: string;
}

interface LineSeries {
  key: string;
  label: string;
  color: string;
  line: string;
  area: string;
  points: ChartPoint[];
}

interface MultiChart {
  width: number;
  height: number;
  series: LineSeries[];
  yTicks: { y: number; label: string }[];
  xLabels: { x: number; label: string }[];
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
}

interface StackSegment {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  value: number;
  label: string;
}

interface StackBar {
  label: string;
  total: number;
  x: number;
  width: number;
  segments: StackSegment[];
}

interface StackChart {
  width: number;
  height: number;
  bars: StackBar[];
  yTicks: { y: number; label: string }[];
  plotLeft: number;
  plotRight: number;
  baseline: number;
}

interface ChartGeometry {
  line: string;
  area: string;
  points: ChartPoint[];
  yTicks: { label: string; y: number }[];
  max: number;
  avgY: number | null;
}

interface DonutSlice {
  path: string;
  color: string;
  label: string;
  value: number;
}

interface Gauge {
  background: string;
  foreground: string;
  value: number;
  color: string;
}

interface MoneyRow {
  label: string;
  value: number;
  display: string;
  pct: number;
  color: string;
}

interface ScoreBar {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  value: number;
}

interface ScoreChart {
  width: number;
  height: number;
  bars: ScoreBar[];
  baseline: number;
  avgY: number | null;
}

interface FunnelRow {
  label: string;
  value: number;
  widthPct: number;
  conversion: number | null;
}

interface MapShape {
  code: string;
  name: string;
  count: number;
  d: string;
  fill: string;
}

interface MapBubble {
  point: MapPoint;
  x: number;
  y: number;
  r: number;
}

interface MapView {
  width: number;
  height: number;
  sphere: string;
  graticule: string;
  shapes: MapShape[];
  bubbles: MapBubble[];
  max: number;
}

interface MapTip {
  leftPct: number;
  topPct: number;
  below: boolean;
  point: MapPoint;
}

interface GrowthHover {
  index: number;
  leftPct: number;
  month: string;
  rows: { label: string; color: string; value: number }[];
}

interface StatusRow {
  label: string;
  value: number;
  tone: string;
}

@Component({
  selector: "app-overview-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: "./overview-dashboard.component.html",
  styleUrl: "./overview-dashboard.component.css",
})
export class OverviewDashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private world: WorldCollection | null = null;
  private lastUpdatedAt: Date | null = null;

  stats: AdminStats | null = null;
  loading = true;
  error = "";
  lastUpdated = "";
  mapError = false;

  kpis: KpiCard[] = [];
  map: MapView | null = null;
  mapTip: MapTip | null = null;
  hoveredCountry = "";

  growth: MultiChart | null = null;
  growthHover: GrowthHover | null = null;

  stacked: StackChart | null = null;
  fundingChart: ChartGeometry | null = null;
  donutSlices: DonutSlice[] = [];
  donutHover: DonutSlice | null = null;

  approvalGauge: Gauge | null = null;
  scoreGauge: Gauge | null = null;
  coverageGauge: Gauge | null = null;

  budgetRows: MoneyRow[] = [];
  scoreChart: ScoreChart | null = null;
  funnelRows: FunnelRow[] = [];
  countryRows: MoneyRow[] = [];

  readonly palette = [
    "#e8c06a",
    "#38bdf8",
    "#34d399",
    "#a78bfa",
    "#fb7185",
    "#fbbf24",
    "#22d3ee",
    "#94a3b8",
  ];

  private readonly entityLabelKeys: Record<string, string> = Object.fromEntries(
    PROFILE_ENTITY_TYPES.map((label, index) => [
      label,
      `PROFILE.OPTIONS.ENTITY.${index}`,
    ]),
  );

  private readonly budgetLabelKeys: Record<string, string> = {
    "International consultants": "DASHBOARD.BUDGET.CATEGORIES.INTERNATIONAL_CONSULTANTS",
    "National consultants": "DASHBOARD.BUDGET.CATEGORIES.NATIONAL_CONSULTANTS",
    "Travel & per diem": "DASHBOARD.BUDGET.CATEGORIES.TRAVEL",
    "Workshops & training": "DASHBOARD.BUDGET.CATEGORIES.WORKSHOPS",
    "Equipment & software": "DASHBOARD.BUDGET.CATEGORIES.EQUIPMENT",
    "External audit": "DASHBOARD.BUDGET.CATEGORIES.AUDIT",
    "Project management": "DASHBOARD.BUDGET.CATEGORIES.PROJECT_MANAGEMENT",
    Other: "DASHBOARD.BUDGET.CATEGORIES.OTHER",
  };

  constructor(
    private api: ApiService,
    private breadcrumbService: BreadcrumbService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.breadcrumbService.setContext(this.translate.instant("DASHBOARD.TITLE"));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.breadcrumbService.setContext(
          this.translate.instant("DASHBOARD.TITLE"),
        );
        this.syncUpdatedLabel();
        if (this.stats) this.render(this.stats, this.world);
      });
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      const [stats, world] = await Promise.all([
        this.api.getAdminStats(),
        loadWorld().catch(() => null),
      ]);
      this.world = world;
      this.lastUpdatedAt = new Date();
      this.syncUpdatedLabel();
      this.render(stats, world);
    } catch {
      this.error = this.translate.instant("DASHBOARD.LOAD_ERROR");
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

  private render(data: AdminStats, world: WorldCollection | null): void {
    this.stats = data;
    this.kpis = this.buildKpis(data);
    this.donutSlices = this.buildDonut(data.entityTypes ?? []);
    this.growth = this.buildGrowth(data.monthlySeries ?? []);
    this.stacked = this.buildStacked(data.monthlySeries ?? []);
    this.fundingChart = this.buildChart(
      data.fundingByMonth ?? [],
      (value) => this.formatMoney(value),
    );
    this.budgetRows = this.buildMoneyRows(
      data.budgetByCategory ?? [],
      data.budgetPlannedUSD,
    );
    this.scoreChart = this.buildScoreChart(
      data.scoreBuckets ?? [],
      data.avgReadinessScore ?? 0,
    );
    this.funnelRows = this.buildFunnel(data.funnel ?? []);
    this.countryRows = this.buildCountryRows(data.countryBreakdown ?? []);

    const approval = Math.max(0, Math.min(100, data.conversionRate ?? 0));
    const score = Math.max(0, Math.min(100, data.avgReadinessScore ?? 0));
    const coverage = data.accreditationSubmissions
      ? Math.round((data.stage2Submissions / data.accreditationSubmissions) * 100)
      : 0;
    this.approvalGauge = this.buildGauge(approval, "#34d399");
    this.scoreGauge = this.buildGauge(score, "#e8c06a");
    this.coverageGauge = this.buildGauge(coverage, "#38bdf8");

    if (world) {
      this.map = this.buildMap(data, world);
      this.mapError = false;
    } else {
      this.map = null;
      this.mapError = true;
    }
  }

  /* ── KPIs ─────────────────────────────────────────────── */

  private buildKpis(data: AdminStats): KpiCard[] {
    const series = data.monthlySeries ?? [];
    const values = (key: keyof MonthlyActivity): number[] =>
      series.map((row) => Number(row[key]) || 0);
    const trend = (key: keyof MonthlyActivity): number | null => {
      if (series.length < 2) return null;
      const previous = Number(series[series.length - 2][key]) || 0;
      const current = Number(series[series.length - 1][key]) || 0;
      if (!previous) return current ? null : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const fundingValues = (data.fundingByMonth ?? []).map((row) => row.value);
    const fundingTrend = (() => {
      if (fundingValues.length < 2) return null;
      const previous = fundingValues[fundingValues.length - 2];
      const current = fundingValues[fundingValues.length - 1];
      if (!previous) return current ? null : 0;
      return Math.round(((current - previous) / previous) * 100);
    })();

    const make = (
      label: string,
      value: string,
      icon: string,
      tone: string,
      sub: string,
      delta: number | null,
      sparkValues: number[],
    ): KpiCard => {
      const spark = this.buildSpark(sparkValues);
      return {
        label,
        value,
        icon,
        tone,
        sub,
        delta,
        sparkLine: spark.line,
        sparkArea: spark.area,
      };
    };

    return [
      make(
        this.t("DASHBOARD.KPI.ORGANIZATIONS"),
        this.formatNumber(data.organizations),
        "◈",
        "gold",
        this.t("DASHBOARD.KPI.ORGANIZATIONS_SUB", {
          countries: data.countries,
          score: data.avgReadinessScore,
        }),
        trend("organizations"),
        values("organizations"),
      ),
      make(
        this.t("DASHBOARD.KPI.ACCREDITATION"),
        this.formatNumber(data.accreditationSubmissions),
        "▤",
        "sky",
        this.t("DASHBOARD.KPI.ACCREDITATION_SUB", {
          passed: data.statusCounts["Passed"] || 0,
          rate: data.conversionRate,
        }),
        trend("accreditation"),
        values("accreditation"),
      ),
      make(
        this.t("DASHBOARD.KPI.READINESS"),
        this.formatNumber(data.readinessSubmissions),
        "◎",
        "violet",
        this.t("DASHBOARD.KPI.READINESS_SUB", {
          stage2: data.stage2Submissions,
          ask: this.formatMoney(data.avgFundingPerSubmission),
        }),
        trend("readiness"),
        values("readiness"),
      ),
      make(
        this.t("DASHBOARD.KPI.ENQUIRIES"),
        this.formatNumber(data.leads),
        "✦",
        "mint",
        this.t("DASHBOARD.KPI.ENQUIRIES_SUB", {
          profile: data.leadSourceCounts["profile"] || 0,
        }),
        trend("leads"),
        values("leads"),
      ),
      make(
        this.t("DASHBOARD.KPI.FUNDING"),
        this.formatMoney(data.fundingRequestedUSD),
        "$",
        "gold",
        this.t("DASHBOARD.KPI.FUNDING_SUB", {
          budget: this.formatMoney(data.budgetPlannedUSD),
        }),
        fundingTrend,
        fundingValues,
      ),
      make(
        this.t("DASHBOARD.KPI.USERS"),
        this.formatNumber(data.users),
        "♙",
        "slate",
        this.t("DASHBOARD.KPI.USERS_SUB", {
          active: data.userCounts["active"] || 0,
          pending: data.userCounts["pending"] || 0,
        }),
        trend("users"),
        values("users"),
      ),
    ];
  }

  private buildSpark(values: number[]): Spark {
    const width = 120;
    const height = 32;
    const pad = 2;
    const rows = values.length ? values : [0, 0];
    const max = Math.max(1, ...rows);
    const min = Math.min(0, ...rows);
    const x = scaleLinear()
      .domain([0, Math.max(1, rows.length - 1)])
      .range([pad, width - pad]);
    const y = scaleLinear()
      .domain([min, max])
      .range([height - pad, pad]);
    const points = rows.map((value, index) => ({
      x: x(index),
      y: y(value),
    }));
    return {
      line:
        line<{ x: number; y: number }>()
          .x((point) => point.x)
          .y((point) => point.y)
          .curve(curveMonotoneX)(points) ?? "",
      area:
        area<{ x: number; y: number }>()
          .x((point) => point.x)
          .y0(height)
          .y1((point) => point.y)
          .curve(curveMonotoneX)(points) ?? "",
    };
  }

  /* ── World map ────────────────────────────────────────── */

  private buildMap(data: AdminStats, world: WorldCollection): MapView {
    const points = (data.mapPoints ?? []).filter((point) => point.count > 0);
    const max = Math.max(1, ...points.map((point) => point.count));
    const features = world.features.filter((feature) => feature.id !== "AQ");

    const projection = geoEqualEarth().fitExtent(
      [
        [12, 12],
        [MAP_WIDTH - 12, MAP_HEIGHT - 12],
      ],
      {
        type: "FeatureCollection",
        features,
      } as unknown as GeoPermissibleObjects,
    );
    const path = geoPath(projection);

    const byCode = new Map<string, MapPoint>();
    for (const point of points) {
      const code = countryCode(point.country);
      if (code) byCode.set(code, point);
    }

    const shapes: MapShape[] = [];
    for (const feature of features) {
      const code = feature.id ?? "";
      const point = code ? byCode.get(code) : undefined;
      const count = point?.count ?? 0;
      const d = path(feature as unknown as GeoPermissibleObjects);
      if (!d) continue;
      shapes.push({
        code,
        name: feature.properties.name,
        count,
        d,
        fill: count
          ? interpolateRgb("#28527c", "#f2d38a")(Math.pow(count / max, 0.55))
          : "#13263f",
      });
    }

    const radius = scaleSqrt().domain([1, max]).range([4.5, 21]);
    const bubbles: MapBubble[] = [];
    for (const point of points) {
      const centroid = countryCentroid(point.country);
      const projected = centroid ? projection(centroid) : null;
      if (!projected) continue;
      bubbles.push({
        point,
        x: projected[0],
        y: projected[1],
        r: radius(point.count),
      });
    }
    bubbles.sort((a, b) => a.point.count - b.point.count);

    return {
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      sphere:
        path({ type: "Sphere" } as unknown as GeoPermissibleObjects) ?? "",
      graticule:
        path(geoGraticule10() as unknown as GeoPermissibleObjects) ?? "",
      shapes,
      bubbles,
      max,
    };
  }

  showMapTip(bubble: MapBubble): void {
    if (!this.map) return;
    const leftPct = (bubble.x / this.map.width) * 100;
    const topPct = (bubble.y / this.map.height) * 100;
    this.mapTip = {
      leftPct: Math.min(86, Math.max(14, leftPct)),
      topPct,
      below: topPct < 30,
      point: bubble.point,
    };
  }

  hideMapTip(): void {
    this.mapTip = null;
  }

  hoverCountry(code: string): void {
    this.hoveredCountry = code;
  }

  clearHoverCountry(): void {
    this.hoveredCountry = "";
  }

  mapFillFor(shape: MapShape): string {
    return this.hoveredCountry === shape.code && shape.count
      ? "#ffe0a3"
      : shape.fill;
  }

  /* ── Growth (multi-series line) ───────────────────────── */

  private buildGrowth(rows: MonthlyActivity[]): MultiChart {
    const width = 720;
    const height = 270;
    const plotLeft = 38;
    const plotRight = width - 16;
    const plotTop = 18;
    const plotBottom = height - 30;
    const x = scalePoint<string>()
      .domain(rows.map((row) => this.monthLabel(row.key, row.label)))
      .range([plotLeft, plotRight]);
    const max = Math.max(
      1,
      ...rows.flatMap((row) => [
        row.accreditation,
        row.readiness,
        row.leads,
      ]),
    );
    const y = scaleLinear()
      .domain([0, max])
      .nice()
      .range([plotBottom, plotTop]);

    const definitions: { key: StreamKey; label: string; color: string }[] = [
      { key: "accreditation", label: this.streamLabel("accreditation"), color: "#38bdf8" },
      { key: "readiness", label: this.streamLabel("readiness"), color: "#e8c06a" },
      { key: "leads", label: this.streamLabel("leads"), color: "#34d399" },
    ];

    const months = rows.map((row) => this.monthLabel(row.key, row.label));
    const series = definitions.map((definition) => {
      const points: ChartPoint[] = rows.map((row, index) => ({
        x: x(months[index]) ?? plotLeft,
        y: y(row[definition.key]),
        value: row[definition.key],
        label: months[index],
      }));
      return {
        key: definition.key,
        label: definition.label,
        color: definition.color,
        line:
          line<ChartPoint>()
            .x((point) => point.x)
            .y((point) => point.y)
            .curve(curveMonotoneX)(points) ?? "",
        area:
          area<ChartPoint>()
            .x((point) => point.x)
            .y0(plotBottom)
            .y1((point) => point.y)
            .curve(curveMonotoneX)(points) ?? "",
        points,
      };
    });

    return {
      width,
      height,
      series,
      yTicks: y.ticks(4).map((value) => ({ y: y(value), label: String(value) })),
      xLabels: rows.map((row, index) => ({
        x: x(months[index]) ?? plotLeft,
        label: months[index],
      })),
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
    };
  }

  onGrowthMove(event: MouseEvent): void {
    const chart = this.growth;
    if (!chart || !chart.xLabels.length) return;
    const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)),
    );
    const index = Math.round(ratio * (chart.xLabels.length - 1));
    this.growthHover = {
      index,
      leftPct: (chart.xLabels[index].x / chart.width) * 100,
      month: chart.xLabels[index].label,
      rows: chart.series.map((item) => ({
        label: item.label,
        color: item.color,
        value: item.points[index]?.value ?? 0,
      })),
    };
  }

  clearGrowthHover(): void {
    this.growthHover = null;
  }

  growthGuideX(): number {
    return this.growth?.xLabels[this.growthHover?.index ?? 0]?.x ?? 0;
  }

  /* ── Stacked monthly volume ───────────────────────────── */

  private buildStacked(rows: MonthlyActivity[]): StackChart {
    const width = 640;
    const height = 250;
    const plotLeft = 32;
    const plotRight = width - 12;
    const plotTop = 16;
    const plotBottom = height - 30;
    const keys: { key: StreamKey; color: string; label: string }[] = [
      { key: "accreditation", color: "#38bdf8", label: this.streamLabel("accreditation") },
      { key: "readiness", color: "#e8c06a", label: this.streamLabel("readiness") },
      { key: "leads", color: "#34d399", label: this.streamLabel("leads") },
    ];
    const months = rows.map((row) => this.monthLabel(row.key, row.label));
    const x = scaleBand<string>()
      .domain(months)
      .range([plotLeft, plotRight])
      .padding(0.34);
    const max = Math.max(1, ...rows.map((row) => row.total));
    const y = scaleLinear()
      .domain([0, max])
      .nice()
      .range([plotBottom, plotTop]);

    const bars = rows.map((row, index) => {
      const month = months[index];
      let cumulative = 0;
      const segments: StackSegment[] = [];
      for (const key of keys) {
        const value = row[key.key];
        if (!value) continue;
        const bottom = y(cumulative);
        cumulative += value;
        const top = y(cumulative);
        segments.push({
          x: x(month) ?? 0,
          y: top,
          width: x.bandwidth(),
          height: Math.max(0, bottom - top),
          color: key.color,
          value,
          label: key.label,
        });
      }
      return {
        label: month,
        total: row.total,
        x: x(month) ?? 0,
        width: x.bandwidth(),
        segments,
      };
    });

    return {
      width,
      height,
      bars,
      yTicks: y.ticks(4).map((value) => ({ y: y(value), label: String(value) })),
      plotLeft,
      plotRight,
      baseline: plotBottom,
    };
  }

  /* ── Funding area ─────────────────────────────────────── */

  private buildChart(
    rows: StatRank[],
    tickFormat: (value: number) => string,
  ): ChartGeometry {
    const width = 640;
    const height = 250;
    const pad = 32;
    const top = 16;
    const maxValue = Math.max(1, ...rows.map((row) => row.value));
    const x = scaleLinear()
      .domain([0, Math.max(1, rows.length - 1)])
      .range([pad, width - pad]);
    const y = scaleLinear()
      .domain([0, maxValue])
      .nice()
      .range([height - pad, top]);

    const linePath =
      line<StatRank>()
        .x((_, index) => x(index))
        .y((row) => y(row.value))
        .curve(curveMonotoneX)(rows) ?? "";
    const areaPath =
      area<StatRank>()
        .x((_, index) => x(index))
        .y0(height - pad)
        .y1((row) => y(row.value))
        .curve(curveMonotoneX)(rows) ?? "";
    const average =
      rows.length > 0
        ? rows.reduce((total, row) => total + row.value, 0) / rows.length
        : 0;

    return {
      line: linePath,
      area: areaPath,
      points: rows.map((row, index) => ({
        x: x(index),
        y: y(row.value),
        value: row.value,
        label: this.shortMonth(row.label),
      })),
      yTicks: y.ticks(4).map((value) => ({
        label: tickFormat(value),
        y: y(value),
      })),
      max: maxValue,
      avgY: rows.length ? y(average) : null,
    };
  }

  /* ── Donut ────────────────────────────────────────────── */

  private buildDonut(rows: StatRank[]): DonutSlice[] {
    if (!rows.length) return [];
    const pieGenerator = pie<StatRank>()
      .value((row) => row.value)
      .sort(null);
    const arcGenerator = arc<unknown>()
      .innerRadius(52)
      .outerRadius(80)
      .cornerRadius(4)
      .padAngle(0.02);

    return pieGenerator(rows).map((segment, index) => ({
      path: arcGenerator(segment as never) ?? "",
      color: this.colorAt(index),
      label: this.dataLabel(segment.data.label, this.entityLabelKeys),
      value: segment.data.value,
    }));
  }

  hoverDonut(slice: DonutSlice | null): void {
    this.donutHover = slice;
  }

  /* ── Gauges ───────────────────────────────────────────── */

  private buildGauge(pct: number, color: string): Gauge {
    const start = -Math.PI * 0.75;
    const sweep = Math.PI * 1.5;
    const value = Math.max(0, Math.min(100, pct));
    return {
      background:
        arc<unknown>()({
          innerRadius: 44,
          outerRadius: 57,
          startAngle: start,
          endAngle: start + sweep,
          cornerRadius: 6,
        }) ?? "",
      foreground:
        arc<unknown>()({
          innerRadius: 44,
          outerRadius: 57,
          startAngle: start,
          endAngle: start + sweep * (value / 100),
          cornerRadius: 6,
          padAngle: value > 0 ? 0.01 : 0,
        }) ?? "",
      value,
      color,
    };
  }

  /* ── Budget & country rows ────────────────────────────── */

  private buildMoneyRows(rows: StatRank[], total: number): MoneyRow[] {
    const max = Math.max(1, ...rows.map((row) => row.value));
    return rows.map((row, index) => ({
      label: this.dataLabel(row.label, this.budgetLabelKeys),
      value: row.value,
      display: this.formatMoney(row.value),
      pct: Math.round((row.value / max) * 100),
      color: this.colorAt(index),
    }));
  }

  private buildCountryRows(rows: CountryBreakdown[]): MoneyRow[] {
    const max = Math.max(1, ...rows.map((row) => row.total));
    return rows.map((row) => ({
      label: this.countryName(row.country),
      value: row.total,
      display: this.formatNumber(row.total),
      pct: Math.round((row.total / max) * 100),
      color: "#38bdf8",
    }));
  }

  /* ── Score histogram ──────────────────────────────────── */

  private buildScoreChart(rows: StatRank[], average: number): ScoreChart {
    const width = 420;
    const height = 190;
    const padLeft = 24;
    const padRight = 10;
    const padTop = 18;
    const padBottom = 26;
    const x = scaleBand<string>()
      .domain(rows.map((row) => row.label))
      .range([padLeft, width - padRight])
      .padding(0.32);
    const max = Math.max(1, ...rows.map((row) => row.value));
    const y = scaleLinear()
      .domain([0, max])
      .nice()
      .range([height - padBottom, padTop]);
    const bars: ScoreBar[] = rows.map((row) => {
      const top = y(row.value);
      return {
        x: x(row.label) ?? 0,
        y: top,
        width: x.bandwidth(),
        height: Math.max(0, height - padBottom - top),
        label: row.label,
        value: row.value,
      };
    });

    return {
      width,
      height,
      bars,
      baseline: height - padBottom,
      avgY: average > 0 ? y(average) : null,
    };
  }

  /* ── Funnel ───────────────────────────────────────────── */

  private buildFunnel(rows: StatRank[]): FunnelRow[] {
    const first = Math.max(1, rows[0]?.value ?? 0);
    return rows.map((row, index) => ({
      label: this.dataLabel(row.label, FUNNEL_LABEL_KEYS),
      value: row.value,
      widthPct: Math.max(6, Math.round((row.value / first) * 100)),
      conversion:
        index === 0 ? null : Math.round((row.value / first) * 100),
    }));
  }

  /* ── Status helpers ───────────────────────────────────── */

  get screeningRows(): StatusRow[] {
    const counts = this.stats?.statusCounts ?? {};
    return ["Passed", "Pending", "Failed"].map((label) => ({
      label: this.t(`DASHBOARD.STATUS.${label.toUpperCase()}`),
      value: counts[label] ?? 0,
      tone: label.toLowerCase(),
    }));
  }

  get leadStatusRows(): StatusRow[] {
    const counts = this.stats?.leadStatusCounts ?? {};
    return ["Qualified", "Contacted", "Pending", "Rejected"].map((label) => ({
      label: this.t(`DASHBOARD.STATUS.${label.toUpperCase()}`),
      value: counts[label] ?? 0,
      tone: label.toLowerCase(),
    }));
  }

  get sourceRows(): StatRank[] {
    const counts = this.stats?.leadSourceCounts ?? {};
    return Object.entries(counts)
      .map(([label, value]) => ({
        label: this.dataLabel(label.toLowerCase(), SOURCE_LABEL_KEYS),
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }

  userRows(counts: Record<string, number>): StatusRow[] {
    return ["active", "pending", "suspended"].map((label) => ({
      label: this.t(`DASHBOARD.USERS.${label.toUpperCase()}`),
      value: counts[label] ?? 0,
      tone: label,
    }));
  }

  roleRows(counts: Record<string, number>): StatRank[] {
    return Object.entries(counts)
      .map(([label, value]) => ({
        label: this.t(`DASHBOARD.ROLES.${label.toUpperCase()}`),
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }

  get activeUsers(): number {
    return this.stats?.userCounts?.["active"] ?? 0;
  }

  get profileLeads(): number {
    return this.stats?.leadSourceCounts?.["profile"] ?? 0;
  }

  /* ── Formatting ───────────────────────────────────────── */

  get locale(): string {
    const lang = this.translate.currentLang();
    return LANGUAGE_LOCALES[lang ?? "en"] ?? "en-US";
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  private streamLabel(key: StreamKey): string {
    const suffix =
      key === "accreditation"
        ? "ACCREDITATION"
        : key === "readiness"
          ? "READINESS"
          : "ENQUIRIES";
    return this.t(`DASHBOARD.KPI.${suffix}`);
  }

  private monthLabel(key: string, fallback: string): string {
    if (!key) return fallback;
    const date = new Date(`${key}-01T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return fallback;
    return new Intl.DateTimeFormat(this.locale, {
      month: "short",
      timeZone: "UTC",
    }).format(date);
  }

  private shortMonth(label: string): string {
    const index = EN_MONTHS.indexOf(label);
    if (index < 0) return label;
    return new Intl.DateTimeFormat(this.locale, {
      month: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2024, index, 1)));
  }

  private dataLabel(label: string, map: Record<string, string>): string {
    const key = map[label];
    if (!key) return label;
    const translated = this.t(key);
    return translated === key ? label : translated;
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat(this.locale, {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value || 0);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat(this.locale).format(value || 0);
  }

  formatDate(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleDateString(this.locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  }

  percent(value: number, total: number): number {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  }

  countryName(name: string): string {
    return countryLabel(name, this.locale);
  }

  countryNameByCode(code: string, fallback: string): string {
    if (!code) return fallback;
    try {
      const label = new Intl.DisplayNames([this.locale], {
        type: "region",
      }).of(code);
      return label || fallback;
    } catch {
      return fallback;
    }
  }

  entityLabel(label: string): string {
    return this.dataLabel(label, this.entityLabelKeys);
  }

  colorAt(index: number): string {
    return this.palette[index % this.palette.length];
  }

  trendLabel(delta: number | null): string {
    if (delta === null) return this.t("DASHBOARD.NEW");
    if (delta === 0) return this.t("DASHBOARD.FLAT");
    return `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta)}%`;
  }

  trendTone(delta: number | null): string {
    if (delta === null || delta === 0) return "flat";
    return delta > 0 ? "up" : "down";
  }
}
