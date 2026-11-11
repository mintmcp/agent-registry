import { scanForLeaks } from "./leaks.js";
import { CHANGELOG_FILE, MANIFEST_FILE, README_FILE, type TemplateFolder } from "./load.js";
import { BUILTIN_PLACEHOLDERS, findPlaceholders, NAMESPACES } from "./placeholders.js";
import { hasDefault, RenderError, renderTemplate } from "./render.js";
import type { CatalogEntry, SetupParam } from "./schema.js";

export type CheckReport = {
  errors: string[];
  warnings: string[];
};

// Headings the platform appends to every agent's AGENTS.md. A template that
// carries them would end up with the platform part twice.
export const PLATFORM_SECTION_HEADINGS = [
  "## Your configuration and identity",
  "## Operating Guide",
];

export function checkTemplate(entry: CatalogEntry, files: TemplateFolder): CheckReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { manifest, content } = entry;

  const renderable: Array<[string, string]> = [
    [manifest.files.agentsMd, content.agentsMd],
    ...Object.entries(content.seed),
  ];

  if (content.agentsMd.trim() === "") errors.push(`${manifest.files.agentsMd}: is empty`);

  for (const heading of PLATFORM_SECTION_HEADINGS) {
    content.agentsMd.split("\n").forEach((line, i) => {
      if (line.trim() === heading) {
        errors.push(
          `${manifest.files.agentsMd}:${i + 1}: '${heading}' is added by the platform; remove it`,
        );
      }
    });
  }

  const declared = new Set(manifest.setup.map((p) => p.name));
  const used = new Set<string>();
  for (const [path, text] of renderable) {
    for (const ref of findPlaceholders(text)) {
      const where = `${path}:${ref.line}: ${ref.raw}`;
      if (!NAMESPACES.includes(ref.namespace)) {
        errors.push(`${where} uses unknown namespace '${ref.namespace}'`);
      } else if (ref.namespace === "setup") {
        if (declared.has(ref.key)) used.add(ref.key);
        else errors.push(`${where} is not declared in setup`);
      } else if (!BUILTIN_PLACEHOLDERS[ref.namespace].includes(ref.key)) {
        errors.push(`${where} is not a known ${ref.namespace} placeholder`);
      }
    }
  }
  const placeholderErrors = errors.length;
  for (const name of declared) {
    if (!used.has(name)) errors.push(`${MANIFEST_FILE}: setup param '${name}' is never used`);
  }

  const listed = new Set([
    MANIFEST_FILE,
    README_FILE,
    CHANGELOG_FILE,
    manifest.files.agentsMd,
    ...manifest.files.seed,
    ...(manifest.installGuide ? [manifest.installGuide] : []),
  ]);
  for (const path of Object.keys(files)) {
    if (!listed.has(path)) {
      errors.push(
        `${path}: not referenced by ${MANIFEST_FILE} (list it under files.seed or remove it)`,
      );
    }
  }
  if (files[CHANGELOG_FILE] === undefined) warnings.push(`missing ${CHANGELOG_FILE}`);

  for (const [path, text] of Object.entries(files)) {
    for (const leak of scanForLeaks(path, text)) {
      errors.push(`${leak.file}:${leak.line}: possible org-specific ${leak.kind} '${leak.match}'`);
    }
  }

  // A bad placeholder already has its own error; rendering would only repeat
  // it as "unresolved".
  if (placeholderErrors === 0) {
    try {
      renderTemplate(entry, sampleRenderContext(manifest.slug, manifest.setup));
    } catch (err) {
      if (!(err instanceof RenderError)) throw err;
      for (const issue of err.issues) errors.push(`sample render: ${issue}`);
    }
  }

  return { errors, warnings };
}

function sampleSetupValue(param: SetupParam): unknown {
  switch (param.type) {
    case "string":
      if (!param.validation) return "sample";
      return param.placeholder && new RegExp(param.validation.pattern).test(param.placeholder)
        ? param.placeholder
        : undefined;
    case "text":
      return "sample text";
    case "url":
      return "https://example.com";
    case "integer":
      return param.validation?.min ?? param.validation?.max ?? 1;
    case "boolean":
      return true;
    case "enum":
      return param.options[0];
    case "slack_user_list":
      return [{ id: "U00000000", name: "Sample User" }];
    case "slack_channel":
      return { id: "C00000000", name: "sample-channel" };
  }
}

// Values that satisfy every param's schema, so a sample render only fails on
// template problems. A `string` with a pattern has no generic sample: it
// uses its default or a placeholder that matches the pattern.
export function sampleRenderContext(slug: string, setup: SetupParam[]) {
  const values: Record<string, unknown> = {};
  for (const param of setup) {
    const value = hasDefault(param) ? param.defaultValue : sampleSetupValue(param);
    if (value !== undefined) values[param.name] = value;
  }
  return {
    agent: { name: "Sample Agent", slug },
    install: { date: "2026-01-01", by: "Sample User" },
    setup: values,
  };
}
