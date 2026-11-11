import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { extractTemplate, ownerPart, replaceNames } from "../scripts/lib/extract.js";
import { loadTemplate, readTemplateDir } from "../src/load.js";
import { fixturesDir } from "./helpers/fixtures.js";

function extractSample() {
  return extractTemplate({
    agent: readTemplateDir(resolve(fixturesDir, "agent-workspace/sample-bot")),
    slug: "sample-bot",
    displayName: "Sample Bot",
    description: "Answers questions",
    aliases: ["SB"],
    source: "sample-bot",
    date: "2026-11-06",
  });
}

describe("ownerPart", () => {
  it("drops everything from the first platform heading", () => {
    const md =
      "# A\n\nRules.\n\n## Your configuration and identity\n\nX\n\n---\n\n## Operating Guide\n";
    expect(ownerPart(md)).toBe("# A\n\nRules.\n");
  });

  it("keeps files without a platform part", () => {
    expect(ownerPart("# A\n\nRules.\n")).toBe("# A\n\nRules.\n");
  });
});

describe("replaceNames", () => {
  it("replaces whole names only, longest first", () => {
    expect(replaceNames("SB is Sample Bot. SBX stays. SB's job.", ["SB", "Sample Bot"])).toBe(
      "{{agent.name}} is {{agent.name}}. SBX stays. {{agent.name}}'s job.",
    );
  });
});

describe("extractTemplate", () => {
  it("drafts a template that loads", () => {
    const { template } = extractSample();
    expect(Object.keys(template).sort()).toEqual([
      "AGENTS.md",
      "CHANGELOG.md",
      "README.md",
      "seed/answers.csv",
      "seed/knowledge.md",
      "template.yaml",
    ]);
    expect(loadTemplate("sample-bot", template).success).toBe(true);
  });

  it("keeps only the owner part and replaces the agent's names", () => {
    const agentsMd = extractSample().template["AGENTS.md"];
    expect(agentsMd).not.toContain("Operating Guide");
    expect(agentsMd).toContain("You are {{agent.name}}. {{agent.name}} reads the queue");
  });

  it("keeps only CSV headers", () => {
    expect(extractSample().template["seed/answers.csv"]).toBe("id,title,status\n");
  });

  it("reports the org-specific values it finds", () => {
    expect(extractSample().findings.map((f) => `${f.file}:${f.kind}:${f.match}`)).toEqual([
      "seed/knowledge.md:slack-id:U0ABC12345D",
      "seed/knowledge.md:salesforce-host:acmecorp-dev-ed.develop.lightning.force.com",
      "seed/knowledge.md:slack-id:C0DEF67890G",
    ]);
  });
});
