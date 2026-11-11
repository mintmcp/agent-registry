// Parses every template under `agents-catalog/` and runs the content checks
// (placeholders, platform sections, org-specific leaks, sample render).
// Run: `npm run validate`

import { buildCatalog } from "../src/catalog.js";
import { checkTemplate } from "../src/checks.js";
import { readCatalogDir } from "../src/load.js";

const folders = readCatalogDir();
const { catalog, issues } = buildCatalog(folders);

let failed = false;
for (const [slug, list] of Object.entries(issues)) {
  failed = true;
  console.error(`${slug}: failed to load`);
  for (const issue of list) console.error(`  ${issue}`);
}

for (const [slug, entry] of Object.entries(catalog)) {
  const report = checkTemplate(entry, folders[slug]);
  for (const w of report.warnings) console.warn(`WARN: ${slug}: ${w}`);
  if (report.errors.length > 0) {
    failed = true;
    console.error(`${slug}: failed checks`);
    for (const e of report.errors) console.error(`  ${e}`);
  }
}

if (failed) process.exit(1);

const entries = Object.entries(catalog);
console.log(`OK: ${entries.length} templates validated.`);
for (const [slug, { manifest }] of entries) {
  const connectors = manifest.connectors.map((c) => c.slug).join("+") || "none";
  console.log(`  - ${slug}@${manifest.version} (connectors=${connectors})`);
}
