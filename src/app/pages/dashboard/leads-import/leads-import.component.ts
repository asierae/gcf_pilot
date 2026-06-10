import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as XLSX from 'xlsx';
import { LeadRecord, LEAD_STATUS_OPTIONS, LeadStatus } from '../../../models/applicant.model';
import { StorageService } from '../../../services/storage.service';

type LeadField = keyof Omit<LeadRecord, 'id' | 'createdAt' | 'updatedAt'>;

@Component({
  selector: 'app-leads-import',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './leads-import.component.html',
  styleUrls: ['./leads-import.component.css']
})
export class LeadsImportComponent implements OnInit {
  fileName = '';
  parseError = '';
  successMessage = '';
  loadError = '';
  loading = false;
  tableLoading = true;
  savingFieldId: string | null = null;
  pendingLeads: LeadRecord[] = [];
  savedLeads: LeadRecord[] = [];
  searchQuery = '';
  readonly statusOptions = LEAD_STATUS_OPTIONS;
  readonly pageSize = 20;
  currentPage = 1;

  constructor(private storageService: StorageService) {}

  ngOnInit(): void {
    void this.loadSavedLeads();
  }

  async loadSavedLeads(): Promise<void> {
    this.tableLoading = true;
    this.loadError = '';

    try {
      this.savedLeads = await this.storageService.getLeads();
      this.clampCurrentPage();
    } catch {
      this.loadError = 'Could not load leads from Firebase.';
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
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!sheet) {
        throw new Error('No worksheet found in the selected file.');
      }

      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        defval: ''
      });

      if (rows.length < 2) {
        throw new Error('The Excel file must include a header row and at least one data row.');
      }

      const headerRow = (rows[0] as any[]).map((value: unknown) => String(value ?? '').trim().toLowerCase());
      const leadRows = rows.slice(1) as any[];
      const importedLeads: LeadRecord[] = leadRows
        .map((row) => this.parseRow(headerRow, row))
        .filter((lead): lead is LeadRecord => lead !== null);

      if (!importedLeads.length) {
        throw new Error('No valid rows were found in the file.');
      }

      this.pendingLeads = importedLeads;
    } catch (error) {
      this.parseError = error instanceof Error ? error.message : 'Unable to parse the selected Excel file.';
      this.pendingLeads = [];
    }
  }

  updatePendingField(index: number, field: LeadField, value: string): void {
    if (!this.pendingLeads[index]) {
      return;
    }

    this.pendingLeads[index] = {
      ...this.pendingLeads[index],
      [field]: field === 'status' ? this.normalizeStatus(value) : value
    };
  }

  async saveLeads(): Promise<void> {
    this.clearMessages();

    if (!this.pendingLeads.length) {
      this.parseError = 'Please choose an Excel file before saving.';
      return;
    }

    const existingKeys = new Set(this.savedLeads.map((lead) => this.leadKey(lead)));
    const newLeads = this.pendingLeads.filter((lead) => !existingKeys.has(this.leadKey(lead)));
    const skippedCount = this.pendingLeads.length - newLeads.length;

    if (!newLeads.length) {
      this.successMessage = `All ${skippedCount} row${skippedCount === 1 ? '' : 's'} already exist and were ignored.`;
      this.pendingLeads = [];
      this.fileName = '';
      return;
    }

    this.loading = true;

    try {
      const created = await this.storageService.saveLeads(newLeads);
      this.savedLeads = [...created, ...this.savedLeads];
      this.currentPage = 1;

      const addedCount = created.length;
      if (skippedCount > 0) {
        this.successMessage = `${addedCount} row${addedCount === 1 ? '' : 's'} added. ${skippedCount} duplicate${skippedCount === 1 ? '' : 's'} ignored.`;
      } else {
        this.successMessage = `${addedCount} row${addedCount === 1 ? '' : 's'} added successfully.`;
      }

      this.pendingLeads = [];
      this.fileName = '';
    } catch {
      this.parseError = 'Could not save leads to Firebase. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  async updateSavedField(lead: LeadRecord, field: LeadField, value: string): Promise<void> {
    if (!lead.id) {
      return;
    }

    const normalizedValue = field === 'status' ? this.normalizeStatus(value) : value;
    const previous = lead[field];
    const updatedLead: LeadRecord = {
      ...lead,
      [field]: normalizedValue
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
      this.parseError = 'Could not update the row in Firebase.';
    } finally {
      this.savingFieldId = null;
    }
  }

  onSearchInput(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.currentPage = 1;
  }

  clearSearch(): void {
    this.searchQuery = '';
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
    if (!query) {
      return this.savedLeads;
    }

    return this.savedLeads.filter((lead) => this.getSearchableText(lead).includes(query));
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
    return Math.min(this.currentPage * this.pageSize, this.filteredLeads.length);
  }

  get hasSearch(): boolean {
    return Boolean(this.searchQuery.trim());
  }

  getStatusClass(status: LeadStatus): string {
    return `status-select status-${status.toLowerCase()}`;
  }

  private parseRow(headerRow: string[], row: (string | number)[]): LeadRecord | null {
    const normalizedRow = headerRow.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = String(row[index] ?? '').trim();
      return acc;
    }, {});

    const anyCellHasValue = Object.values(normalizedRow).some((value) => value.length > 0);
    if (!anyCellHasValue) {
      return null;
    }

    const statusValue = normalizedRow['status'] || normalizedRow['lead status'] || normalizedRow['estado'];

    return {
      region: normalizedRow['region'] || normalizedRow['region/area'] || normalizedRow['area'] || '',
      country: normalizedRow['country'] || '',
      organization:
        normalizedRow['organization'] || normalizedRow['organization name'] || normalizedRow['entity'] || '',
      acronym: normalizedRow['acronym'] || '',
      entityType: normalizedRow['entity type'] || normalizedRow['type of entity'] || '',
      website: normalizedRow['website'] || '',
      contactEmail: normalizedRow['contact email'] || normalizedRow['email'] || '',
      climateSpecialty:
        normalizedRow['climate specialty/profile'] || normalizedRow['climate specialty'] || normalizedRow['profile'] || '',
      status: this.normalizeStatus(statusValue)
    };
  }

  private normalizeStatus(value: string): LeadStatus {
    const statusOption = this.statusOptions.find(
      (status) => status.toLowerCase() === String(value).trim().toLowerCase()
    );
    return statusOption ?? 'Pending';
  }

  private leadKey(lead: LeadRecord): string {
    const email = lead.contactEmail.trim().toLowerCase();
    if (email) {
      return `email:${email}`;
    }

    return [
      lead.organization,
      lead.country,
      lead.acronym,
      lead.region
    ]
      .map((value) => value.trim().toLowerCase())
      .join('|');
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
      lead.status
    ]
      .join(' ')
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
    this.parseError = '';
    this.successMessage = '';
  }
}
