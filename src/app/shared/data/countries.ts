/**
 * All ISO 3166-1 country codes. Display names are resolved with
 * Intl.DisplayNames so the list stays complete without shipping a huge
 * hard-coded label table.
 */
const ISO_CODES = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ
EC EE EG EH ER ES ET
FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU
ID IE IL IM IN IO IQ IR IS IT
JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ
LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ
OM
PA PE PF PG PH PK PL PM PN PR PS PT PW PY
QA
RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
UA UG UM US UY UZ
VA VC VE VG VI VN VU
WF WS
YE YT
ZA ZM ZW
`
  .trim()
  .split(/\s+/);

/** Extra spellings used by legacy imports and the seeded demo data. */
const ALIASES = [
  "Bosnia and Herzegovina",
  "Cape Verde",
  "Czech Republic",
  "Democratic Republic of the Congo",
  "East Timor",
  "England",
  "Scotland",
  "Timor-Leste",
  "Turkey",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "United States of America",
  "Vatican City",
  "Viet Nam",
];

function buildCountryNames(): string[] {
  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    // Very old browsers fall back to the codes themselves.
  }

  const names = new Set<string>();
  for (const code of ISO_CODES) {
    const name = display?.of(code);
    if (name && name !== code) names.add(name);
    else names.add(code);
  }
  for (const alias of ALIASES) names.add(alias);

  return [...names].sort((a, b) => a.localeCompare(b, "en"));
}

export const COUNTRY_NAMES: string[] = buildCountryNames();

/** Spellings that do not resolve through `Intl.DisplayNames`. */
const CODE_ALIASES: Record<string, string> = {
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  "united kingdom": "GB",
  "great britain": "GB",
  britain: "GB",
  uk: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  russia: "RU",
  "south korea": "KR",
  "north korea": "KP",
  "republic of korea": "KR",
  vietnam: "VN",
  "viet nam": "VN",
  laos: "LA",
  syria: "SY",
  iran: "IR",
  moldova: "MD",
  tanzania: "TZ",
  bolivia: "BO",
  venezuela: "VE",
  "czech republic": "CZ",
  czechia: "CZ",
  turkey: "TR",
  turkiye: "TR",
  "ivory coast": "CI",
  "cote divoire": "CI",
  "cape verde": "CV",
  "cabo verde": "CV",
  swaziland: "SZ",
  eswatini: "SZ",
  "east timor": "TL",
  "timor leste": "TL",
  burma: "MM",
  myanmar: "MM",
  macedonia: "MK",
  "north macedonia": "MK",
  "democratic republic of the congo": "CD",
  "democratic republic of congo": "CD",
  "dr congo": "CD",
  "congo kinshasa": "CD",
  "republic of the congo": "CG",
  "congo brazzaville": "CG",
  "vatican city": "VA",
  "holy see": "VA",
  uae: "AE",
  "united arab emirates": "AE",
  "south sudan": "SS",
  "bosnia and herzegovina": "BA",
  bosnia: "BA",
  "central african republic": "CF",
  "dominican republic": "DO",
  "equatorial guinea": "GQ",
  "solomon islands": "SB",
  palestine: "PS",
  taiwan: "TW",
  kosovo: "XK",
  "sao tome and principe": "ST",
  "sao tome": "ST",
  "st kitts and nevis": "KN",
  "st lucia": "LC",
  "st vincent and the grenadines": "VC",
  "antigua and barbuda": "AG",
  "trinidad and tobago": "TT",
  "brunei darussalam": "BN",
  brunei: "BN",
  "hong kong": "HK",
  macau: "MO",
  macao: "MO",
  "falkland islands": "FK",
  "western sahara": "EH",
};

function normalizeCountryKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const COUNTRY_CODES: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    // Older browsers only resolve the aliases below.
  }

  for (const code of ISO_CODES) {
    const name = display?.of(code);
    if (name) map[normalizeCountryKey(name)] = code;
    map[normalizeCountryKey(code)] = code;
  }
  for (const [name, code] of Object.entries(CODE_ALIASES)) {
    map[normalizeCountryKey(name)] = code;
  }
  return map;
})();

/** Resolves a country name (or ISO code) to its ISO 3166-1 alpha-2 code. */
export function countryCode(name: string): string | null {
  if (!name) return null;
  const key = normalizeCountryKey(name);
  if (!key) return null;
  if (COUNTRY_CODES[key]) return COUNTRY_CODES[key];

  const stripped = key
    .replace(/\b(the|republic|islands|island|state|states)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped && COUNTRY_CODES[stripped]) return COUNTRY_CODES[stripped];

  let best: { code: string; length: number } | null = null;
  for (const [candidate, code] of Object.entries(COUNTRY_CODES)) {
    if (candidate.length < 4) continue;
    if (key.includes(candidate) || candidate.includes(key)) {
      if (!best || candidate.length > best.length) {
        best = { code, length: candidate.length };
      }
    }
  }
  return best?.code ?? null;
}

/** Canonical English display name for a country, keeping unknown values. */
export function countryLabel(name: string): string {
  const code = countryCode(name);
  if (code) {
    try {
      const label = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
      if (label) return label;
    } catch {
      // Fall back to the stored spelling.
    }
  }
  return name;
}
