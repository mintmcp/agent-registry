import { createHash } from "node:crypto";

import { loadTemplate, type TemplateFolder } from "./load.js";
import type { Catalog, CatalogEntry } from "./schema.js";

// Recursively rewrite all object keys in sorted order so the JSON encoding
// is independent of insertion order. Arrays preserve their order.
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) out[key] = canonicalize(obj[key]);
    return out;
  }
  return value;
}

export function versionFor(catalog: Catalog): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(canonicalize(catalog)))
    .digest("hex");
  return `sha256-${hash}`;
}

export type BuildResult = {
  catalog: Catalog;
  issues: Record<string, string[]>;
};

export function buildCatalog(filesBySlug: Record<string, TemplateFolder>): BuildResult {
  const catalog: Catalog = {};
  const issues: Record<string, string[]> = {};
  for (const [slug, files] of Object.entries(filesBySlug)) {
    const loaded = loadTemplate(slug, files);
    if (loaded.success) catalog[slug] = loaded.entry;
    else issues[slug] = loaded.issues;
  }
  return { catalog, issues };
}

// Compares raw folder contents, not parsed entries: a file the manifest
// doesn't list still counts as a change, and a template that fails to load
// on either side is still reported.
export function changedSlugs(
  base: Record<string, TemplateFolder>,
  head: Record<string, TemplateFolder>,
): string[] {
  const same = (a: TemplateFolder | undefined, b: TemplateFolder) =>
    a !== undefined && JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
  return Object.keys(head)
    .filter((slug) => !same(base[slug], head[slug]))
    .sort();
}

export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

// A published version never changes: a template whose folder changed must
// carry a higher version than the base ref, or the platform would serve two
// different templates under one `slug@version`.
export function versionBumpIssues(
  changed: string[],
  base: Record<string, CatalogEntry>,
  head: Record<string, CatalogEntry>,
): string[] {
  const issues: string[] = [];
  for (const slug of changed) {
    const before = base[slug];
    const after = head[slug];
    if (!before || !after) continue;
    const { version: was } = before.manifest;
    const { version: now } = after.manifest;
    if (compareSemver(now, was) <= 0) {
      issues.push(`${slug}: changed but version ${now} is not higher than ${was}; bump it`);
    }
  }
  return issues;
}
