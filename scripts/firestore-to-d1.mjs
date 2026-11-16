/**
 * Convert firestore-export.json into SQL that D1 can execute directly.
 *
 * Usage:
 *   node scripts/export-firestore.mjs        # 1. dump Firestore
 *   node scripts/firestore-to-d1.mjs         # 2. build worker/import.sql
 *   npx wrangler d1 execute averacapital-db --remote --file=worker/import.sql
 *
 * Flags:
 *   --wipe    delete every existing applicant/lead before inserting
 *
 * The SQL uses INSERT ... ON CONFLICT(id) DO UPDATE, so it is safe to re-run.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = join(projectRoot, 'firestore-export.json');
const outputPath = join(projectRoot, 'worker', 'import.sql');

const WIPE = process.argv.includes('--wipe');

const SUBMISSION_STATUSES = ['Pending', 'Passed', 'Failed'];
const LEAD_STATUSES = ['Pending', 'Contacted', 'Qualified', 'Rejected'];

const isObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const str = (value) =>
  value === null || value === undefined ? '' : String(value);

const iso = (value) => {
  const text = str(value);
  return text || new Date().toISOString();
};

function normalizeStage(raw) {
  if (!isObject(raw)) return null;
  return {
    submittedAt: iso(raw.submittedAt),
    data: isObject(raw.data) ? raw.data : {},
  };
}

function normalizeApplicant(id, raw) {
  const source = isObject(raw) ? raw : {};
  const admin = isObject(source.admin) ? source.admin : {};
  const status = SUBMISSION_STATUSES.includes(admin.status)
    ? admin.status
    : 'Pending';

  return {
    id: str(source.id) || id,
    createdAt: iso(source.createdAt),
    updatedAt: iso(source.updatedAt),
    stage1: normalizeStage(source.stage1),
    stage2: normalizeStage(source.stage2),
    admin: {
      status,
      reviewNotes: isObject(admin.reviewNotes) ? admin.reviewNotes : {},
      lastReviewSent: isObject(admin.lastReviewSent) ? admin.lastReviewSent : null,
    },
    extensions: isObject(source.extensions) ? source.extensions : {},
  };
}

function normalizeLead(id, raw) {
  const source = isObject(raw) ? raw : {};
  const status = LEAD_STATUSES.includes(source.status) ? source.status : 'Pending';

  return {
    id: str(source.id) || id,
    region: str(source.region),
    country: str(source.country),
    organization: str(source.organization),
    acronym: str(source.acronym),
    entityType: str(source.entityType),
    website: str(source.website),
    contactEmail: str(source.contactEmail),
    climateSpecialty: str(source.climateSpecialty),
    comments: str(source.comments),
    status,
    createdAt: iso(source.createdAt),
    updatedAt: iso(source.updatedAt),
  };
}

/** SQL string literal. */
const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
/** JSON column value (compact, single line). */
const json = (value) => quote(JSON.stringify(value));

function applicantStatement(applicant) {
  return `INSERT INTO applicants (id, created_at, updated_at, stage1, stage2, admin, extensions)
VALUES (
  ${quote(applicant.id)},
  ${quote(applicant.createdAt)},
  ${quote(applicant.updatedAt)},
  ${applicant.stage1 ? json(applicant.stage1) : 'NULL'},
  ${applicant.stage2 ? json(applicant.stage2) : 'NULL'},
  ${json(applicant.admin)},
  ${json(applicant.extensions)}
)
ON CONFLICT(id) DO UPDATE SET
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  stage1 = excluded.stage1,
  stage2 = excluded.stage2,
  admin = excluded.admin,
  extensions = excluded.extensions;`;
}

function leadStatement(lead) {
  return `INSERT INTO leads (id, region, country, organization, acronym, entity_type, website, contact_email, climate_specialty, comments, status, created_at, updated_at)
VALUES (
  ${quote(lead.id)},
  ${quote(lead.region)},
  ${quote(lead.country)},
  ${quote(lead.organization)},
  ${quote(lead.acronym)},
  ${quote(lead.entityType)},
  ${quote(lead.website)},
  ${quote(lead.contactEmail)},
  ${quote(lead.climateSpecialty)},
  ${quote(lead.comments)},
  ${quote(lead.status)},
  ${quote(lead.createdAt)},
  ${quote(lead.updatedAt)}
)
ON CONFLICT(id) DO UPDATE SET
  region = excluded.region,
  country = excluded.country,
  organization = excluded.organization,
  acronym = excluded.acronym,
  entity_type = excluded.entity_type,
  website = excluded.website,
  contact_email = excluded.contact_email,
  climate_specialty = excluded.climate_specialty,
  comments = excluded.comments,
  status = excluded.status,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;`;
}

const exportPayload = JSON.parse(await readFile(inputPath, 'utf8'));
const collections = exportPayload.collections ?? {};

const applicants = (collections.applicants ?? []).map((item) =>
  normalizeApplicant(str(item.id), item.data),
);
const leads = (collections.leads ?? []).map((item) =>
  normalizeLead(str(item.id), item.data),
);

const seenApplicants = new Set();
const seenLeads = new Set();

const statements = [
  '-- Generated by scripts/firestore-to-d1.mjs — do not commit (contains PII).',
  `-- Source: ${inputPath}`,
  `-- Exported at: ${exportPayload.exportedAt ?? 'unknown'}`,
  'PRAGMA defer_foreign_keys = ON;',
  '',
];

if (WIPE) {
  statements.push('DELETE FROM applicants;', 'DELETE FROM leads;', '');
}

for (const applicant of applicants) {
  if (seenApplicants.has(applicant.id)) {
    console.warn(`Duplicate applicant id, keeping the last one: ${applicant.id}`);
  }
  seenApplicants.add(applicant.id);
  statements.push(applicantStatement(applicant), '');
}

for (const lead of leads) {
  if (seenLeads.has(lead.id)) {
    console.warn(`Duplicate lead id, keeping the last one: ${lead.id}`);
  }
  seenLeads.add(lead.id);
  statements.push(leadStatement(lead), '');
}

await writeFile(outputPath, statements.join('\n'), 'utf8');

console.log('Import file ready:', outputPath);
console.log(`  applicants: ${applicants.length} (${applicants.filter((a) => a.stage2).length} with stage 2)`);
console.log(`  leads:      ${leads.length}`);
console.log(`  ${WIPE ? 'Existing rows will be deleted first.' : 'Existing rows with the same id will be updated.'}`);
console.log('\nNext:');
console.log('  npx wrangler d1 execute averacapital-db --remote --file=worker/import.sql');
