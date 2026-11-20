import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import * as XLSX from "xlsx";
import { CountrySelectComponent } from "../../../shared/components/country-select/country-select.component";
import {
  LeadRecord,
  LEAD_STATUS_OPTIONS,
  LeadStatus,
} from "../../../models/applicant.model";
import { StorageService } from "../../../services/storage.service";
import { ConfirmDialogComponent } from "../../../shared/components/confirm-dialog/confirm-dialog.component";

type LeadField = keyof Omit<LeadRecord, "id" | "createdAt" | "updatedAt">;

@Component({
  selector: "app-leads-import",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ConfirmDialogComponent,
    CountrySelectComponent,
  ],
  templateUrl: "./leads-import.component.html",
  styleUrls: ["./leads-import.component.css"],
})
export class LeadsImportComponent implements OnInit, OnDestroy {
  fileName = "";
  parseError = "";
  successMessage = "";
  loadError = "";
  loading = false;
  tableLoading = true;
  savingFieldId: string | null = null;
  pendingLeads: LeadRecord[] = [];
  savedLeads: LeadRecord[] = [];
  selectedIds = new Set<string>();
  deleteConfirmOpen = false;
  searchQuery = "";
  readonly statusOptions = LEAD_STATUS_OPTIONS;
  readonly pageSize = 20;
  currentPage = 1;

  // Tab state
  activeTab: "import" | "single" = "import";

  // Drawer state
  drawerOpen = false;
  private previousBodyOverflow = "";

  // Single lead form
  addFormData: Partial<LeadRecord> = { status: "Pending" };
  addFormSaving = false;
  addFormError = "";

  // Lead detail editor
  detailOpen = false;
  detailLead: LeadRecord | null = null;
  detailDocumentsText = "";
  detailSaving = false;
  detailError = "";
  private previousDetailOverflow = "";

  readonly detailSections: {
    title: string;
    fields: { key: keyof LeadRecord; label: string; wide?: boolean; type?: string }[];
  }[] = [
    {
      title: "Institution",
      fields: [
        { key: "organization", label: "Organization", wide: true },
        { key: "acronym", label: "Acronym" },
        { key: "entityType", label: "Entity type" },
        { key: "region", label: "Region" },
        { key: "country", label: "Country" },
        { key: "website", label: "Website", type: "url" },
      ],
    },
    {
      title: "Enquiry",
      fields: [
        { key: "contactName", label: "Contact name" },
        { key: "contactRole", label: "Contact role" },
        { key: "contactEmail", label: "Contact email", type: "email" },
        { key: "climateSpecialty", label: "Climate specialty", wide: true },
        { key: "objective", label: "Primary objective", wide: true },
        { key: "financing", label: "Indicative financing need" },
        { key: "timeline", label: "Intended timeline" },
        { key: "operatingHistory", label: "Operating history" },
        { key: "projectStage", label: "Project stage" },
        { key: "projectCountry", label: "Project country" },
        { key: "projectSector", label: "Project sector" },
        { key: "accessType", label: "Access type" },
        { key: "complianceIssues", label: "Compliance declaration", wide: true },
        { key: "engagement", label: "Preferred next step", wide: true },
      ],
    },
    {
      title: "Notes",
      fields: [
        { key: "challenge", label: "Challenge / support requested", wide: true },
        { key: "comments", label: "Internal comments", wide: true },
      ],
    },
  ];

  openLeadDetail(lead: LeadRecord): void {
    this.detailLead = { ...lead };
    this.detailDocumentsText = (lead.availableDocuments ?? []).join(", ");
    this.detailError = "";
    this.detailOpen = true;
    this.previousDetailOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  closeLeadDetail(): void {
    this.detailOpen = false;
    this.detailLead = null;
    document.body.style.overflow = this.previousDetailOverflow;
  }

  async saveLeadDetail(): Promise<void> {
    const lead = this.detailLead;
    if (!lead?.id) return;

    this.detailSaving = true;
    this.detailError = "";

    const updated: LeadRecord = {
      ...lead,
      availableDocuments: this.detailDocumentsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    const index = this.savedLeads.findIndex((item) => item.id === lead.id);
    try {
      const { id, createdAt, updatedAt, ...payload } = updated;
      await this.storageService.updateLead(lead.id, payload);
      if (index !== -1) {
        this.savedLeads[index] = {
          ...updated,
          updatedAt: new Date().toISOString(),
        };
      }
      this.successMessage = `Lead "${updated.organization}" updated.`;
      this.closeLeadDetail();
    } catch {
      this.detailError = "Could not save this lead. Please try again.";
    } finally {
      this.detailSaving = false;
    }
  }

  openDrawer(tab: "import" | "single"): void {
    this.activeTab = tab;
    this.drawerOpen = true;
    this.clearMessages();
    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    document.body.style.overflow = this.previousBodyOverflow;
  }

  @HostListener("document:keydown.escape")
  onEscape(): void {
    if (this.detailOpen) {
      this.closeLeadDetail();
    } else if (this.drawerOpen) {
      this.closeDrawer();
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = this.previousBodyOverflow;
    if (this.detailOpen) {
      document.body.style.overflow = this.previousDetailOverflow;
    }
  }

  dismissMessages(): void {
    this.clearMessages();
  }

  cancelPreview(): void {
    this.pendingLeads = [];
    this.fileName = "";
    this.clearMessages();
  }

  resetAddForm(): void {
    this.addFormData = { status: "Pending" };
    this.addFormError = "";
  }

  async submitAddForm(): Promise<void> {
    const org = (this.addFormData.organization ?? "").trim();
    if (!org) {
      this.addFormError = "Organization name is required.";
      return;
    }

    this.addFormSaving = true;
    this.addFormError = "";

    try {
      const lead: Omit<LeadRecord, "id" | "createdAt" | "updatedAt"> = {
        organization: org,
        acronym: (this.addFormData.acronym ?? "").trim(),
        region: (this.addFormData.region ?? "").trim(),
        country: (this.addFormData.country ?? "").trim(),
        entityType: (this.addFormData.entityType ?? "").trim(),
        website: (this.addFormData.website ?? "").trim(),
        contactEmail: (this.addFormData.contactEmail ?? "").trim(),
        climateSpecialty: (this.addFormData.climateSpecialty ?? "").trim(),
        comments: (this.addFormData.comments ?? "").trim(),
        status: (this.addFormData.status as LeadStatus) ?? "Pending",
      };

      const [created] = await this.storageService.saveLeads([lead]);
      this.savedLeads = [created, ...this.savedLeads];
      this.currentPage = 1;
      this.closeDrawer();
      this.resetAddForm();
      this.successMessage = `Lead "${org}" added successfully.`;
    } catch {
      this.addFormError = "Could not save lead to the server. Please try again.";
    } finally {
      this.addFormSaving = false;
    }
  }

  constructor(private storageService: StorageService) {}

  ngOnInit(): void {
    void this.loadSavedLeads();
  }

  async loadSavedLeads(): Promise<void> {
    this.tableLoading = true;
    this.loadError = "";

    try {
      this.savedLeads = await this.storageService.getLeads();
      this.selectedIds = new Set(
        [...this.selectedIds].filter((id) =>
          this.savedLeads.some((lead) => lead.id === id),
        ),
      );
      this.clampCurrentPage();
    } catch {
      this.loadError = "Could not load leads from the server.";
    } finally {
      this.tableLoading = false;
    }
  }

  async onFileChange(event: Event): Promise<void> {
    this.clearMessages();

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.fileName = file.name;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!sheet) {
        throw new Error("No worksheet found in the selected file.");
      }

      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        defval: "",
      });

      if (rows.length < 2) {
        throw new Error(
          "The Excel file must include a header row and at least one data row.",
        );
      }

      const headerRow = (rows[0] as any[]).map((value: unknown) =>
        this.normalizeHeader(value),
      );
      const leadRows = rows.slice(1) as any[];
      const importedLeads: LeadRecord[] = leadRows
        .map((row) => this.parseRow(headerRow, row))
        .filter((lead): lead is LeadRecord => lead !== null);

      if (!importedLeads.length) {
        throw new Error("No valid rows were found in the file.");
      }

      this.pendingLeads = importedLeads;
      this.closeDrawer();
      window.setTimeout(() => {
        const panel = document.querySelector(".preview-panel");
        if (panel) {
          const top =
            panel.getBoundingClientRect().top + window.scrollY - 96;
          window.scrollTo({ top, behavior: "smooth" });
        }
      }, 80);
    } catch (error) {
      this.parseError =
        error instanceof Error
          ? error.message
          : "Unable to parse the selected Excel file.";
      this.pendingLeads = [];
    }
  }

  updatePendingField(index: number, field: LeadField, value: string): void {
    if (!this.pendingLeads[index]) {
      return;
    }

    this.pendingLeads[index] = {
      ...this.pendingLeads[index],
      [field]: field === "status" ? this.normalizeStatus(value) : value,
    };
  }

  async saveLeads(): Promise<void> {
    this.clearMessages();

    if (!this.pendingLeads.length) {
      this.parseError = "Please choose an Excel file before saving.";
      return;
    }

    const existingKeys = new Set(
      this.savedLeads.map((lead) => this.leadKey(lead)),
    );
    const newLeads = this.pendingLeads.filter(
      (lead) => !existingKeys.has(this.leadKey(lead)),
    );
    const skippedCount = this.pendingLeads.length - newLeads.length;

    if (!newLeads.length) {
      this.successMessage = `All ${skippedCount} row${skippedCount === 1 ? "" : "s"} already exist and were ignored.`;
      this.pendingLeads = [];
      this.fileName = "";
      return;
    }

    this.loading = true;

    try {
      const created = await this.storageService.saveLeads(newLeads);
      this.savedLeads = [...created, ...this.savedLeads];
      this.currentPage = 1;

      const addedCount = created.length;
      if (skippedCount > 0) {
        this.successMessage = `${addedCount} row${addedCount === 1 ? "" : "s"} added. ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"} ignored.`;
      } else {
        this.successMessage = `${addedCount} row${addedCount === 1 ? "" : "s"} added successfully.`;
      }

      this.pendingLeads = [];
      this.fileName = "";
    } catch {
      this.parseError = "Could not save leads to the server. Please try again.";
    } finally {
      this.loading = false;
    }
  }

  togglePendingFavorite(index: number, favorite: boolean): void {
    const lead = this.pendingLeads[index];
    if (!lead) {
      return;
    }
    this.pendingLeads[index] = { ...lead, favorite };
  }

  async toggleSavedFavorite(
    lead: LeadRecord,
    favorite: boolean,
  ): Promise<void> {
    if (!lead.id) {
      return;
    }
    const index = this.savedLeads.findIndex((item) => item.id === lead.id);
    if (index === -1) {
      return;
    }

    const previous = lead.favorite;
    const updatedLead: LeadRecord = { ...lead, favorite };
    this.savedLeads[index] = updatedLead;
    this.savingFieldId = lead.id;

    try {
      const { id, createdAt, updatedAt, ...payload } = updatedLead;
      await this.storageService.updateLead(lead.id, payload);
    } catch {
      this.savedLeads[index] = { ...lead, favorite: previous };
      this.parseError = "Could not update the row on the server.";
    } finally {
      this.savingFieldId = null;
    }
  }

  async updateSavedField(
    lead: LeadRecord,
    field: LeadField,
    value: string,
  ): Promise<void> {
    if (!lead.id) {
      return;
    }

    const normalizedValue =
      field === "status" ? this.normalizeStatus(value) : value;
    const previous = lead[field];
    const updatedLead: LeadRecord = {
      ...lead,
      [field]: normalizedValue,
    };

    const index = this.savedLeads.findIndex((item) => item.id === lead.id);
    if (index === -1) {
      return;
    }

    this.savedLeads[index] = updatedLead;
    this.savingFieldId = lead.id;

    try {
      const { id, createdAt, updatedAt, ...payload } = updatedLead;
      await this.storageService.updateLead(lead.id, payload);
    } catch {
      this.savedLeads[index] = { ...lead, [field]: previous };
      this.parseError = "Could not update the row on the server.";
    } finally {
      this.savingFieldId = null;
    }
  }

  onSearchInput(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.currentPage = 1;
  }

  clearSearch(): void {
    this.searchQuery = "";
    this.currentPage = 1;
  }

  prevPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  goToPage(page: number): void {
    this.currentPage = Math.min(Math.max(1, page), this.totalPages);
  }

  get filteredLeads(): LeadRecord[] {
    const query = this.searchQuery.trim().toLowerCase();
    const leads = query
      ? this.savedLeads.filter((lead) =>
          this.getSearchableText(lead).includes(query),
        )
      : this.savedLeads;

    // Favorited leads appear first, the rest keep their current order.
    return [...leads].sort((a, b) => {
      const aFavorite = a.favorite ? 1 : 0;
      const bFavorite = b.favorite ? 1 : 0;
      return bFavorite - aFavorite;
    });
  }

  get paginatedLeads(): LeadRecord[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredLeads.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredLeads.length / this.pageSize));
  }

  get pageStart(): number {
    if (!this.filteredLeads.length) {
      return 0;
    }
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min(
      this.currentPage * this.pageSize,
      this.filteredLeads.length,
    );
  }

  get hasSearch(): boolean {
    return Boolean(this.searchQuery.trim());
  }

  getStatusClass(status: LeadStatus): string {
    return `status-select status-${status.toLowerCase()}`;
  }

  get visibleIds(): string[] {
    return this.paginatedLeads.flatMap((lead) => (lead.id ? [lead.id] : []));
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get allSelected(): boolean {
    const visible = this.visibleIds;
    return (
      visible.length > 0 && visible.every((id) => this.selectedIds.has(id))
    );
  }

  get someSelected(): boolean {
    const visible = this.visibleIds;
    const selectedVisible = visible.filter((id) => this.selectedIds.has(id));
    return (
      selectedVisible.length > 0 && selectedVisible.length < visible.length
    );
  }

  isSelected(leadId: string | undefined): boolean {
    return Boolean(leadId && this.selectedIds.has(leadId));
  }

  toggleSelection(leadId: string | undefined, event: Event): void {
    if (!leadId) {
      return;
    }

    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedIds.add(leadId);
    } else {
      this.selectedIds.delete(leadId);
    }
    this.selectedIds = new Set(this.selectedIds);
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    for (const id of this.visibleIds) {
      if (checked) {
        this.selectedIds.add(id);
      } else {
        this.selectedIds.delete(id);
      }
    }
    this.selectedIds = new Set(this.selectedIds);
  }

  openDeleteConfirm(): void {
    if (!this.selectedIds.size) {
      return;
    }

    this.deleteConfirmOpen = true;
  }

  cancelDeleteConfirm(): void {
    this.deleteConfirmOpen = false;
  }

  get deleteConfirmMessage(): string {
    const count = this.selectedIds.size;
    return `You are about to delete ${count} lead${count === 1 ? "" : "s"}. This action cannot be undone.`;
  }

  async confirmDelete(): Promise<void> {
    if (!this.selectedIds.size) {
      this.deleteConfirmOpen = false;
      return;
    }

    const count = this.selectedIds.size;
    this.loading = true;
    this.clearMessages();

    try {
      await this.storageService.deleteLeads([...this.selectedIds]);
      this.selectedIds = new Set();
      this.deleteConfirmOpen = false;
      await this.loadSavedLeads();
      this.successMessage = `${count} lead${count === 1 ? "" : "s"} deleted.`;
    } catch {
      this.parseError = "Could not delete leads from the server.";
    } finally {
      this.loading = false;
    }
  }

  private normalizeHeader(value: unknown): string {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s*\/\s*/g, "/")
      .replace(/\s+/g, " ");
  }

  private parseRow(
    headerRow: string[],
    row: (string | number)[],
  ): LeadRecord | null {
    const normalizedRow = headerRow.reduce<Record<string, string>>(
      (acc, header, index) => {
        acc[header] = String(row[index] ?? "").trim();
        return acc;
      },
      {},
    );

    const anyCellHasValue = Object.values(normalizedRow).some(
      (value) => value.length > 0,
    );
    if (!anyCellHasValue) {
      return null;
    }

    const statusValue =
      normalizedRow["status"] ||
      normalizedRow["lead status"] ||
      normalizedRow["estado"];

    return {
      region:
        normalizedRow["region"] ||
        normalizedRow["region/area"] ||
        normalizedRow["area"] ||
        "",
      country: normalizedRow["country"] || "",
      organization:
        normalizedRow["organization"] ||
        normalizedRow["organization name"] ||
        normalizedRow["entity"] ||
        "",
      acronym: normalizedRow["acronym"] || "",
      entityType:
        normalizedRow["entity type"] || normalizedRow["type of entity"] || "",
      website: normalizedRow["website"] || "",
      contactEmail:
        normalizedRow["contact email"] || normalizedRow["email"] || "",
      climateSpecialty:
        normalizedRow["climate specialty/profile"] ||
        normalizedRow["climate specialty"] ||
        normalizedRow["climate specialty profile"] ||
        "",
      comments: normalizedRow["comments"] || normalizedRow["comment"] || "",
      status: this.normalizeStatus(statusValue),
    };
  }

  private normalizeStatus(value: string): LeadStatus {
    const statusOption = this.statusOptions.find(
      (status) => status.toLowerCase() === String(value).trim().toLowerCase(),
    );
    return statusOption ?? "Pending";
  }

  private leadKey(lead: LeadRecord): string {
    const email = lead.contactEmail.trim().toLowerCase();
    if (email) {
      return `email:${email}`;
    }

    return [lead.organization, lead.country, lead.acronym, lead.region!]
      .map((value) => value.trim().toLowerCase())
      .join("|");
  }

  private getSearchableText(lead: LeadRecord): string {
    return [
      lead.region,
      lead.country,
      lead.organization,
      lead.acronym,
      lead.entityType,
      lead.website,
      lead.contactEmail,
      lead.climateSpecialty,
      lead.comments,
      lead.status,
    ]
      .join(" ")
      .toLowerCase();
  }

  private clampCurrentPage(): void {
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  }

  private clearMessages(): void {
    this.parseError = "";
    this.successMessage = "";
  }
}
