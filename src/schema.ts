import { z } from "zod";

export const SlugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case");

// Plain MAJOR.MINOR.PATCH. No pre-release or build tags: every published
// version is installable, so there is nothing to mark as pre-release.
export const SemverSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "must be MAJOR.MINOR.PATCH");

// Shape check only. The platform also requires runs at least ten minutes
// apart, which depends on the whole expression and is enforced at install.
const CronSchema = z
  .string()
  .max(128)
  .refine((value) => /^[\d*,/-]+( [\d*,/-]+){4}$/.test(value.trim()), {
    message: "must be a 5-field cron expression (UTC)",
  });

export const ScheduleSchema = z.strictObject({
  kind: z.literal("schedule"),
  cron: z.array(CronSchema).min(1).max(10),
});

// Defaults written to the coworker agent's platform config record. No
// `provider` or credential: each org picks its own at install.
export const AgentConfigSchema = z.strictObject({
  harness: z.enum(["claude", "codex"]),
  // A suggestion; the org's provider decides which models are available.
  model: z.string().min(1).max(200).optional(),
  effort: z.enum(["low", "medium", "high", "xhigh"]).nullable(),
  ambientReplies: z.boolean(),
  schedules: z.array(ScheduleSchema).max(10),
});

// `slug` is the mcp-registry catalog key, not the platform's reverse-DNS
// name (`com.mintmcp/salesforce`): that one is the registry's `pulseName`,
// which the registry marks as migration scaffolding.
export const ConnectorRequirementSchema = z.strictObject({
  slug: SlugSchema,
  required: z.boolean(),
  account: z.enum(["agent", "messaging_user"]),
  tools: z.array(z.string().min(1)),
  reason: z.string().min(1).max(500),
});

const PatternSchema = z.string().refine(
  (value) => {
    try {
      new RegExp(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: "must be a valid regular expression" },
);

const setupParamBase = {
  name: z.string().regex(/^[a-z][a-z0-9_]*$/, "must be snake_case"),
  label: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  required: z.boolean(),
  placeholder: z.string().max(200).optional(),
};

// Extends mcp-registry's `EnvFieldSchema` idea for the install form. There
// is no `isSecret`: rendered values land in a Git repo, so credentials
// belong to connectors and the model credential, both set in the UI.
export const SetupParamSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...setupParamBase,
    type: z.literal("string"),
    defaultValue: z.string().optional(),
    validation: z.strictObject({ pattern: PatternSchema }).optional(),
  }),
  z.strictObject({
    ...setupParamBase,
    type: z.literal("text"),
    defaultValue: z.string().optional(),
  }),
  z.strictObject({
    ...setupParamBase,
    type: z.literal("url"),
    defaultValue: z.url().optional(),
  }),
  z.strictObject({
    ...setupParamBase,
    type: z.literal("integer"),
    defaultValue: z.number().int().optional(),
    validation: z
      .strictObject({ min: z.number().int().optional(), max: z.number().int().optional() })
      .optional(),
  }),
  z.strictObject({
    ...setupParamBase,
    type: z.literal("boolean"),
    defaultValue: z.boolean().optional(),
  }),
  z.strictObject({
    ...setupParamBase,
    type: z.literal("enum"),
    options: z.array(z.string().min(1)).min(1),
    defaultValue: z.string().optional(),
  }),
  z.strictObject({
    ...setupParamBase,
    type: z.literal("slack_user_list"),
  }),
  z.strictObject({
    ...setupParamBase,
    type: z.literal("slack_channel"),
  }),
]);

// Workspace files the platform writes itself on every agent. A template
// seeding one of them would either be overwritten or fight the platform.
export const PLATFORM_OWNED_PATHS = [
  "AGENTS.md",
  "CLAUDE.md",
  ".claude/",
  "progress.md",
  "activity-log.csv",
  "inbound/",
];

const RelativePathSchema = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith("/") && !p.split("/").includes(".."), {
    message: "must be a relative path inside the template folder",
  });

export const TemplateFilesSchema = z.strictObject({
  agentsMd: RelativePathSchema,
  seed: z.array(
    RelativePathSchema.refine((p) => p.startsWith("seed/"), { message: "must be under seed/" }),
  ),
});

export const TemplateManifestSchema = z
  .strictObject({
    slug: SlugSchema,
    version: SemverSchema,
    displayName: z.string().min(1).max(100),
    description: z.string().min(1).max(2000),
    avatar: z.string().min(1),
    category: SlugSchema.optional(),
    config: AgentConfigSchema,
    connectors: z.array(ConnectorRequirementSchema),
    setup: z.array(SetupParamSchema),
    files: TemplateFilesSchema,
    installGuide: RelativePathSchema.optional(),
  })
  .superRefine((manifest, ctx) => {
    reportDuplicates(
      manifest.setup.map((p) => p.name),
      ["setup"],
      "setup param",
      ctx,
    );
    reportDuplicates(
      manifest.connectors.map((c) => c.slug),
      ["connectors"],
      "connector",
      ctx,
    );
    reportDuplicates(manifest.files.seed, ["files", "seed"], "seed file", ctx);

    manifest.files.seed.forEach((path, i) => {
      const target = workspacePathFor(path);
      if (isPlatformOwned(target)) {
        ctx.addIssue({
          code: "custom",
          path: ["files", "seed", i],
          message: `'${target}' is written by the platform and can't be seeded`,
        });
      }
    });

    manifest.setup.forEach((param, i) => {
      if (param.type === "enum" && param.defaultValue !== undefined) {
        if (!param.options.includes(param.defaultValue)) {
          ctx.addIssue({
            code: "custom",
            path: ["setup", i, "defaultValue"],
            message: "must be one of options",
          });
        }
      }
      if (param.type === "integer" && param.validation) {
        const { min, max } = param.validation;
        if (min !== undefined && max !== undefined && min > max) {
          ctx.addIssue({
            code: "custom",
            path: ["setup", i, "validation"],
            message: "min must not exceed max",
          });
        }
      }
    });
  });

function reportDuplicates(
  values: string[],
  path: (string | number)[],
  label: string,
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      ctx.addIssue({ code: "custom", path, message: `duplicate ${label} '${value}'` });
    }
    seen.add(value);
  }
}

// `seed/notes.md` is written to `<agent-slug>/notes.md`.
export function workspacePathFor(seedPath: string): string {
  return seedPath.replace(/^seed\//, "");
}

export function isPlatformOwned(workspacePath: string): boolean {
  return PLATFORM_OWNED_PATHS.some((owned) =>
    owned.endsWith("/") ? workspacePath.startsWith(owned) : workspacePath === owned,
  );
}

export const TemplateContentSchema = z.strictObject({
  agentsMd: z.string(),
  seed: z.record(z.string(), z.string()),
  readme: z.string(),
  installGuide: z.string().optional(),
});

export const CatalogEntrySchema = z.strictObject({
  manifest: TemplateManifestSchema,
  content: TemplateContentSchema,
});

export const CatalogSchema = z.record(SlugSchema, CatalogEntrySchema);

export type Schedule = z.infer<typeof ScheduleSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type ConnectorRequirement = z.infer<typeof ConnectorRequirementSchema>;
export type SetupParam = z.infer<typeof SetupParamSchema>;
export type TemplateFiles = z.infer<typeof TemplateFilesSchema>;
export type TemplateManifest = z.infer<typeof TemplateManifestSchema>;
export type TemplateContent = z.infer<typeof TemplateContentSchema>;
export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;
export type Catalog = z.infer<typeof CatalogSchema>;
