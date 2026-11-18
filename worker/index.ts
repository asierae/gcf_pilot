/**
 * Cloudflare Worker API for the Averacapital GCF portal.
 *
 * The Angular SPA is served from the ASSETS binding. Every request to
 * /api/* is handled here first (see `assets.run_worker_first` in
 * wrangler.jsonc) and never reaches the static-asset layer.
 *
 * Storage layout
 *  - D1  (binding DB)        -> applicants + leads tables (see worker/schema.sql)
 *  - R2  (binding DOCUMENTS) -> uploaded PDFs/documents, served via /api/files/*
 *
 * Auth
 *  - POST /api/login exchanges admin credentials for API_TOKEN.
 *  - Every admin route requires `Authorization: Bearer <API_TOKEN>`.
 *  - Applicant submissions and file uploads stay public, matching the
 *    previous direct-to-browser storage behaviour.
 */

type JsonObject = Record<string, unknown>;

import {
  renderEmailHtml,
  renderEmailText,
  type EmailContent,
} from './email';

interface Env {
  ASSETS: AssetsFetcher;
  DB: D1DatabaseLike;
  DOCUMENTS: R2BucketLike;
  API_TOKEN?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  /** JSON map of username -> password, e.g. {"hatyja":"asier"} */
  ADMIN_ACCOUNTS?: string;
  /** Comma-separated origins allowed to call this API cross-origin (e.g. the Vercel URL) */
  CORS_ORIGINS?: string;
  /** Resend API key. When missing, emails fall back to Gmail compose in the UI. */
  RESEND_API_KEY?: string;
  /** Public contact inbox (defaults to contact@averacapitalaccess.com). */
  CONTACT_EMAIL?: string;
  /** Sender for automatic emails (defaults to noreply@averacapitalaccess.com). */
  NOREPLY_EMAIL?: string;
  /** Public site origin used for logo, CTA links and the footer (defaults to https://averacapitalaccess.com). */
  SITE_URL?: string;
}

/* ------------------------------------------------------------------ *
 * Minimal Workers runtime types (avoids adding @cloudflare/workers-types)
 * ------------------------------------------------------------------ */

interface AssetsFetcher {
  fetch(request: Request): Promise<Response>;
}

interface D1ResultLike<T> {
  results?: T[];
}

interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  first<T = JsonObject>(): Promise<T | null>;
  all<T = JsonObject>(): Promise<D1ResultLike<T>>;
  run(): Promise<unknown>;
}

interface D1DatabaseLike {
  prepare(query: string): D1StatementLike;
  batch(statements: D1StatementLike[]): Promise<unknown[]>;
}

interface R2HttpMetadata {
  contentType?: string;
  contentDisposition?: string;
  cacheControl?: string;
}

interface R2ObjectBodyLike {
  body: ReadableStream;
  size: number;
  httpMetadata?: R2HttpMetadata;
}

interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: R2HttpMetadata },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBodyLike | null>;
  delete(key: string): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * Domain types (mirror src/app/models/applicant.model.ts)
 * ------------------------------------------------------------------ */

type SubmissionStatus = 'Pending' | 'Passed' | 'Failed';

const SUBMISSION_STATUSES: SubmissionStatus[] = ['Pending', 'Passed', 'Failed'];
const LEAD_STATUSES = ['Pending', 'Contacted', 'Qualified', 'Rejected'];

interface StagePayload {
  submittedAt: string;
  data: JsonObject;
}

interface ReviewSentLog {
  sentAt: string;
  recipient: string;
}

interface ApplicantAdmin {
  status: SubmissionStatus;
  reviewNotes: Record<string, string>;
  lastReviewSent: ReviewSentLog | null;
}

interface ApplicantRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  stage1: StagePayload | null;
  stage2: StagePayload | null;
  admin: ApplicantAdmin;
  extensions: JsonObject;
}

interface ApplicantRow {
  id: string;
  created_at: string;
  updated_at: string;
  stage1: string | null;
  stage2: string | null;
  admin: string | null;
  extensions: string | null;
}

interface LeadRecord {
  id: string;
  region: string;
  country: string;
  organization: string;
  acronym: string;
  entityType: string;
  website: string;
  contactEmail: string;
  climateSpecialty: string;
  comments: string;
  status: string;
  contactName: string;
  contactRole: string;
  objective: string;
  financing: string;
  timeline: string;
  operatingHistory: string;
  availableDocuments: string[];
  projectStage: string;
  projectCountry: string;
  projectSector: string;
  accessType: string;
  complianceIssues: string;
  challenge: string;
  engagement: string;
  consent: boolean;
  readinessScore: number;
  suggestedRoute: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

interface LeadRow {
  id: string;
  region: string | null;
  country: string | null;
  organization: string | null;
  acronym: string | null;
  entity_type: string | null;
  website: string | null;
  contact_email: string | null;
  climate_specialty: string | null;
  comments: string | null;
  status: string | null;
  contact_name: string | null;
  contact_role: string | null;
  objective: string | null;
  financing: string | null;
  timeline: string | null;
  operating_history: string | null;
  available_documents: string | null;
  project_stage: string | null;
  project_country: string | null;
  project_sector: string | null;
  access_type: string | null;
  compliance_issues: string | null;
  challenge: string | null;
  engagement: string | null;
  consent: number | null;
  readiness_score: number | null;
  suggested_route: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

interface OrganizationRow {
  id: string;
  name: string | null;
  acronym: string | null;
  acronym_norm: string | null;
  legal_address: string | null;
  operational_address: string | null;
  website: string | null;
  country: string | null;
  entity_type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
}

interface OrganizationRecord {
  id: string;
  name: string;
  acronym: string;
  legalAddress: string;
  operationalAddress: string;
  website: string;
  country: string;
  entityType: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  createdAt: string;
  updatedAt: string;
}

type DraftForm = 'stage1' | 'readiness';

const DRAFT_TABLES: Record<DraftForm, string> = {
  stage1: 'stage1_drafts',
  readiness: 'readiness_drafts',
};

const DEFAULT_ADMIN: ApplicantAdmin = {
  status: 'Pending',
  reviewNotes: {},
  lastReviewSent: null,
};

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_BATCH_IDS = 500;

/**
 * R2 layout: `<scope>/<entityId>/<section>/<uuid>-<file name>`.
 *  - organizations -> applicants (stage 1 & 2) and readiness applications
 *  - leads         -> lead documents
 */
const UPLOAD_SCOPES = ['organizations', 'leads'] as const;
type UploadScope = (typeof UPLOAD_SCOPES)[number];

/** Keys written before the folder layout existed; still readable/deletable. */
const LEGACY_UPLOAD_PREFIX = 'gcf-applicants/';

const UPLOAD_KEY_PREFIXES = [
  ...UPLOAD_SCOPES.map((scope) => `${scope}/`),
  LEGACY_UPLOAD_PREFIX,
];

/** One path segment: letters, digits, dot, dash, underscore. No slashes. */
const KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

/** Applicant ids generated by the client wizard (UUID) or by this Worker. */
const APPLICANT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{5,79}$/;

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function empty(status = 204): Response {
  return new Response(null, { status });
}

function methodNotAllowed(allow: string): Response {
  return json({ error: `Method not allowed. Use ${allow}.` }, 405);
}

function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  if (!origin) return {};

  const allowed = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!allowed.includes('*') && !allowed.includes(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

async function readJson<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text) {
    throw new HttpError(400, 'Request body is required.');
  }
  if (text.length > MAX_JSON_BYTES) {
    throw new HttpError(413, 'Request body is too large.');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
}

function asObject(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, `"${field}" must be an object.`);
  }
  return value as JsonObject;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new HttpError(400, `"${field}" must be a string.`);
  }
  return value;
}

/** Reads an optional string field, returning '' when absent or not a string. */
function readText(source: JsonObject, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Validates an organization / applicant id coming from the client. */
function assertEntityId(id: string): void {
  if (!APPLICANT_ID_PATTERN.test(id) || id.includes('..')) {
    throw new HttpError(400, '"id" is not valid.');
  }
}

/** Reads an entity id, generating one when the client omits it. */
function readEntityId(raw: unknown): string {
  if (raw === undefined || raw === null) {
    return generateId();
  }
  if (typeof raw !== 'string') {
    throw new HttpError(400, '"id" must be a string.');
  }
  const id = raw.trim();
  assertEntityId(id);
  return id;
}

function stripTrailingSlash(path: string): string {
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (cleaned || 'file').slice(0, 120);
}

function resourceTypeFor(contentType: string): 'image' | 'video' | 'raw' {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  return 'raw';
}

/* ------------------------------------------------------------------ *
 * Row <-> record mapping
 * ------------------------------------------------------------------ */

function normalizeAdmin(raw: unknown): ApplicantAdmin {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_ADMIN };
  }
  const admin = raw as Partial<ApplicantAdmin>;
  const status = SUBMISSION_STATUSES.includes(admin.status as SubmissionStatus)
    ? (admin.status as SubmissionStatus)
    : 'Pending';
  return {
    status,
    reviewNotes:
      admin.reviewNotes && typeof admin.reviewNotes === 'object'
        ? admin.reviewNotes
        : {},
    lastReviewSent: admin.lastReviewSent ?? null,
  };
}

function normalizeStage(raw: unknown): StagePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const stage = raw as Partial<StagePayload>;
  return {
    submittedAt:
      typeof stage.submittedAt === 'string'
        ? stage.submittedAt
        : new Date().toISOString(),
    data:
      stage.data && typeof stage.data === 'object'
        ? (stage.data as JsonObject)
        : {},
  };
}

function rowToApplicant(row: ApplicantRow): ApplicantRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stage1: normalizeStage(parseJson<unknown>(row.stage1, null)),
    stage2: normalizeStage(parseJson<unknown>(row.stage2, null)),
    admin: normalizeAdmin(parseJson<unknown>(row.admin, null)),
    extensions: parseJson<JsonObject>(row.extensions, {}),
  };
}

function rowToLead(row: LeadRow): LeadRecord {
  return {
    id: row.id,
    region: row.region ?? '',
    country: row.country ?? '',
    organization: row.organization ?? '',
    acronym: row.acronym ?? '',
    entityType: row.entity_type ?? '',
    website: row.website ?? '',
    contactEmail: row.contact_email ?? '',
    climateSpecialty: row.climate_specialty ?? '',
    comments: row.comments ?? '',
    status: row.status ?? 'Pending',
    contactName: row.contact_name ?? '',
    contactRole: row.contact_role ?? '',
    objective: row.objective ?? '',
    financing: row.financing ?? '',
    timeline: row.timeline ?? '',
    operatingHistory: row.operating_history ?? '',
    availableDocuments: parseJson<string[]>(row.available_documents, []),
    projectStage: row.project_stage ?? '',
    projectCountry: row.project_country ?? '',
    projectSector: row.project_sector ?? '',
    accessType: row.access_type ?? '',
    complianceIssues: row.compliance_issues ?? '',
    challenge: row.challenge ?? '',
    engagement: row.engagement ?? '',
    consent: row.consent === 1,
    readinessScore: row.readiness_score ?? 0,
    suggestedRoute: row.suggested_route ?? '',
    source: row.source ?? 'manual',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ------------------------------------------------------------------ *
 * Organizations
 * ------------------------------------------------------------------ */

function rowToOrganization(row: OrganizationRow): OrganizationRecord {
  return {
    id: row.id,
    name: row.name ?? '',
    acronym: row.acronym ?? '',
    legalAddress: row.legal_address ?? '',
    operationalAddress: row.operational_address ?? '',
    website: row.website ?? '',
    country: row.country ?? '',
    entityType: row.entity_type ?? '',
    contactName: row.contact_name ?? '',
    contactEmail: row.contact_email ?? '',
    contactPhone: row.contact_phone ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeAcronym(value: string): string {
  return value.trim().toLowerCase();
}

function readOrgFields(body: JsonObject): OrganizationRecord {
  const pick = (key: string): string => {
    const value = body[key];
    return typeof value === 'string' ? value.trim() : '';
  };

  const organization: OrganizationRecord = {
    id: '',
    name: pick('name'),
    acronym: pick('acronym'),
    legalAddress: pick('legalAddress'),
    operationalAddress: pick('operationalAddress'),
    website: pick('website'),
    country: pick('country'),
    entityType: pick('entityType'),
    contactName: pick('contactName'),
    contactEmail: pick('contactEmail'),
    contactPhone: pick('contactPhone'),
    createdAt: '',
    updatedAt: '',
  };

  return organization;
}

async function findAcronymOwner(
  env: Env,
  acronym: string,
  excludeId: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT id FROM organizations WHERE acronym_norm = ?',
  )
    .bind(normalizeAcronym(acronym))
    .first<{ id: string }>();

  if (!row || row.id === excludeId) return null;
  return row.id;
}

/**
 * Creates the organization on first write and keeps its profile in sync on
 * later writes. `name` and `acronym` are immutable once the organization
 * exists: they identify it and the acronym is unique across the platform.
 */
async function saveOrganization(
  env: Env,
  id: string,
  input: OrganizationRecord,
): Promise<OrganizationRecord> {
  const now = new Date().toISOString();
  const existing = await env.DB.prepare('SELECT * FROM organizations WHERE id = ?')
    .bind(id)
    .first<OrganizationRow>();

  if (!existing) {
    if (!input.name) {
      throw new HttpError(400, 'Organization name is required.');
    }
    if (!input.acronym) {
      throw new HttpError(400, 'Organization acronym is required.');
    }
    if (await findAcronymOwner(env, input.acronym, id)) {
      throw new HttpError(
        409,
        `The acronym "${input.acronym}" is already registered. Please use a different one.`,
      );
    }

    await env.DB.prepare(
      `INSERT INTO organizations (
         id, name, acronym, acronym_norm, legal_address, operational_address,
         website, country, entity_type, contact_name, contact_email,
         contact_phone, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        input.name,
        input.acronym,
        normalizeAcronym(input.acronym),
        input.legalAddress,
        input.operationalAddress,
        input.website,
        input.country,
        input.entityType,
        input.contactName,
        input.contactEmail,
        input.contactPhone,
        now,
        now,
      )
      .run();

    return { ...input, id, createdAt: now, updatedAt: now };
  }

  await env.DB.prepare(
    `UPDATE organizations
        SET legal_address = ?, operational_address = ?, website = ?,
            country = ?, entity_type = ?, contact_name = ?,
            contact_email = ?, contact_phone = ?, updated_at = ?
      WHERE id = ?`,
  )
    .bind(
      input.legalAddress || existing.legal_address || '',
      input.operationalAddress || existing.operational_address || '',
      input.website || existing.website || '',
      input.country || existing.country || '',
      input.entityType || existing.entity_type || '',
      input.contactName || existing.contact_name || '',
      input.contactEmail || existing.contact_email || '',
      input.contactPhone || existing.contact_phone || '',
      now,
      id,
    )
    .run();

  const updated = await env.DB.prepare('SELECT * FROM organizations WHERE id = ?')
    .bind(id)
    .first<OrganizationRow>();

  return updated ? rowToOrganization(updated) : { ...input, id, createdAt: now, updatedAt: now };
}

/** Organization profile derived from a pre-screening (stage 1) payload. */
function organizationFromStage1(data: JsonObject): OrganizationRecord {
  const read = (key: string): string => {
    const value = data[key];
    return typeof value === 'string' ? value.trim() : '';
  };

  return {
    id: '',
    name: read('applicantName'),
    acronym: read('applicantAcronym'),
    legalAddress: read('legalAddress'),
    operationalAddress: read('operationalAddress'),
    website: read('website'),
    country: read('headquartersCountry'),
    entityType: read('typeOfEntity'),
    contactName: read('primaryContactName'),
    contactEmail: read('primaryContactEmail'),
    contactPhone: read('primaryContactPhone'),
    createdAt: '',
    updatedAt: '',
  };
}

/** Organization profile derived from a readiness payload. */
function organizationFromReadiness(data: JsonObject): OrganizationRecord {
  const metadata =
    data.metadata && typeof data.metadata === 'object'
      ? (data.metadata as JsonObject)
      : {};
  const read = (key: string): string => {
    const value = metadata[key];
    return typeof value === 'string' ? value.trim() : '';
  };

  return {
    id: '',
    name: read('organizationLegalName'),
    acronym: read('organizationAcronym'),
    legalAddress: '',
    operationalAddress: '',
    website: '',
    country: read('country'),
    entityType: read('entityType'),
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    createdAt: '',
    updatedAt: '',
  };
}

async function getOrganization(env: Env, id: string): Promise<Response> {
  assertEntityId(id);
  const row = await env.DB.prepare('SELECT * FROM organizations WHERE id = ?')
    .bind(id)
    .first<OrganizationRow>();

  return json({ organization: row ? rowToOrganization(row) : null });
}

async function putOrganization(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  assertEntityId(id);
  const body = await readJson<JsonObject>(request);
  const organization = await saveOrganization(env, id, readOrgFields(body));
  return json({ organization });
}

async function acronymAvailable(
  env: Env,
  acronym: string,
  excludeId: string,
): Promise<Response> {
  const trimmed = acronym.trim();
  if (!trimmed) {
    return json({ available: false, acronym: '' });
  }

  const owner = await findAcronymOwner(env, trimmed, excludeId);
  return json({ available: owner === null, acronym: trimmed });
}

/* ------------------------------------------------------------------ *
 * Drafts
 * ------------------------------------------------------------------ */

function readDraftForm(raw: string): DraftForm {
  if (raw !== 'stage1' && raw !== 'readiness') {
    throw new HttpError(400, 'Unknown draft form.');
  }
  return raw;
}

async function getDraft(env: Env, form: DraftForm, orgId: string): Promise<Response> {
  assertEntityId(orgId);
  const row = await env.DB.prepare(
    `SELECT data, updated_at FROM ${DRAFT_TABLES[form]} WHERE organization_id = ?`,
  )
    .bind(orgId)
    .first<{ data: string; updated_at: string }>();

  return json({
    draft: row
      ? { data: parseJson<JsonObject>(row.data, {}), updatedAt: row.updated_at }
      : null,
  });
}

async function putDraft(
  request: Request,
  env: Env,
  form: DraftForm,
  orgId: string,
): Promise<Response> {
  assertEntityId(orgId);
  const body = await readJson<{ data?: unknown }>(request);
  const data = asObject(body.data, 'data');
  const now = new Date().toISOString();
  const table = DRAFT_TABLES[form];

  await env.DB.prepare(
    `INSERT INTO ${table} (organization_id, data, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(organization_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  )
    .bind(orgId, JSON.stringify(data), now)
    .run();

  return json({ updatedAt: now });
}

async function deleteDraft(
  env: Env,
  form: DraftForm,
  orgId: string,
): Promise<Response> {
  assertEntityId(orgId);
  await deleteDraftRow(env, form, orgId);
  return empty();
}

/* ------------------------------------------------------------------ *
 * Readiness submissions
 * ------------------------------------------------------------------ */

async function putReadiness(
  request: Request,
  env: Env,
  orgId: string,
): Promise<Response> {
  assertEntityId(orgId);
  const body = await readJson<{ data?: unknown }>(request);
  const data = asObject(body.data, 'data');
  const now = new Date().toISOString();

  // The readiness answers also register/refresh the organization profile.
  const organization = await saveOrganization(env, orgId, organizationFromReadiness(data));

  const existing = await env.DB.prepare(
    'SELECT submitted_at FROM readiness_applications WHERE organization_id = ?',
  )
    .bind(orgId)
    .first<{ submitted_at: string }>();

  await env.DB.prepare(
    `INSERT INTO readiness_applications (organization_id, submitted_at, updated_at, data)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(organization_id) DO UPDATE SET
       submitted_at = excluded.submitted_at,
       updated_at = excluded.updated_at,
       data = excluded.data`,
  )
    .bind(orgId, now, now, JSON.stringify(data))
    .run();

  await deleteDraftRow(env, 'readiness', orgId);

  const metadata =
    data.metadata && typeof data.metadata === 'object'
      ? (data.metadata as JsonObject)
      : {};
  const amount = metadata.requestedAmountUSD;
  await notifySubmission(env, {
    form: 'readiness',
    organizationName: readText(metadata, 'organizationLegalName') || organization.name,
    contactName: readText(metadata, 'ndaFocalPointName'),
    contactEmail: readText(metadata, 'ndaEmail'),
    details: [
      {
        label: 'Organization',
        value: readText(metadata, 'organizationLegalName') || organization.name,
      },
      { label: 'Acronym', value: organization.acronym },
      { label: 'Proposal', value: readText(metadata, 'proposalTitle') },
      { label: 'Country', value: readText(metadata, 'country') },
      {
        label: 'Requested amount',
        value:
          typeof amount === 'number'
            ? `USD ${amount.toLocaleString('en-US')}`
            : readText(metadata, 'requestedAmountUSD'),
      },
      { label: 'Submitted', value: now },
    ],
  });

  return json(
    {
      submission: { organizationId: orgId, submittedAt: now, data },
      organization,
      created: existing === null,
    },
    existing === null ? 201 : 200,
  );
}

interface ReadinessListRow {
  organization_id: string;
  submitted_at: string;
  updated_at: string;
  data: string;
  org_name: string | null;
  org_acronym: string | null;
  org_country: string | null;
}

/** Compact row for the admin readiness dashboard. */
function readinessSummary(row: ReadinessListRow): JsonObject {
  const data = parseJson<JsonObject>(row.data, {});
  const metadata =
    data.metadata && typeof data.metadata === 'object'
      ? (data.metadata as JsonObject)
      : {};
  const read = (key: string): string => {
    const value = metadata[key];
    return typeof value === 'string' ? value : '';
  };
  const amount = metadata.requestedAmountUSD;

  return {
    organizationId: row.organization_id,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    organization: {
      name: row.org_name || read('organizationLegalName'),
      acronym: row.org_acronym || read('organizationAcronym'),
      country: row.org_country || read('country'),
    },
    proposalTitle: read('proposalTitle'),
    requestedAmountUSD: typeof amount === 'number' ? amount : null,
    ndaEmail: read('ndaEmail'),
  };
}

async function listReadiness(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT r.organization_id, r.submitted_at, r.updated_at, r.data,
            o.name AS org_name, o.acronym AS org_acronym, o.country AS org_country
       FROM readiness_applications r
       LEFT JOIN organizations o ON o.id = r.organization_id
      ORDER BY r.submitted_at DESC`,
  ).all<ReadinessListRow>();

  return json({ submissions: (results ?? []).map(readinessSummary) });
}

/**
 * Admin edit: rewrites the readiness answers without bumping `submitted_at`
 * and without sending another pair of submission emails.
 */
async function updateReadinessAdmin(
  request: Request,
  env: Env,
  orgId: string,
): Promise<Response> {
  assertEntityId(orgId);
  const body = await readJson<{ data?: unknown }>(request);
  const data = asObject(body.data, 'data');
  const now = new Date().toISOString();

  const existing = await env.DB.prepare(
    'SELECT submitted_at FROM readiness_applications WHERE organization_id = ?',
  )
    .bind(orgId)
    .first<{ submitted_at: string }>();

  if (!existing) {
    return json({ error: 'Readiness submission not found.' }, 404);
  }

  const organization = await saveOrganization(
    env,
    orgId,
    organizationFromReadiness(data),
  );

  await env.DB.prepare(
    `UPDATE readiness_applications
        SET updated_at = ?, data = ?
      WHERE organization_id = ?`,
  )
    .bind(now, JSON.stringify(data), orgId)
    .run();

  await deleteDraftRow(env, 'readiness', orgId);

  return json({
    submission: {
      organizationId: orgId,
      submittedAt: existing.submitted_at,
      updatedAt: now,
      data,
    },
    organization,
  });
}

async function getReadiness(env: Env, orgId: string): Promise<Response> {
  assertEntityId(orgId);
  const row = await env.DB.prepare(
    'SELECT submitted_at, data FROM readiness_applications WHERE organization_id = ?',
  )
    .bind(orgId)
    .first<{ submitted_at: string; data: string }>();

  return json({
    submission: row
      ? {
          organizationId: orgId,
          submittedAt: row.submitted_at,
          data: parseJson<JsonObject>(row.data, {}),
        }
      : null,
  });
}

async function deleteDraftRow(
  env: Env,
  form: DraftForm,
  orgId: string,
): Promise<void> {
  await env.DB.prepare(
    `DELETE FROM ${DRAFT_TABLES[form]} WHERE organization_id = ?`,
  )
    .bind(orgId)
    .run();
}

/**
 * Everything an organization has filled in, used by the organization
 * dashboard and by the wizards to prefill themselves.
 */
async function organizationForms(env: Env, orgId: string): Promise<Response> {
  assertEntityId(orgId);
  const orgRow = await env.DB.prepare('SELECT * FROM organizations WHERE id = ?')
    .bind(orgId)
    .first<OrganizationRow>();

  const applicant = await env.DB.prepare('SELECT * FROM applicants WHERE id = ?')
    .bind(orgId)
    .first<ApplicantRow>();

  const readinessRow = await env.DB.prepare(
    'SELECT submitted_at, data FROM readiness_applications WHERE organization_id = ?',
  )
    .bind(orgId)
    .first<{ submitted_at: string; data: string }>();

  const drafts: Record<string, string | null> = { stage1: null, readiness: null };
  for (const form of ['stage1', 'readiness'] as DraftForm[]) {
    const row = await env.DB.prepare(
      `SELECT updated_at FROM ${DRAFT_TABLES[form]} WHERE organization_id = ?`,
    )
      .bind(orgId)
      .first<{ updated_at: string }>();
    drafts[form] = row?.updated_at ?? null;
  }

  if (!orgRow && !applicant && !readinessRow) {
    return json({ organization: null, stage1: null, stage2: null, readiness: null, drafts });
  }

  const stage1 = applicant ? normalizeStage(parseJson<unknown>(applicant.stage1, null)) : null;
  const stage2 = applicant ? normalizeStage(parseJson<unknown>(applicant.stage2, null)) : null;

  return json({
    organization: orgRow ? rowToOrganization(orgRow) : null,
    stage1: stage1 ? { submittedAt: stage1.submittedAt, data: stage1.data } : null,
    stage2: stage2 ? { submittedAt: stage2.submittedAt, data: stage2.data } : null,
    readiness: readinessRow
      ? {
          submittedAt: readinessRow.submitted_at,
          data: parseJson<JsonObject>(readinessRow.data, {}),
        }
      : null,
    drafts,
  });
}

/* ------------------------------------------------------------------ *
 * Email (Resend)
 *
 *  - contact@averacapitalaccess.com -> public inbox, also the reply-to
 *  - noreply@averacapitalaccess.com -> sender of automatic notifications
 *
 * Without RESEND_API_KEY every send is a no-op and the review endpoint
 * answers 501 so the UI can fall back to Gmail compose.
 * ------------------------------------------------------------------ */

const DEFAULT_CONTACT_EMAIL = 'contact@averacapitalaccess.com';
const DEFAULT_NOREPLY_EMAIL = 'noreply@averacapitalaccess.com';
const DEFAULT_SITE_URL = 'https://averacapitalaccess.com';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function contactEmail(env: Env): string {
  return env.CONTACT_EMAIL?.trim() || DEFAULT_CONTACT_EMAIL;
}

function noreplyEmail(env: Env): string {
  return env.NOREPLY_EMAIL?.trim() || DEFAULT_NOREPLY_EMAIL;
}

function siteUrl(env: Env): string {
  return (env.SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

interface OutgoingEmail {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  fromName?: string;
  /** Overrides the default no-reply sender, e.g. contact@ for account mail. */
  from?: string;
}

async function sendEmail(env: Env, message: OutgoingEmail): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;

  const recipients = (Array.isArray(message.to) ? message.to : [message.to])
    .map((value) => value.trim())
    .filter((value) => EMAIL_PATTERN.test(value));
  if (!recipients.length) return false;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${message.fromName ?? 'Avera Capital Access'} <${message.from ?? noreplyEmail(env)}>`,
        to: recipients,
        subject: message.subject,
        html: message.html,
        ...(message.text ? { text: message.text } : {}),
        reply_to: message.replyTo ?? contactEmail(env),
      }),
    });

    if (!response.ok) {
      console.error('Resend rejected the email', response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('Resend request failed', error);
    return false;
  }
}

type SubmissionForm = 'pre-screening' | 'stage 2' | 'readiness';

interface SubmissionNotice {
  form: SubmissionForm;
  organizationName: string;
  contactName: string;
  contactEmail: string;
  details: { label: string; value: string }[];
}

/** Confirmation to the applicant plus a copy for the team. Never throws. */
async function notifySubmission(env: Env, notice: SubmissionNotice): Promise<void> {
  if (!env.RESEND_API_KEY) return;

  const label =
    notice.form === 'readiness'
      ? 'readiness application'
      : notice.form === 'stage 2'
        ? 'stage 2 application'
        : 'pre-screening questionnaire';
  const org = notice.organizationName || 'your organization';
  const site = siteUrl(env);
  const brand = { site, inbox: contactEmail(env) };
  const wizardPath = notice.form === 'readiness' ? '/readiness' : '/stage1';

  try {
    if (EMAIL_PATTERN.test(notice.contactEmail)) {
      const receipt: EmailContent = {
        kicker: 'Submission received',
        title: `Thank you, ${notice.contactName || 'there'}`,
        intro: `We received the ${label} for ${org}. Our team will review it and come back to you if anything else is needed.`,
        paragraphs: [
          'You can keep working on your submission at any time — drafts are saved to your organization so nothing is lost between sessions.',
        ],
        rows: notice.details,
        cta: {
          label: 'Continue in the portal',
          href: `${site}${wizardPath}`,
        },
        footnote: 'Typical first response: 2 business days.',
        audience: 'applicant',
      };

      await sendEmail(env, {
        to: notice.contactEmail,
        subject: `We received the ${label} for ${org}`,
        html: renderEmailHtml(receipt, brand),
        text: renderEmailText(receipt, brand),
      });
    }

    const internal: EmailContent = {
      kicker: 'New submission',
      title: `New ${label}`,
      intro: `${org} submitted a ${label} through the portal.`,
      rows: [
        ...notice.details,
        { label: 'Contact', value: notice.contactName },
        { label: 'Email', value: notice.contactEmail },
      ],
      cta: {
        label: 'Open the advisor dashboard',
        href: `${site}/dashboard`,
      },
      footnote: 'Reply to this email to answer the applicant directly.',
      audience: 'team',
    };

    await sendEmail(env, {
      to: contactEmail(env),
      subject: `New ${label}: ${org}`,
      html: renderEmailHtml(internal, brand),
      text: renderEmailText(internal, brand),
      replyTo: EMAIL_PATTERN.test(notice.contactEmail)
        ? notice.contactEmail
        : contactEmail(env),
    });
  } catch (error) {
    console.error('Submission notification failed', error);
  }
}

async function sendReviewEmail(request: Request, env: Env): Promise<Response> {
  if (!env.RESEND_API_KEY) {
    return json(
      {
        error:
          'Automatic email sending is not configured. Review emails open in Gmail compose instead.',
      },
      501,
    );
  }

  const body = await readJson<{ to?: unknown; subject?: unknown; body?: unknown }>(request);
  const to = asString(body.to, 'to').trim();
  const subject = asString(body.subject, 'subject').trim();
  const text = asString(body.body, 'body').trim();

  if (!EMAIL_PATTERN.test(to)) {
    throw new HttpError(400, '"to" must be a valid email address.');
  }
  if (!subject) {
    throw new HttpError(400, '"subject" is required.');
  }
  if (!text) {
    throw new HttpError(400, '"body" is required.');
  }

  const [firstLine, ...rest] = text.split(/\n{2,}/);
  const review: EmailContent = {
    kicker: 'Advisory message',
    title: subject,
    intro: firstLine,
    paragraphs: rest,
    cta: {
      label: 'Reply to our advisory team',
      href: `mailto:${contactEmail(env)}?subject=${encodeURIComponent(`Re: ${subject}`)}`,
    },
    footnote: 'Your organization dashboard keeps every milestone and document in one place.',
    audience: 'applicant',
  };

  const delivered = await sendEmail(env, {
    to,
    subject,
    text: renderEmailText(review, { site: siteUrl(env), inbox: contactEmail(env) }),
    html: renderEmailHtml(review, { site: siteUrl(env), inbox: contactEmail(env) }),
  });

  if (!delivered) {
    return json(
      {
        error:
          'The email provider rejected the message. Review emails open in Gmail compose instead.',
      },
      502,
    );
  }

  return json({ delivered: true });
}

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

function parseAdminAccounts(env: Env): Record<string, string> {
  const accounts = parseJson<Record<string, unknown>>(env.ADMIN_ACCOUNTS ?? null, {});
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(accounts)) {
    if (typeof value === 'string') {
      result[key] = value;
    }
  }
  return result;
}

function checkCredentials(env: Env, username: string, password: string): boolean {
  const accounts = parseAdminAccounts(env);
  if (username in accounts) {
    return safeEqual(accounts[username], password);
  }
  if (env.ADMIN_USERNAME && env.ADMIN_PASSWORD) {
    return (
      safeEqual(env.ADMIN_USERNAME, username) &&
      safeEqual(env.ADMIN_PASSWORD, password)
    );
  }
  return false;
}

function checkAdmin(env: Env, request: Request): Response | null {
  if (!env.API_TOKEN) {
    return json(
      { error: 'API_TOKEN is not configured on the Worker. Run: wrangler secret put API_TOKEN' },
      503,
    );
  }
  const header = request.headers.get('Authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : (request.headers.get('X-API-Token') ?? '').trim();

  if (!token || !safeEqual(token, env.API_TOKEN)) {
    return json({ error: 'Unauthorized. Sign in again.' }, 401);
  }
  return null;
}

/**
 * Exchanges credentials for a session user. Portal accounts live in D1; the
 * legacy env-based admin accounts keep working as a fallback so an existing
 * deployment cannot lock itself out.
 */
async function login(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ username?: unknown; password?: unknown }>(request);
  const username = asString(body.username, 'username').trim();
  const password = asString(body.password, 'password');

  const account = await findUser(env, 'username', username);
  if (account) {
    if (account.status === 'suspended') {
      return json({ error: 'This account is suspended. Contact the team.' }, 403);
    }
    if (await verifyPassword(password, account.password_hash)) {
      if (account.status === 'pending') {
        return json(
          {
            error:
              'This account has not been activated yet. Use the invitation link in your email to set a password.',
          },
          403,
        );
      }

      return json({
        user: publicUser(account),
        token: account.role === 'admin' ? env.API_TOKEN : undefined,
      });
    }

    // The D1 row exists (e.g. seeded from the old demo store) but the password
    // does not match. Legacy env credentials still win, so applying the new
    // schema can never lock an existing administrator out.
    if (!checkCredentials(env, username, password)) {
      return json({ error: 'Invalid username or password.' }, 401);
    }
  } else if (!checkCredentials(env, username, password)) {
    return json({ error: 'Invalid username or password.' }, 401);
  }

  // Legacy administrators configured through env vars.
  if (!env.API_TOKEN) {
    return json(
      { error: 'API_TOKEN is not configured on the Worker. Run: wrangler secret put API_TOKEN' },
      503,
    );
  }

  return json({
    token: env.API_TOKEN,
    username,
    user: {
      id: `legacy-${username}`,
      username,
      email: '',
      role: 'admin',
      status: 'active',
      hasPassword: true,
    },
  });
}

/* ------------------------------------------------------------------ *
 * Portal accounts (D1 users, password resets, invitations)
 * ------------------------------------------------------------------ */

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string | null;
  role: string;
  status: string;
  organization_id: string | null;
  organization_name: string | null;
  organization_acronym: string | null;
  created_at: string;
  updated_at: string;
}

interface PublicUser {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  organizationId?: string;
  organizationName?: string;
  organizationAcronym?: string;
  hasPassword: boolean;
  createdAt: string;
}

const PASSWORD_ITERATIONS = 100000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PASSWORD_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  );
  return new Uint8Array(bits);
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt);
  return `pbkdf2$${PASSWORD_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false;
  const [scheme, iterations, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterations || !saltHex || !hashHex) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: fromHex(saltHex),
        iterations: Number(iterations) || PASSWORD_ITERATIONS,
        hash: 'SHA-256',
      },
      key,
      256,
    ),
  );
  if (bits.length !== hashHex.length / 2) return false;
  const expected = fromHex(hashHex);
  let diff = 0;
  for (let i = 0; i < bits.length; i += 1) {
    diff |= bits[i] ^ expected[i];
  }
  return diff === 0;
}

function randomToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

function publicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    organizationId: row.organization_id ?? undefined,
    organizationName: row.organization_name ?? undefined,
    organizationAcronym: row.organization_acronym ?? undefined,
    hasPassword: !!row.password_hash,
    createdAt: row.created_at,
  };
}

/** Users table may not exist until schema.sql has been applied. */
async function findUser(
  env: Env,
  field: 'username' | 'email' | 'id',
  value: string,
): Promise<UserRow | null> {
  try {
    return await env.DB.prepare(
      field === 'email'
        ? 'SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1'
        : `SELECT * FROM users WHERE ${field} = ? LIMIT 1`,
    )
      .bind(value)
      .first<UserRow>();
  } catch (error) {
    console.error('Could not read users table', error);
    return null;
  }
}

async function listUsers(env: Env): Promise<Response> {
  let results: UserRow[] = [];
  try {
    const response = await env.DB.prepare(
      'SELECT * FROM users ORDER BY created_at ASC',
    ).all<UserRow>();
    results = response.results ?? [];
  } catch (error) {
    console.error('Could not list users', error);
  }
  return json({ users: results.map(publicUser) });
}

function readUserInput(body: JsonObject): {
  username: string;
  email: string;
  role: 'admin' | 'applicant';
  status: 'active' | 'pending' | 'suspended';
  organizationId?: string;
  organizationName?: string;
  organizationAcronym?: string;
} {
  const username = asString(body.username, 'username').trim();
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
    throw new HttpError(
      400,
      'Username must be 3–40 characters (letters, numbers, dot, dash or underscore).',
    );
  }

  const email = asString(body.email, 'email').trim();
  if (!EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, 'Enter a valid email address.');
  }

  const role = body.role === 'admin' ? 'admin' : 'applicant';
  const status =
    body.status === 'active' || body.status === 'suspended'
      ? body.status
      : 'pending';

  return {
    username,
    email,
    role,
    status,
    organizationId: optionalString(body.organizationId),
    organizationName: optionalString(body.organizationName),
    organizationAcronym: optionalString(body.organizationAcronym),
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function createUser(request: Request, env: Env): Promise<Response> {
  const body = await readJson<JsonObject>(request);
  const input = readUserInput(body);

  const existing = await findUser(env, 'username', input.username);
  if (existing) {
    return json({ error: 'That username is already taken.' }, 409);
  }

  const now = new Date().toISOString();
  const id = `usr-${crypto.randomUUID()}`;
  const status = input.status;

  await env.DB.prepare(
    `INSERT INTO users (
       id, username, email, password_hash, role, status,
       organization_id, organization_name, organization_acronym,
       created_at, updated_at
     ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.username,
      input.email,
      input.role,
      status,
      input.organizationId ?? null,
      input.organizationName ?? null,
      input.organizationAcronym ?? null,
      now,
      now,
    )
    .run();

  const row = await findUser(env, 'id', id);
  const invite = body.invite === true;
  let invited = false;
  let inviteError: string | undefined;

  if (invite && row) {
    const result = await sendInvite(env, row);
    invited = result.sent;
    inviteError = result.error;
  }

  return json(
    { user: row ? publicUser(row) : null, invited, inviteError },
    201,
  );
}

async function updateUser(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const row = await findUser(env, 'id', id);
  if (!row) return json({ error: 'User not found.' }, 404);

  const body = await readJson<JsonObject>(request);
  const username = optionalString(body.username) ?? row.username;
  const email = optionalString(body.email) ?? row.email;
  if (!EMAIL_PATTERN.test(email)) {
    return json({ error: 'Enter a valid email address.' }, 400);
  }
  const role = body.role === 'admin' ? 'admin' : body.role === 'applicant' ? 'applicant' : row.role;
  const status =
    body.status === 'active' || body.status === 'pending' || body.status === 'suspended'
      ? body.status
      : row.status;

  if (username.toLowerCase() !== row.username.toLowerCase()) {
    const taken = await findUser(env, 'username', username);
    if (taken) return json({ error: 'That username is already taken.' }, 409);
  }

  await env.DB.prepare(
    `UPDATE users SET
       username = ?, email = ?, role = ?, status = ?,
       organization_id = ?, organization_name = ?, organization_acronym = ?,
       updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      username,
      email,
      role,
      status,
      optionalString(body.organizationId) ?? row.organization_id,
      optionalString(body.organizationName) ?? row.organization_name,
      optionalString(body.organizationAcronym) ?? row.organization_acronym,
      new Date().toISOString(),
      id,
    )
    .run();

  const updated = await findUser(env, 'id', id);
  return json({ user: updated ? publicUser(updated) : null });
}

async function deleteUser(env: Env, id: string): Promise<Response> {
  await env.DB.prepare('DELETE FROM user_tokens WHERE user_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return empty();
}

async function issueUserToken(
  env: Env,
  userId: string,
  kind: 'reset' | 'invite',
  ttlMinutes: number,
): Promise<string> {
  const token = randomToken();
  const now = new Date();
  const expires = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

  await env.DB.prepare(
    `UPDATE user_tokens SET used_at = ? WHERE user_id = ? AND kind = ? AND used_at IS NULL`,
  )
    .bind(now.toISOString(), userId, kind)
    .run();

  await env.DB.prepare(
    `INSERT INTO user_tokens (token, user_id, kind, expires_at, used_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`,
  )
    .bind(token, userId, kind, expires, now.toISOString())
    .run();

  return token;
}

async function sendAccountEmail(
  env: Env,
  user: UserRow,
  kind: 'reset' | 'invite',
  token: string,
): Promise<boolean> {
  const site = siteUrl(env);
  const inbox = contactEmail(env);
  const path = kind === 'reset' ? 'reset-password' : 'accept-invite';
  const link = `${site}/${path}?token=${encodeURIComponent(token)}`;
  const expiry = kind === 'reset' ? '60 minutes' : '7 days';

  const content: EmailContent = {
    kicker: kind === 'reset' ? 'Password reset' : 'Account invitation',
    title:
      kind === 'reset'
        ? 'Reset your Avera password'
        : 'You have been invited to the Avera portal',
    intro:
      kind === 'reset'
        ? `We received a request to reset the password for the account “${user.username}”. Choose a new password with the button below.`
        : `An Avera administrator created a portal account for “${user.username}”. Set your password to activate it and sign in.`,
    paragraphs:
      kind === 'reset'
        ? ['If you did not request this, you can ignore this email — your password will not change.']
        : [
            user.organization_name
              ? `Account organization: ${user.organization_name}.`
              : 'Your account will be linked to your organization once you sign in.',
          ],
    cta: {
      label: kind === 'reset' ? 'Choose a new password' : 'Activate my account',
      href: link,
    },
    footnote: `This link expires in ${expiry} and can only be used once.`,
    audience: 'applicant',
  };

  const delivered = await sendEmail(env, {
    to: user.email,
    subject:
      kind === 'reset'
        ? 'Reset your Avera Capital Access password'
        : 'Activate your Avera Capital Access account',
    html: renderEmailHtml(content, { site, inbox }),
    text: renderEmailText(content, { site, inbox }),
    from: inbox,
    replyTo: inbox,
  });

  return delivered;
}

async function sendInvite(
  env: Env,
  user: UserRow,
): Promise<{ sent: boolean; error?: string }> {
  if (!env.RESEND_API_KEY) {
    return {
      sent: false,
      error:
        'Email delivery is not configured. Add the RESEND_API_KEY secret to send invitations.',
    };
  }
  if (!EMAIL_PATTERN.test(user.email)) {
    return { sent: false, error: 'This account has no valid email address.' };
  }

  const token = await issueUserToken(env, user.id, 'invite', 7 * 24 * 60);
  const sent = await sendAccountEmail(env, user, 'invite', token);
  return sent
    ? { sent: true }
    : { sent: false, error: 'Resend could not deliver the invitation email.' };
}

async function inviteUser(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const user = await findUser(env, 'id', id);
  if (!user) return json({ error: 'User not found.' }, 404);

  const result = await sendInvite(env, user);
  if (!result.sent) {
    return json({ error: result.error ?? 'Could not send the invitation.' }, 502);
  }

  if (user.status === 'pending') {
    // Keep pending until the invitee sets a password.
  } else if (!user.password_hash) {
    await env.DB.prepare(
      `UPDATE users SET status = 'pending', updated_at = ? WHERE id = ?`,
    )
      .bind(new Date().toISOString(), id)
      .run();
  }

  return json({ sent: true });
}

async function forgotPassword(request: Request, env: Env): Promise<Response> {
  if (!env.RESEND_API_KEY) {
    return json(
      {
        error:
          'Password email is not configured. Add the RESEND_API_KEY secret to the Worker.',
      },
      501,
    );
  }

  const body = await readJson<{ username?: unknown }>(request);
  const identifier = asString(body.username, 'username').trim();
  const user =
    (await findUser(env, 'username', identifier)) ??
    (await findUser(env, 'email', identifier));

  if (!user) {
    return json({ error: 'No account matches that username or email.' }, 404);
  }
  if (user.status === 'suspended') {
    return json({ error: 'This account is suspended. Contact the team.' }, 403);
  }
  if (!EMAIL_PATTERN.test(user.email)) {
    return json({ error: 'This account has no valid email address.' }, 400);
  }

  const token = await issueUserToken(env, user.id, 'reset', 60);
  const sent = await sendAccountEmail(env, user, 'reset', token);
  if (!sent) {
    return json({ error: 'The email provider rejected the message.' }, 502);
  }

  return json({ sent: true });
}

interface TokenRow {
  token: string;
  user_id: string;
  kind: string;
  expires_at: string;
  used_at: string | null;
}

async function consumeUserToken(
  env: Env,
  token: string,
  password: string,
): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM user_tokens WHERE token = ?',
  )
    .bind(token)
    .first<TokenRow>();

  if (!row || row.used_at) {
    return json({ error: 'This link is no longer valid. Request a new one.' }, 400);
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return json({ error: 'This link has expired. Request a new one.' }, 400);
  }
  if (password.length < 8) {
    return json({ error: 'Password must be at least 8 characters.' }, 400);
  }

  const user = await findUser(env, 'id', row.user_id);
  if (!user) {
    return json({ error: 'The account no longer exists.' }, 404);
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  await env.DB.prepare(
    `UPDATE users SET password_hash = ?, status = 'active', updated_at = ? WHERE id = ?`,
  )
    .bind(passwordHash, now, user.id)
    .run();
  await env.DB.prepare(
    'UPDATE user_tokens SET used_at = ? WHERE token = ?',
  )
    .bind(now, token)
    .run();

  return json({ ok: true, username: user.username });
}

async function resetPassword(request: Request, env: Env): Promise<Response> {
  const body = await readJson<JsonObject>(request);
  const token = asString(body.token, 'token');
  const password = asString(body.password, 'password');
  return consumeUserToken(env, token, password);
}

async function acceptInvite(request: Request, env: Env): Promise<Response> {
  const body = await readJson<JsonObject>(request);
  const token = asString(body.token, 'token');
  const password = asString(body.password, 'password');
  return consumeUserToken(env, token, password);
}

/** Public: tells the reset / invite pages whose link this is. */
async function describeUserToken(env: Env, token: string): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM user_tokens WHERE token = ?',
  )
    .bind(token)
    .first<TokenRow>();

  if (!row || row.used_at) {
    return json({ error: 'This link is no longer valid. Request a new one.' }, 400);
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return json({ error: 'This link has expired. Request a new one.' }, 400);
  }

  const user = await findUser(env, 'id', row.user_id);
  if (!user) {
    return json({ error: 'The account no longer exists.' }, 404);
  }

  return json({
    token: {
      kind: row.kind,
      username: user.username,
      email: user.email,
      organizationName: user.organization_name ?? undefined,
    },
  });
}

/* ------------------------------------------------------------------ *
 * Applicants
 * ------------------------------------------------------------------ */

async function listApplicants(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM applicants ORDER BY created_at DESC',
  ).all<ApplicantRow>();

  return json({ applicants: (results ?? []).map(rowToApplicant) });
}

async function getApplicant(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT * FROM applicants WHERE id = ?')
    .bind(id)
    .first<ApplicantRow>();

  return json({ applicant: row ? rowToApplicant(row) : null });
}

/**
 * Public endpoint used by the applicant portal to prefill the wizard.
 * Returns only the stage payload — never admin notes, status or review logs.
 */
async function latestSubmission(
  env: Env,
  stageParam: string | null,
): Promise<Response> {
  const column = stageParam === '2' ? 'stage2' : 'stage1';
  const row = await env.DB.prepare(
    `SELECT id, ${column} AS payload
       FROM applicants
      WHERE ${column} IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1`,
  ).first<{ id: string; payload: string | null }>();

  if (!row) {
    return json({ submission: null });
  }

  const stage = normalizeStage(parseJson<unknown>(row.payload, null));
  if (!stage) {
    return json({ submission: null });
  }

  return json({
    submission: { id: row.id, date: stage.submittedAt, data: stage.data },
  });
}

/** Notice built from the shared pre-screening / stage 2 fields. */
function applicantSubmissionNotice(
  form: SubmissionForm,
  data: JsonObject,
  submittedAt: string,
): SubmissionNotice {
  return {
    form,
    organizationName: readText(data, 'applicantName'),
    contactName: readText(data, 'primaryContactName'),
    contactEmail: readText(data, 'primaryContactEmail'),
    details: [
      { label: 'Organization', value: readText(data, 'applicantName') },
      { label: 'Acronym', value: readText(data, 'applicantAcronym') },
      { label: 'Country', value: readText(data, 'headquartersCountry') },
      { label: 'Submitted', value: submittedAt },
    ],
  };
}

async function createStage1(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ data?: unknown; id?: unknown }>(request);
  const data = asObject(body.data, 'data');
  const id = readEntityId(body.id);
  const now = new Date().toISOString();

  // The pre-screening answers create/refresh the organization profile.
  const organization = await saveOrganization(env, id, organizationFromStage1(data));

  const existing = await env.DB.prepare('SELECT * FROM applicants WHERE id = ?')
    .bind(id)
    .first<ApplicantRow>();

  // Signed-in organizations resubmit on top of their existing record.
  if (existing) {
    const applicant = rowToApplicant(existing);
    applicant.updatedAt = now;
    applicant.stage1 = { submittedAt: now, data };

    await env.DB.prepare(
      `UPDATE applicants SET updated_at = ?, stage1 = ? WHERE id = ?`,
    )
      .bind(now, JSON.stringify(applicant.stage1), id)
      .run();

    await deleteDraftRow(env, 'stage1', id);

    await notifySubmission(env, applicantSubmissionNotice('pre-screening', data, now));

    return json({ applicant, organization }, 200);
  }

  const applicant: ApplicantRecord = {
    id,
    createdAt: now,
    updatedAt: now,
    stage1: { submittedAt: now, data },
    stage2: null,
    admin: { ...DEFAULT_ADMIN },
    extensions: {},
  };

  await env.DB.prepare(
    `INSERT INTO applicants (id, created_at, updated_at, stage1, stage2, admin, extensions)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      applicant.id,
      applicant.createdAt,
      applicant.updatedAt,
      JSON.stringify(applicant.stage1),
      null,
      JSON.stringify(applicant.admin),
      JSON.stringify(applicant.extensions),
    )
    .run();

  await deleteDraftRow(env, 'stage1', id);

  await notifySubmission(env, applicantSubmissionNotice('pre-screening', data, now));

  return json({ applicant, organization }, 201);
}

async function createStage2(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ data?: unknown; stage1Data?: unknown; id?: unknown }>(
    request,
  );
  const data = asObject(body.data, 'data');
  const stage1Data = body.stage1Data ? asObject(body.stage1Data, 'stage1Data') : {};
  const id = readEntityId(body.id);
  const now = new Date().toISOString();

  const existing = await env.DB.prepare('SELECT * FROM applicants WHERE id = ?')
    .bind(id)
    .first<ApplicantRow>();

  // A signed-in organization submits stage 2 on top of its existing record.
  if (existing) {
    const applicant = rowToApplicant(existing);
    applicant.updatedAt = now;
    applicant.stage2 = { submittedAt: now, data };
    if (!applicant.stage1 && Object.keys(stage1Data).length) {
      applicant.stage1 = { submittedAt: now, data: stage1Data };
    }

    await env.DB.prepare(
      `UPDATE applicants
          SET updated_at = ?, stage1 = ?, stage2 = ?
        WHERE id = ?`,
    )
      .bind(
        now,
        applicant.stage1 ? JSON.stringify(applicant.stage1) : null,
        JSON.stringify(applicant.stage2),
        id,
      )
      .run();

    await notifySubmission(env, applicantSubmissionNotice('stage 2', data, now));

    return json({ applicant }, 200);
  }

  if (Object.keys(stage1Data).length) {
    await saveOrganization(env, id, organizationFromStage1(stage1Data));
  }

  const applicant: ApplicantRecord = {
    id,
    createdAt: now,
    updatedAt: now,
    stage1: { submittedAt: now, data: stage1Data },
    stage2: { submittedAt: now, data },
    admin: { ...DEFAULT_ADMIN },
    extensions: {},
  };

  await env.DB.prepare(
    `INSERT INTO applicants (id, created_at, updated_at, stage1, stage2, admin, extensions)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      applicant.id,
      applicant.createdAt,
      applicant.updatedAt,
      JSON.stringify(applicant.stage1),
      JSON.stringify(applicant.stage2),
      JSON.stringify(applicant.admin),
      JSON.stringify(applicant.extensions),
    )
    .run();

  await notifySubmission(env, applicantSubmissionNotice('stage 2', data, now));

  return json({ applicant }, 201);
}

async function deleteApplicants(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ ids?: unknown }>(request);
  const ids = readIdList(body.ids);

  const statements = ids.map((id) =>
    env.DB.prepare('DELETE FROM applicants WHERE id = ?').bind(id),
  );
  await env.DB.batch(statements);
  return empty();
}

async function updateApplicantStatus(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await readJson<{ status?: unknown }>(request);
  const status = asString(body.status, 'status') as SubmissionStatus;

  if (!SUBMISSION_STATUSES.includes(status)) {
    throw new HttpError(400, `"status" must be one of ${SUBMISSION_STATUSES.join(', ')}.`);
  }

  return patchApplicant(env, id, (applicant, now) => ({
    ...applicant,
    updatedAt: now,
    admin: { ...applicant.admin, status },
  }));
}

async function updateApplicantStage1(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await readJson<{ data?: unknown; updatedAt?: unknown }>(request);
  const data = asObject(body.data, 'data');
  const requestedUpdatedAt =
    typeof body.updatedAt === 'string' ? body.updatedAt : null;

  return patchApplicant(env, id, (applicant, now) => ({
    ...applicant,
    updatedAt: requestedUpdatedAt ?? now,
    stage1: applicant.stage1
      ? { ...applicant.stage1, data }
      : { submittedAt: now, data },
  }));
}

async function updateApplicantReviewNote(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await readJson<{ sectionId?: unknown; note?: unknown }>(request);
  const sectionId = asString(body.sectionId, 'sectionId');
  const note = asString(body.note, 'note');

  return patchApplicant(env, id, (applicant, now) => ({
    ...applicant,
    updatedAt: now,
    admin: {
      ...applicant.admin,
      reviewNotes: { ...applicant.admin.reviewNotes, [sectionId]: note },
    },
  }));
}

async function markApplicantReviewSent(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await readJson<{ recipient?: unknown }>(request);
  const recipient = asString(body.recipient, 'recipient');
  const now = new Date().toISOString();

  return patchApplicant(env, id, (applicant) => ({
    ...applicant,
    updatedAt: now,
    admin: {
      ...applicant.admin,
      lastReviewSent: { sentAt: now, recipient },
    },
  }));
}

/**
 * Read-modify-write helper for the JSON columns. Admin traffic is low
 * volume, so a race here is not a practical concern.
 */
async function patchApplicant(
  env: Env,
  id: string,
  mutate: (applicant: ApplicantRecord, now: string) => ApplicantRecord,
): Promise<Response> {
  const row = await env.DB.prepare('SELECT * FROM applicants WHERE id = ?')
    .bind(id)
    .first<ApplicantRow>();

  if (!row) {
    return json({ error: 'Applicant not found.' }, 404);
  }

  const updated = mutate(rowToApplicant(row), new Date().toISOString());

  await env.DB.prepare(
    `UPDATE applicants
        SET updated_at = ?, stage1 = ?, stage2 = ?, admin = ?, extensions = ?
      WHERE id = ?`,
  )
    .bind(
      updated.updatedAt,
      updated.stage1 ? JSON.stringify(updated.stage1) : null,
      updated.stage2 ? JSON.stringify(updated.stage2) : null,
      JSON.stringify(updated.admin),
      JSON.stringify(updated.extensions),
      id,
    )
    .run();

  return json({ applicant: updated });
}

/* ------------------------------------------------------------------ *
 * Leads
 * ------------------------------------------------------------------ */

function normalizeLeadInput(raw: unknown): Omit<LeadRecord, 'id' | 'createdAt' | 'updatedAt'> {
  const lead = asObject(raw, 'lead');
  const read = (key: string): string =>
    typeof lead[key] === 'string' ? (lead[key] as string) : '';

  const status = read('status');
  const documents = Array.isArray(lead.availableDocuments)
    ? lead.availableDocuments.filter((item): item is string => typeof item === 'string')
    : typeof lead.availableDocuments === 'string'
      ? parseJson<string[]>(lead.availableDocuments, [])
      : [];

  return {
    region: read('region'),
    country: read('country'),
    organization: read('organization'),
    acronym: read('acronym'),
    entityType: read('entityType'),
    website: read('website'),
    contactEmail: read('contactEmail'),
    climateSpecialty: read('climateSpecialty'),
    comments: read('comments'),
    status: LEAD_STATUSES.includes(status) ? status : 'Pending',
    contactName: read('contactName'),
    contactRole: read('contactRole'),
    objective: read('objective'),
    financing: read('financing'),
    timeline: read('timeline'),
    operatingHistory: read('operatingHistory'),
    availableDocuments: documents,
    projectStage: read('projectStage'),
    projectCountry: read('projectCountry'),
    projectSector: read('projectSector'),
    accessType: read('accessType'),
    complianceIssues: read('complianceIssues'),
    challenge: read('challenge'),
    engagement: read('engagement'),
    consent: lead.consent === true,
    readinessScore: readInt(lead.readinessScore, 0, 100),
    suggestedRoute: read('suggestedRoute'),
    source: ['manual', 'import', 'profile'].includes(read('source'))
      ? read('source')
      : 'manual',
  };
}

function readInt(raw: unknown, min: number, max: number): number {
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

async function listLeads(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM leads ORDER BY created_at DESC',
  ).all<LeadRow>();

  return json({ leads: (results ?? []).map(rowToLead) });
}

async function createLeads(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ leads?: unknown }>(request);
  if (!Array.isArray(body.leads)) {
    throw new HttpError(400, '"leads" must be an array.');
  }
  if (body.leads.length === 0) {
    return json({ leads: [] }, 201);
  }
  if (body.leads.length > MAX_BATCH_IDS) {
    throw new HttpError(413, `A maximum of ${MAX_BATCH_IDS} leads can be imported at once.`);
  }

  const now = new Date().toISOString();
  const created: LeadRecord[] = body.leads.map((raw) => {
    const lead = normalizeLeadInput(raw);
    return { ...lead, id: generateId(), createdAt: now, updatedAt: now };
  });

  await env.DB.batch(
    created.map((lead) =>
      env.DB.prepare(
        `INSERT INTO leads
           (id, region, country, organization, acronym, entity_type, website,
            contact_email, climate_specialty, comments, status,
            contact_name, contact_role, objective, financing, timeline,
            operating_history, available_documents, project_stage, project_country,
            project_sector, access_type, compliance_issues, challenge, engagement,
            consent, readiness_score, suggested_route, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        lead.id,
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
        lead.contactName,
        lead.contactRole,
        lead.objective,
        lead.financing,
        lead.timeline,
        lead.operatingHistory,
        JSON.stringify(lead.availableDocuments),
        lead.projectStage,
        lead.projectCountry,
        lead.projectSector,
        lead.accessType,
        lead.complianceIssues,
        lead.challenge,
        lead.engagement,
        lead.consent ? 1 : 0,
        lead.readinessScore,
        lead.suggestedRoute,
        lead.source,
        lead.createdAt,
        lead.updatedAt,
      ),
    ),
  );

  return json({ leads: created }, 201);
}

async function updateLead(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await readJson<{ lead?: unknown }>(request);
  const lead = normalizeLeadInput(body.lead);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `UPDATE leads
        SET region = ?, country = ?, organization = ?, acronym = ?, entity_type = ?,
            website = ?, contact_email = ?, climate_specialty = ?, comments = ?,
            status = ?, contact_name = ?, contact_role = ?, objective = ?,
            financing = ?, timeline = ?, operating_history = ?,
            available_documents = ?, project_stage = ?, project_country = ?,
            project_sector = ?, access_type = ?, compliance_issues = ?,
            challenge = ?, engagement = ?, consent = ?, readiness_score = ?,
            suggested_route = ?, source = ?, updated_at = ?
      WHERE id = ?`,
  )
    .bind(
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
      lead.contactName,
      lead.contactRole,
      lead.objective,
      lead.financing,
      lead.timeline,
      lead.operatingHistory,
      JSON.stringify(lead.availableDocuments),
      lead.projectStage,
      lead.projectCountry,
      lead.projectSector,
      lead.accessType,
      lead.complianceIssues,
      lead.challenge,
      lead.engagement,
      lead.consent ? 1 : 0,
      lead.readinessScore,
      lead.suggestedRoute,
      lead.source,
      now,
      id,
    )
    .run();

  return empty();
}

/* ------------------------------------------------------------------ *
 * Profile assessment (public enquiry form)
 * ------------------------------------------------------------------ */

/**
 * Documents / capabilities the public profile form can tick. The score
 * weighting mirrors the indicative screening used by the form itself.
 */
const PROFILE_DOCUMENT_WEIGHTS: Record<string, number> = {
  'Audited financial statements': 15,
  'Governance and internal control policies': 15,
  'Environmental and social risk management framework': 15,
  'Anti-money laundering / anti-corruption policies': 15,
  'Climate project or financing track record': 10,
};

const PROFILE_PROJECT_OBJECTIVES = [
  'Project financing / investment',
  'Project development / proposal support',
];

const PROFILE_ACCREDITATION_OBJECTIVE = 'GCF accreditation and institutional readiness';

function isProfileProject(lead: Omit<LeadRecord, 'id' | 'createdAt' | 'updatedAt'>): boolean {
  return PROFILE_PROJECT_OBJECTIVES.includes(lead.objective);
}

function isProfileAccreditation(
  lead: Omit<LeadRecord, 'id' | 'createdAt' | 'updatedAt'>,
): boolean {
  return lead.objective === PROFILE_ACCREDITATION_OBJECTIVE;
}

/** Indicative 0–100 readiness score, computed server-side. */
function computeProfileScore(
  lead: Omit<LeadRecord, 'id' | 'createdAt' | 'updatedAt'>,
): number {
  let score = 0;

  if (lead.operatingHistory === '3+ years') score += 20;
  else if (lead.operatingHistory === '1–2 years') score += 10;

  for (const document of lead.availableDocuments) {
    score += PROFILE_DOCUMENT_WEIGHTS[document] ?? 0;
  }

  if (isProfileProject(lead)) {
    if (lead.projectStage === 'Feasibility study available') score += 5;
    else if (
      lead.projectStage === 'Investment proposal prepared' ||
      lead.projectStage === 'Seeking financing / financial close'
    ) {
      score += 10;
    }
  } else if (isProfileAccreditation(lead)) {
    if (lead.accessType && lead.accessType !== 'Not yet determined') score += 10;
  } else {
    score += 10;
  }

  return Math.min(100, score);
}

/** Advisory pathway suggested from the enquiry answers. */
function suggestProfileRoute(
  lead: Omit<LeadRecord, 'id' | 'createdAt' | 'updatedAt'>,
): string {
  if (lead.complianceIssues !== 'No known material issues') {
    return 'Confidential compliance clarification';
  }
  if (isProfileAccreditation(lead)) {
    return 'Institutional Accreditation Readiness Diagnostic';
  }
  if (isProfileProject(lead)) {
    return 'Project Investment Readiness Review';
  }
  if (lead.objective === 'Institutional due diligence / risk intelligence') {
    return 'Institutional Integrity & Risk Intelligence Review';
  }
  if (lead.objective === 'Strategic partnerships / capital mobilisation') {
    return 'Capital Mobilisation & Partnership Strategy';
  }
  return 'Strategic Advisory Scoping';
}

async function createProfileAssessment(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await readJson<{ lead?: unknown }>(request);
  const lead = normalizeLeadInput(body.lead);

  if (!lead.organization.trim()) {
    throw new HttpError(400, 'Please enter your organisation name.');
  }
  if (!EMAIL_PATTERN.test(lead.contactEmail)) {
    throw new HttpError(400, 'Please enter a valid professional contact email.');
  }
  if (!lead.consent) {
    throw new HttpError(400, 'Consent is required to submit this enquiry.');
  }

  const now = new Date().toISOString();
  const assessed = {
    ...lead,
    status: 'Pending',
    source: 'profile',
    readinessScore: computeProfileScore(lead),
    suggestedRoute: suggestProfileRoute(lead),
  };
  const created: LeadRecord = {
    ...assessed,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  await env.DB.prepare(
    `INSERT INTO leads
       (id, region, country, organization, acronym, entity_type, website,
        contact_email, climate_specialty, comments, status,
        contact_name, contact_role, objective, financing, timeline,
        operating_history, available_documents, project_stage, project_country,
        project_sector, access_type, compliance_issues, challenge, engagement,
        consent, readiness_score, suggested_route, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      created.id,
      created.region,
      created.country,
      created.organization,
      created.acronym,
      created.entityType,
      created.website,
      created.contactEmail,
      created.climateSpecialty,
      created.comments,
      created.status,
      created.contactName,
      created.contactRole,
      created.objective,
      created.financing,
      created.timeline,
      created.operatingHistory,
      JSON.stringify(created.availableDocuments),
      created.projectStage,
      created.projectCountry,
      created.projectSector,
      created.accessType,
      created.complianceIssues,
      created.challenge,
      created.engagement,
      created.consent ? 1 : 0,
      created.readinessScore,
      created.suggestedRoute,
      created.source,
      created.createdAt,
      created.updatedAt,
    )
    .run();

  return json({ lead: created }, 201);
}

async function deleteLeads(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ ids?: unknown }>(request);
  const ids = readIdList(body.ids);

  await env.DB.batch(
    ids.map((id) => env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(id)),
  );
  return empty();
}

function readIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new HttpError(400, '"ids" must be an array of strings.');
  }

  const ids = raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length !== raw.length) {
    throw new HttpError(400, '"ids" must contain only non-empty strings.');
  }
  if (ids.length > MAX_BATCH_IDS) {
    throw new HttpError(413, `A maximum of ${MAX_BATCH_IDS} ids can be deleted at once.`);
  }
  return ids;
}

/* ------------------------------------------------------------------ *
 * Uploads (R2)
 * ------------------------------------------------------------------ */

function readKeySegment(form: FormData, field: string): string {
  const raw = form.get(field);
  if (typeof raw !== 'string' || !KEY_SEGMENT.test(raw) || raw.includes('..')) {
    throw new HttpError(
      400,
      `"${field}" is required and may only contain letters, digits, dots, dashes and underscores.`,
    );
  }
  return raw;
}

function readScope(form: FormData): UploadScope {
  const raw = form.get('scope');
  if (typeof raw !== 'string' || !UPLOAD_SCOPES.includes(raw as UploadScope)) {
    throw new HttpError(400, `"scope" must be one of ${UPLOAD_SCOPES.join(', ')}.`);
  }
  return raw as UploadScope;
}

async function uploadFile(request: Request, env: Env): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, 'Expected a multipart/form-data upload.');
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    throw new HttpError(400, 'No file provided.');
  }
  if (file.size === 0) {
    throw new HttpError(400, 'The uploaded file is empty.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, `Files must be 15 MB or smaller.`);
  }

  const scope = readScope(form);
  const entityId = readKeySegment(form, 'entityId');
  const section = readKeySegment(form, 'section');

  const contentType = file.type || 'application/octet-stream';
  const key = `${scope}/${entityId}/${section}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;

  await env.DOCUMENTS.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType,
      contentDisposition: `inline; filename="${sanitizeFileName(file.name)}"`,
    },
  });

  return json(
    {
      url: `/api/files/${key}`,
      publicId: key,
      resourceType: resourceTypeFor(contentType),
      name: file.name,
      scope,
      entityId,
      section,
    },
    201,
  );
}

async function deleteFile(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ publicId?: unknown }>(request);
  const publicId = asString(body.publicId, 'publicId');

  const allowed = UPLOAD_KEY_PREFIXES.some((prefix) => publicId.startsWith(prefix));
  if (!allowed || publicId.includes('..')) {
    throw new HttpError(400, 'Invalid file key.');
  }

  await env.DOCUMENTS.delete(publicId);
  return empty();
}

async function serveFile(env: Env, key: string, method: string): Promise<Response> {
  const decoded = decodeURIComponent(key);
  const object = await env.DOCUMENTS.get(decoded);

  if (!object) {
    return json({ error: 'File not found.' }, 404);
  }

  const headers = new Headers();
  const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream';
  headers.set('Content-Type', contentType);
  headers.set('Content-Length', String(object.size));
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('X-Content-Type-Options', 'nosniff');
  // Neutralises any HTML/SVG that might have been uploaded.
  headers.set('Content-Security-Policy', "default-src 'none'; sandbox");

  if (object.httpMetadata?.contentDisposition) {
    headers.set('Content-Disposition', object.httpMetadata.contentDisposition);
  }

  return new Response(method === 'HEAD' ? null : object.body, { headers });
}

/* ------------------------------------------------------------------ *
 * Router
 * ------------------------------------------------------------------ */

async function withAdmin(
  env: Env,
  request: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  const authError = checkAdmin(env, request);
  if (authError) return authError;
  return handler();
}

async function handleApi(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method.toUpperCase();

  if (path === '/api' || path === '/api/health') {
    return json({ ok: true, service: 'averacapital-api' });
  }

  if (path === '/api/login') {
    if (method !== 'POST') return methodNotAllowed('POST');
    return login(request, env);
  }

  if (path === '/api/auth/forgot-password') {
    if (method !== 'POST') return methodNotAllowed('POST');
    return forgotPassword(request, env);
  }

  if (path === '/api/auth/reset-password') {
    if (method !== 'POST') return methodNotAllowed('POST');
    return resetPassword(request, env);
  }

  if (path === '/api/auth/accept-invite') {
    if (method !== 'POST') return methodNotAllowed('POST');
    return acceptInvite(request, env);
  }

  const authTokenMatch = /^\/api\/auth\/token\/([^/]+)$/.exec(path);
  if (authTokenMatch) {
    if (method !== 'GET') return methodNotAllowed('GET');
    return describeUserToken(env, decodeURIComponent(authTokenMatch[1]));
  }

  if (path === '/api/users') {
    if (method === 'GET') return withAdmin(env, request, () => listUsers(env));
    if (method === 'POST') return withAdmin(env, request, () => createUser(request, env));
    return methodNotAllowed('GET, POST');
  }

  const userInviteMatch = /^\/api\/users\/([^/]+)\/invite$/.exec(path);
  if (userInviteMatch) {
    if (method !== 'POST') return methodNotAllowed('POST');
    const id = decodeURIComponent(userInviteMatch[1]);
    return withAdmin(env, request, () => inviteUser(request, env, id));
  }

  const userMatch = /^\/api\/users\/([^/]+)$/.exec(path);
  if (userMatch) {
    const id = decodeURIComponent(userMatch[1]);
    if (method === 'PATCH' || method === 'PUT') {
      return withAdmin(env, request, () => updateUser(request, env, id));
    }
    if (method === 'DELETE') {
      return withAdmin(env, request, () => deleteUser(env, id));
    }
    return methodNotAllowed('PATCH, DELETE');
  }

  if (path === '/api/send-review-email') {
    if (method !== 'POST') return methodNotAllowed('POST');
    return sendReviewEmail(request, env);
  }

  if (path.startsWith('/api/files/')) {
    if (method !== 'GET' && method !== 'HEAD') return methodNotAllowed('GET, HEAD');
    return serveFile(env, path.slice('/api/files/'.length), method);
  }

  if (path === '/api/upload') {
    if (method === 'POST') return uploadFile(request, env);
    if (method === 'DELETE') return deleteFile(request, env);
    return methodNotAllowed('POST, DELETE');
  }

  if (path === '/api/applicants') {
    if (method === 'GET') return withAdmin(env, request, () => listApplicants(env));
    if (method === 'DELETE') {
      return withAdmin(env, request, () => deleteApplicants(request, env));
    }
    return methodNotAllowed('GET, DELETE');
  }

  if (path === '/api/applicants/stage1') {
    if (method !== 'POST') return methodNotAllowed('POST');
    return createStage1(request, env);
  }

  if (path === '/api/applicants/stage2') {
    if (method !== 'POST') return methodNotAllowed('POST');
    return createStage2(request, env);
  }

  if (path === '/api/applicants/latest') {
    if (method !== 'GET') return methodNotAllowed('GET');
    return latestSubmission(env, new URL(request.url).searchParams.get('stage'));
  }

  if (path === '/api/organizations/acronym-available') {
    if (method !== 'GET') return methodNotAllowed('GET');
    const params = new URL(request.url).searchParams;
    return acronymAvailable(
      env,
      params.get('acronym') ?? '',
      params.get('exclude') ?? '',
    );
  }

  const orgFormsMatch = /^\/api\/organizations\/([^/]+)\/forms$/.exec(path);
  if (orgFormsMatch) {
    if (method !== 'GET') return methodNotAllowed('GET');
    return organizationForms(env, decodeURIComponent(orgFormsMatch[1]));
  }

  const organizationMatch = /^\/api\/organizations\/([^/]+)$/.exec(path);
  if (organizationMatch) {
    const id = decodeURIComponent(organizationMatch[1]);
    if (method === 'GET') return getOrganization(env, id);
    if (method === 'PUT' || method === 'PATCH') return putOrganization(request, env, id);
    return methodNotAllowed('GET, PUT');
  }

  const draftMatch = /^\/api\/drafts\/(stage1|readiness)\/([^/]+)$/.exec(path);
  if (draftMatch) {
    const form = readDraftForm(draftMatch[1]);
    const orgId = decodeURIComponent(draftMatch[2]);
    if (method === 'GET') return getDraft(env, form, orgId);
    if (method === 'PUT' || method === 'POST') return putDraft(request, env, form, orgId);
    if (method === 'DELETE') return deleteDraft(env, form, orgId);
    return methodNotAllowed('GET, PUT, DELETE');
  }

  if (path === '/api/readiness') {
    if (method !== 'GET') return methodNotAllowed('GET');
    return withAdmin(env, request, () => listReadiness(env));
  }

  const readinessMatch = /^\/api\/readiness\/([^/]+)$/.exec(path);
  if (readinessMatch) {
    const orgId = decodeURIComponent(readinessMatch[1]);
    if (method === 'GET') return getReadiness(env, orgId);
    if (method === 'PUT' || method === 'POST') return putReadiness(request, env, orgId);
    if (method === 'PATCH') {
      return withAdmin(env, request, () => updateReadinessAdmin(request, env, orgId));
    }
    return methodNotAllowed('GET, PUT, PATCH');
  }

  const applicantMatch = /^\/api\/applicants\/([^/]+)(?:\/(status|stage1|review-notes|review-sent))?$/.exec(
    path,
  );
  if (applicantMatch) {
    const id = decodeURIComponent(applicantMatch[1]);
    const action = applicantMatch[2];

    if (!action) {
      if (method !== 'GET') return methodNotAllowed('GET');
      return withAdmin(env, request, () => getApplicant(env, id));
    }

    if (method !== 'PATCH' && method !== 'PUT') return methodNotAllowed('PATCH');

    if (action === 'status') {
      return withAdmin(env, request, () => updateApplicantStatus(request, env, id));
    }
    if (action === 'stage1') {
      return withAdmin(env, request, () => updateApplicantStage1(request, env, id));
    }
    if (action === 'review-notes') {
      return withAdmin(env, request, () =>
        updateApplicantReviewNote(request, env, id),
      );
    }
    return withAdmin(env, request, () => markApplicantReviewSent(request, env, id));
  }

  if (path === '/api/leads') {
    if (method === 'GET') return withAdmin(env, request, () => listLeads(env));
    if (method === 'POST') return withAdmin(env, request, () => createLeads(request, env));
    if (method === 'DELETE') return withAdmin(env, request, () => deleteLeads(request, env));
    return methodNotAllowed('GET, POST, DELETE');
  }

  if (path === '/api/profile-assessment') {
    if (method !== 'POST') return methodNotAllowed('POST');
    return createProfileAssessment(request, env);
  }

  const leadMatch = /^\/api\/leads\/([^/]+)$/.exec(path);
  if (leadMatch) {
    if (method !== 'PATCH' && method !== 'PUT') return methodNotAllowed('PATCH');
    const id = decodeURIComponent(leadMatch[1]);
    return withAdmin(env, request, () => updateLead(request, env, id));
  }

  return json({ error: 'Not found.' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = stripTrailingSlash(url.pathname);

    if (path !== '/api' && !path.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    const cors = corsHeaders(env, request.headers.get('Origin'));

    // Browser preflight: answer before auth, since it carries no credentials.
    if (request.method.toUpperCase() === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    let response: Response;
    try {
      response = await handleApi(request, env, path);
    } catch (error) {
      if (error instanceof HttpError) {
        response = json({ error: error.message }, error.status);
      } else {
        console.error('Unhandled API error', error);
        response = json({ error: 'Unexpected server error.' }, 500);
      }
    }

    if (Object.keys(cors).length === 0) {
      return response;
    }

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) {
      headers.set(key, value);
    }

    const body =
      response.status === 204 || response.status === 304 ? null : response.body;

    return new Response(body, { status: response.status, headers });
  },
};