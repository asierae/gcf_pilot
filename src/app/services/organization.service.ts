import { Injectable, inject } from '@angular/core';
import {
  DraftForm,
  OrganizationDraft,
  OrganizationForms,
  OrganizationRecord,
} from '../models/organization.model';
import { ApiService } from './api.service';

/**
 * Organization profile, drafts and readiness submissions.
 *
 * The organization id is the single identifier shared by the forms, the drafts
 * and the R2 folder (`organizations/<id>/...`).
 */
@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly api = inject(ApiService);

  async load(id: string): Promise<OrganizationRecord | null> {
    try {
      return await this.api.getOrganization(id);
    } catch {
      return null;
    }
  }

  async save(
    id: string,
    profile: Partial<OrganizationRecord>,
  ): Promise<OrganizationRecord> {
    return this.api.saveOrganization(id, profile);
  }

  async isAcronymAvailable(acronym: string, organizationId: string): Promise<boolean> {
    const value = acronym.trim();
    if (!value) return false;
    try {
      return await this.api.isAcronymAvailable(value, organizationId);
    } catch {
      // Never block the user because the check itself failed.
      return true;
    }
  }

  async forms(id: string): Promise<OrganizationForms> {
    return this.api.getOrganizationForms(id);
  }

  async loadDraft(
    form: DraftForm,
    organizationId: string,
  ): Promise<OrganizationDraft | null> {
    try {
      return await this.api.getDraft(form, organizationId);
    } catch {
      return null;
    }
  }

  async saveDraft(
    form: DraftForm,
    organizationId: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    return this.api.saveDraft(form, organizationId, data);
  }

  async clearDraft(form: DraftForm, organizationId: string): Promise<void> {
    try {
      await this.api.deleteDraft(form, organizationId);
    } catch {
      // A missing draft is not an error here.
    }
  }

  async loadStage2Draft(
    organizationId: string,
  ): Promise<OrganizationDraft | null> {
    try {
      return await this.api.getStage2Draft(organizationId);
    } catch {
      return null;
    }
  }

  async saveStage2Draft(
    organizationId: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    return this.api.saveStage2Draft(organizationId, data);
  }

  async clearStage2Draft(organizationId: string): Promise<void> {
    try {
      await this.api.deleteStage2Draft(organizationId);
    } catch {
      // A missing draft is not an error here.
    }
  }

  async getAccreditationSubmission(id: string) {
    return this.api.getAccreditationSubmission(id);
  }

  async submitReadiness(
    organizationId: string,
    data: Record<string, unknown>,
  ): Promise<{ submittedAt: string; userCreated: boolean; username?: string }> {
    return this.api.submitReadiness(organizationId, data);
  }

  /** Admin edit: updates the submission without re-sending emails. */
  async updateReadiness(
    organizationId: string,
    data: Record<string, unknown>,
  ): Promise<{ submittedAt: string; updatedAt: string }> {
    return this.api.updateReadinessAdmin(organizationId, data);
  }
}
