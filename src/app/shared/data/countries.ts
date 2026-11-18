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
