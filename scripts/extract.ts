// Drafts a template from a live coworker agent's workspace folder. The draft
// still needs a human pass: turn the reported findings into setup params,
// sort what it learned in its data files, and fill config and connectors
// from the platform (get_coworker_agent).
// Run: `npm run extract -- --from <agent-folder> --slug <slug> --name "<display name>"
//        [--alias <name>]... [--out <dir>]`

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { catalogRoot, readTemplateDir } from "../src/load.js";
import { SlugSchema } from "../src/schema.js";
import { parseCli } from "./lib/cli.js";
import { extractTemplate } from "./lib/extract.js";

const args = parseCli({
  from: { type: "string" },
  slug: { type: "string" },
  name: { type: "string" },
  alias: { type: "string", multiple: true },
  out: { type: "string" },
});

if (!args.from || !args.slug || !args.name) {
  console.error(
    'Usage: npm run extract -- --from <agent-folder> --slug <slug> --name "<display name>" [--alias <name>]... [--out <dir>]',
  );
  process.exit(2);
}
if (!SlugSchema.safeParse(args.slug).success) {
  console.error(`--slug '${args.slug}' must be kebab-case`);
  process.exit(2);
}

const from = resolve(args.from);
const out = resolve(args.out ?? join(catalogRoot, args.slug));
if (existsSync(out)) {
  console.error(`${out} already exists; pick another --out or remove it first`);
  process.exit(1);
}

function readDescription(folder: string): string {
  try {
    const settings = JSON.parse(readFileSync(join(folder, ".claude", "settings.json"), "utf8"));
    if (typeof settings.description === "string" && settings.description)
      return settings.description;
  } catch {}
  return "TODO: describe what the agent does";
}

const { template, findings } = extractTemplate({
  agent: readTemplateDir(from),
  slug: args.slug,
  displayName: args.name,
  description: readDescription(from),
  aliases: args.alias ?? [],
  source: basename(from),
  date: new Date().toISOString().slice(0, 10),
});

for (const [path, text] of Object.entries(template)) {
  const target = join(out, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text, "utf8");
}

console.log(`Wrote draft template to ${out}`);
console.log(`  files: ${Object.keys(template).sort().join(", ")}`);
if (findings.length === 0) {
  console.log("No org-specific values found by the scan. Still review the data files by hand.");
} else {
  console.log(`\n${findings.length} org-specific value(s) to replace with setup params or remove:`);
  for (const f of findings) console.log(`  ${f.file}:${f.line}  ${f.kind}  ${f.match}`);
}
