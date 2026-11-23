/**
 * Minimal, dependency-free PDF writer for the Avera Risk & Reputation report.
 *
 * Uses only PDF standard fonts (Helvetica / Helvetica-Bold), so all text must
 * be Latin-1/ASCII. Byte offsets are computed with TextEncoder: using string
 * lengths would corrupt the xref table for non-ASCII content.
 */

interface PdfFactor {
  label: string;
  value: number;
  weight: number;
}

export interface RiskReportInput {
  organization: string;
  acronym: string;
  country: string;
  overall: number;
  benchmark: number;
  benchmarkSource: string;
  riskBand: string;
  confidence: number;
  source: string;
  factors: PdfFactor[];
  auditFirm: string;
  auditDate: string | null;
  auditNotes: string;
  /** Present when the audit was produced by the AI risk analysis. */
  aiAnalysis: {
    score: number;
    summary: string;
    analyzedAt: string | null;
  } | null;
  /** AI risk score (higher = riskier), when available. */
  riskScore: number | null;
  generatedAt: string;
}

const CHAR_WIDTHS: Record<string, number> = {
  ' ': 0.278, ',': 0.278, '.': 0.278, ':': 0.278, ';': 0.278, '!': 0.278,
  'i': 0.278, 'j': 0.278, 'l': 0.278, 't': 0.278, 'f': 0.278, 'I': 0.278,
  "'": 0.191, '"': 0.333, '(': 0.333, ')': 0.333, '-': 0.333, '/': 0.278,
  'a': 0.556, 'b': 0.556, 'c': 0.5, 'd': 0.556, 'e': 0.556, 'g': 0.556,
  'h': 0.556, 'k': 0.5, 'm': 0.833, 'n': 0.556, 'o': 0.556, 'p': 0.556,
  'q': 0.556, 'r': 0.333, 's': 0.5, 'u': 0.556, 'v': 0.5, 'w': 0.722,
  'x': 0.5, 'y': 0.5, 'z': 0.5,
  'A': 0.667, 'B': 0.667, 'C': 0.722, 'D': 0.722, 'E': 0.667, 'F': 0.611,
  'G': 0.778, 'H': 0.722, 'J': 0.5, 'K': 0.667, 'L': 0.556, 'M': 0.833,
  'N': 0.722, 'O': 0.778, 'P': 0.667, 'Q': 0.778, 'R': 0.722, 'S': 0.667,
  'T': 0.611, 'U': 0.722, 'V': 0.667, 'W': 0.944, 'X': 0.667, 'Y': 0.667,
  'Z': 0.611,
  '0': 0.556, '1': 0.556, '2': 0.556, '3': 0.556, '4': 0.556, '5': 0.556,
  '6': 0.556, '7': 0.556, '8': 0.556, '9': 0.556,
  '&': 0.667, '%': 0.889, '#': 0.556, '+': 0.584, '=': 0.584, '?': 0.556,
};

function textWidth(value: string, size: number, bold: boolean): number {
  const factor = bold ? 1.06 : 1;
  return (
    Array.from(value).reduce(
      (sum, char) => sum + (CHAR_WIDTHS[char] ?? 0.556),
      0,
    ) *
    size *
    factor
  );
}

const encoder = new TextEncoder();
const NAVY = '0.039 0.094 0.141';
const GOLD = '0.910 0.753 0.416';
const INK = '0.118 0.153 0.208';
const MUTED = '0.396 0.455 0.549';
const LINE = '0.878 0.902 0.929';

function escapeText(value: string): string {
  return value
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function hexColor(value: number): string {
  if (value >= 75) return '0.204 0.831 0.600';
  if (value >= 60) return '0.910 0.753 0.416';
  if (value >= 40) return '0.984 0.749 0.235';
  return '0.984 0.443 0.522';
}

/** Risk scale: the higher the score, the more severe the colour. */
function hexColorRisk(value: number): string {
  if (value >= 75) return '0.984 0.443 0.522';
  if (value >= 60) return '0.984 0.749 0.235';
  if (value >= 40) return '0.910 0.753 0.416';
  return '0.204 0.831 0.600';
}

export function buildRiskReportPdf(input: RiskReportInput): Uint8Array {
  const width = 595;
  const height = 842;
  let commands: string[] = [];

  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ): void => {
    commands.push(
      `${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`,
    );
  };

  const text = (
    x: number,
    y: number,
    value: string,
    size = 10,
    font: 'F1' | 'F2' = 'F1',
    color = INK,
  ): void => {
    commands.push(
      `BT ${color} rg /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapeText(value)}) Tj ET`,
    );
  };

  /** Right-align to the page margin instead of letting text overflow. */
  const textRight = (
    xRight: number,
    y: number,
    value: string,
    size = 10,
    font: 'F1' | 'F2' = 'F1',
    color = INK,
  ): void => {
    text(
      xRight - textWidth(value, size, font === 'F2'),
      y,
      value,
      size,
      font,
      color,
    );
  };

  const line = (x1: number, y1: number, x2: number, y2: number): void => {
    commands.push(
      `${LINE} RG 0.7 w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`,
    );
  };

  /**
   * Avera mark (hexagon + "A") drawn as PDF vectors. Geometry and colour match
   * `public/avera-logo.svg`, so no image decoder or extra PDF object is needed.
   */
  const logo = (x: number, yBottom: number, size: number): void => {
    const scale = size / 40;
    const px = (sx: number): number => x + sx * scale;
    const py = (sy: number): number => yBottom + (40 - sy) * scale;
    const stroke = (
      points: [number, number][],
      strokeWidth: number,
      closed = false,
      round = false,
    ): void => {
      const [first, ...rest] = points;
      const cap = round ? 1 : 0;
      commands.push(
        `${GOLD} RG ${cap} J ${cap} j ${(strokeWidth * scale).toFixed(2)} w ${px(first[0]).toFixed(2)} ${py(first[1]).toFixed(2)} m`,
      );
      for (const [sx, sy] of rest) {
        commands.push(`${px(sx).toFixed(2)} ${py(sy).toFixed(2)} l`);
      }
      commands.push(closed ? 'h S' : 'S');
    };
    commands.push('q');
    stroke(
      [
        [20, 3.5],
        [34.5, 12],
        [34.5, 28],
        [20, 36.5],
        [5.5, 28],
        [5.5, 12],
      ],
      1.4,
      true,
    );
    stroke([[20, 11], [20, 29]], 1.5, false, true);
    stroke([[12, 24], [20, 11], [28, 24]], 1.5, false, true);
    commands.push('Q');
  };

  // ── Header ────────────────────────────────────────────
  rect(0, height - 96, width, 96, NAVY);
  rect(0, height - 99, width, 3, GOLD);
  logo(48, height - 56, 38);
  text(100, height - 46, 'AVERA', 22, 'F2', '1 1 1');
  text(100, height - 66, 'CAPITAL ACCESS', 10, 'F1', GOLD);
  textRight(
    width - 48,
    height - 48,
    'RISK & REPUTATION REPORT',
    11,
    'F2',
    '1 1 1',
  );
  textRight(
    width - 48,
    height - 66,
    'Issued by Avera Capital Access',
    8,
    'F1',
    GOLD,
  );

  // ── Organization block ────────────────────────────────
  let y = height - 132;
  text(48, y, input.organization || 'Organization', 16, 'F2');
  y -= 18;
  const meta = [
    input.acronym ? `Acronym: ${input.acronym}` : '',
    input.country ? `Country: ${input.country}` : '',
    `Source: ${input.source === 'avera-audit' ? 'Avera Capital Access audit' : 'Avera research (computed from submitted data)'}`,
  ]
    .filter(Boolean)
    .join('    |    ');
  text(48, y, meta, 8, 'F1', MUTED);

  y -= 26;
  line(48, y, width - 48, y);

  // ── Overall score ─────────────────────────────────────
  const riskScore = input.riskScore;
  const headline = riskScore !== null ? riskScore : input.overall;
  const headlineColor = riskScore !== null ? hexColorRisk(riskScore) : hexColor(input.overall);
  y -= 34;
  text(
    48,
    y,
    riskScore !== null
      ? 'OVERALL RISK SCORE (HIGHER = RISKIER)'
      : 'AVERA CAPABILITY INDEX (HIGHER = STRONGER)',
    9,
    'F2',
    MUTED,
  );
  text(48, y - 36, String(headline), 40, 'F2', headlineColor);
  text(110, y - 32, '/ 100', 12, 'F1', MUTED);
  textRight(
    width - 48,
    y - 4,
    `Risk exposure: ${input.riskBand}`,
    10,
    'F2',
    headlineColor,
  );
  if (riskScore !== null) {
    textRight(
      width - 48,
      y - 22,
      `Avera capability index: ${input.overall} / 100 (higher = stronger)`,
      9,
    );
  }
  textRight(
    width - 48,
    y - (riskScore !== null ? 40 : 22),
    `Benchmark (${input.benchmarkSource}): ${input.benchmark}`,
    9,
  );
  textRight(
    width - 48,
    y - (riskScore !== null ? 56 : 38),
    `Evidence confidence: ${input.confidence}`,
    9,
  );

  // ── Factor bars ───────────────────────────────────────
  y -= riskScore !== null ? 106 : 86;
  text(48, y, 'CAPABILITY DRIVERS (HIGHER = STRONGER)', 9, 'F2', MUTED);
  y -= 24;
  const barX = 230;
  const barW = 250;
  for (const factor of input.factors) {
    text(48, y, factor.label, 9, 'F1');
    rect(barX, y - 8, barW, 10, '0.933 0.949 0.965');
    rect(
      barX,
      y - 8,
      Math.max(0, Math.min(barW, (barW * factor.value) / 100)),
      10,
      GOLD,
    );
    text(barX + barW + 12, y, String(factor.value), 9, 'F2');
    textRight(width - 48, y, `${Math.round(factor.weight * 100)}%`, 8, 'F1', MUTED);
    y -= 24;
  }

  const pages = [commands];
  const nextPage = () => {
    commands = [];
    pages.push(commands);
    rect(0, height - 65, width, 65, NAVY);
    logo(48, height - 48, 30);
    text(92, height - 38, 'AVERA  /  EXTERNAL DUE DILIGENCE', 12, 'F2', '1 1 1');
    y = height - 104;
  };
  const ensureSpace = (amount: number) => { if (y - amount < 70) nextPage(); };
  const heading = (label: string) => {
    ensureSpace(65);
    y -= 10;
    rect(48, y - 2, 3, 12, GOLD);
    text(58, y, label, 11, 'F2', NAVY);
    y -= 22;
  };
  const paragraph = (value: string) => {
    const print = (row: string) => {
      ensureSpace(15);
      text(48, y, row, 10);
      y -= 15;
    };
    for (const block of value.trim().split(/\n+/)) {
      let row = '';
      for (let word of block.trim().split(/\s+/)) {
        if (row && textWidth(`${row} ${word}`, 10, false) > width - 100) {
          print(row);
          row = '';
        }
        while (textWidth(word, 10, false) > width - 100) {
          let n = 1;
          while (textWidth(word.slice(0, n + 1), 10, false) <= width - 100) n++;
          print(word.slice(0, n));
          word = word.slice(n);
        }
        row = row ? `${row} ${word}` : word;
      }
      if (row) print(row);
      y -= 7;
    }
  };

  const ai = input.aiAnalysis;
  heading('01   Executive assessment');
  if (ai) {
    paragraph(`Overall risk score: ${ai.score}/100 (higher = riskier).` +
      (ai.analyzedAt ? ` Research date: ${ai.analyzedAt.slice(0, 10)}.` : ''));
    paragraph(ai.summary);
  } else {
    paragraph('No AI research analysis is on file. The index reflects available submission data and any published audit overrides.');
  }
  nextPage();
  heading('02   Scope and methodology');
  paragraph('The capability index weighs governance (24%), financial management (24%), delivery (20%), climate alignment (17%) and transparency (15%). Higher scores indicate stronger demonstrated capacity. Evidence confidence measures support for the assessment.');
  if (ai) paragraph('This AI-assisted external desk review examines public information. It does not authenticate original records. Gaps in public evidence require follow-up and are not proof of misconduct.');
  heading('03   Findings and follow-up');
  if (input.auditFirm) paragraph(`Prepared by: ${input.auditFirm}`);
  if (input.auditDate) paragraph(`Assessment date: ${input.auditDate.slice(0, 10)}`);
  paragraph(input.auditNotes && input.auditNotes !== ai?.summary ? input.auditNotes :
    ai ? 'See the executive assessment. No separate detailed findings are on file.' : 'No published audit findings are on file.');

  heading('04   Declaration');
  paragraph('This report was prepared by Avera Capital Access for accreditation screening and risk monitoring. It is an AI-assisted desk review of publicly available information, not a statutory audit, and it does not replace on-site verification or the review of original documents.');
  paragraph('Evidence gaps listed above are requests for further information and must not be read as adverse findings. The assessment reflects information available on the issue date and may change as new evidence is reviewed.');
  ensureSpace(96);
  y -= 16;
  line(48, y, 250, y);
  y -= 14;
  text(48, y, 'Authorised signature', 8, 'F1', MUTED);
  y -= 14;
  text(48, y, 'Avera Capital Access', 11, 'F2', NAVY);
  if (input.auditDate) {
    y -= 13;
    text(48, y, `Issued ${input.auditDate.slice(0, 10)}`, 8, 'F1', MUTED);
  }

  const kids = pages.map((_, i) => `${5 + 2 * i} 0 R`);
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  pages.forEach((page, i) => {
    commands = page;
    line(48, 49, width - 48, 49);
    text(48, 32, `Avera Capital Access  |  Issued ${input.generatedAt.slice(0, 10)}`, 8, 'F1', MUTED);
    textRight(width - 48, 32, `${i + 1} / ${pages.length}`, 8, 'F2', MUTED);
    const content = commands.join('\n');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + 2 * i} 0 R >>`,
      `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`,
    );
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return encoder.encode(pdf);
}
