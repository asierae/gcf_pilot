import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { APPLICANTS_COLLECTION, firebaseConfig, LEADS_COLLECTION } from '../config/firebase.config';
import {
  ApplicantAdmin,
  ApplicantRecord,
  DEFAULT_APPLICANT_ADMIN,
  LeadRecord,
  ReviewSentLog,
  StagePayload
} from '../models/applicant.model';
import { SubmissionStatus } from '../models/applicant.model';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private readonly app: FirebaseApp;
  private readonly db: Firestore;

  constructor() {
    this.app = initializeApp(firebaseConfig);
    this.db = getFirestore(this.app);
  }

  async getAllApplicants(): Promise<ApplicantRecord[]> {
    const snapshot = await getDocs(collection(this.db, APPLICANTS_COLLECTION));
    return snapshot.docs
      .map((item) => this.normalizeApplicant(item.id, item.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getApplicantById(id: string): Promise<ApplicantRecord | null> {
    const snapshot = await getDoc(doc(this.db, APPLICANTS_COLLECTION, id));
    if (!snapshot.exists()) {
      return null;
    }

    return this.normalizeApplicant(snapshot.id, snapshot.data());
  }

  async createApplicantStage1(data: Record<string, unknown>): Promise<ApplicantRecord> {
    const now = new Date().toISOString();
    const applicant: ApplicantRecord = {
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
      stage1: { submittedAt: now, data },
      stage2: null,
      admin: { ...DEFAULT_APPLICANT_ADMIN },
      extensions: {}
    };

    await setDoc(doc(this.db, APPLICANTS_COLLECTION, applicant.id), applicant);
    return applicant;
  }

  async createApplicantStage2(data: Record<string, unknown>, stage1Data: Record<string, unknown>): Promise<ApplicantRecord> {
    const now = new Date().toISOString();
    const applicant: ApplicantRecord = {
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
      stage1: { submittedAt: now, data: stage1Data },
      stage2: { submittedAt: now, data },
      admin: { ...DEFAULT_APPLICANT_ADMIN },
      extensions: {}
    };

    await setDoc(doc(this.db, APPLICANTS_COLLECTION, applicant.id), applicant);
    return applicant;
  }

  async deleteApplicants(ids: string[]): Promise<void> {
    if (!ids.length) {
      return;
    }

    const batch = writeBatch(this.db);
    for (const id of ids) {
      batch.delete(doc(this.db, APPLICANTS_COLLECTION, id));
    }
    await batch.commit();
  }

  async updateApplicantStatus(id: string, status: SubmissionStatus): Promise<void> {
    await updateDoc(doc(this.db, APPLICANTS_COLLECTION, id), {
      'admin.status': status,
      updatedAt: new Date().toISOString()
    });
  }

  async updateApplicantReviewNote(id: string, sectionId: string, note: string): Promise<void> {
    await updateDoc(doc(this.db, APPLICANTS_COLLECTION, id), {
      [`admin.reviewNotes.${sectionId}`]: note,
      updatedAt: new Date().toISOString()
    });
  }

  async markApplicantReviewSent(id: string, recipient: string): Promise<void> {
    const lastReviewSent: ReviewSentLog = {
      sentAt: new Date().toISOString(),
      recipient
    };

    await updateDoc(doc(this.db, APPLICANTS_COLLECTION, id), {
      'admin.lastReviewSent': lastReviewSent,
      updatedAt: new Date().toISOString()
    });
  }

  async getLatestApplicantWithStage1(): Promise<ApplicantRecord | null> {
    const applicants = await this.getAllApplicants();
    return applicants.find((applicant) => applicant.stage1 !== null) ?? null;
  }

  async getLatestApplicantWithStage2(): Promise<ApplicantRecord | null> {
    const applicants = await this.getAllApplicants();
    return applicants.find((applicant) => applicant.stage2 !== null) ?? null;
  }

  async getAllLeads(): Promise<LeadRecord[]> {
    const snapshot = await getDocs(collection(this.db, LEADS_COLLECTION));
    return snapshot.docs
      .map((item) => this.normalizeLead(item.id, item.data()))
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }

  async createLeads(leads: Omit<LeadRecord, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<LeadRecord[]> {
    if (!leads.length) {
      return [];
    }

    const now = new Date().toISOString();
    const batch = writeBatch(this.db);
    const created: LeadRecord[] = [];

    for (const lead of leads) {
      const id = this.generateId();
      const record: LeadRecord = {
        ...lead,
        id,
        createdAt: now,
        updatedAt: now
      };
      batch.set(doc(this.db, LEADS_COLLECTION, id), record);
      created.push(record);
    }

    await batch.commit();
    return created;
  }

  async updateLead(id: string, lead: Omit<LeadRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await updateDoc(doc(this.db, LEADS_COLLECTION, id), {
      ...lead,
      updatedAt: new Date().toISOString()
    });
  }

  async deleteLeads(ids: string[]): Promise<void> {
    if (!ids.length) {
      return;
    }

    const batch = writeBatch(this.db);
    for (const id of ids) {
      batch.delete(doc(this.db, LEADS_COLLECTION, id));
    }
    await batch.commit();
  }

  private normalizeLead(id: string, raw: Record<string, unknown>): LeadRecord {
    return {
      id: (raw['id'] as string) ?? id,
      region: String(raw['region'] ?? ''),
      country: String(raw['country'] ?? ''),
      organization: String(raw['organization'] ?? ''),
      acronym: String(raw['acronym'] ?? ''),
      entityType: String(raw['entityType'] ?? ''),
      website: String(raw['website'] ?? ''),
      contactEmail: String(raw['contactEmail'] ?? ''),
      climateSpecialty: String(raw['climateSpecialty'] ?? ''),
      comments: String(raw['comments'] ?? ''),
      status: (raw['status'] as LeadRecord['status']) ?? 'Pending',
      createdAt: (raw['createdAt'] as string) ?? new Date().toISOString(),
      updatedAt: (raw['updatedAt'] as string) ?? new Date().toISOString()
    };
  }

  private normalizeApplicant(id: string, raw: Record<string, unknown>): ApplicantRecord {
    const admin = (raw['admin'] as ApplicantAdmin | undefined) ?? { ...DEFAULT_APPLICANT_ADMIN };

    return {
      id: (raw['id'] as string) ?? id,
      createdAt: (raw['createdAt'] as string) ?? new Date().toISOString(),
      updatedAt: (raw['updatedAt'] as string) ?? new Date().toISOString(),
      stage1: (raw['stage1'] as StagePayload | null | undefined) ?? null,
      stage2: (raw['stage2'] as StagePayload | null | undefined) ?? null,
      admin: {
        status: admin.status ?? 'Pending',
        reviewNotes: admin.reviewNotes ?? {},
        lastReviewSent: admin.lastReviewSent ?? null
      },
      extensions: (raw['extensions'] as Record<string, unknown> | undefined) ?? {}
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
