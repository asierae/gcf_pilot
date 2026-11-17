import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  ACCOUNTING_STANDARD_OPTIONS,
  AUDIT_OPINION_OPTIONS,
  BUDGET_CATEGORY_OPTIONS,
  BudgetCategory,
  DocumentKey,
  ENTITY_OPTIONS,
  GAP_FIELDS,
  OBJECTIVE_OPTIONS,
  POLICY_OPTIONS,
  PROCUREMENT_OPTIONS,
  PolicyStatus,
  QUARTERS,
  Quarter,
  ReadinessApplication,
  ReadinessObjective,
  UNIT_TYPE_OPTIONS,
  createEmptyApplication,
  createEmptyFmca,
} from './readiness-application.model';
import { AttachmentService } from '../../services/attachment.service';
import { AuthService } from '../../services/auth.service';
import { OrganizationService } from '../../services/organization.service';
import { StoredAttachment } from '../../models/attachment.model';
import { OrganizationRecord } from '../../models/organization.model';
import { resolveAttachmentUrl } from '../../shared/utils/attachment-url.util';
import {
  isOrganizationId,
  newOrganizationId,
  ORG_QUERY_PARAM,
  syncOrganizationId,
} from '../../shared/utils/organization.util';

interface WizardStep {
  n: number;
  short: string;
  title: string;
  subtitle: string;
}

interface DocRequirement {
  key: DocumentKey;
  label: string;
  description: string;
  conditional: boolean;
}

interface RiskResult {
  level: 'low' | 'medium' | 'high';
  label: string;
  summary: string;
  reasons: string[];
}

interface BudgetWarning {
  tone: 'warn' | 'info';
  text: string;
}

const STORAGE_KEY = 'gcf_readiness_intake_v1';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-readiness-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './readiness-wizard.component.html',
  styleUrl: './readiness-wizard.component.css',
})
export class ReadinessWizardComponent implements OnInit, OnDestroy {
  readonly steps: WizardStep[] = [
    {
      n: 1,
      short: 'Eligibility',
      title: 'Eligibility & Readiness Setup',
      subtitle: 'Metadata, NDA focal point and GCF Readiness 2024–2027 alignment.',
    },
    {
      n: 2,
      short: 'Institutional',
      title: 'Institutional Profile & Gap Matrix',
      subtitle: 'Map your accreditation gaps across fiduciary, ESS and gender standards.',
    },
    {
      n: 3,
      short: 'Narrative',
      title: 'Technical Narrative & Theory of Change',
      subtitle: 'Build the strategic justification GCF reviewers expect to see.',
    },
    {
      n: 4,
      short: 'Logframe',
      title: 'Dynamic Logframe & Quarterly Workplan',
      subtitle: 'Outcomes, outputs and activities with a visual Q1–Q8 Gantt timeline.',
    },
    {
      n: 5,
      short: 'Budget',
      title: 'Activity-Based Budget & Procurement',
      subtitle: 'Every cost must trace to a logframe activity. Guardrails run live.',
    },
    {
      n: 6,
      short: 'FMCA',
      title: 'FMCA Fiduciary Due Diligence',
      subtitle: 'Required when you act as your own Delivery Partner.',
    },
    {
      n: 7,
      short: 'Vault & Export',
      title: 'Legal PDF Vault & JSON Export',
      subtitle: 'Attach statutory documents and generate the GCF-ready JSON package.',
    },
  ];

  readonly entityOptions = ENTITY_OPTIONS;
  readonly objectiveOptions = OBJECTIVE_OPTIONS;
  readonly policyOptions = POLICY_OPTIONS;
  readonly gapFields = GAP_FIELDS;
  readonly quarters = QUARTERS;
  readonly budgetCategoryOptions = BUDGET_CATEGORY_OPTIONS;
  readonly unitTypeOptions = UNIT_TYPE_OPTIONS;
  readonly procurementOptions = PROCUREMENT_OPTIONS;
  readonly accountingStandardOptions = ACCOUNTING_STANDARD_OPTIONS;
  readonly auditOpinionOptions = AUDIT_OPINION_OPTIONS;

  readonly documentRequirements: DocRequirement[] = [
    {
      key: 'ndaNoObjectionLetterPdf',
      label: 'NDA No-Objection Letter',
      description: 'Signed letter from the National Designated Authority endorsing the proposal.',
      conditional: false,
    },
    {
      key: 'legalRegistrationStatutesPdf',
      label: 'Legal registration & statutes',
      description: 'Certificate of incorporation and current constitutional documents.',
      conditional: false,
    },
    {
      key: 'organogramPdf',
      label: 'Organogram',
      description: 'Current organizational chart with reporting lines and unit mandates.',
      conditional: false,
    },
    {
      key: 'auditedFinancialStatements3YrsPdf',
      label: 'Audited financial statements (3 years)',
      description: 'Required for FMCA: the three most recent external audit reports.',
      conditional: true,
    },
    {
      key: 'financeAndProcurementManualsPdf',
      label: 'Finance & procurement manuals',
      description: 'Approved policies covering financial control and procurement thresholds.',
      conditional: true,
    },
    {
      key: 'bankAccountConfirmationPdf',
      label: 'Bank account confirmation',
      description: 'Bank letter confirming the dedicated GCF account and signatories.',
      conditional: true,
    },
  ];

  application: ReadinessApplication = createEmptyApplication();
  currentStep = 1;
  attempted = new Set<number>();
  /**
   * Organization id. It is the R2 folder (`organizations/<id>/readiness/`),
   * the draft key and the readiness record key.
   */
  organizationId = newOrganizationId();
  organization: OrganizationRecord | null = null;
  /** True once the organization exists: name and acronym are read-only. */
  identityLocked = false;
  acronymTaken = false;
  acronymChecking = false;
  submitting = false;
  submittedAt: string | null = null;
  submitError = '';
  docMeta: Partial<Record<DocumentKey, string>> = {};
  docAttachments: Partial<Record<DocumentKey, StoredAttachment>> = {};
  docUploading: Partial<Record<DocumentKey, boolean>> = {};
  docErrors: Partial<Record<DocumentKey, string>> = {};
  errorSummary = '';
  saveState: 'saved' | 'saving' | 'error' = 'saved';
  previewOpen = false;
  previewJson = '';
  copyLabel = 'Copy JSON';

  private readonly attachmentService = inject(AttachmentService);
  private readonly authService = inject(AuthService);
  private readonly organizationService = inject(OrganizationService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private acronymTimer: ReturnType<typeof setTimeout> | null = null;
  private activitySeq = 100;
  private draftReady = false;
  private localSavedAt: string | null = null;

  async ngOnInit(): Promise<void> {
    this.organizationId = this.resolveOrganizationId();
    syncOrganizationId(this.location, this.organizationId);

    this.restoreLocalDraft();
    this.refreshActivitySequence();

    await this.loadServerState();
    this.draftReady = true;
  }

  ngOnDestroy(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      clearTimeout(this.acronymTimer ?? undefined);
      this.persist();
    }
  }

  /**
   * Signed-in applicants work on their organization. Anonymous visitors get a
   * generated id in the URL (`?org=...`) that also restores their draft.
   */
  private resolveOrganizationId(): string {
    const user = this.authService.currentUserValue;
    if (user?.organizationId) {
      return user.organizationId;
    }

    const fromUrl = this.route.snapshot.queryParamMap.get(ORG_QUERY_PARAM);
    if (isOrganizationId(fromUrl)) {
      return fromUrl as string;
    }

    const stored = this.readLocalDraft()?.__id;
    return isOrganizationId(stored) ? (stored as string) : newOrganizationId();
  }

  private readLocalDraft():
    | (Partial<ReadinessApplication> & {
        __id?: string;
        __docMeta?: Partial<Record<DocumentKey, string>>;
        __docAttachments?: Partial<Record<DocumentKey, StoredAttachment>>;
        __savedAt?: string;
      })
    | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  private restoreLocalDraft(): void {
    const saved = this.readLocalDraft();
    if (!saved) return;

    // Ignore a cache that belongs to a different organization link.
    if (
      saved.__id &&
      saved.__id !== this.organizationId &&
      !this.authService.currentUserValue?.organizationId
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    this.applySavedApplication(saved);
    this.localSavedAt = saved.__savedAt ?? null;
  }

  private async loadServerState(): Promise<void> {
    const [forms, draft] = await Promise.all([
      this.organizationService.forms(this.organizationId),
      this.organizationService.loadDraft('readiness', this.organizationId),
    ]);

    const organization = forms.organization;
    if (organization) {
      this.organization = organization;
      this.identityLocked = true;
      this.applyOrganizationProfile(organization);
    }

    if (forms.readiness?.submittedAt) {
      this.submittedAt = forms.readiness.submittedAt;
    }

    if (draft?.data) {
      const serverIsNewer =
        !this.localSavedAt || new Date(draft.updatedAt) >= new Date(this.localSavedAt);
      if (serverIsNewer) {
        this.applySavedApplication(draft.data as Partial<ReadinessApplication>);
      }
    }
  }

  private applySavedApplication(
    saved: Partial<ReadinessApplication> & {
      __docMeta?: Partial<Record<DocumentKey, string>>;
      __docAttachments?: Partial<Record<DocumentKey, StoredAttachment>>;
    },
  ): void {
    const base = createEmptyApplication();
    this.application = {
      metadata: { ...base.metadata, ...(saved.metadata ?? {}) },
      institutionalProfile: {
        ...base.institutionalProfile,
        ...(saved.institutionalProfile ?? {}),
        gapMatrix: {
          ...base.institutionalProfile.gapMatrix,
          ...(saved.institutionalProfile?.gapMatrix ?? {}),
        },
      },
      narrative: { ...base.narrative, ...(saved.narrative ?? {}) },
      logframe: saved.logframe ?? base.logframe,
      budget: { ...base.budget, ...(saved.budget ?? {}) },
      fmca: { ...createEmptyFmca(), ...(saved.fmca ?? {}) },
      documents: base.documents,
    };

    this.docAttachments = saved.__docAttachments ?? {};
    this.docMeta = saved.__docMeta ?? {};
    for (const [key, attachment] of Object.entries(this.docAttachments)) {
      if (attachment && !this.docMeta[key as DocumentKey]) {
        this.docMeta[key as DocumentKey] = attachment.name;
      }
    }
  }

  private applyOrganizationProfile(org: OrganizationRecord): void {
    const metadata = this.application.metadata;
    this.application.metadata = {
      ...metadata,
      organizationLegalName: org.name || metadata.organizationLegalName,
      organizationAcronym: org.acronym || metadata.organizationAcronym,
      country: org.country || metadata.country,
      entityType: (org.entityType as ReadinessApplication['metadata']['entityType']) || metadata.entityType,
    };
  }

  // ── Persistence ──────────────────────────────────────────────
  onUserInput(): void {
    this.errorSummary = '';
    this.submitError = '';
    this.scheduleSave();
  }

  onAcronymChange(): void {
    this.onUserInput();

    if (this.identityLocked) {
      this.acronymTaken = false;
      return;
    }

    const acronym = this.application.metadata.organizationAcronym.trim();
    if (this.acronymTimer) clearTimeout(this.acronymTimer);
    if (!acronym) {
      this.acronymTaken = false;
      return;
    }

    this.acronymChecking = true;
    this.acronymTimer = setTimeout(async () => {
      const available = await this.organizationService.isAcronymAvailable(
        acronym,
        this.organizationId,
      );
      // Ignore stale responses.
      if (this.application.metadata.organizationAcronym.trim() === acronym) {
        this.acronymTaken = !available;
        this.acronymChecking = false;
      }
    }, 450);
  }

  scheduleSave(): void {
    this.saveState = 'saving';
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.persist(), 450);
  }

  persist(): void {
    try {
      const payload = {
        ...this.draftPayload(),
        __id: this.organizationId,
        __savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      this.localSavedAt = payload.__savedAt;
      this.saveState = 'saved';
    } catch {
      this.saveState = 'error';
    }

    if (this.draftReady) {
      void this.saveServerDraft();
    }
  }

  private draftPayload(): Record<string, unknown> {
    const { documents: _documents, ...rest } = this.application;
    return {
      ...rest,
      __docMeta: this.docMeta,
      __docAttachments: this.docAttachments,
    };
  }

  private async saveServerDraft(): Promise<void> {
    try {
      await this.organizationService.saveDraft(
        'readiness',
        this.organizationId,
        this.draftPayload(),
      );
      if (this.saveState !== 'error') {
        this.saveState = 'saved';
      }
    } catch {
      this.saveState = 'error';
    }
  }

  get saveText(): string {
    if (this.saveState === 'saving') return 'Saving…';
    if (this.saveState === 'error') return 'Saved locally — cloud save failed';
    return 'Draft saved to your organization workspace';
  }

  // ── Navigation ───────────────────────────────────────────────
  get currentStepMeta(): WizardStep {
    return this.steps[this.currentStep - 1];
  }

  stepSkipped(n: number): boolean {
    return n === 6 && this.application.metadata.hasExternalDeliveryPartner;
  }

  stepVisible(n: number): boolean {
    return !this.stepSkipped(n);
  }

  stepValid(n: number): boolean {
    return this.stepIssues(n).length === 0;
  }

  stepState(n: number): 'active' | 'complete' | 'skipped' | 'todo' {
    if (this.stepSkipped(n)) return 'skipped';
    if (n === this.currentStep) return 'active';
    if (this.stepValid(n)) return 'complete';
    return 'todo';
  }

  get currentIssues(): string[] {
    return this.stepIssues(this.currentStep);
  }

  get showIssues(): boolean {
    return this.attempted.has(this.currentStep) && this.currentIssues.length > 0;
  }

  get progressPercent(): number {
    return Math.round(((this.currentStep - 1) / (this.steps.length - 1)) * 100);
  }

  get completedSteps(): number {
    return this.steps.filter((s) => this.stepVisible(s.n) && this.stepValid(s.n)).length;
  }

  goToStep(n: number): void {
    if (n === this.currentStep) return;
    if (this.stepSkipped(n)) return;
    if (n > this.currentStep && !this.allStepsBeforeValid(n)) {
      this.attempted.add(this.currentStep);
      this.errorSummary = 'Complete the current step before moving forward.';
      return;
    }
    this.currentStep = n;
    this.errorSummary = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextStep(): void {
    if (this.currentStep === 7) return;
    if (!this.stepValid(this.currentStep)) {
      this.attempted.add(this.currentStep);
      this.errorSummary = 'Please resolve the items below before continuing.';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (this.currentStep === 5) {
      this.goToStep(this.application.metadata.hasExternalDeliveryPartner ? 7 : 6);
      return;
    }
    this.goToStep(this.currentStep + 1);
  }

  previousStep(): void {
    if (this.currentStep === 1) return;
    if (this.currentStep === 7) {
      this.goToStep(this.application.metadata.hasExternalDeliveryPartner ? 5 : 6);
      return;
    }
    this.goToStep(this.currentStep - 1);
  }

  private allStepsBeforeValid(target: number): boolean {
    for (const step of this.steps) {
      if (step.n >= target) break;
      if (!this.stepVisible(step.n)) continue;
      if (!this.stepValid(step.n)) return false;
    }
    return true;
  }

  private firstInvalidStep(): number {
    for (const step of this.steps) {
      if (!this.stepVisible(step.n)) continue;
      if (!this.stepValid(step.n)) return step.n;
    }
    return 7;
  }

  get allStepsValid(): boolean {
    return this.steps.every((s) => !this.stepVisible(s.n) || this.stepValid(s.n));
  }

  // ── Validation ───────────────────────────────────────────────
  stepIssues(step: number): string[] {
    const issues: string[] = [];
    const m = this.application.metadata;
    const p = this.application.institutionalProfile;
    const n = this.application.narrative;

    if (step === 1) {
      if (m.proposalTitle.trim().length < 5) issues.push('Proposal title is required.');
      if (!m.country.trim()) issues.push('Country is required.');
      if (!m.organizationLegalName.trim()) issues.push('Organization legal name is required.');
      if (!m.organizationAcronym.trim()) issues.push('Organization acronym is required.');
      if (this.acronymTaken)
        issues.push('That acronym is already registered. Please use a different one.');
      if (!m.requestedAmountUSD || m.requestedAmountUSD <= 0)
        issues.push('Requested grant amount must be greater than zero.');
      if (!m.readinessObjectives.length)
        issues.push('Select at least one Readiness 2024–2027 objective.');
      if (!m.ndaFocalPointName.trim()) issues.push('NDA focal point name is required.');
      if (!m.ndaMinistry.trim()) issues.push('NDA ministry or authority is required.');
      if (!EMAIL_RE.test(m.ndaEmail)) issues.push('Enter a valid NDA focal point email.');
      if (m.hasExternalDeliveryPartner && !m.externalDeliveryPartnerName?.trim())
        issues.push('Name the accredited Delivery Partner you will work with.');
    }

    if (step === 2) {
      if (!p.registrationNumber.trim()) issues.push('Registration number is required.');
      if (!p.incorporationDate) issues.push('Incorporation date is required.');
      if (!p.staffCount || p.staffCount <= 0) issues.push('Staff count must be greater than zero.');
      if (p.annualOperatingBudgetUSD < 0) issues.push('Annual operating budget cannot be negative.');
      if (p.largestPreviousGrantUSD < 0) issues.push('Largest previous grant cannot be negative.');
      if (p.mandateSummary.trim().length < 40)
        issues.push('Describe your institutional mandate in at least 40 characters.');
      if (p.identifiedGapsSummary.trim().length < 20)
        issues.push('Summarize the gaps that will become Readiness deliverables.');
    }

    if (step === 3) {
      if (n.problemStatementAndBarriers.trim().length < 80)
        issues.push('Problem statement and barriers needs at least 80 characters.');
      if (n.nationalAlignmentNdcNap.trim().length < 80)
        issues.push('NDC / NAP alignment needs at least 80 characters.');
      if (n.complementarityPastGrants.trim().length < 80)
        issues.push('Complementarity with past grants needs at least 80 characters.');
      if (n.theoryOfChange.trim().length < 80)
        issues.push('Theory of change needs at least 80 characters.');
      if (n.sustainabilityAndExitStrategy.trim().length < 80)
        issues.push('Sustainability and exit strategy needs at least 80 characters.');
    }

    if (step === 4) {
      const outcomes = this.application.logframe.outcomes;
      if (!outcomes.length) issues.push('Add at least one outcome.');
      outcomes.forEach((outcome, oi) => {
        if (!outcome.description.trim()) issues.push(`Outcome ${oi + 1}: description is required.`);
        if (!outcome.indicator.trim()) issues.push(`Outcome ${oi + 1}: indicator is required.`);
        if (!outcome.outputs.length) issues.push(`Outcome ${oi + 1}: add at least one output.`);
        outcome.outputs.forEach((output, pi) => {
          if (!output.description.trim())
            issues.push(`Output ${oi + 1}.${pi + 1}: description is required.`);
          if (!output.indicator.trim())
            issues.push(`Output ${oi + 1}.${pi + 1}: indicator is required.`);
          if (!output.activities.length)
            issues.push(`Output ${oi + 1}.${pi + 1}: add at least one activity.`);
          output.activities.forEach((activity, ai) => {
            const ref = `${oi + 1}.${pi + 1}.${ai + 1}`;
            if (!activity.description.trim())
              issues.push(`Activity ${ref}: description is required.`);
            if (!activity.deliverable.trim())
              issues.push(`Activity ${ref}: deliverable is required.`);
            if (!activity.quarters.length)
              issues.push(`Activity ${ref}: select at least one delivery quarter.`);
          });
        });
      });
    }

    if (step === 5) {
      const b = this.application.budget;
      if (!b.lineItems.length) issues.push('Add at least one budget line item.');
      b.lineItems.forEach((line, i) => {
        const ref = i + 1;
        if (!line.activityId || !this.activityExists(line.activityId))
          issues.push(`Budget line ${ref}: link a valid logframe activity.`);
        if (!line.description.trim()) issues.push(`Budget line ${ref}: description is required.`);
        if (!line.unitCostUSD || line.unitCostUSD <= 0)
          issues.push(`Budget line ${ref}: unit cost must be greater than zero.`);
        if (!line.quantity || line.quantity <= 0)
          issues.push(`Budget line ${ref}: quantity must be greater than zero.`);
        if (line.budgetNoteJustification.trim().length < 5)
          issues.push(`Budget line ${ref}: add a budget note justification.`);
      });
      if (!b.disbursementTranches.length)
        issues.push('Add at least one disbursement tranche.');
      b.disbursementTranches.forEach((t, i) => {
        if (!t.milestoneDescription.trim())
          issues.push(`Tranche ${i + 1}: milestone description is required.`);
        if (!t.amountUSD || t.amountUSD <= 0)
          issues.push(`Tranche ${i + 1}: amount must be greater than zero.`);
      });
    }

    if (step === 6 && this.stepVisible(6)) {
      const f = this.application.fmca;
      if (!f) {
        issues.push('Complete the FMCA module.');
      } else {
        if (!f.regulatoryAuthority.trim())
          issues.push('Financial regulatory authority is required.');
        if (f.totalAssetsUSD < 0) issues.push('Total assets cannot be negative.');
        if (!f.accountingSoftwareName.trim())
          issues.push('Accounting software name is required.');
        if (!f.externalAuditorName.trim()) issues.push('External auditor name is required.');
        if (f.hasOngoingLitigation && !f.litigationDetails?.trim())
          issues.push('Describe the ongoing litigation.');
      }
    }

    if (step === 7) {
      const missing = this.requiredDocuments.filter((doc) => !this.docMeta[doc.key]);
      if (missing.length)
        issues.push(
          `Attach ${missing.length} required PDF${missing.length === 1 ? '' : 's'}: ${missing
            .map((d) => d.label)
            .join(', ')}.`,
        );
    }

    return issues;
  }

  // ── Step 1 helpers ───────────────────────────────────────────
  isObjectiveSelected(value: ReadinessObjective): boolean {
    return this.application.metadata.readinessObjectives.includes(value);
  }

  toggleObjective(value: ReadinessObjective): void {
    const list = this.application.metadata.readinessObjectives;
    const index = list.indexOf(value);
    if (index >= 0) list.splice(index, 1);
    else list.push(value);
    this.scheduleSave();
  }

  setDeliveryPartner(value: boolean): void {
    this.application.metadata.hasExternalDeliveryPartner = value;
    if (!value && !this.application.fmca) {
      this.application.fmca = createEmptyFmca();
    }
    this.errorSummary = '';
    this.scheduleSave();
  }

  // ── Step 2 helpers ───────────────────────────────────────────
  setPolicy(
    key: keyof ReadinessApplication['institutionalProfile']['gapMatrix'],
    value: PolicyStatus,
  ): void {
    this.application.institutionalProfile.gapMatrix[key] = value;
    this.scheduleSave();
  }

  get gapStats(): { missing: number; draft: number; approved: number } {
    const values = Object.values(this.application.institutionalProfile.gapMatrix);
    return {
      missing: values.filter((v) => v === 'none').length,
      draft: values.filter((v) => v === 'draft').length,
      approved: values.filter((v) => v === 'board_approved').length,
    };
  }

  // ── Step 3 helpers ───────────────────────────────────────────
  charCount(value: string): number {
    return value.trim().length;
  }

  // ── Step 4 helpers ───────────────────────────────────────────
  private refreshActivitySequence(): void {
    const count = this.application.logframe.outcomes.reduce(
      (total, outcome) =>
        total +
        outcome.outputs.reduce((sum, output) => sum + output.activities.length, 0),
      0,
    );
    this.activitySeq = Math.max(this.activitySeq, count + 100);
  }

  private nextActivityId(): string {
    this.activitySeq += 1;
    return `act_${this.activitySeq}`;
  }

  addOutcome(): void {
    const n = this.application.logframe.outcomes.length + 1;
    this.application.logframe.outcomes.push({
      id: `out_${Date.now().toString(36)}_${n}`,
      code: `Outcome ${n}`,
      description: '',
      indicator: '',
      baseline: '',
      target: '',
      meansOfVerification: '',
      outputs: [
        {
          id: `outp_${Date.now().toString(36)}_${n}_1`,
          code: `Output ${n}.1`,
          description: '',
          indicator: '',
          baseline: '',
          target: '',
          activities: [],
        },
      ],
    });
    this.scheduleSave();
  }

  removeOutcome(index: number): void {
    this.application.logframe.outcomes.splice(index, 1);
    this.scheduleSave();
  }

  addOutput(outcomeIndex: number): void {
    const outcome = this.application.logframe.outcomes[outcomeIndex];
    const p = outcome.outputs.length + 1;
    outcome.outputs.push({
      id: `outp_${Date.now().toString(36)}_${outcomeIndex + 1}_${p}`,
      code: `Output ${outcomeIndex + 1}.${p}`,
      description: '',
      indicator: '',
      baseline: '',
      target: '',
      activities: [],
    });
    this.scheduleSave();
  }

  removeOutput(outcomeIndex: number, outputIndex: number): void {
    this.application.logframe.outcomes[outcomeIndex].outputs.splice(outputIndex, 1);
    this.scheduleSave();
  }

  addActivity(outcomeIndex: number, outputIndex: number): void {
    const output = this.application.logframe.outcomes[outcomeIndex].outputs[outputIndex];
    const code = `Activity ${outcomeIndex + 1}.${outputIndex + 1}.${output.activities.length + 1}`;
    output.activities.push({
      id: this.nextActivityId(),
      code,
      description: '',
      deliverable: '',
      quarters: [],
    });
    this.scheduleSave();
  }

  removeActivity(outcomeIndex: number, outputIndex: number, activityIndex: number): void {
    this.application.logframe.outcomes[outcomeIndex].outputs[outputIndex].activities.splice(
      activityIndex,
      1,
    );
    this.scheduleSave();
  }

  toggleQuarter(activity: { quarters: Quarter[] }, quarter: Quarter): void {
    const index = activity.quarters.indexOf(quarter);
    if (index >= 0) activity.quarters.splice(index, 1);
    else activity.quarters.push(quarter);
    this.scheduleSave();
  }

  activityOptions(): { id: string; label: string }[] {
    return this.application.logframe.outcomes.flatMap((outcome) =>
      outcome.outputs.flatMap((output) =>
        output.activities.map((activity) => ({
          id: activity.id,
          label: `${activity.code} — ${activity.description || 'Untitled activity'}`,
        })),
      ),
    );
  }

  activityExists(id: string): boolean {
    return this.activityOptions().some((activity) => activity.id === id);
  }

  // ── Step 5 helpers ───────────────────────────────────────────
  addBudgetLine(): void {
    this.application.budget.lineItems.push({
      id: `line_${Date.now().toString(36)}_${this.application.budget.lineItems.length + 1}`,
      activityId: '',
      category: 'national_consultants',
      description: '',
      unitType: 'days',
      unitCostUSD: 0,
      quantity: 1,
      budgetNoteJustification: '',
      procurementMethod: 'three_quotes',
      targetQuarter: 'Q1',
    });
    this.scheduleSave();
  }

  removeBudgetLine(index: number): void {
    this.application.budget.lineItems.splice(index, 1);
    this.scheduleSave();
  }

  lineTotal(line: { unitCostUSD: number; quantity: number }): number {
    return (Number(line.unitCostUSD) || 0) * (Number(line.quantity) || 0);
  }

  get totalDirectCosts(): number {
    return this.application.budget.lineItems
      .filter((line) => line.category !== 'project_management_costs')
      .reduce((sum, line) => sum + this.lineTotal(line), 0);
  }

  get pmcTotal(): number {
    return this.application.budget.lineItems
      .filter((line) => line.category === 'project_management_costs')
      .reduce((sum, line) => sum + this.lineTotal(line), 0);
  }

  get pmcPercent(): number {
    return this.totalDirectCosts > 0 ? (this.pmcTotal / this.totalDirectCosts) * 100 : 0;
  }

  get grandTotal(): number {
    return this.totalDirectCosts + this.pmcTotal;
  }

  get budgetVariance(): number {
    return this.grandTotal - (Number(this.application.metadata.requestedAmountUSD) || 0);
  }

  get varianceAlert(): boolean {
    return Math.abs(this.budgetVariance) > 1;
  }

  get trancheAlert(): boolean {
    return Math.abs(this.trancheTotal - this.grandTotal) > 1;
  }

  get trancheTotal(): number {
    return this.application.budget.disbursementTranches.reduce(
      (sum, tranche) => sum + (Number(tranche.amountUSD) || 0),
      0,
    );
  }

  get budgetWarnings(): BudgetWarning[] {
    const warnings: BudgetWarning[] = [];
    const lines = this.application.budget.lineItems;
    if (this.pmcPercent > 7.5) {
      warnings.push({
        tone: 'warn',
        text: `PMC is ${this.pmcPercent.toFixed(1)}% of direct costs — above the 7.5% GCF guardrail.`,
      });
    }
    if (lines.length && !lines.some((line) => line.category === 'external_audit')) {
      warnings.push({
        tone: 'warn',
        text: 'No external audit cost is budgeted. GCF Readiness proposals normally require one.',
      });
    }
    if (Math.abs(this.budgetVariance) > 1 && this.application.metadata.requestedAmountUSD > 0) {
      warnings.push({
        tone: 'warn',
        text: `Budget total differs from the Step 1 request by ${this.money(Math.abs(this.budgetVariance))}.`,
      });
    }
    const unlinked = lines.filter(
      (line) => !line.activityId || !this.activityExists(line.activityId),
    ).length;
    if (unlinked) {
      warnings.push({
        tone: 'warn',
        text: `${unlinked} budget line${unlinked === 1 ? '' : 's'} not linked to a valid logframe activity.`,
      });
    }
    const budgetedActivities = new Set(lines.map((line) => line.activityId));
    const unbudgeted = this.activityOptions().filter((a) => !budgetedActivities.has(a.id)).length;
    if (unbudgeted) {
      warnings.push({
        tone: 'info',
        text: `${unbudgeted} logframe activit${unbudgeted === 1 ? 'y has' : 'ies have'} no budget line yet.`,
      });
    }
    if (
      this.application.budget.disbursementTranches.length &&
      Math.abs(this.trancheTotal - this.grandTotal) > 1
    ) {
      warnings.push({
        tone: 'warn',
        text: `Disbursement tranches total ${this.money(this.trancheTotal)} vs. budget total ${this.money(this.grandTotal)}.`,
      });
    }
    return warnings;
  }

  get procurementSummary(): { label: string; count: number; total: number }[] {
    return this.procurementOptions
      .map((method) => {
        const lines = this.application.budget.lineItems.filter(
          (line) => line.procurementMethod === method.value,
        );
        return {
          label: method.label,
          count: lines.length,
          total: lines.reduce((sum, line) => sum + this.lineTotal(line), 0),
        };
      })
      .filter((row) => row.count > 0);
  }

  categoryLabel(value: BudgetCategory): string {
    return this.budgetCategoryOptions.find((option) => option.value === value)?.label ?? value;
  }

  addTranche(): void {
    const tranches = this.application.budget.disbursementTranches;
    tranches.push({
      trancheNumber: tranches.length + 1,
      milestoneDescription: '',
      amountUSD: 0,
      estimatedMonth: 1,
    });
    this.scheduleSave();
  }

  removeTranche(index: number): void {
    this.application.budget.disbursementTranches.splice(index, 1);
    this.scheduleSave();
  }

  // ── Step 6 helpers ───────────────────────────────────────────
  get fmca(): NonNullable<ReadinessApplication['fmca']> {
    if (!this.application.fmca) this.application.fmca = createEmptyFmca();
    return this.application.fmca;
  }

  get risk(): RiskResult {
    const f = this.fmca;
    const requested = Number(this.application.metadata.requestedAmountUSD) || 0;
    const largest = Number(this.application.institutionalProfile.largestPreviousGrantUSD) || 0;
    const reasons: string[] = [];

    if (f.past3YearsAuditOpinion !== 'unqualified') {
      reasons.push('The latest external audit opinion is not unqualified.');
    }
    if (!f.canSegregateGcfFundsInSeparateAccount) {
      reasons.push('GCF funds cannot be segregated in a dedicated bank account.');
    }
    if (f.accountingStandard === 'Cash_Basis') {
      reasons.push('Cash-basis accounting does not meet GCF fiduciary expectations.');
    }
    if (reasons.length) {
      return {
        level: 'high',
        label: 'High fiduciary risk',
        summary:
          'GCF will likely reject direct Delivery Partner status. Recommend partnering with an Accredited Entity.',
        reasons,
      };
    }

    if (!f.hasIndependentAuditCommittee)
      reasons.push('No independent audit committee is in place.');
    if (!f.hasSanctionsScreeningProcess)
      reasons.push('No AML/CFT sanctions screening process is documented.');
    if (requested > 0 && largest < requested * 0.5) {
      reasons.push('Largest previous grant is below 50% of the requested amount.');
    }
    if (reasons.length) {
      return {
        level: 'medium',
        label: 'Medium fiduciary risk',
        summary:
          'Core safeguards are in place, but governance or track-record gaps need mitigation before FMCA clearance.',
        reasons,
      };
    }

    return {
      level: 'low',
      label: 'Low fiduciary risk',
      summary:
        'All seven FMCA pillars are satisfied. Direct Delivery Partner status is defensible.',
      reasons: [],
    };
  }

  addPastGrant(): void {
    this.fmca.pastGrantsTrackRecord.push({
      id: `grant_${Date.now().toString(36)}_${this.fmca.pastGrantsTrackRecord.length + 1}`,
      donorName: '',
      amountUSD: 0,
      year: new Date().getFullYear(),
      status: 'completed',
    });
    this.scheduleSave();
  }

  removePastGrant(index: number): void {
    this.fmca.pastGrantsTrackRecord.splice(index, 1);
    this.scheduleSave();
  }

  // ── Step 7 helpers ───────────────────────────────────────────
  get requiredDocuments(): DocRequirement[] {
    return this.documentRequirements.filter(
      (doc) => !doc.conditional || !this.application.metadata.hasExternalDeliveryPartner,
    );
  }

  docsValid(): boolean {
    return this.requiredDocuments.every((doc) => Boolean(this.docMeta[doc.key]));
  }

  get attachedCount(): number {
    return this.requiredDocuments.filter((doc) => Boolean(this.docMeta[doc.key])).length;
  }

  onFileSelected(event: Event, key: DocumentKey): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    void this.acceptFile(file, key);
  }

  onDrop(event: DragEvent, key: DocumentKey): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    void this.acceptFile(file, key);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private async acceptFile(file: File, key: DocumentKey): Promise<void> {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      this.docErrors[key] = 'Only PDF files are accepted.';
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      this.docErrors[key] = 'File is larger than 25 MB.';
      return;
    }
    if (this.docUploading[key]) return;

    this.docErrors[key] = undefined;
    this.docUploading[key] = true;
    this.application.documents[key] = file;

    try {
      const uploaded = await this.attachmentService.uploadFile(file, {
        scope: 'organizations',
        entityId: this.organizationId,
        section: 'readiness',
      });

      const previous = this.docAttachments[key];
      if (previous?.publicId) {
        void this.attachmentService.deleteFile(previous.publicId).catch(() => undefined);
      }

      this.docAttachments[key] = uploaded;
      this.docMeta[key] = uploaded.name;
      this.application.documents[key] = file;
      this.scheduleSave();
    } catch (error) {
      this.application.documents[key] = null;
      this.docErrors[key] =
        error instanceof Error ? error.message : 'Could not upload the file.';
    } finally {
      this.docUploading[key] = false;
    }
  }

  removeDocument(key: DocumentKey): void {
    const attachment = this.docAttachments[key];
    if (attachment?.publicId) {
      void this.attachmentService.deleteFile(attachment.publicId).catch(() => undefined);
    }

    delete this.docAttachments[key];
    this.application.documents[key] = null;
    delete this.docMeta[key];
    this.docErrors[key] = undefined;
    this.scheduleSave();
  }

  fileSizeLabel(key: DocumentKey): string {
    const file = this.application.documents[key];
    if (!file) return '';
    if (file.size < 1024 * 1024) return `${Math.max(1, Math.round(file.size / 1024))} KB`;
    return `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  }

  docMetaFor(key: DocumentKey): string {
    return this.docMeta[key] ?? '';
  }

  buildExportObject(): Record<string, unknown> {
    const m = this.application.metadata;
    const f = this.application.fmca;
    return {
      schemaVersion: 'gcf-readiness-intake-1.0',
      generatedAt: new Date().toISOString(),
      organizationId: this.organizationId,
      metadata: m,
      institutionalProfile: this.application.institutionalProfile,
      narrative: this.application.narrative,
      logframe: this.application.logframe,
      budget: this.application.budget,
      ...(m.hasExternalDeliveryPartner ? {} : { fmca: f }),
      documents: Object.fromEntries(
        this.requiredDocuments.map((doc) => {
          const attachment = this.docAttachments[doc.key];
          if (!attachment) return [doc.key, null];
          return [
            doc.key,
            {
              fileName: attachment.name,
              url: this.absoluteFileUrl(resolveAttachmentUrl(attachment)),
              publicId: attachment.publicId,
            },
          ];
        }),
      ),
    };
  }

  private absoluteFileUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) return url;
    return typeof location !== 'undefined' ? `${location.origin}${url}` : url;
  }

  /** Persists the readiness application in D1 under the organization id. */
  async submitReadiness(): Promise<void> {
    if (this.submitting) return;

    if (!this.allStepsValid) {
      const step = this.firstInvalidStep();
      this.currentStep = step;
      this.attempted.add(step);
      this.errorSummary = 'Complete the remaining requirements before submitting.';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    this.submitting = true;
    this.submitError = '';

    try {
      const data = this.buildExportObject();

      // Register/refresh the organization so the dashboard can list the form.
      await this.organizationService.save(this.organizationId, {
        name: this.application.metadata.organizationLegalName,
        acronym: this.application.metadata.organizationAcronym,
        country: this.application.metadata.country,
        entityType: this.application.metadata.entityType,
        contactEmail: this.application.metadata.ndaEmail,
        contactName: this.application.metadata.ndaFocalPointName,
      });
      this.identityLocked = true;

      const { submittedAt } = await this.organizationService.submitReadiness(
        this.organizationId,
        data,
      );

      await this.organizationService.clearDraft('readiness', this.organizationId);
      localStorage.removeItem(STORAGE_KEY);

      this.submittedAt = submittedAt;
      this.saveState = 'saved';
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not submit the readiness application.';
      this.submitError = message;

      if (message.toLowerCase().includes('acronym')) {
        this.acronymTaken = true;
        this.currentStep = 1;
      }
    } finally {
      this.submitting = false;
    }
  }

  downloadJson(): void {
    if (!this.allStepsValid) {
      const step = this.firstInvalidStep();
      this.currentStep = step;
      this.attempted.add(step);
      this.errorSummary = 'Complete the remaining requirements before exporting.';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const json = JSON.stringify(this.buildExportObject(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gcf-readiness-${(m_fragment(this.application.metadata.organizationLegalName) || 'application')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  openPreview(): void {
    this.previewJson = JSON.stringify(this.buildExportObject(), null, 2);
    this.previewOpen = true;
  }

  closePreview(): void {
    this.previewOpen = false;
  }

  copyJson(): void {
    navigator.clipboard?.writeText(this.previewJson).then(() => {
      this.copyLabel = 'Copied';
      setTimeout(() => (this.copyLabel = 'Copy JSON'), 1800);
    });
  }

  // ── Demo data ────────────────────────────────────────────────
  fillDemoData(): void {
    const demo = createEmptyApplication();
    demo.metadata = {
      proposalTitle:
        'Building GCF Direct Access Readiness for the Kenya National Climate Finance Authority',
      country: 'Kenya',
      organizationLegalName: 'Kenya National Climate Finance Authority',
      organizationAcronym: 'KNCFA',
      entityType: 'public',
      requestedAmountUSD: 950000,
      durationMonths: 24,
      readinessObjectives: ['obj1_coordination', 'obj3_dae_capacity', 'obj4_pipeline'],
      ndaFocalPointName: 'Dr. Amina Wanjiru',
      ndaMinistry: 'Ministry of Environment, Climate Change and Forestry',
      ndaEmail: 'a.wanjiru@environment.go.ke',
      hasExternalDeliveryPartner: false,
      externalDeliveryPartnerName: '',
    };

    demo.institutionalProfile = {
      registrationNumber: 'KE-CFA-2019-0442',
      incorporationDate: '2019-07-15',
      staffCount: 84,
      annualOperatingBudgetUSD: 6400000,
      largestPreviousGrantUSD: 1200000,
      mandateSummary:
        'The Authority coordinates national climate finance, manages the country climate finance tracking system and supports public institutions to access international climate funds.',
      gapMatrix: {
        financialManagementPolicy: 'draft',
        internalExternalAudit: 'draft',
        procurementPolicy: 'none',
        amlCftPolicy: 'draft',
        whistleblowerPolicy: 'none',
        essManagementSystem: 'draft',
        grievanceMechanism: 'board_approved',
        genderPolicy: 'board_approved',
      },
      identifiedGapsSummary:
        'Updated financial management and procurement manuals, a whistleblower policy, an ESS management system, and an AML/CFT framework must be drafted and approved by the Board before accreditation.',
    };

    demo.narrative = {
      problemStatementAndBarriers:
        'Kenya has strong national climate policy but limited capacity to convert priorities into GCF-accredited projects. The Authority lacks the fiduciary manuals, ESS systems and concept-note pipeline required to qualify as a Direct Access Entity, which slows access to international climate finance.',
      nationalAlignmentNdcNap:
        'The proposal directly supports the updated NDC (2020) and the National Adaptation Plan 2023–2027 by strengthening the institutional architecture that finances mitigation and adaptation priorities, including the national climate finance tracking framework.',
      complementarityPastGrants:
        'This Readiness request complements the 2021 GCF Readiness grant that established the climate finance tracking unit. It does not duplicate procurement or training already delivered and instead converts that foundation into accreditation-ready policies and a pipeline.',
      theoryOfChange:
        'If the Authority receives targeted technical assistance to close fiduciary, ESS and gender gaps, and if staff are trained to originate and appraise projects, then the Authority will pass the accreditation gap assessment and submit bankable concept notes to GCF.',
      sustainabilityAndExitStrategy:
        'Policies, manuals and the pipeline screening methodology will be adopted by the Board and embedded in the Authority’s standard operating procedures. A dedicated accreditation focal point will remain in post and annual budget lines will fund maintenance after the grant closes.',
    };

    demo.logframe = {
      outcomes: [
        {
          id: 'out_1',
          code: 'Outcome 1',
          description:
            'The Authority has closed the fiduciary, ESS and gender gaps required for GCF accreditation.',
          indicator:
            'Number of GCF accreditation criteria rated “fully met” in an independent gap assessment',
          baseline: '3 of 8 criteria fully met',
          target: '8 of 8 criteria fully met',
          meansOfVerification: 'Independent gap assessment report and Board-approved policies',
          outputs: [
            {
              id: 'out_1_out_1',
              code: 'Output 1.1',
              description:
                'Approved financial, procurement, AML/CFT and whistleblower policies are in place.',
              indicator: 'Number of missing policies adopted by the Board',
              baseline: '0 of 4 policies adopted',
              target: '4 of 4 policies adopted',
              activities: [
                {
                  id: 'act_1_1_1',
                  code: 'Activity 1.1.1',
                  description:
                    'Conduct an institutional accreditation gap assessment against GCF fiduciary and ESS standards.',
                  deliverable: 'Gap assessment report with a validated action plan',
                  quarters: ['Q1', 'Q2'],
                },
                {
                  id: 'act_1_1_2',
                  code: 'Activity 1.1.2',
                  description:
                    'Draft or update financial management, procurement, AML/CFT and whistleblower policies.',
                  deliverable: 'Board-ready policy package',
                  quarters: ['Q2', 'Q3'],
                },
                {
                  id: 'act_1_1_3',
                  code: 'Activity 1.1.3',
                  description:
                    'Commission an external audit readiness review of the three-year financial statements.',
                  deliverable: 'Audit readiness memo and management letter',
                  quarters: ['Q2'],
                },
              ],
            },
            {
              id: 'out_1_out_2',
              code: 'Output 1.2',
              description: 'Staff apply GCF fiduciary, ESS and gender safeguards in daily operations.',
              indicator: 'Share of targeted staff passing the competency assessment',
              baseline: '32%',
              target: '85%',
              activities: [
                {
                  id: 'act_1_2_1',
                  code: 'Activity 1.2.1',
                  description:
                    'Deliver accreditation readiness training for finance, procurement and safeguards teams.',
                  deliverable: 'Training curriculum, attendance report and competency results',
                  quarters: ['Q3'],
                },
              ],
            },
          ],
        },
        {
          id: 'out_2',
          code: 'Outcome 2',
          description:
            'A prioritized climate project pipeline and two GCF concept notes are ready for NDA review.',
          indicator: 'Number of concept notes endorsed by the NDA',
          baseline: '0 concept notes',
          target: '2 concept notes',
          meansOfVerification: 'NDA endorsement letters and submitted concept note packages',
          outputs: [
            {
              id: 'out_2_out_1',
              code: 'Output 2.1',
              description:
                'A climate finance coordination mechanism links the NDA, line ministries and the Authority.',
              indicator: 'Number of coordination meetings with agreed action minutes',
              baseline: '1 ad hoc meeting per year',
              target: '8 quarterly meetings',
              activities: [
                {
                  id: 'act_2_1_1',
                  code: 'Activity 2.1.1',
                  description:
                    'Establish and operate a climate finance coordination secretariat for the NDA network.',
                  deliverable: 'Secretariat terms of reference and quarterly progress reports',
                  quarters: ['Q1', 'Q2', 'Q3', 'Q4'],
                },
                {
                  id: 'act_2_1_2',
                  code: 'Activity 2.1.2',
                  description:
                    'Facilitate alignment workshops between the NDA, line ministries and prospective executing entities.',
                  deliverable: 'Workshop reports and pipeline shortlist',
                  quarters: ['Q2', 'Q3', 'Q4'],
                },
              ],
            },
            {
              id: 'out_2_out_2',
              code: 'Output 2.2',
              description: 'Two bankable concept notes are prepared using a transparent screening method.',
              indicator: 'Number of concept notes meeting the GCF concept note quality checklist',
              baseline: '0',
              target: '2',
              activities: [
                {
                  id: 'act_2_2_1',
                  code: 'Activity 2.2.1',
                  description:
                    'Design a project pipeline screening methodology aligned with NDC and NAP priorities.',
                  deliverable: 'Screening methodology and scored long-list',
                  quarters: ['Q3', 'Q4'],
                },
                {
                  id: 'act_2_2_2',
                  code: 'Activity 2.2.2',
                  description:
                    'Prepare two GCF concept notes with theory of change, budget and ESS screening.',
                  deliverable: 'Two concept note packages ready for NDA review',
                  quarters: ['Q4', 'Q5', 'Q6'],
                },
              ],
            },
          ],
        },
      ],
    };

    demo.budget = {
      lineItems: [
        {
          id: 'line_1',
          activityId: 'act_1_1_1',
          category: 'international_consultants',
          description: 'Lead accreditation and fiduciary gap assessment expert',
          unitType: 'days',
          unitCostUSD: 1500,
          quantity: 120,
          budgetNoteJustification:
            'International expert required to benchmark the Authority against GCF fiduciary and ESS standards.',
          procurementMethod: 'competitive_bidding',
          targetQuarter: 'Q1',
        },
        {
          id: 'line_2',
          activityId: 'act_1_1_2',
          category: 'national_consultants',
          description: 'National policy drafting team for fiduciary manuals',
          unitType: 'days',
          unitCostUSD: 450,
          quantity: 180,
          budgetNoteJustification:
            'National legal and finance consultants will draft policies aligned to Kenyan law and GCF requirements.',
          procurementMethod: 'three_quotes',
          targetQuarter: 'Q2',
        },
        {
          id: 'line_3',
          activityId: 'act_1_1_3',
          category: 'external_audit',
          description: 'External audit readiness review of three-year financial statements',
          unitType: 'lump_sum',
          unitCostUSD: 40000,
          quantity: 1,
          budgetNoteJustification:
            'Independent audit readiness review is required for the FMCA evidence package.',
          procurementMethod: 'competitive_bidding',
          targetQuarter: 'Q2',
        },
        {
          id: 'line_4',
          activityId: 'act_1_2_1',
          category: 'workshops_training',
          description: 'Accreditation readiness training workshops',
          unitType: 'workshops',
          unitCostUSD: 12000,
          quantity: 12,
          budgetNoteJustification:
            'Twelve workshops cover finance, procurement, ESS and gender safeguards for 120 staff.',
          procurementMethod: 'three_quotes',
          targetQuarter: 'Q3',
        },
        {
          id: 'line_5',
          activityId: 'act_1_2_1',
          category: 'workshops_training',
          description: 'Training materials, venue and participant costs',
          unitType: 'workshops',
          unitCostUSD: 12000,
          quantity: 3,
          budgetNoteJustification:
            'Additional outreach workshops for county-level implementing partners.',
          procurementMethod: 'three_quotes',
          targetQuarter: 'Q3',
        },
        {
          id: 'line_6',
          activityId: 'act_2_1_1',
          category: 'national_consultants',
          description: 'Coordination secretariat facilitator',
          unitType: 'days',
          unitCostUSD: 450,
          quantity: 150,
          budgetNoteJustification:
            'Facilitator supports quarterly NDA coordination meetings and action tracking.',
          procurementMethod: 'three_quotes',
          targetQuarter: 'Q1',
        },
        {
          id: 'line_7',
          activityId: 'act_2_1_2',
          category: 'travel_per_diem',
          description: 'Travel and per diem for NDA alignment workshops',
          unitType: 'trips',
          unitCostUSD: 2200,
          quantity: 30,
          budgetNoteJustification:
            'Travel costs cover 30 trips for county and ministry representatives.',
          procurementMethod: 'direct_contracting',
          targetQuarter: 'Q2',
        },
        {
          id: 'line_8',
          activityId: 'act_2_2_1',
          category: 'equipment_software',
          description: 'Pipeline screening platform and data licences',
          unitType: 'lump_sum',
          unitCostUSD: 150000,
          quantity: 1,
          budgetNoteJustification:
            'The screening platform will remain with the Authority after the grant and support future pipeline cycles.',
          procurementMethod: 'competitive_bidding',
          targetQuarter: 'Q3',
        },
        {
          id: 'line_9',
          activityId: 'act_2_2_2',
          category: 'international_consultants',
          description: 'Concept note development expert',
          unitType: 'days',
          unitCostUSD: 1500,
          quantity: 60,
          budgetNoteJustification:
            'International expert quality-assures two concept notes against GCF investment criteria.',
          procurementMethod: 'competitive_bidding',
          targetQuarter: 'Q4',
        },
        {
          id: 'line_10',
          activityId: 'act_2_2_2',
          category: 'national_consultants',
          description: 'National climate finance analysts for concept notes',
          unitType: 'days',
          unitCostUSD: 450,
          quantity: 105,
          budgetNoteJustification:
            'National analysts prepare financial models, ESS screening and stakeholder mapping.',
          procurementMethod: 'three_quotes',
          targetQuarter: 'Q4',
        },
        {
          id: 'line_11',
          activityId: 'act_2_1_1',
          category: 'project_management_costs',
          description: 'Project management unit and grant administration',
          unitType: 'lump_sum',
          unitCostUSD: 48250,
          quantity: 1,
          budgetNoteJustification:
            'PMC covers the part-time project manager, fiduciary oversight and reporting.',
          procurementMethod: 'not_applicable',
          targetQuarter: 'Q1',
        },
      ],
      disbursementTranches: [
        {
          trancheNumber: 1,
          milestoneDescription: 'Inception, gap assessment and approved workplan',
          amountUSD: 285000,
          estimatedMonth: 3,
        },
        {
          trancheNumber: 2,
          milestoneDescription: 'Policies adopted and training completed',
          amountUSD: 380000,
          estimatedMonth: 12,
        },
        {
          trancheNumber: 3,
          milestoneDescription: 'Two concept notes endorsed by the NDA',
          amountUSD: 285000,
          estimatedMonth: 24,
        },
      ],
    };

    demo.fmca = {
      regulatoryAuthority: 'Central Bank of Kenya',
      totalAssetsUSD: 7800000,
      hasOngoingLitigation: false,
      litigationDetails: '',
      hasIndependentAuditCommittee: true,
      accountingStandard: 'IFRS',
      accountingSoftwareName: 'Sage Intacct',
      canSegregateGcfFundsInSeparateAccount: true,
      hasDualSignatoryControls: true,
      past3YearsAuditOpinion: 'unqualified',
      externalAuditorName: 'Deloitte East Africa',
      hasSanctionsScreeningProcess: true,
      pastGrantsTrackRecord: [
        {
          id: 'grant_1',
          donorName: 'Global Environment Facility',
          amountUSD: 1200000,
          year: 2022,
          status: 'completed',
        },
        {
          id: 'grant_2',
          donorName: 'African Development Bank',
          amountUSD: 850000,
          year: 2024,
          status: 'ongoing',
        },
        {
          id: 'grant_3',
          donorName: 'UNDP',
          amountUSD: 420000,
          year: 2021,
          status: 'completed',
        },
      ],
    };

    const docs: { key: DocumentKey; name: string }[] = [
      { key: 'ndaNoObjectionLetterPdf', name: 'nda-no-objection-letter.pdf' },
      { key: 'legalRegistrationStatutesPdf', name: 'legal-registration-and-statutes.pdf' },
      { key: 'organogramPdf', name: 'organogram-2026.pdf' },
      {
        key: 'auditedFinancialStatements3YrsPdf',
        name: 'audited-financial-statements-2023-2025.pdf',
      },
      {
        key: 'financeAndProcurementManualsPdf',
        name: 'finance-and-procurement-manuals.pdf',
      },
      { key: 'bankAccountConfirmationPdf', name: 'bank-account-confirmation.pdf' },
    ];
    demo.documents = {
      ndaNoObjectionLetterPdf: null,
      legalRegistrationStatutesPdf: null,
      organogramPdf: null,
      auditedFinancialStatements3YrsPdf: null,
      financeAndProcurementManualsPdf: null,
      bankAccountConfirmationPdf: null,
    };
    this.docMeta = {};
    for (const doc of docs) {
      const file = new File([`Demo PDF placeholder: ${doc.name}`], doc.name, {
        type: 'application/pdf',
      });
      demo.documents[doc.key] = file;
      this.docMeta[doc.key] = doc.name;
    }

    this.application = demo;
    if (this.organization) {
      // Keep the signed-in organization's locked identity.
      this.applyOrganizationProfile(this.organization);
    }
    this.docErrors = {};
    this.attempted.clear();
    this.errorSummary = '';
    this.currentStep = 1;
    this.activitySeq = 50;
    this.persist();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Formatting ───────────────────────────────────────────────
  money(value: number): string {
    return `$${Math.round(Number(value) || 0).toLocaleString('en-US')}`;
  }

  pct(value: number): string {
    return `${(Number(value) || 0).toFixed(1)}%`;
  }

  policyLabel(value: PolicyStatus): string {
    return this.policyOptions.find((option) => option.value === value)?.label ?? value;
  }

  entityLabel(): string {
    const value = this.application.metadata.entityType;
    return this.entityOptions.find((option) => option.value === value)?.label ?? value;
  }
}

function m_fragment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
