export interface StatRank {
  label: string;
  value: number;
}

export interface MapPoint {
  country: string;
  count: number;
  organizations: number;
  accreditation: number;
  readiness: number;
  leads: number;
}

export interface CountryBreakdown {
  country: string;
  total: number;
  organizations: number;
  accreditation: number;
  readiness: number;
  leads: number;
}

export interface MonthlyActivity {
  key: string;
  label: string;
  accreditation: number;
  readiness: number;
  leads: number;
  organizations: number;
  users: number;
  total: number;
}

export interface RecentActivity {
  id: string;
  label: string;
  sub: string;
  date: string;
  route: string;
}

/** Aggregated read-only metrics returned by `/api/admin/stats`. */
export interface AdminStats {
  organizations: number;
  countries: number;
  accreditationSubmissions: number;
  readinessSubmissions: number;
  stage2Submissions: number;
  leads: number;
  users: number;
  fundingRequestedUSD: number;
  budgetPlannedUSD: number;
  avgReadinessScore: number;
  avgFundingPerSubmission: number;
  statusCounts: Record<string, number>;
  leadStatusCounts: Record<string, number>;
  leadSourceCounts: Record<string, number>;
  userCounts: Record<string, number>;
  roleCounts: Record<string, number>;
  entityTypes: StatRank[];
  topCountries: StatRank[];
  countryBreakdown: CountryBreakdown[];
  mapPoints: MapPoint[];
  monthly: StatRank[];
  monthlySeries: MonthlyActivity[];
  fundingByMonth: StatRank[];
  budgetByCategory: StatRank[];
  scoreBuckets: StatRank[];
  funnel: StatRank[];
  conversionRate: number;
  recent: RecentActivity[];
}
