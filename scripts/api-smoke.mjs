/**
 * Smoke test for the organization / draft / readiness endpoints.
 * Usage: node scripts/api-smoke.mjs [baseUrl]
 */
const BASE = (process.argv[2] ?? 'http://127.0.0.1:8787').replace(/\/$/, '');

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function main() {
  const id = `smoke-${Date.now()}`;
  const acronym = `SMK${Date.now().toString(36).slice(-4).toUpperCase()}`;

  console.log(`\nOrganization ${id} / ${acronym}\n`);

  // 1. Missing organization reads as null.
  let res = await req('GET', `/api/organizations/${id}`);
  check('GET /api/organizations/:id -> null', res.status === 200 && res.data.organization === null);

  // 2. Acronym free before creating it.
  res = await req('GET', `/api/organizations/acronym-available?acronym=${acronym}&exclude=${id}`);
  check('acronym available before create', res.data?.available === true);

  // 3. Draft round-trip.
  res = await req('PUT', `/api/drafts/stage1/${id}`, { data: { applicantName: 'Smoke Test Org' } });
  check('PUT stage1 draft', res.status === 200 && Boolean(res.data.updatedAt), JSON.stringify(res.data));

  res = await req('GET', `/api/drafts/stage1/${id}`);
  check(
    'GET stage1 draft',
    res.status === 200 && res.data.draft?.data?.applicantName === 'Smoke Test Org',
    JSON.stringify(res.data),
  );

  // 4. Readiness draft is a separate table.
  res = await req('GET', `/api/drafts/readiness/${id}`);
  check('readiness draft isolated from stage1', res.status === 200 && res.data.draft === null);

  // 5. Save the organization.
  res = await req('PUT', `/api/organizations/${id}`, {
    name: 'Smoke Test Organization',
    acronym,
    country: 'Kenya',
    entityType: 'public',
  });
  check('PUT organization creates it', res.status === 200 && res.data.organization?.id === id, JSON.stringify(res.data));

  // 6. Acronym now taken for anybody else.
  res = await req('GET', `/api/organizations/acronym-available?acronym=${acronym}&exclude=other-org-id`);
  check('acronym taken for another org', res.data?.available === false);

  // 7. Same org may keep its acronym.
  res = await req('GET', `/api/organizations/acronym-available?acronym=${acronym}&exclude=${id}`);
  check('acronym still available for its own org', res.data?.available === true);

  // 8. Duplicate acronym is rejected.
  res = await req('PUT', `/api/organizations/dup-${Date.now()}`, {
    name: 'Duplicate Acronym Org',
    acronym,
  });
  check('duplicate acronym rejected with 409', res.status === 409, `${res.status} ${JSON.stringify(res.data)}`);

  // 9. Readiness submission creates the record + organization.
  const readiness = {
    metadata: {
      proposalTitle: 'Smoke readiness proposal',
      country: 'Kenya',
      organizationLegalName: 'Smoke Test Organization',
      organizationAcronym: acronym,
      entityType: 'public',
    },
  };
  res = await req('PUT', `/api/readiness/${id}`, { data: readiness });
  check('PUT readiness submission', res.status === 201 && Boolean(res.data.submission?.submittedAt), JSON.stringify(res.data));

  res = await req('PUT', `/api/readiness/${id}`, { data: readiness });
  check('PUT readiness again upserts', res.status === 200, String(res.status));

  res = await req('GET', `/api/readiness/${id}`);
  check(
    'GET readiness submission',
    res.data?.submission?.data?.metadata?.proposalTitle === 'Smoke readiness proposal',
  );

  res = await req('GET', `/api/drafts/readiness/${id}`);
  check('readiness draft cleared after submit', res.data?.draft === null);

  // 10. Forms roll-up.
  res = await req('GET', `/api/organizations/${id}/forms`);
  check(
    'forms lists organization + readiness draft timestamp cleared',
    res.status === 200 &&
      res.data.organization?.acronym === acronym &&
      Boolean(res.data.readiness?.submittedAt),
    JSON.stringify(res.data).slice(0, 400),
  );

  // 11. Stage 1 submission (pre-screening) links the same organization.
  const stage1Id = `smoke-s1-${Date.now()}`;
  const stage1Acronym = `S1${Date.now().toString(36).slice(-4).toUpperCase()}`;
  res = await req('POST', '/api/applicants/stage1', {
    id: stage1Id,
    data: {
      applicantName: 'Smoke Stage One Org',
      applicantAcronym: stage1Acronym,
      headquartersCountry: 'Ghana',
      typeOfEntity: 'ngo',
    },
  });
  check('POST stage1 creates applicant', res.status === 201, JSON.stringify(res.data));
  check('POST stage1 creates organization', res.data?.organization?.acronym === stage1Acronym);

  res = await req('GET', `/api/organizations/${stage1Id}/forms`);
  check(
    'forms lists stage1 submission',
    Boolean(res.data?.stage1?.submittedAt) && res.data.stage1.data.applicantAcronym === stage1Acronym,
  );

  // 12. Stage 2 upserts into the same organization record.
  res = await req('POST', '/api/applicants/stage2', {
    id: stage1Id,
    data: { applicantName: 'Smoke Stage One Org', projectTitle: 'Stage 2 project' },
  });
  check('POST stage2 upserts existing applicant', res.status === 200, `${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);

  res = await req('GET', `/api/organizations/${stage1Id}/forms`);
  check(
    'stage2 stored on the same record',
    Boolean(res.data?.stage2?.submittedAt) && Boolean(res.data?.stage1?.submittedAt),
  );

  // 13. Draft cleanup.
  res = await req('DELETE', `/api/drafts/stage1/${id}`);
  check('DELETE draft', res.status === 204, String(res.status));

  res = await req('GET', `/api/drafts/stage1/${id}`);
  check('draft gone after delete', res.data?.draft === null);

  // 14. Invalid ids are rejected.
  res = await req('GET', '/api/drafts/stage1/a');
  check('invalid id rejected', res.status === 400, String(res.status));

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
