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

export function buildRiskReportPdf(input: RiskReportInput): Uint8Array {
  const width = 595;
  const height = 842;
  const commands: string[] = [];

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
  y -= 34;
  text(48, y, 'OVERALL RISK & REPUTATION INDEX', 9, 'F2', MUTED);
  text(48, y - 36, String(input.overall), 40, 'F2', hexColor(input.overall));
  text(110, y - 32, '/ 100', 12, 'F1', MUTED);
  textRight(
    width - 48,
    y - 4,
    `Risk band: ${input.riskBand}`,
    10,
    'F2',
    hexColor(input.overall),
  );
  textRight(
    width - 48,
    y - 22,
    `Benchmark (${input.benchmarkSource}): ${input.benchmark}`,
    9,
  );
  textRight(width - 48, y - 38, `Evidence confidence: ${input.confidence}`, 9);

  // ── Factor bars ───────────────────────────────────────
  y -= 86;
  text(48, y, 'SCORE DRIVERS', 9, 'F2', MUTED);
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

  // ── Audit findings ────────────────────────────────────
  if (input.auditFirm || input.auditDate || input.auditNotes) {
    y -= 12;
    line(48, y, width - 48, y);
    y -= 22;
    text(48, y, 'AVERA AUDIT FINDINGS', 9, 'F2', MUTED);
    if (input.auditFirm) {
      y -= 16;
      text(48, y, `Issued by: ${input.auditFirm}`, 9);
    }
    if (input.auditDate) {
      y -= 16;
      text(48, y, `Audit date: ${input.auditDate.slice(0, 10)}`, 9);
    }
    if (input.auditNotes) {
      y -= 16;
      const chunks = input.auditNotes.match(/.{1,92}(\s|$)/g) ?? [
        input.auditNotes,
      ];
      for (const chunk of chunks.slice(0, 6)) {
        text(48, y, chunk.trim(), 8, 'F1', MUTED);
        y -= 12;
      }
    }
  }

  // ── Signature + footer ────────────────────────────────
  const footerY = 96;
  line(48, footerY + 34, width - 48, footerY + 34);
  text(48, footerY + 16, 'Authorised signature', 8, 'F1', MUTED);
  text(48, footerY - 4, 'Avera Capital Access', 12, 'F2', NAVY);
  textRight(
    width - 48,
    footerY + 16,
    `Generated ${input.generatedAt.slice(0, 10)}`,
    8,
    'F1',
    MUTED,
  );
  textRight(
    width - 48,
    footerY - 4,
    'This report is computed from submitted data and Avera research.',
    7,
    'F1',
    MUTED,
  );

  const content = commands.join('\n');
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];

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
