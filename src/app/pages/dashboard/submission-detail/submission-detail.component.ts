import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, RouterLink } from "@angular/router";
import {
  FormSubmission,
  StorageService,
  SUBMISSION_STATUSES,
  SubmissionStatus,
} from "../../../services/storage.service";
import { NotificationService } from "../../../services/notification.service";
import { EmailService } from "../../../services/email.service";
import { CloudinaryService } from "../../../services/cloudinary.service";
import {
  MAX_FILES_PER_ATTACHMENT,
  STAGE1_ATTACHMENT_FIELDS,
  collectAttachmentFields,
  isAttachmentFieldKey,
  normalizeAttachments,
} from "../../../config/attachments.config";
import {
  DisplaySection,
  STAGE1_DISPLAY_SECTIONS,
  formatStage1Value,
  getAttachments,
  getSelectOptions,
  hasDisplayValue,
  isBooleanFieldKey,
} from "../../../shared/data/stage1-display.config";
import { ApplicantRecord } from "../../../models/applicant.model";
import { StoredAttachment } from "../../../models/attachment.model";
import { resolveCloudinaryFileUrl } from "../../../shared/utils/cloudinary-url.util";

type FieldEditType = "text" | "textarea" | "select" | "attachment" | "readonly";

// Fields that must never be editable
const READ_ONLY_FIELDS = new Set(["applicantName", "areaOfOperation"]);

@Component({
  selector: "app-submission-detail",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./submission-detail.component.html",
  styleUrl: "./submission-detail.component.css",
})
export class SubmissionDetailComponent implements OnInit {
  submission: FormSubmission | null = null;
  sections = STAGE1_DISPLAY_SECTIONS;
  sectionNotes: Record<string, string> = {};
  lastSentAt: string | null = null;
  status: SubmissionStatus = "Pending";
  readonly statusOptions = SUBMISSION_STATUSES;
  readonly maxFiles = MAX_FILES_PER_ATTACHMENT;
  applicantRecord: ApplicantRecord | null = null;
  attachmentFields: {
    key: string;
    label: string;
    attachments: StoredAttachment[];
  }[] = [];
  updatedAt: string | null = null;

  // Edit mode
  editMode = false;
  editData: Record<string, unknown> = {};
  saving = false;
  sending = false;
  uploadingKeys = new Set<string>();

  constructor(
    private route: ActivatedRoute,
    private storageService: StorageService,
    private notificationService: NotificationService,
    private cloudinaryService: CloudinaryService,
    public emailService: EmailService,
  ) {}

  ngOnInit(): void {
    void this.loadSubmission();
  }

  private async loadSubmission(): Promise<void> {
    const id = this.route.snapshot.paramMap.get("id");
    if (!id) return;

    try {
      this.submission = await this.storageService.getStage1SubmissionById(id);
      this.applicantRecord = await this.storageService.getApplicantRecord(id);
      if (this.submission) {
        this.sectionNotes = {
          ...(await this.storageService.getSubmissionReviewNotes(id)),
        };
        this.lastSentAt = await this.storageService.getLastReviewSentAt(id);
        this.status = await this.storageService.getSubmissionStatus(id);
        this.attachmentFields = collectAttachmentFields(
          this.getMergedSubmissionData(),
        );
        this.updatedAt = this.applicantRecord?.updatedAt ?? null;
      }
    } catch {
      this.notificationService.error(
        "Could not load submission from Firebase.",
      );
    }
  }

  // ── Edit mode ────────────────────────────────────────────────────────────

  enterEditMode(): void {
    if (!this.submission) return;
    // Deep copy so arrays (attachments) are independent
    this.editData = JSON.parse(JSON.stringify(this.submission.data));
    this.editMode = true;
  }

  cancelEdit(): void {
    this.editMode = false;
    this.editData = {};
    this.uploadingKeys = new Set();
  }

  async saveEdit(): Promise<void> {
    if (!this.submission || this.saving) return;

    this.saving = true;
    try {
      const newUpdatedAt = await this.storageService.updateStage1Data(
        this.submission.id,
        this.editData,
      );
      this.submission = { ...this.submission, data: { ...this.editData } };
      this.updatedAt = newUpdatedAt;
      this.attachmentFields = collectAttachmentFields(
        this.getMergedSubmissionData(),
      );
      this.editMode = false;
      this.editData = {};
      this.notificationService.success("Submission updated successfully.");
    } catch {
      this.notificationService.error("Could not save changes to Firebase.");
    } finally {
      this.saving = false;
    }
  }

  // ── Field type helpers ───────────────────────────────────────────────────

  getFieldType(key: string): FieldEditType {
    if (READ_ONLY_FIELDS.has(key)) return "readonly";
    if (isAttachmentFieldKey(key)) return "attachment";
    if (getSelectOptions(key) !== null) return "select";
    if (this.isLongText(key)) return "textarea";
    return "text";
  }

  getSelectOptions(key: string): { value: string; label: string }[] {
    return getSelectOptions(key) ?? [];
  }

  getEditValue(key: string): string {
    const raw = this.editData[key];
    if (raw === null || raw === undefined) return "";
    if (typeof raw === "boolean") return raw ? "true" : "false";
    return String(raw);
  }

  setEditValue(key: string, value: string): void {
    if (isBooleanFieldKey(key)) {
      this.editData[key] = value === "true";
    } else {
      this.editData[key] = value;
    }
  }

  // ── Attachment editing ───────────────────────────────────────────────────

  /** All 4 attachment field groups (always visible in edit mode). */
  get liveAttachmentFields(): {
    key: string;
    label: string;
    attachments: StoredAttachment[];
  }[] {
    if (!this.editMode) return this.attachmentFields;
    return Object.entries(STAGE1_ATTACHMENT_FIELDS).map(([key, label]) => ({
      key,
      label,
      attachments: this.getEditAttachments(key),
    }));
  }

  getEditAttachments(key: string): StoredAttachment[] {
    return normalizeAttachments(this.editData[key]);
  }

  removeAttachment(key: string, index: number): void {
    const current = [...this.getEditAttachments(key)];
    current.splice(index, 1);
    this.editData = { ...this.editData, [key]: current };
  }

  async uploadAttachment(key: string, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (!files.length) return;

    const current = [...this.getEditAttachments(key)];
    const slots = MAX_FILES_PER_ATTACHMENT - current.length;
    if (slots <= 0) {
      this.notificationService.warning(
        `Maximum ${MAX_FILES_PER_ATTACHMENT} files per field.`,
      );
      return;
    }

    const toUpload = files.slice(0, slots);
    this.uploadingKeys = new Set([...this.uploadingKeys, key]);

    try {
      for (const file of toUpload) {
        const uploaded = await this.cloudinaryService.uploadFile(file);
        current.push(uploaded);
      }
      this.editData = { ...this.editData, [key]: current };
    } catch {
      this.notificationService.error(
        "Could not upload file. Please try again.",
      );
    } finally {
      const next = new Set(this.uploadingKeys);
      next.delete(key);
      this.uploadingKeys = next;
    }
  }

  isUploading(key: string): boolean {
    return this.uploadingKeys.has(key);
  }

  canUploadMore(key: string): boolean {
    return this.getEditAttachments(key).length < MAX_FILES_PER_ATTACHMENT;
  }

  // ── Display helpers ──────────────────────────────────────────────────────

  getStatusClass(): string {
    return `status-select status-${this.status.toLowerCase()}`;
  }

  async onStatusChange(event: Event): Promise<void> {
    if (!this.submission) return;
    const value = (event.target as HTMLSelectElement).value as SubmissionStatus;
    const previous = this.status;
    this.status = value;
    try {
      await this.storageService.setSubmissionStatus(this.submission.id, value);
    } catch {
      this.status = previous;
      this.notificationService.error("Could not update status in Firebase.");
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  /** In edit mode reads from editData so summary cards stay in sync. */
  getValue(key: string): string {
    if (!this.submission) return "";
    const data = this.editMode ? this.editData : this.submission.data;
    return formatStage1Value(key, data[key]);
  }

  hasValue(key: string): boolean {
    if (!this.submission) return false;
    const data = this.editMode ? this.editData : this.submission.data;
    return hasDisplayValue(key, data);
  }

  sectionHasValues(sectionIndex: number): boolean {
    const section = this.sections[sectionIndex];
    return section.fields.some(
      (f: { key: string }) =>
        this.hasValue(f.key) || (this.editMode && isAttachmentFieldKey(f.key)),
    );
  }

  getNote(sectionId: string): string {
    return this.sectionNotes[sectionId] ?? "";
  }

  onNoteInput(sectionId: string, event: Event): void {
    if (!this.submission) return;
    const value = (event.target as HTMLTextAreaElement).value;
    this.sectionNotes[sectionId] = value;
    void this.storageService
      .saveSubmissionReviewNote(this.submission.id, sectionId, value)
      .catch(() =>
        this.notificationService.error("Could not save note to Firebase."),
      );
  }

  hasAnyNotes(): boolean {
    return this.sections.some(
      (s) => (this.sectionNotes[s.id] ?? "").trim().length > 0,
    );
  }

  async sendToApplicant(): Promise<void> {
    if (!this.submission || this.sending) return;

    const recipient = (
      this.submission.data["primaryContactEmail"] as string
    )?.trim();
    if (!recipient) {
      this.notificationService.error(
        "No applicant email found in this submission.",
      );
      return;
    }
    if (!this.hasAnyNotes()) {
      this.notificationService.warning(
        "Add at least one review note before sending to the applicant.",
      );
      return;
    }

    const applicantName =
      (this.submission.data["applicantName"] as string) || "Applicant";
    const contactName =
      (this.submission.data["primaryContactName"] as string) || applicantName;
    const subject = `GCF Stage 1 Review Notes — ${applicantName}`;
    const body = this.buildEmailBody(contactName);

    this.sending = true;
    try {
      const mode = await this.emailService.sendReviewEmail({
        to: recipient,
        subject,
        body,
      });
      await this.storageService.markReviewSent(this.submission.id, recipient);
      this.lastSentAt = new Date().toISOString();

      if (mode === "automatic") {
        this.notificationService.success(
          `Review notes sent from ${this.emailService.senderEmail} to ${recipient}.`,
        );
      } else {
        this.notificationService.info(
          `Gmail opened for ${this.emailService.senderEmail}. Sign in with that account and click Send.`,
        );
      }
    } finally {
      this.sending = false;
    }
  }

  private buildEmailBody(contactName: string): string {
    if (!this.submission) return "";
    const lines = [
      `Dear ${contactName},`,
      "",
      "Please find below our review notes regarding your Stage 1 pre-screening submission:",
      "",
    ];
    for (const section of this.visibleSectionsWithNotes()) {
      lines.push(`--- ${section.title} ---`);
      lines.push(
        (this.sectionNotes[section.id] ?? "").trim() ||
          "(No notes for this section)",
      );
      lines.push("");
    }
    lines.push("---");
    lines.push(`Applicant: ${this.submission.data["applicantName"] || "N/A"}`);
    lines.push(`Submission date: ${this.formatDate(this.submission.date)}`);
    lines.push(`Reference ID: ${this.submission.id}`);
    lines.push("");
    lines.push("Kind regards,");
    lines.push("GCF Accreditation Team");
    lines.push(this.emailService.senderEmail);
    return lines.join("\n");
  }

  private visibleSectionsWithNotes(): DisplaySection[] {
    return this.sections.filter((s) =>
      this.sectionHasValues(this.sections.indexOf(s)),
    );
  }

  fileUrl(attachment: StoredAttachment | string): string {
    return resolveCloudinaryFileUrl(attachment);
  }

  isAttachmentField(key: string): boolean {
    return isAttachmentFieldKey(key);
  }

  getAttachmentItems(key: string): StoredAttachment[] {
    if (!this.submission) return [];
    return getAttachments(key, this.getMergedSubmissionData());
  }

  private getMergedSubmissionData(): Record<string, unknown> {
    return {
      ...(this.submission?.data ?? {}),
      ...(this.applicantRecord?.stage2?.data ?? {}),
    };
  }

  isLongText(key: string): boolean {
    return [
      "ndaEngagementDescription",
      "consultationSummary",
      "businessMandate",
      "climateFinanceOverview",
      "trackRecordOverview",
      "fullCycleDescription",
      "fastTrackComplianceDetails",
      "executingEntityDetails",
    ].includes(key);
  }

  isBadgeField(key: string): boolean {
    return (
      key.startsWith("has") ||
      key.startsWith("can") ||
      key.startsWith("accredited")
    );
  }

  isYesValue(key: string): boolean {
    const val = this.submission?.data[key];
    if (typeof val === "boolean") return val;
    return val === "yes";
  }
}
