import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
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
      this.mapMarkers = (this.stats.mapPoints ?? [])
        .map((point) => {
          const coords = countryMarker(point.country);
          return coords ? { ...point, ...coords } : null;
        })
        .filter((point): point is Marker => point !== null)
        .sort((a, b) => b.count - a.count);
    } catch {
      this.error = "Could not load the system statistics. Please try again.";
    } finally {
      this.loading = false;
    }
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

  donutBackground(rows: StatRank[]): string {
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    if (!total) return "rgba(255,255,255,0.06)";
    let start = 0;
    const stops = rows.map((row, index) => {
      const end = start + (row.value / total) * 100;
      const segment = `${this.colorAt(index)} ${start}% ${end}%`;
      start = end;
      return segment;
    });
    return `conic-gradient(${stops.join(", ")})`;
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

  get maxMonthly(): number {
    return Math.max(1, ...(this.stats?.monthly ?? []).map((row) => row.value));
  }

  get activeUsers(): number {
    return this.stats?.userCounts?.["active"] ?? 0;
  }

  get profileLeads(): number {
    return this.stats?.leadSourceCounts?.["profile"] ?? 0;
  }
}
