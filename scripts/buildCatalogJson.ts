import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { buildCatalog, versionFor } from "../src/catalog.js";
import { readCatalogDir, repoRoot } from "../src/load.js";

const OUT_PATH = resolve(repoRoot, "dist", "catalog.json");

const { catalog, issues } = buildCatalog(readCatalogDir());
if (Object.keys(issues).length > 0) {
  console.error("Templates failed to load:");
  for (const [slug, list] of Object.entries(issues)) {
    for (const issue of list) console.error(`  ${slug}: ${issue}`);
  }
  process.exit(1);
}

const payload = {
  version: versionFor(catalog),
  generatedAt: new Date().toISOString(),
  catalog,
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(payload), "utf8");

console.log(`Wrote ${OUT_PATH}`);
console.log(`  templates:   ${Object.keys(catalog).length}`);
console.log(`  version:     ${payload.version}`);
console.log(`  generatedAt: ${payload.generatedAt}`);
