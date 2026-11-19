/* ------------------------------------------------------------------ *
 * Branded transactional email templates
 *
 * Mirrors the landing page: navy shell, gold hairline and CTA,
 * Avera wordmark header, content card and a footer with the public
 * inbox. Table-based markup with inline styles so Gmail, Outlook and
 * Apple Mail keep the layout intact.
 * ------------------------------------------------------------------ */

export interface EmailCallToAction {
  label: string;
  href: string;
}

export interface EmailContent {
  /** Small gold label above the title, e.g. "Submission received". */
  kicker: string;
  title: string;
  intro: string;
  paragraphs?: string[];
  rows?: { label: string; value: string }[];
  cta?: EmailCallToAction;
  /** Quiet note under the CTA (response time, storage hint, ...). */
  footnote?: string;
  /** Receipts and internal copies get a different closing note. */
  audience?: 'applicant' | 'team' | 'broadcast';
}

export interface EmailBrand {
  /** Public site origin, no trailing slash, e.g. https://averacapitalaccess.com */
  site: string;
  /** Inbox shown in the footer and used for mailto links. */
  inbox: string;
}

const BRAND = {
  page: '#050f17',
  navy: '#0a1824',
  navySoft: '#0d1f2c',
  panel: '#0f2432',
  line: '#17303f',
  gold: '#e8c06a',
  white: '#f4fbff',
  body: '#c3d4df',
  muted: '#93a8b8',
  faint: '#7e94a4',
  deep: '#07121b',
} as const;

const FONT = "'Inter','Segoe UI',Helvetica,Arial,sans-serif";
const FONT_DISPLAY = "'Sora','Segoe UI',Helvetica,Arial,sans-serif";

const TAGLINE =
  'Climate finance advisory for public and private institutions pursuing Green Climate Fund accreditation and funding.';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function detailRows(rows: { label: string; value: string }[]): string {
  const visible = rows.filter((row) => row.value);
  if (!visible.length) return '';

  const body = visible
    .map(
      (row, index) => `${
        index > 0
          ? `<tr><td colspan="2" style="padding:0;height:1px;background:${BRAND.line};font-size:0;line-height:0;">&nbsp;</td></tr>`
          : ''
      }<tr>
        <td style="padding:10px 14px 10px 0;font-family:${FONT};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.faint};vertical-align:top;white-space:nowrap;">${escapeHtml(
          row.label,
        )}</td>
        <td style="padding:10px 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${BRAND.white};text-align:right;word-break:break-word;">${escapeHtml(
          row.value,
        )}</td>
      </tr>`,
    )
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;border-collapse:collapse;background:${BRAND.panel};border:1px solid ${BRAND.line};border-radius:12px;">
    <tr><td style="padding:6px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${body}</table>
    </td></tr>
  </table>`;
}

function ctaBlock(cta?: EmailCallToAction): string {
  if (!cta) return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
    <tr><td style="border-radius:999px;background:${BRAND.gold};">
      <a href="${escapeHtml(cta.href)}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:${BRAND.gold};color:${BRAND.navy};font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.02em;text-decoration:none;">${escapeHtml(
        cta.label,
      )} <span style="color:${BRAND.navy};">&rarr;</span></a>
    </td></tr>
  </table>`;
}

/** Plain-text alternative for clients that block HTML. */
export function renderEmailText(content: EmailContent, brand: EmailBrand): string {
  const lines = [
    'AVERA CAPITAL ACCESS',
    '',
    content.kicker.toUpperCase(),
    content.title,
    '',
    content.intro,
  ];
  if (content.paragraphs?.length) {
    lines.push('', ...content.paragraphs.filter(Boolean));
  }
  const rows = (content.rows ?? []).filter((row) => row.value);
  if (rows.length) {
    lines.push('', ...rows.map((row) => `${row.label}: ${row.value}`));
  }
  if (content.cta) {
    lines.push('', `${content.cta.label}: ${content.cta.href}`);
  }
  if (content.footnote) {
    lines.push('', content.footnote);
  }
  lines.push(
    '',
    '—',
    TAGLINE,
    `${brand.inbox}  ·  ${brand.site}`,
    'Geneva · London · Singapore · Mon–Fri 09:00–18:00 CET',
    '© 2026 Avera Capital Access',
  );
  return lines.join('\n');
}

/** Branded HTML body for every automatic email. */
export function renderEmailHtml(content: EmailContent, brand: EmailBrand): string {
  const site = brand.site.replace(/\/+$/, '');
  const inbox = brand.inbox;
  const paragraphs = (content.paragraphs ?? [])
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:14px 0 0;font-family:${FONT};font-size:14px;line-height:1.7;color:${BRAND.body};">${escapeHtml(
          paragraph,
        )}</p>`,
    )
    .join('');

  const audienceNote =
    content.audience === 'team'
      ? 'Internal notification from the Avera portal. Reply directly to this email to reach the applicant.'
      : content.audience === 'broadcast'
        ? 'You are receiving this email because you have an account on the Avera Capital Access portal.'
        : 'You are receiving this because a form was submitted on the Avera portal. If this was not you, please ignore this email.';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>${escapeHtml(content.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(
    content.intro,
  )}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.page};padding:30px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${BRAND.navy};border:1px solid ${BRAND.line};border-radius:16px;overflow:hidden;">

          <!-- header -->
          <tr>
            <td style="padding:24px 30px;background:${BRAND.navySoft};border-bottom:1px solid ${BRAND.line};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <a href="${site}" style="text-decoration:none;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding-right:12px;vertical-align:middle;">
                            <img src="${site}/icon-192.png" width="38" height="38" alt="Avera Capital Access" style="display:block;width:38px;height:38px;border:0;border-radius:9px;" />
                          </td>
                          <td style="vertical-align:middle;">
                            <div style="font-family:${FONT_DISPLAY};font-size:14px;font-weight:700;letter-spacing:0.26em;color:#ffffff;line-height:1;">AVERA</div>
                            <div style="margin-top:6px;font-family:${FONT};font-size:8px;letter-spacing:0.34em;color:${BRAND.muted};line-height:1;">CAPITAL ACCESS</div>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                  <td align="right" style="vertical-align:middle;font-family:${FONT};font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:${BRAND.gold};">GCF Advisory</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:3px;line-height:0;font-size:0;background:${BRAND.gold};">&nbsp;</td></tr>

          <!-- content -->
          <tr>
            <td style="padding:34px 30px 34px;">
              <p style="margin:0 0 10px;font-family:${FONT};font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.gold};">${escapeHtml(
                content.kicker,
              )}</p>
              <h1 style="margin:0;font-family:${FONT_DISPLAY};font-size:24px;line-height:1.3;font-weight:600;letter-spacing:-0.01em;color:${BRAND.white};">${escapeHtml(
                content.title,
              )}</h1>
              <p style="margin:16px 0 0;font-family:${FONT};font-size:14px;line-height:1.7;color:${BRAND.body};">${escapeHtml(
                content.intro,
              )}</p>
              ${paragraphs}
              ${detailRows(content.rows ?? [])}
              ${ctaBlock(content.cta)}
              ${
                content.footnote
                  ? `<p style="margin:16px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${BRAND.muted};">${escapeHtml(
                      content.footnote,
                    )}</p>`
                  : ''
              }
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="padding:26px 30px 28px;background:${BRAND.deep};border-top:1px solid ${BRAND.line};">
              <p style="margin:0 0 12px;font-family:${FONT};font-size:12px;line-height:1.6;color:${BRAND.muted};">${TAGLINE}</p>
              <p style="margin:0 0 10px;font-family:${FONT};font-size:12px;line-height:1.6;color:${BRAND.white};">
                <a href="mailto:${escapeHtml(inbox)}" style="color:${BRAND.gold};text-decoration:none;">${escapeHtml(
                  inbox,
                )}</a>
                <span style="color:#3d5768;">&nbsp;·&nbsp;</span>
                <a href="${site}" style="color:${BRAND.body};text-decoration:none;">averacapitalaccess.com</a>
              </p>
              <p style="margin:0 0 8px;font-family:${FONT};font-size:11px;color:#63798a;">Geneva · London · Singapore · Mon–Fri 09:00–18:00 CET</p>
              <p style="margin:0;font-family:${FONT};font-size:10px;line-height:1.6;color:#4d6473;">${escapeHtml(
                audienceNote,
              )} © 2026 Avera Capital Access. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
