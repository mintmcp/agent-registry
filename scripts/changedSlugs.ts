// Prints the template slugs added or changed since a git ref, one per line.
// Run: `tsx scripts/changedSlugs.ts <base-ref>`; used by template-checks.yml
// to scope the PR checks to what the PR touched.

import { changedSlugs } from "../src/catalog.js";
import { readCatalogAtRef, readCatalogDir } from "../src/load.js";

const ref = process.argv[2];
if (!ref) {
  console.error("Usage: tsx scripts/changedSlugs.ts <base-ref>");
  process.exit(2);
}

for (const slug of changedSlugs(readCatalogAtRef(ref), readCatalogDir())) console.log(slug);
