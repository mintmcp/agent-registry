import { z } from "zod";

import { BUILTIN_PLACEHOLDERS, substitute } from "./placeholders.js";
import type { CatalogEntry, SetupParam } from "./schema.js";
import { workspacePathFor } from "./schema.js";

const SlackUserSchema = z.union([
  z.string().regex(/^[UW][A-Z0-9]{2,}$/, "must be a Slack user ID"),
  z.strictObject({
    id: z.string().regex(/^[UW][A-Z0-9]{2,}$/, "must be a Slack user ID"),
    name: z.string().min(1).optional(),
  }),
]);

const SlackChannelSchema = z.union([
  z.string().regex(/^[CG][A-Z0-9]{2,}$/, "must be a Slack channel ID"),
  z.strictObject({
    id: z.string().regex(/^[CG][A-Z0-9]{2,}$/, "must be a Slack channel ID"),
    name: z.string().min(1).optional(),
  }),
]);

type SlackRef = { id: string; name?: string };

function valueSchemaFor(param: SetupParam): z.ZodType {
  switch (param.type) {
    case "string": {
      const base = z.string().min(1);
      return param.validation ? base.regex(new RegExp(param.validation.pattern)) : base;
    }
    case "text":
      return z.string().min(1);
    case "url":
      return z.url();
    case "integer": {
      let schema = z.number().int();
      if (param.validation?.min !== undefined) schema = schema.min(param.validation.min);
      if (param.validation?.max !== undefined) schema = schema.max(param.validation.max);
      return schema;
    }
    case "boolean":
      return z.boolean();
    case "enum":
      return z.enum(param.options as [string, ...string[]]);
    case "slack_user_list":
      return z.array(SlackUserSchema).min(1);
    case "slack_channel":
      return SlackChannelSchema;
  }
}

// The UI form and the install API validate with this same schema, so a value
// the form accepts is never rejected by the API (and the reverse).
export function setupValuesSchema(setup: SetupParam[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const param of setup) {
    const schema = valueSchemaFor(param);
    shape[param.name] = param.required && !hasDefault(param) ? schema : schema.optional();
  }
  return z.strictObject(shape);
}

export function hasDefault(param: SetupParam): param is SetupParam & { defaultValue: unknown } {
  return "defaultValue" in param && param.defaultValue !== undefined;
}

export type SetupValuesResult =
  | { success: true; values: Record<string, unknown> }
  | { success: false; issues: string[] };

export function resolveSetupValues(setup: SetupParam[], input: unknown): SetupValuesResult {
  const parsed = setupValuesSchema(setup).safeParse(input ?? {});
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((i) => `setup.${i.path.join(".")}: ${i.message}`),
    };
  }
  const values: Record<string, unknown> = { ...parsed.data };
  for (const param of setup) {
    if (values[param.name] === undefined && hasDefault(param)) {
      values[param.name] = param.defaultValue;
    }
  }
  return { success: true, values };
}

function toSlackRef(value: unknown): SlackRef {
  return typeof value === "string" ? { id: value } : (value as SlackRef);
}

// Slack users keep their ID next to the name because agents identify people
// by Slack user ID, never by display name.
export function formatSetupValue(param: SetupParam, value: unknown): string {
  if (value === undefined) return "";
  switch (param.type) {
    case "slack_user_list":
      return (value as unknown[])
        .map(toSlackRef)
        .map((u) => (u.name ? `${u.name} (Slack ID ${u.id})` : `Slack ID ${u.id}`))
        .join(", ");
    case "slack_channel": {
      const c = toSlackRef(value);
      return c.name
        ? `#${c.name.replace(/^#/, "")} (Slack channel ${c.id})`
        : `Slack channel ${c.id}`;
    }
    case "boolean":
      return value ? "yes" : "no";
    default:
      return String(value);
  }
}

export type RenderContext = {
  agent: { name: string; slug: string };
  install: { date: string; by: string };
  setup: unknown;
};

export type RenderedAgent = {
  // Paths relative to the agent's workspace folder (`<repo>/<agent-slug>/`).
  files: Record<string, string>;
};

export class RenderError extends Error {
  constructor(readonly issues: string[]) {
    super(`Template render failed:\n  ${issues.join("\n  ")}`);
    this.name = "RenderError";
  }
}

// Renders only what the template owns: the owner part of AGENTS.md and the
// seed files. The platform appends its own AGENTS.md sections and writes
// CLAUDE.md, .claude/, progress.md, activity-log.csv and inbound/.
export function renderTemplate(entry: CatalogEntry, ctx: RenderContext): RenderedAgent {
  const { manifest, content } = entry;
  const resolved = resolveSetupValues(manifest.setup, ctx.setup);
  if (!resolved.success) throw new RenderError(resolved.issues);

  const params = new Map(manifest.setup.map((p) => [p.name, p]));
  const builtins: Record<string, Record<string, string>> = {
    agent: ctx.agent,
    install: ctx.install,
  };

  const resolve = (namespace: string, key: string): string | undefined => {
    if (namespace === "setup") {
      const param = params.get(key);
      return param ? formatSetupValue(param, resolved.values[key]) : undefined;
    }
    if (BUILTIN_PLACEHOLDERS[namespace]?.includes(key)) return builtins[namespace][key];
    return undefined;
  };

  const issues: string[] = [];
  const files: Record<string, string> = {};
  const sources: Array<[string, string]> = [
    ["AGENTS.md", content.agentsMd],
    ...Object.entries(content.seed).map(([path, text]): [string, string] => [
      workspacePathFor(path),
      text,
    ]),
  ];
  for (const [path, text] of sources) {
    const { output, unresolved } = substitute(text, resolve);
    for (const raw of unresolved) issues.push(`${path}: unresolved placeholder ${raw}`);
    files[path] = output;
  }

  if (issues.length > 0) throw new RenderError(issues);
  return { files };
}
