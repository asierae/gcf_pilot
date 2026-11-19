// One-off: move ADMIN_ORGANIZATION_EDIT.SEND_EMAIL to the top level so the
// `SEND_EMAIL.*` keys used by the send-email component resolve.
import { readFileSync, writeFileSync } from 'node:fs';

const locales = ['en', 'es', 'fr', 'ru', 'zh', 'ar', 'vi'];

for (const locale of locales) {
  const path = new URL(`../src/assets/i18n/${locale}.json`, import.meta.url);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const nested = data.ADMIN_ORGANIZATION_EDIT?.SEND_EMAIL;

  if (!nested) {
    console.log(`${locale}: already at top level, nothing to do`);
    continue;
  }

  delete data.ADMIN_ORGANIZATION_EDIT.SEND_EMAIL;
  if (Object.keys(data.ADMIN_ORGANIZATION_EDIT).length === 0) {
    delete data.ADMIN_ORGANIZATION_EDIT;
  }
  data.SEND_EMAIL = nested;

  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`${locale}: moved SEND_EMAIL to top level`);
}
