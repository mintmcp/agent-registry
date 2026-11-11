import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

import { type CatalogEntry, type TemplateManifest, TemplateManifestSchema } from "./schema.js";

const here = fileURLToPath(new URL(".", import.meta.url));

// `src/` in a checkout, `dist/src/` once built; both sit one or two levels
// under the repo root, which is the first ancestor holding `package.json`.
function findRepoRoot(start: string): string {
  let dir = start;
  while (!existsSync(join(dir, "package.json"))) {
    const parent = resolve(dir, "..");
    if (parent === dir) throw new Error(`No package.json above ${start}`);
    dir = parent;
  }
  return dir;
}

export const repoRoot = findRepoRoot(here);
export const CATALOG_DIR_NAME = "agents-catalog";
export const catalogRoot = resolve(repoRoot, CATALOG_DIR_NAME);
export const MANIFEST_FILE = "template.yaml";
export const README_FILE = "README.md";
export const CHANGELOG_FILE = "CHANGELOG.md";

// Every file of one template folder, keyed by path relative to that folder.
// Reading the whole folder up front lets the same checks run against the
// working tree and against a git ref.
export type TemplateFolder = Record<string, string>;

export function readTemplateDir(dir: string): TemplateFolder {
  const files: TemplateFolder = {};
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      if (name.startsWith(".")) continue;
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else files[relative(dir, full).split("\\").join("/")] = readFileSync(full, "utf8");
    }
  };
  walk(dir);
  return files;
}

export function listTemplateSlugs(root: string = catalogRoot): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => !name.startsWith(".") && statSync(join(root, name)).isDirectory())
    .sort();
}

export function readCatalogDir(root: string = catalogRoot): Record<string, TemplateFolder> {
  const out: Record<string, TemplateFolder> = {};
  for (const slug of listTemplateSlugs(root)) out[slug] = readTemplateDir(join(root, slug));
  return out;
}

function git(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const r = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: r.status === 0, stdout: r.stdout, stderr: r.stderr };
}

// Same shape as `readCatalogDir`, read from a git ref instead of the working
// tree. An absent catalog folder on that ref means no templates yet.
export function readCatalogAtRef(ref: string): Record<string, TemplateFolder> {
  const listed = git(["ls-tree", "-r", "--name-only", ref, "--", `${CATALOG_DIR_NAME}/`]);
  if (!listed.ok) throw new Error(`git ls-tree ${ref} failed: ${listed.stderr.trim()}`);

  const out: Record<string, TemplateFolder> = {};
  for (const path of listed.stdout.split("\n").filter(Boolean)) {
    const [, slug, ...rest] = path.split("/");
    if (rest.length === 0 || [slug, ...rest].some((s) => s.startsWith("."))) continue;
    const shown = git(["show", `${ref}:${path}`]);
    if (!shown.ok) throw new Error(`git show ${ref}:${path} failed: ${shown.stderr.trim()}`);
    out[slug] ??= {};
    out[slug][rest.join("/")] = shown.stdout;
  }
  return out;
}

export type LoadResult =
  | { success: true; entry: CatalogEntry }
  | { success: false; issues: string[] };

export function parseManifest(
  text: string,
): { success: true; manifest: TemplateManifest } | { success: false; issues: string[] } {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (err) {
    return { success: false, issues: [`${MANIFEST_FILE}: ${(err as Error).message}`] };
  }
  const parsed = TemplateManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((i) => `${MANIFEST_FILE}: ${i.path.join(".")}: ${i.message}`),
    };
  }
  return { success: true, manifest: parsed.data };
}

// Turns a template folder into its catalog entry. Missing files are reported
// here; content rules (placeholders, leaks) live in `checks.ts`.
export function loadTemplate(slug: string, files: TemplateFolder): LoadResult {
  const manifestText = files[MANIFEST_FILE];
  if (manifestText === undefined) return { success: false, issues: [`missing ${MANIFEST_FILE}`] };

  const parsed = parseManifest(manifestText);
  if (!parsed.success) return parsed;
  const { manifest } = parsed;

  const issues: string[] = [];
  if (manifest.slug !== slug) {
    issues.push(`${MANIFEST_FILE}: slug '${manifest.slug}' must match its folder name '${slug}'`);
  }
  const required = (path: string): string => {
    const text = files[path];
    if (text === undefined) issues.push(`missing ${path}`);
    return text ?? "";
  };

  const agentsMd = required(manifest.files.agentsMd);
  const readme = required(README_FILE);
  const seed: Record<string, string> = {};
  for (const path of manifest.files.seed) seed[path] = required(path);
  const installGuide = manifest.installGuide ? required(manifest.installGuide) : undefined;

  if (issues.length > 0) return { success: false, issues };
  return {
    success: true,
    entry: {
      manifest,
      content: { agentsMd, seed, readme, ...(installGuide !== undefined && { installGuide }) },
    },
  };
}
