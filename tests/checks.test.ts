import { describe, expect, it } from "vitest";

import { checkTemplate } from "../src/checks.js";
import { scanForLeaks } from "../src/leaks.js";
import { loadTemplate, type TemplateFolder } from "../src/load.js";
import { exampleFolder, loadEntry } from "./helpers/fixtures.js";

function check(mutate: (folder: TemplateFolder) => void) {
  const folder = exampleFolder();
  mutate(folder);
  return checkTemplate(loadEntry(folder), folder);
}

describe("checkTemplate", () => {
  it("passes the example template", () => {
    expect(check(() => {})).toEqual({ errors: [], warnings: [] });
  });

  it("flags the platform's AGENTS.md sections", () => {
    const { errors } = check((f) => {
      f["AGENTS.md"] += "\n## Operating Guide\n\nStuff.\n";
    });
    expect(errors).toEqual([expect.stringMatching(/^AGENTS\.md:\d+: '## Operating Guide'/)]);
  });

  it("flags undeclared and unknown placeholders", () => {
    const { errors } = check((f) => {
      f["AGENTS.md"] += "{{setup.channel}} {{agnt.name}} {{agent.email}}\n";
    });
    expect(errors).toEqual([
      expect.stringContaining("{{setup.channel}} is not declared in setup"),
      expect.stringContaining("{{agnt.name}} uses unknown namespace 'agnt'"),
      expect.stringContaining("{{agent.email}} is not a known agent placeholder"),
    ]);
  });

  it("flags setup params nothing uses", () => {
    const { errors } = check((f) => {
      f["seed/knowledge.md"] = f["seed/knowledge.md"].replace("{{setup.source_url}}", "the source");
    });
    expect(errors).toEqual(["template.yaml: setup param 'source_url' is never used"]);
  });

  it("flags files the manifest doesn't list", () => {
    const { errors } = check((f) => {
      f["seed/notes.md"] = "notes\n";
    });
    expect(errors).toEqual([expect.stringContaining("seed/notes.md: not referenced")]);
  });

  it("flags org-specific values in any file", () => {
    const { errors } = check((f) => {
      f["README.md"] += "Ask jane@acme.io in C0DEF67890G.\n";
    });
    expect(errors).toEqual([
      expect.stringContaining("possible org-specific slack-id 'C0DEF67890G'"),
      expect.stringContaining("possible org-specific email 'jane@acme.io'"),
    ]);
  });

  it("warns when CHANGELOG.md is missing", () => {
    expect(check((f) => delete f["CHANGELOG.md"]).warnings).toEqual(["missing CHANGELOG.md"]);
  });
});

describe("loadTemplate", () => {
  it("requires the slug to match the folder", () => {
    const result = loadTemplate("other-slug", exampleFolder());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0]).toMatch(/must match its folder name/);
  });

  it("reports missing listed files", () => {
    const folder = exampleFolder();
    delete folder["seed/reviews.csv"];
    const result = loadTemplate("example-agent", folder);
    expect(result.success ? [] : result.issues).toEqual(["missing seed/reviews.csv"]);
  });
});

describe("scanForLeaks", () => {
  it("finds Mint, Slack and Salesforce identifiers", () => {
    const text = [
      "agt_6Ink6n4YndLPkoy6mHKlXv uses hosted-d4bd54d3-8834-4dfa-a513-9a55f6758306",
      "admin U0AK0FNACBF on https://orgfarm-72d4cb5f54-dev-ed.develop.lightning.force.com",
    ].join("\n");
    expect(scanForLeaks("f.md", text).map((l) => l.kind)).toEqual([
      "mint-id",
      "hosted-connector-id",
      "slack-id",
      "salesforce-host",
    ]);
  });

  it("allows example hosts and upper-case words", () => {
    const text =
      "CONSTRAINTS for https://yourorg.my.salesforce.com, login.salesforce.com, a@example.com";
    expect(scanForLeaks("f.md", text)).toEqual([]);
  });
});
