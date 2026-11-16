/**
 * Export the legacy Firestore database (project gfc-pilot) to a local JSON file.
 *
 * Uses the Firestore REST API with the public web API key, so it needs no
 * service account and no npm dependencies (Node 18+ has global fetch).
 * The legacy rules are `allow read: if true`, so anonymous reads work.
 *
 * Usage:
 *   node scripts/export-firestore.mjs
 *
 * Optional environment variables:
 *   FIREBASE_PROJECT   default: gfc-pilot
 *   FIREBASE_API_KEY   default: the web key that was in firebase.config.ts
 *   FIREBASE_REFERER   set if the API key is restricted to HTTP referrers,
 *                      e.g. FIREBASE_REFERER=https://gfc-pilot.firebaseapp.com/
 *
 * Output: firestore-export.json (git-ignored — it contains applicant PII).
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PROJECT = process.env.FIREBASE_PROJECT || 'gfc-pilot';
const API_KEY =
  process.env.FIREBASE_API_KEY || 'AIzaSyAKyiy82QF-KsLpqpnPK4G6j3UNcGLKsAI';
const REFERER = process.env.FIREBASE_REFERER || '';
const COLLECTIONS = ['applicants', 'leads'];

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(projectRoot, 'firestore-export.json');

/** Decode one Firestore REST "Value" into a plain JS value. */
function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;

  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  // Timestamps come back as RFC 3339 strings, exactly what the app stores.
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) return decodeFields(value.mapValue.fields);
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ('bytesValue' in value) return value.bytesValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;

  return null;
}

function decodeFields(fields) {
  const result = {};
  for (const [key, value] of Object.entries(fields ?? {})) {
    result[key] = decodeValue(value);
  }
  return result;
}

async function fetchCollection(name) {
  const documents = [];
  let pageToken = '';
  let page = 0;

  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${name}`,
    );
    url.searchParams.set('pageSize', '300');
    url.searchParams.set('key', API_KEY);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url, {
      headers: REFERER ? { Referer: REFERER } : {},
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Firestore ${name}: HTTP ${response.status} ${response.statusText}\n${detail}\n` +
          (response.status === 403
            ? 'If the API key is restricted to HTTP referrers, retry with FIREBASE_REFERER set.'
            : ''),
      );
    }

    const body = await response.json();
    for (const document of body.documents ?? []) {
      documents.push({
        id: document.name.split('/').pop(),
        data: decodeFields(document.fields),
      });
    }

    pageToken = body.nextPageToken ?? '';
    page += 1;
    process.stdout.write(`\r  ${name}: ${documents.length} documents (page ${page})`);
  } while (pageToken);

  if (documents.length > 0) process.stdout.write('\n');
  return documents;
}

const collections = {};

for (const name of COLLECTIONS) {
  process.stdout.write(`Reading ${name}...\n`);
  collections[name] = await fetchCollection(name);
}

const payload = {
  exportedAt: new Date().toISOString(),
  project: PROJECT,
  collections,
};

await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');

console.log('\nExport complete:');
for (const name of COLLECTIONS) {
  console.log(`  ${name}: ${collections[name].length}`);
}
console.log(`  file: ${outputPath}`);
