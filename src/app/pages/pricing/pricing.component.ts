import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BreadcrumbService } from '../../services/breadcrumb.service';

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface Plan {
  id: string;
  icon: string;
  name: string;
  tagline: string;
  price: string | null;
  period: string | null;
  currency: string | null;
  featured: boolean;
  badge?: string;
  ctaLabel: string;
  ctaLink: string;
  ctaExternal?: boolean;
  features: PlanFeature[];
  accentClass: string;
}

export interface FundTier {
  amountUSD: number;
  label: string;
  rate: number;
  feeUSD: number;
  note?: string;
}

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.css',
})
export class PricingComponent implements OnInit, OnDestroy {
  constructor(private breadcrumbService: BreadcrumbService) {}

  ngOnInit(): void {
    this.breadcrumbService.setContext('Consulting Engagements');
  }

  ngOnDestroy(): void {
    this.breadcrumbService.clearContext();
  }

  readonly plans: Plan[] = [
    {
      id: 'free',
      icon: '🌱',
      name: 'Initial Assessment',
      tagline: 'Evaluate your baseline eligibility and structural readiness',
      price: null,
      period: null,
      currency: null,
      featured: false,
      ctaLabel: 'Start Assessment',
      ctaLink: '/stage1',
      accentClass: 'plan-free',
      features: [
        { text: 'Access to Stage 1 questionnaire', included: true },
        { text: 'Eligibility self-assessment tools', included: true },
        { text: 'GCF criteria overview & documentation', included: true },
        { text: 'Document requirements checklist', included: true },
        { text: 'Knowledge base & resources', included: true },
        { text: 'Platform updates & news', included: true },
        { text: 'Expert review & feedback', included: false },
        { text: 'Stage 2 application support', included: false },
      ],
    },
    {
      id: 'essentials',
      icon: '🔍',
      name: 'Strategic Advisory',
      tagline: 'Critical gap analysis and guided preparation to secure institutional readiness',
      price: '2,900',
      period: 'per assessment',
      currency: '€',
      featured: false,
      ctaLabel: 'Request Advisory',
      ctaLink: '/stage1',
      accentClass: 'plan-essentials',
      features: [
        { text: 'Everything in Initial Assessment', included: true },
        { text: 'Expert review of Stage 1 framework', included: true },
        { text: 'Personalized gap analysis report', included: true },
        { text: 'Document preparation guidance', included: true },
        { text: '2 rigorous revision rounds included', included: true },
        { text: 'Response to GCF reviewer comments', included: true },
        { text: '30-day post-submission email support', included: true },
        { text: 'Stage 2 application support', included: false },
      ],
    },
    {
      id: 'professional',
      icon: '🚀',
      name: 'Full-Cycle Consulting',
      tagline: 'Comprehensive strategy and project planning to secure multi-million funding',
      price: '8,500',
      period: 'engagement base fee',
      currency: '€',
      featured: true,
      badge: 'Recommended Engagement',
      ctaLabel: 'Start Engagement',
      ctaLink: '/stage1',
      accentClass: 'plan-professional',
      features: [
        { text: 'Everything in Strategic Advisory', included: true },
        { text: 'Full Stage 2 application engineering', included: true },
        { text: 'Project concept note & proposal development', included: true },
        { text: 'Financial model & structuring', included: true },
        { text: 'E&S safeguards compliance guidance', included: true },
        { text: 'Unlimited strategic revision rounds', included: true },
        { text: 'Dedicated Lead Accreditation Consultant', included: true },
        { text: '6-month post-submission strategy support', included: true },
      ],
    },
    {
      id: 'enterprise',
      icon: '🏛️',
      name: 'Institutional Retainer',
      tagline: 'Exclusive, long-term strategic partnership for complex, multi-project portfolios',
      price: null,
      period: null,
      currency: null,
      featured: false,
      ctaLabel: 'Schedule Consultation',
      ctaLink: 'mailto:contact@averacapitalaccess.com',
      ctaExternal: true,
      accentClass: 'plan-enterprise',
      features: [
        { text: 'Everything in Full-Cycle Consulting', included: true },
        { text: 'Multi-project portfolio orchestration', included: true },
        { text: 'On-site workshops & executive training', included: true },
        { text: 'Deep institutional capacity building', included: true },
        { text: 'Priority review and rapid turnaround', included: true },
        { text: 'Strategic GCF network positioning', included: true },
        { text: 'Ongoing retainer advisory arrangements', included: true },
        { text: 'Executive-level policy advisory', included: true },
      ],
    },
  ];

  readonly fundTiers: FundTier[] = [
    { amountUSD: 1_000_000, label: '$1,000,000', rate: 3, feeUSD: 30_000 },
    { amountUSD: 5_000_000, label: '$5,000,000', rate: 2, feeUSD: 100_000 },
    { amountUSD: 10_000_000, label: '$10,000,000', rate: 1.5, feeUSD: 150_000 },
    { amountUSD: 25_000_000, label: '$25,000,000', rate: 1, feeUSD: 250_000 },
    { amountUSD: 50_000_000, label: '$50,000,000', rate: 0.75, feeUSD: 375_000 },
    {
      amountUSD: 100_000_000,
      label: '$100,000,000',
      rate: 0.5,
      feeUSD: 500_000,
      note: 'Lowest rate',
    },
  ];

  /** Highest commission rate, used to scale the rate bars in the table. */
  readonly maxTierRate = Math.max(...this.fundTiers.map((tier) => tier.rate));

  get quoteMailto(): string {
    return 'mailto:contact@averacapitalaccess.com?subject=Commission%20quote%20for%20a%20GCF%20project';
  }
}
