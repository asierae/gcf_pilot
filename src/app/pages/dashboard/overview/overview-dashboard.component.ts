import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { arc, area, curveMonotoneX, line, pie, scaleLinear } from "d3";
import { ApiService } from "../../../services/api.service";
import { BreadcrumbService } from "../../../services/breadcrumb.service";
import { AdminStats, StatRank } from "../../../models/admin-stats.model";
import { countryMarker } from "../../../shared/data/country-coordinates";

interface Marker {
  country: string;
  count: number;
  left: number;
  top: number;
}

interface StatusRow {
  label: string;
  value: number;
  tone: string;
}

interface ChartPoint extends StatRank {
  x: number;
  y: number;
}

interface ChartGeometry {
  line: string;
  area: string;
  points: ChartPoint[];
  yTicks: { label: string; y: number }[];
  max: number;
}

interface DonutSlice {
  path: string;
  color: string;
  label: string;
  value: number;
}

const CHART_WIDTH = 600;
const CHART_HEIGHT = 180;
const CHART_PAD = 24;

@Component({
  selector: "app-overview-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./overview-dashboard.component.html",
  styleUrl: "./overview-dashboard.component.css",
})
export class OverviewDashboardComponent implements OnInit {
  stats: AdminStats | null = null;
  loading = true;
  error = "";
  mapMarkers: Marker[] = [];
  lastUpdated = "";

  activityChart: ChartGeometry | null = null;
  fundingChart: ChartGeometry | null = null;
  donutSlices: DonutSlice[] = [];

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
  readonly chartWidth = CHART_WIDTH;
  readonly chartRight = CHART_WIDTH - CHART_PAD;
  readonly chartBaseline = CHART_HEIGHT - CHART_PAD;

  constructor(
    private api: ApiService,
    private breadcrumbService: BreadcrumbService,
  ) {}

  ngOnInit(): void {
    this.breadcrumbService.setContext("Dashboard");
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      this.stats = await this.api.getAdminStats();
      this.lastUpdated = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      this.mapMarkers = (this.stats.mapPoints ?? [])
        .map((point) => {
          const coords = countryMarker(point.country);
          return coords ? { ...point, ...coords } : null;
        })
        .filter((point): point is Marker => point !== null)
        .sort((a, b) => b.count - a.count);
      this.donutSlices = this.buildDonut(this.stats.entityTypes ?? []);
      this.activityChart = this.buildChart(
        this.stats.monthly ?? [],
        (value) => String(value),
      );
      this.fundingChart = this.buildChart(
        this.stats.fundingByMonth ?? [],
        (value) => this.formatMoney(value),
      );
    } catch {
      this.error = "Could not load the system statistics. Please try again.";
    } finally {
      this.loading = false;
    }
  }

  private buildChart(
    rows: StatRank[],
    tickFormat: (value: number) => string,
  ): ChartGeometry {
    const maxValue = Math.max(1, ...rows.map((row) => row.value));
    const x = scaleLinear()
      .domain([0, Math.max(1, rows.length - 1)])
      .range([CHART_PAD, CHART_WIDTH - CHART_PAD]);
    const y = scaleLinear()
      .domain([0, maxValue])
      .range([CHART_HEIGHT - CHART_PAD, CHART_PAD]);

    const linePath =
      line<StatRank>()
        .x((_, index) => x(index))
        .y((row) => y(row.value))
        .curve(curveMonotoneX)(rows) ?? "";
    const areaPath =
      area<StatRank>()
        .x((_, index) => x(index))
        .y0(CHART_HEIGHT - CHART_PAD)
        .y1((row) => y(row.value))
        .curve(curveMonotoneX)(rows) ?? "";

    return {
      line: linePath,
      area: areaPath,
      points: rows.map((row, index) => ({
        ...row,
        x: x(index),
        y: y(row.value),
      })),
      yTicks: y.ticks(4).map((value) => ({
        label: tickFormat(value),
        y: y(value),
      })),
      max: maxValue,
    };
  }

  private buildDonut(rows: StatRank[]): DonutSlice[] {
    if (!rows.length) return [];
    const pieGenerator = pie<StatRank>()
      .value((row) => row.value)
      .sort(null);
    const arcGenerator = arc<any>()
      .innerRadius(46)
      .outerRadius(70)
      .cornerRadius(3);

    return pieGenerator(rows).map((segment, index) => ({
      path: arcGenerator(segment) ?? "",
      color: this.colorAt(index),
      label: segment.data.label,
      value: segment.data.value,
    }));
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value || 0);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat("en-US").format(value || 0);
  }

  formatDate(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  }

  percent(value: number, total: number): number {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  }

  colorAt(index: number): string {
    return this.palette[index % this.palette.length];
  }

  get screeningRows(): StatusRow[] {
    const counts = this.stats?.statusCounts ?? {};
    return ["Passed", "Pending", "Failed"].map((label) => ({
      label,
      value: counts[label] ?? 0,
      tone: label.toLowerCase(),
    }));
  }

  get leadStatusRows(): StatusRow[] {
    const counts = this.stats?.leadStatusCounts ?? {};
    return ["Qualified", "Contacted", "Pending", "Rejected"].map((label) => ({
      label,
      value: counts[label] ?? 0,
      tone: label.toLowerCase(),
    }));
  }

  get sourceRows(): StatRank[] {
    const counts = this.stats?.leadSourceCounts ?? {};
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  userRows(counts: Record<string, number>): StatusRow[] {
    return ["active", "pending", "suspended"].map((label) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      value: counts[label] ?? 0,
      tone: label,
    }));
  }

  roleRows(counts: Record<string, number>): StatRank[] {
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  get activeUsers(): number {
    return this.stats?.userCounts?.["active"] ?? 0;
  }

  get profileLeads(): number {
    return this.stats?.leadSourceCounts?.["profile"] ?? 0;
  }
}
