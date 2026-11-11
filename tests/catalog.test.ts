import { describe, expect, it } from "vitest";

import {
  buildCatalog,
  changedSlugs,
  compareSemver,
  versionBumpIssues,
  versionFor,
} from "../src/catalog.js";
import { CatalogSchema } from "../src/schema.js";
import { exampleFolder } from "./helpers/fixtures.js";

function bumped(version: string) {
  const folder = exampleFolder();
  folder["template.yaml"] = folder["template.yaml"].replace(
    "version: 1.0.0",
    `version: ${version}`,
  );
  folder["AGENTS.md"] += "\nOne more rule.\n";
  return folder;
}

describe("buildCatalog", () => {
  it("builds entries that match CatalogSchema", () => {
    const { catalog, issues } = buildCatalog({ "example-agent": exampleFolder() });
    expect(issues).toEqual({});
    expect(CatalogSchema.safeParse(catalog).success).toBe(true);
    expect(Object.keys(catalog["example-agent"].content.seed)).toEqual([
      "seed/knowledge.md",
      "seed/reviews.csv",
    ]);
  });

  it("reports templates that fail to load", () => {
    const { catalog, issues } = buildCatalog({ broken: { "README.md": "x" } });
    expect(catalog).toEqual({});
    expect(issues).toEqual({ broken: ["missing template.yaml"] });
  });

  it("has a version independent of key order", () => {
    const { catalog } = buildCatalog({ "example-agent": exampleFolder() });
    const entry = catalog["example-agent"];
    const reordered = { "example-agent": { content: entry.content, manifest: entry.manifest } };
    expect(versionFor(reordered)).toBe(versionFor(catalog));
  });
});

describe("changedSlugs", () => {
  it("returns new and modified templates, not removed ones", () => {
    const base = { "example-agent": exampleFolder(), removed: exampleFolder() };
    const head = { "example-agent": bumped("1.1.0"), added: exampleFolder() };
    expect(changedSlugs(base, head)).toEqual(["added", "example-agent"]);
  });

  it("ignores untouched templates", () => {
    expect(changedSlugs({ a: exampleFolder() }, { a: exampleFolder() })).toEqual([]);
  });
});

describe("versionBumpIssues", () => {
  const base = buildCatalog({ "example-agent": exampleFolder() }).catalog;

  it("accepts a changed template with a higher version", () => {
    const head = buildCatalog({ "example-agent": bumped("1.0.1") }).catalog;
    expect(versionBumpIssues(["example-agent"], base, head)).toEqual([]);
  });

  it("rejects a changed template that kept its version", () => {
    const head = buildCatalog({ "example-agent": bumped("1.0.0") }).catalog;
    expect(versionBumpIssues(["example-agent"], base, head)).toEqual([
      "example-agent: changed but version 1.0.0 is not higher than 1.0.0; bump it",
    ]);
  });

  it("ignores new templates", () => {
    expect(versionBumpIssues(["example-agent"], {}, base)).toEqual([]);
  });
});

describe("compareSemver", () => {
  it("compares numerically, not as strings", () => {
    expect(compareSemver("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareSemver("2.0.0", "2.0.0")).toBe(0);
    expect(compareSemver("0.9.9", "1.0.0")).toBeLessThan(0);
  });
});
