# Cloudflare Worker API — Averacapital GCF portal

The Angular SPA is served by the same Worker through the `ASSETS` binding.
Everything under `/api/*` runs in `worker/index.ts` and talks to:

| Binding     | Resource                    | Purpose                          |
| ----------- | --------------------------- | -------------------------------- |
| `DB`        | D1 `averacapital-db`        | applicants + leads               |
| `DOCUMENTS` | R2 `averacapital-documents` | uploaded PDFs / supporting files |

`wrangler.jsonc` already points at both bindings; only the D1 `database_id`
needs to be pasted in after creation.

## 1. Create the Cloudflare resources

```powershell
npx wrangler login
npx wrangler d1 create averacapital-db
npx wrangler r2 bucket create averacapital-documents
```

Copy the `database_id` printed by `d1 create` into
`wrangler.jsonc → d1_databases[0].database_id`.

## 2. Apply the schema

```powershell
# Remote (production) database
npx wrangler d1 execute averacapital-db --remote --file=worker/schema.sql

# Local database used by `wrangler dev`
npx wrangler d1 execute averacapital-db --local --file=worker/schema.sql
```

## 3. Configure secrets

```powershell
# Token returned by POST /api/login and required by admin endpoints
npx wrangler secret put API_TOKEN

# Admin credentials, JSON map of username -> password
npx wrangler secret put ADMIN_ACCOUNTS
# e.g. {"hatyja":"change-me","sarah.admin":"change-me-too"}
```

Optional single-account alternative: set `ADMIN_USERNAME` (already in
`wrangler.jsonc → vars`) plus `npx wrangler secret put ADMIN_PASSWORD`.

Transactional email uses [Resend](https://resend.com):

```powershell
# Without this secret the API answers 501 on /api/send-review-email and the
# UI falls back to Gmail compose. Submission receipts are simply skipped.
npx wrangler secret put RESEND_API_KEY
```

The sender and inbox are plain vars in `wrangler.jsonc → vars`:

| Var             | Default                          | Used for                                     |
| --------------- | -------------------------------- | -------------------------------------------- |
| `NOREPLY_EMAIL` | `noreply@averacapitalaccess.com` | `from` on every automatic email              |
| `CONTACT_EMAIL` | `contact@averacapitalaccess.com` | internal copy + `reply_to` on automatic mail |

`averacapitalaccess.com` (or whichever domain you verify in Resend) needs the
DKIM/SPF records Resend prints; sending from it otherwise fails.

Secrets are per-environment: repeat the commands with `--env production`
only if you add environments later.

## 4. Local development

`.dev.vars` (git-ignored) supplies the same secrets to `wrangler dev`:

```ini
API_TOKEN=local-dev-token
ADMIN_ACCOUNTS={"hatyja":"asier"}
# optional: enables real emails in local dev
# RESEND_API_KEY=re_xxxxxxxx
```

```powershell
npm run worker:dev   # wrangler dev on http://localhost:8787
npm run start        # Angular on http://localhost:4300, /api proxied to 8787
```

## 5. Deploy

```powershell
npm run build
npx wrangler deploy
```

Cloudflare Workers Builds uses the same commands:

| Setting         | Value                                  |
| --------------- | -------------------------------------- |
| Build command   | `npm run build`                        |
| Deploy command  | `npx wrangler deploy`                  |
| Preview command | `npx wrangler versions upload`         |

## 6. Vercel (optional)

Vercel only serves the static SPA, so it needs the Worker URL to reach the data:

1. `wrangler.jsonc → vars.CORS_ORIGINS` = `"https://your-app.vercel.app"`.
2. `src/app/config/api.config.ts → REMOTE_API_BASE_URL` =
   `"https://averacapital.<your-subdomain>.workers.dev"`.
3. Redeploy the Worker and Vercel.

The SPA resolves relative `/api/files/...` URLs against the Worker when
`REMOTE_API_BASE_URL` is set, so uploaded documents keep working.

## Routes

Public (no token):

- `POST /api/applicants/stage1` — `{ data, id? }` (`id` keeps the record in
  sync with the `organizations/<id>/...` upload folder and creates/updates the
  organization profile)
- `POST /api/applicants/stage2` — `{ data, stage1Data, id? }` (upserts into the
  existing applicant/organization row when `id` already exists)
- `GET /api/applicants/latest?stage=1|2` — latest stage payload (wizard prefill)
- `GET /api/organizations/:id` — organization profile (public by design: the
  applicant accounts live in the browser, so there is no token to send)
- `PUT /api/organizations/:id` — create on first write, then update every field
  except `name` / `acronym` (they identify the organization)
- `GET /api/organizations/:id/forms` — everything the organization has filled
  in: profile, stage 1, stage 2, readiness and the last draft timestamp per form
- `GET /api/organizations/acronym-available?acronym=&exclude=` — uniqueness check
- `GET | PUT | DELETE /api/drafts/(stage1|readiness)/:organizationId` — draft
  autosave, keyed by the organization id
- `GET | PUT /api/readiness/:organizationId` — submitted readiness application
- `POST /api/upload` — multipart `file`, `scope`, `entityId`, `section` (max 15 MB)
- `DELETE /api/upload` — `{ publicId }`
- `GET /api/files/<key>` — streams an R2 object
- `POST /api/send-review-email` — `{ to, subject, body }`; sends from
  `NOREPLY_EMAIL` with `reply_to: CONTACT_EMAIL`. Returns 501 when
  `RESEND_API_KEY` is missing so the UI falls back to Gmail compose.

Admin (`Authorization: Bearer <API_TOKEN>`):

- `GET /api/applicants`
- `GET /api/applicants/:id`
- `PATCH /api/applicants/:id/status` — `{ status }`
- `PATCH /api/applicants/:id/stage1` — `{ data, updatedAt? }`
- `PATCH /api/applicants/:id/review-notes` — `{ sectionId, note }`
- `PATCH /api/applicants/:id/review-sent` — `{ recipient }`
- `DELETE /api/applicants` — `{ ids }`
- `GET | POST | DELETE /api/leads`
- `PATCH /api/leads/:id` — `{ lead }`

Auth:

- `POST /api/login` — `{ username, password }` → `{ token }`

## R2 layout

Every uploaded file is stored as:

```
<scope>/<entityId>/<section>/<uuid>-<file name>
```

| scope           | entityId                                      | sections                                             |
| --------------- | --------------------------------------------- | ---------------------------------------------------- |
| `organizations` | organization id (== applicant / readiness id)  | `access`, `legal`, `fasttrack`, `s4`…`s13`, `readiness` |
| `leads`         | lead id                                       | `documents` (reserved)                                |

`section` comes from the form step (`STAGE1_STEPS` / `STAGE2_SCREENING_STEPS`
ids), so the bucket mirrors the wizard. Files uploaded before this layout lived
under `gcf-applicants/`; they stay readable and deletable.

The wizard generates the organization id in the browser so uploads can happen
before the record exists. The same id is sent with the submission, so a
resubmission updates the existing row instead of creating a duplicate.

## Automatic emails

Every accepted submission (pre-screening, stage 2, readiness) triggers two
Resend messages, both best-effort — a provider failure never fails the request:

1. **Requester receipt** → the contact email in the form, from
   `NOREPLY_EMAIL`, `reply_to: CONTACT_EMAIL`.
2. **Internal notice** → `CONTACT_EMAIL`, listing the organization, acronym,
   country, submitted timestamp and the form-specific details.

Review-notes emails from the admin dashboard use the same transport, but if
`RESEND_API_KEY` is not configured the UI opens Gmail compose instead.

## Organizations, drafts and readiness

The organization id is the single identifier across the whole stack:

- `organizations.id`
- the pre-screening row `applicants.id`
- the R2 folder `organizations/<id>/...`
- both draft tables (`stage1_drafts`, `readiness_drafts`)
- `readiness_applications.organization_id`

Anonymous visitors get a generated id in the URL (`?org=<id>`), so the same link
restores their draft. Signed-in applicants always use their account's
`organizationId`; the forms prefill every known field and lock the legal name and
acronym, because acronyms are unique (`idx_organizations_acronym` on
`acronym_norm`). Organizations are only created on submit (or lazily on first
visit for signed-in users), so the name/acronym are not locked mid-typing.

## Migrating existing Firestore data

There is no automatic importer. Export the `applicants` and `leads`
collections from Firebase (JSON) and POST them to the API, or map the JSON
into the two tables with `wrangler d1 execute`. The D1 columns mirror the
Firestore document fields one-to-one:

- `applicants.stage1` / `stage2` → `{ submittedAt, data }`
- `applicants.admin` → `{ status, reviewNotes, lastReviewSent }`
