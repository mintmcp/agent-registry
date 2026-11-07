import { describe, expect, it } from "vitest";

import { findPlaceholders } from "../src/placeholders.js";
import { RenderError, renderTemplate, resolveSetupValues } from "../src/render.js";
import { exampleEntry } from "./helpers/fixtures.js";

// biome-ignore lint/suspicious/noTemplateCurlyInString: a literal GitHub Actions expression, which rendering must leave alone
const GHA_EXPRESSION = "${{ github.run_id }}";

const ctx = {
  agent: { name: "Docs Helper", slug: "docs-helper" },
  install: { date: "2026-11-06", by: "Jane Admin" },
  setup: {
    admins: [{ id: "U0AAAAAAA1", name: "Jane Admin" }, "U0BBBBBBB2"],
    run_channel: { id: "C0CCCCCCC3", name: "#agent-runs" },
    source_url: "https://docs.acme.test",
  },
};

describe("findPlaceholders", () => {
  it("finds placeholders with their line numbers", () => {
    const refs = findPlaceholders("a\nhi {{ agent.name }} and {{setup.mode}}");
    expect(refs.map((r) => [r.namespace, r.key, r.line])).toEqual([
      ["agent", "name", 2],
      ["setup", "mode", 2],
    ]);
  });

  it("ignores GitHub Actions expressions", () => {
    expect(findPlaceholders(GHA_EXPRESSION)).toEqual([]);
  });
});

describe("renderTemplate", () => {
  it("renders AGENTS.md and seed files at their workspace paths", () => {
    const { files } = renderTemplate(exampleEntry(), ctx);
    expect(Object.keys(files).sort()).toEqual(["AGENTS.md", "knowledge.md", "reviews.csv"]);
    expect(files["AGENTS.md"]).toContain(
      "You are Docs Helper. Each run, you review items in `review` mode.",
    );
    expect(files["AGENTS.md"]).toContain(GHA_EXPRESSION);
  });

  it("formats Slack values with their IDs and applies defaults", () => {
    const knowledge = renderTemplate(exampleEntry(), ctx).files["knowledge.md"];
    expect(knowledge).toContain(
      "- Admins: Jane Admin (Slack ID U0AAAAAAA1), Slack ID U0BBBBBBB2. (set 2026-11-06, Jane Admin)",
    );
    expect(knowledge).toContain("- Run channel: #agent-runs (Slack channel C0CCCCCCC3).");
    expect(knowledge).toContain("- Max items per run: 5.");
  });

  it("rejects missing required values", () => {
    const { source_url: _, ...setup } = ctx.setup;
    expect(() => renderTemplate(exampleEntry(), { ...ctx, setup })).toThrow(RenderError);
  });

  it("rejects values outside their validation", () => {
    const result = resolveSetupValues(exampleEntry().manifest.setup, {
      ...ctx.setup,
      max_items: 500,
      mode: "publish",
      run_channel: "U0AAAAAAA1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map((i) => i.split(":")[0]).sort()).toEqual([
        "setup.max_items",
        "setup.mode",
        "setup.run_channel",
      ]);
    }
  });

  it("rejects values for undeclared params", () => {
    const result = resolveSetupValues(exampleEntry().manifest.setup, { ...ctx.setup, extra: "x" });
    expect(result.success).toBe(false);
  });

  it("fails on placeholders it can't resolve", () => {
    const entry = exampleEntry();
    entry.content.agentsMd += "\n{{setup.unknown}}\n";
    expect(() => renderTemplate(entry, ctx)).toThrow(
      /unresolved placeholder \{\{setup.unknown\}\}/,
    );
  });
});
