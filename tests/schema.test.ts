import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import { TemplateManifestSchema } from "../src/schema.js";
import { exampleFolder } from "./helpers/fixtures.js";

function exampleManifest(): Record<string, unknown> {
  return parseYaml(exampleFolder()["template.yaml"]) as Record<string, unknown>;
}

function issuePaths(manifest: unknown): string[] {
  const result = TemplateManifestSchema.safeParse(manifest);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("TemplateManifestSchema", () => {
  it("accepts the example template", () => {
    const result = TemplateManifestSchema.safeParse(exampleManifest());
    expect(result.success, JSON.stringify(result, null, 2)).toBe(true);
  });

  it("rejects unknown keys", () => {
    expect(issuePaths({ ...exampleManifest(), provider: "direct" })).toContain("");
  });

  it("rejects a secret setup param", () => {
    const m = exampleManifest();
    const setup = m.setup as Record<string, unknown>[];
    setup[0] = { ...setup[0], isSecret: true };
    expect(issuePaths(m)).toContain("setup.0");
  });

  it("rejects a non-semver version", () => {
    expect(issuePaths({ ...exampleManifest(), version: "1.0" })).toContain("version");
  });

  it("rejects a malformed cron", () => {
    const m = exampleManifest();
    (m.config as Record<string, unknown>).schedules = [{ kind: "schedule", cron: ["daily"] }];
    expect(issuePaths(m)).toContain("config.schedules.0.cron.0");
  });

  it("rejects an enum default outside its options", () => {
    const m = exampleManifest();
    const setup = m.setup as Record<string, unknown>[];
    const i = setup.findIndex((p) => p.type === "enum");
    setup[i] = { ...setup[i], defaultValue: "publish" };
    expect(issuePaths(m)).toContain(`setup.${i}.defaultValue`);
  });

  it("rejects duplicate setup params", () => {
    const m = exampleManifest();
    const setup = m.setup as unknown[];
    setup.push(setup[0]);
    expect(issuePaths(m)).toContain("setup");
  });

  it("rejects seed files outside seed/", () => {
    const m = exampleManifest();
    (m.files as Record<string, unknown>).seed = ["knowledge.md"];
    expect(issuePaths(m)).toContain("files.seed.0");
  });

  it("rejects seeding a file the platform writes", () => {
    const m = exampleManifest();
    (m.files as Record<string, unknown>).seed = ["seed/progress.md"];
    expect(issuePaths(m)).toContain("files.seed.0");
  });

  it("rejects paths escaping the template folder", () => {
    expect(issuePaths({ ...exampleManifest(), installGuide: "../secrets.md" })).toContain(
      "installGuide",
    );
  });
});
