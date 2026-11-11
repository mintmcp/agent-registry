import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadTemplate, readTemplateDir, type TemplateFolder } from "../../src/load.js";
import type { CatalogEntry } from "../../src/schema.js";

const here = fileURLToPath(new URL(".", import.meta.url));
export const fixturesDir = resolve(here, "../fixtures");
export const fixtureCatalogDir = resolve(fixturesDir, "agents-catalog");

export function exampleFolder(): TemplateFolder {
  return readTemplateDir(resolve(fixtureCatalogDir, "example-agent"));
}

export function loadEntry(folder: TemplateFolder, slug = "example-agent"): CatalogEntry {
  const loaded = loadTemplate(slug, folder);
  if (!loaded.success) throw new Error(`fixture failed to load:\n${loaded.issues.join("\n")}`);
  return loaded.entry;
}

export function exampleEntry(): CatalogEntry {
  return loadEntry(exampleFolder());
}
