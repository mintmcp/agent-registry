// Fails when a template changed since a git ref without a version bump.
// Run: `tsx scripts/checkVersions.ts <base-ref>`

import { buildCatalog, changedSlugs, versionBumpIssues } from "../src/catalog.js";
import { readCatalogAtRef, readCatalogDir } from "../src/load.js";

const ref = process.argv[2];
if (!ref) {
  console.error("Usage: tsx scripts/checkVersions.ts <base-ref>");
  process.exit(2);
}

const baseFolders = readCatalogAtRef(ref);
const headFolders = readCatalogDir();
const changed = changedSlugs(baseFolders, headFolders);

const issues = versionBumpIssues(
  changed,
  buildCatalog(baseFolders).catalog,
  buildCatalog(headFolders).catalog,
);
if (issues.length > 0) {
  console.error("Version check failed:");
  for (const issue of issues) console.error(`  ${issue}`);
  process.exit(1);
}

console.log(`OK: ${changed.length} changed template(s), versions bumped where needed.`);
