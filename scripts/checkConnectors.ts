// Fails when a template requires a connector slug that isn't in the
// mcp-registry catalog.
// Run: `tsx scripts/checkConnectors.ts --catalog <path-or-url>`
//   path: mcp-registry's `src/catalog.json` or a built `dist/catalog.json`
//   url:  the mcp-registry catalog API, with MCP_REGISTRY_TOKEN as bearer

import { readFileSync } from "node:fs";

import { buildCatalog } from "../src/catalog.js";
import { readCatalogDir } from "../src/load.js";
import { parseCli } from "./lib/cli.js";

const { catalog: source } = parseCli({ catalog: { type: "string" } });
if (!source) {
  console.error("Usage: tsx scripts/checkConnectors.ts --catalog <path-or-url>");
  process.exit(2);
}

async function readRegistry(from: string): Promise<unknown> {
  if (!/^https?:\/\//.test(from)) return JSON.parse(readFileSync(from, "utf8"));
  const token = process.env.MCP_REGISTRY_TOKEN;
  if (!token) throw new Error("MCP_REGISTRY_TOKEN is required to read the catalog API");
  const res = await fetch(from, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GET ${from} returned ${res.status}`);
  return res.json();
}

// The source file is slug-keyed; the built file and the API wrap it as
// `{ version, generatedAt, catalog }`.
function registrySlugs(data: unknown): Set<string> {
  const obj = data as Record<string, unknown>;
  const entries =
    obj && typeof obj.catalog === "object" && typeof obj.version === "string" ? obj.catalog : obj;
  return new Set(Object.keys(entries as Record<string, unknown>));
}

const known = registrySlugs(await readRegistry(source));
const { catalog } = buildCatalog(readCatalogDir());

const issues: string[] = [];
for (const [slug, { manifest }] of Object.entries(catalog)) {
  for (const connector of manifest.connectors) {
    if (!known.has(connector.slug)) {
      issues.push(`${slug}: connector '${connector.slug}' is not in the mcp-registry catalog`);
    }
  }
}

if (issues.length > 0) {
  console.error("Connector check failed:");
  for (const issue of issues) console.error(`  ${issue}`);
  process.exit(1);
}

console.log(`OK: connectors of ${Object.keys(catalog).length} template(s) found in mcp-registry.`);
