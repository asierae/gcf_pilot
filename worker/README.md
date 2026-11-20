# Cloudflare Worker API — Averacapital GCF portal

The Angular SPA is served by the same Worker through the `ASSETS` binding.
Everything under `/api/*` runs in `worker/index.ts` and talks to:

| Binding     | Resource                    | Purpose                                    |
| ----------- | --------------------------- | ------------------------------------------ |
| `DB`        | D1 `averacapital-db`        | portal accounts, applicants, leads, orgs   |
| `DOCUMENTS` | R2 `averacapital-documents` | uploaded PDFs / supporting files           |

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

`schema.sql` is idempotent (`CREATE TABLE IF NOT EXISTS` / `INSERT OR IGNORE`),
so it is safe to re-run after every update. It also seeds the legacy demo
accounts (`hatyja`, `sarah.admin`, `hatyja2`, …) with their old passwords;
those accounts can immediately sign in and should be re-invited or reset.

Databases created before the "Check my profile" feature need one extra step —
`CREATE TABLE IF NOT EXISTS` cannot add columns to an existing table:

```powershell
npx wrangler d1 execute averacapital-db --local --file=worker/migrations/2026-11-18_leads_profile_fields.sql
npx wrangler d1 execute averacapital-db --remote --file=worker/migrations/2026-11-18_leads_profile_fields.sql
```

Databases that still have the retired `leads.favorite` flag need the priority
migration. It backfills `favorite = 1` as `priority = 'high'` and drops the old
column, so run it once per database (local, remote, and any custom
`--persist-to` directory):

```powershell
npx wrangler d1 execute averacapital-db --local --file=worker/migrations/2026-11-20_leads_priority.sql
npx wrangler d1 execute averacapital-db --remote --file=worker/migrations/2026-11-20_leads_priority.sql
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
# Without this secret the API answers 501 on /api/send-review-email,
# /api/auth/forgot-password and the user invitation endpoint, and the UI
# falls back to Gmail compose for reviews. Submission receipts are skipped.
npx wrangler secret put RESEND_API_KEY
```

The sender and inbox are plain vars in `wrangler.jsonc → vars`:

| Var             | Default                          | Used for                                     |
| --------------- | -------------------------------- | -------------------------------------------- |
| `NOREPLY_EMAIL` | `noreply@averacapitalaccess.com` | `from` on every automatic email              |
| `CONTACT_EMAIL` | `contact@averacapitalaccess.com` | internal copy + `reply_to` on automatic mail |
| `SITE_URL`      | `https://averacapitalaccess.com` | email logo, CTA links and footer             |

The HTML templates live in `worker/email.ts` (`renderEmailHtml` /
`renderEmailText`) and mirror the landing page: navy shell, gold hairline and
CTA, wordmark header using `<SITE_URL>/icon-192.png`, content card and a footer
with the public inbox. Each message also gets a plain-text alternative.

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

The admin dashboard map uses a simplified 110m country geometry committed at
`src/assets/world-countries.geo.json`, so there is no runtime TopoJSON
dependency. Regenerate it with `node scripts/build-world-map.mjs` after a
temporary `npm install --no-save world-atlas topojson-client i18n-iso-countries`
(see the script header).

## Routes

Public (no token):

- `POST /api/applicants/stage1` — `{ data, id? }` (`id` keeps the record in
  sync with the `organizations/<id>/...` upload folder and creates/updates the
  organization profile). If `data.primaryContactEmail` is not a portal account
  yet, a passwordless `applicant` user with status `pending` is created for
  manual approval (same behaviour as readiness / profile assessment); the
  response adds `userCreated` and `username`.
- `POST /api/applicants/stage2` — `{ data, stage1Data, id? }` (upserts into the
  existing applicant/organization row when `id` already exists). It provisions
  a pending applicant account for an unknown `data.primaryContactEmail` too.
- `GET /api/applicants/latest?stage=1|2` — latest stage payload (wizard prefill)
- `GET /api/organizations/:id` — organization profile (public by design: the
  applicant accounts live in the browser, so there is no token to send)
- `PUT /api/organizations/:id` — create on first write, then update every field
  except `name` / `acronym` (they identify the organization)
- `GET /api/organizations/:id/forms` - everything the organization has filled
  in: profile, stage 1 (Pre-screening), stage 2 (Accreditation), readiness, the
  last draft timestamp per form and `preScreeningStatus` (`Pending` / `Passed` /
  `Failed`). Only `Passed` unlocks Accreditation in the sidebar and route guard.
- `GET /api/organizations/:id/dashboard` - applicant dashboard payload: both
  timelines (accreditation / readiness) with per-step status and date, progress
  percentages, readiness and accreditation snapshots (requested vs budgeted,
  documents attached, questions answered), the next actions and recent activity.
  It also returns the Avera risk & reputation index: five weighted factors
  (governance, financial, delivery, climate, transparency) computed from the
  submitted profile, Stage 1/2 answers and readiness package, shown against a
  labelled Dow Jones Sustainability Index reference band (a static benchmark,
  not a live DJSI feed). When an admin publishes an Avera audit, factor scores
  are overridden with the assigned values, `overall` is recomputed with the same
  weights and `risk.source` becomes `avera-audit`; `risk.audit` carries the
  issuing team, date, notes and report link.
- `GET /api/organizations/:id/risk-report.pdf` — PDF version of that risk &
  reputation section, branded as issued by Avera Capital Access. Generated in
  the Worker (`worker/risk-report-pdf.ts`) with standard PDF fonts, no new
  dependency and no cryptographic signature.
- `PATCH /api/organizations/:id/profile` — applicant-facing profile update. Only
  `legalAddress`, `operationalAddress`, `website`, `country`, `entityType`,
  `contactName` and `contactPhone` are accepted; any other key (`name`,
  `acronym`, `contactEmail`, admin or audit fields, metadata) returns 400. The
  organization must already exist (404 otherwise) so this endpoint cannot
  create rows. Note: applicant routes are unauthenticated, so this restriction
  is about fields, not about ownership of the organization id.
- `GET /api/organizations/acronym-available?acronym=&exclude=` — uniqueness check
- `GET | PUT | DELETE /api/drafts/(stage1|readiness)/:organizationId` — draft
  autosave, keyed by the organization id
- `GET | PUT /api/readiness/:organizationId` — submitted readiness application.
  On PUT, the `metadata.ndaEmail` contact is checked against D1 `users`; an
  unknown email gets a passwordless `applicant` account with status `pending`,
  linked to the organization id. Returns `{ submission, organization, created,
  userCreated, username }`. Existing accounts are never modified.
- `POST /api/upload` — multipart `file`, `scope`, `entityId`, `section` (max 15 MB)
- `DELETE /api/upload` — `{ publicId }`
- `GET /api/files/<key>` — streams an R2 object
- `POST /api/send-review-email` — `{ to, subject, body }`; sends from
  `NOREPLY_EMAIL` with `reply_to: CONTACT_EMAIL`. Returns 501 when
  `RESEND_API_KEY` is missing so the UI falls back to Gmail compose.
- `POST /api/profile-assessment` — `{ lead }` (public "Check my profile"
  enquiry). Requires organisation, a valid email and `consent: true`. Stores a
  `leads` row with `source: 'profile'` and computes the indicative readiness
  score and suggested advisory route server-side. Returns `{ lead,
  userCreated, username }`. When the contact email does not belong to a portal
  account yet, a passwordless `applicant` user with status `pending` is created
  for manual approval through Settings → Users.
- `POST /api/login` — `{ username, password }` → `{ user, token? }`. Portal
  accounts are verified against the D1 `users` table; `token` (the admin API
  token) is only returned for admins. The env-based `ADMIN_ACCOUNTS` /
  `ADMIN_USERNAME` fallback still works.
- `POST /api/auth/forgot-password` — `{ username }` (username or email). Emails
  a one-time reset link from `CONTACT_EMAIL`. 501 without `RESEND_API_KEY`.
- `POST /api/auth/reset-password` — `{ token, password }`, activates the account
  and marks the token used.
- `POST /api/auth/accept-invite` — `{ token, password }`, same as reset but for
  invitation links (7-day expiry).
- `GET /api/auth/token/:token` — `{ token: { kind, username, email } }` used by
  the reset / invite pages to greet the account holder.

Admin (`Authorization: Bearer <API_TOKEN>`):

- `GET /api/users` — portal accounts (never includes password hashes)
- `POST /api/users` — `{ username, email, role, status?, organization*?, invite? }`
- `PATCH | DELETE /api/users/:id`
- `POST /api/users/:id/invite` — emails a set-password link, 502 if Resend
  rejects it
- `GET /api/readiness` — every readiness submission joined with its organization
- `PATCH /api/readiness/:organizationId` — `{ data }`; admin edit that preserves
  `submitted_at` and sends no emails
- `GET /api/admin/stats` — aggregated dashboard metrics: organization, country,
  submission, lead and user counts, funding requested/budgeted, status and
  source breakdowns, entity types, a 12-month activity series split by stream
  (accreditation / readiness / enquiries / organizations / users), monthly
  funding, budget by category, readiness-score buckets, a pipeline-stage
  funnel, per-country breakdowns with map points and the latest submissions
- `GET /api/applicants`
- `GET /api/applicants/:id`
- `PATCH /api/applicants/:id/status` — `{ status }` (`Pending` / `Passed` /
  `Failed`); on a real change it emails the organization contact (stage 1
  contact email, organization profile email, or linked user email) from
  `NOREPLY_EMAIL` with `reply_to: CONTACT_EMAIL`. Skipped without
  `RESEND_API_KEY`; a mail failure never fails the status update.
- `PATCH /api/applicants/:id/stage1` — `{ data, updatedAt? }`
- `PATCH /api/applicants/:id/review-notes` — `{ sectionId, note }`
- `PATCH /api/applicants/:id/review-sent` — `{ recipient }`
- `DELETE /api/applicants` — `{ ids }`
- `GET | POST | DELETE /api/leads`
- `PATCH /api/leads/:id` — `{ lead }`

## Portal accounts

Accounts live in D1 (`users`) and are managed from **Settings → Users**
(admin only):

- **Create** an account with a username, email and role. Applicants can be tied
  to an organization id/name/acronym, which the wizards use to prefill forms.
- **Send invitation** emails a `/accept-invite?token=…` link from
  `contact@averacapitalaccess.com`. Choose a password there and the account
  flips from `pending` to `active`; only then can it sign in.
- **Forgot my password?** on the login page sends a
  `/reset-password?token=…` link (60 minutes, single use) to the address on the
  account.

Passwords are stored as PBKDF2-SHA256 hashes (`pbkdf2$100000$salt$hash`). One
time links live in `user_tokens` with `used_at` / `expires_at`, and every new
link invalidates the previous unused one of the same kind. Suspended accounts
cannot sign in or request a reset. Both messages are branded through
`worker/email.ts` and sent from `CONTACT_EMAIL` with `reply_to` set to the same
inbox.

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

Both applicant-facing and internal copies are rendered through the branded
template in `worker/email.ts`; set `SITE_URL` when the site is served from a
different origin (preview deployments, custom domains).

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
