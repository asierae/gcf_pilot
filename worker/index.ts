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
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function contactEmail(env: Env): string {
  return env.CONTACT_EMAIL?.trim() || DEFAULT_CONTACT_EMAIL;
}

function noreplyEmail(env: Env): string {
  return env.NOREPLY_EMAIL?.trim() || DEFAULT_NOREPLY_EMAIL;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface OutgoingEmail {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  fromName?: string;
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
        from: `${message.fromName ?? 'Avera Capital Access'} <${noreplyEmail(env)}>`,
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

function emailLayout(
  title: string,
  intro: string,
  rows: { label: string; value: string }[],
  footerEmail = DEFAULT_CONTACT_EMAIL,
): string {
  const body = rows
    .filter((row) => row.value)
    .map(
      (row) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px">${escapeHtml(
          row.label,
        )}</td><td style="padding:4px 0;color:#0f172a;font-size:13px">${escapeHtml(
          row.value,
        )}</td></tr>`,
    )
    .join('');

  return `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#f8fafc;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:24px">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8">Avera Capital Access</p>
    <h1 style="margin:0 0 12px;font-size:19px;color:#0f172a">${escapeHtml(title)}</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155">${escapeHtml(intro)}</p>
    <table style="border-collapse:collapse">${body}</table>
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">Questions? Reply to this email or write to ${escapeHtml(
      footerEmail,
    )}.</p>
  </div>
</div>`;
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

  try {
    if (EMAIL_PATTERN.test(notice.contactEmail)) {
      await sendEmail(env, {
        to: notice.contactEmail,
        subject: `We received the ${label} for ${org}`,
        html: emailLayout(
          `Thank you, ${notice.contactName || 'there'}`,
          `We received the ${label} for ${org}. Our team will review it and get back to you if anything else is needed. You can keep working on it from your organization dashboard.`,
          notice.details,
          contactEmail(env),
        ),
        text: `We received the ${label} for ${org}.`,
      });
    }

    await sendEmail(env, {
      to: contactEmail(env),
      subject: `New ${label}: ${org}`,
      html: emailLayout(
        `New ${label}`,
        `${org} submitted a ${label} through the portal.`,
        [
          ...notice.details,
          { label: 'Contact', value: notice.contactName },
          { label: 'Email', value: notice.contactEmail },
        ],
        contactEmail(env),
      ),
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

  const delivered = await sendEmail(env, {
    to,
    subject,
    text,
    html: emailLayout(subject, text, []),
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

async function login(request: Request, env: Env): Promise<Response> {
  if (!env.API_TOKEN) {
    return json(
      { error: 'API_TOKEN is not configured on the Worker. Run: wrangler secret put API_TOKEN' },
      503,
    );
  }

  const body = await readJson<{ username?: unknown; password?: unknown }>(request);
  const username = asString(body.username, 'username');
  const password = asString(body.password, 'password');

  if (!checkCredentials(env, username, password)) {
    return json({ error: 'Invalid username or password.' }, 401);
  }

  return json({ token: env.API_TOKEN, username });
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
  };
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
            contact_email, climate_specialty, comments, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            status = ?, updated_at = ?
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
      now,
      id,
    )
    .run();

  return empty();
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

  const readinessMatch = /^\/api\/readiness\/([^/]+)$/.exec(path);
  if (readinessMatch) {
    const orgId = decodeURIComponent(readinessMatch[1]);
    if (method === 'GET') return getReadiness(env, orgId);
    if (method === 'PUT' || method === 'POST') return putReadiness(request, env, orgId);
    return methodNotAllowed('GET, PUT');
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
