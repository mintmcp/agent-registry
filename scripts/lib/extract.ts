import { stringify as stringifyYaml } from "yaml";

import { PLATFORM_SECTION_HEADINGS } from "../../src/checks.js";
import { type LeakFinding, scanForLeaks } from "../../src/leaks.js";
import { CHANGELOG_FILE, MANIFEST_FILE, README_FILE, type TemplateFolder } from "../../src/load.js";
import { isPlatformOwned, type TemplateManifest } from "../../src/schema.js";

export type ExtractInput = {
  agent: TemplateFolder;
  slug: string;
  displayName: string;
  description: string;
  // Other names the agent calls itself in its instructions (e.g. "CK").
  aliases: string[];
  source: string;
  date: string;
};

export type ExtractResult = {
  template: TemplateFolder;
  findings: LeakFinding[];
};

export const DRAFT_VERSION = "0.1.0";

// Everything from the first platform heading on is injected by the platform,
// including the `---` rule that precedes "Operating Guide".
export function ownerPart(agentsMd: string): string {
  const lines = agentsMd.split("\n");
  const cut = lines.findIndex((line) => PLATFORM_SECTION_HEADINGS.includes(line.trim()));
  const kept = cut === -1 ? lines : lines.slice(0, cut);
  while (kept.length > 0 && /^\s*(---)?\s*$/.test(kept[kept.length - 1])) kept.pop();
  return `${kept.join("\n")}\n`;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Longest name first, so "CK The Copy Editor" is replaced whole before "CK".
export function replaceNames(text: string, names: string[]): string {
  let out = text;
  for (const name of [...names].sort((a, b) => b.length - a.length)) {
    out = out.replace(
      new RegExp(`(?<![\\w])${escapeRegExp(name)}(?![\\w])`, "g"),
      "{{agent.name}}",
    );
  }
  return out;
}

// Rows are the org's working data; only the header survives as the shape
// the instructions refer to.
function headerOnly(csv: string): string {
  const [header] = csv.split("\n");
  return `${header}\n`;
}

export function extractTemplate(input: ExtractInput): ExtractResult {
  const agentsMd = input.agent["AGENTS.md"];
  if (agentsMd === undefined) throw new Error("source folder has no AGENTS.md");

  const names = [input.displayName, ...input.aliases];
  const template: TemplateFolder = {
    "AGENTS.md": replaceNames(ownerPart(agentsMd), names),
  };

  const seed: string[] = [];
  for (const [path, text] of Object.entries(input.agent).sort(([a], [b]) => a.localeCompare(b))) {
    if (isPlatformOwned(path)) continue;
    const seedPath = `seed/${path}`;
    seed.push(seedPath);
    template[seedPath] = path.endsWith(".csv") ? headerOnly(text) : replaceNames(text, names);
  }

  const manifest: TemplateManifest = {
    slug: input.slug,
    version: DRAFT_VERSION,
    displayName: input.displayName,
    description: input.description,
    avatar: "PLACEHOLDER",
    config: {
      harness: "claude",
      model: "sonnet",
      effort: null,
      ambientReplies: false,
      schedules: [],
    },
    connectors: [],
    setup: [],
    files: { agentsMd: "AGENTS.md", seed },
  };
  template[MANIFEST_FILE] = stringifyYaml(manifest);
  template[README_FILE] = `# ${input.displayName}\n\n${input.description}\n`;
  template[CHANGELOG_FILE] =
    `# Changelog\n\n## ${DRAFT_VERSION}\n\n- Extracted from \`${input.source}\` on ${input.date}.\n`;

  const findings = Object.entries(template).flatMap(([path, text]) => scanForLeaks(path, text));
  return { template, findings };
}
