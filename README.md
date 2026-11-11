# @mintmcp/agent-registry

Coworker agent templates any org can install. A template is a trained coworker
agent with everything specific to its original org removed. Installing it
creates an ordinary coworker agent that already knows its job.

The registry is to coworker agents what `mcp-registry` is to the MCP store:
the content, a schema that validates it, and an API that serves it. The
platform installs templates through one backend used by the UI (the templates
section on the Coworker Agents page) and by the `mintmcp` admin connector.

## How a template maps to a coworker agent

| Coworker agent part | Template source |
|---|---|
| Config record (harness, model, effort, ambient replies, schedules) | `template.yaml` → `config` (defaults the org can change) |
| Connector bundle | `template.yaml` → `connectors` (mcp-registry slugs, mapped to the org's installed instance at install) |
| `AGENTS.md`, owner part | `AGENTS.md` |
| Data files in the workspace folder (`knowledge.md`, CSVs, ...) | `seed/` |
| Org-specific values (admins, channels, hosts, limits) | `template.yaml` → `setup`, rendered into the files above |

The template never carries what the platform writes itself: the platform part
of `AGENTS.md` ("Your configuration and identity", "Operating Guide"),
`CLAUDE.md`, `.claude/`, `progress.md`, `activity-log.csv`, `inbound/`, the
trigger workflow, the model provider and credentials.

## Files

- `agents-catalog/<slug>/`: one folder per template (layout below)
- `src/schema.ts`: Zod schema for `template.yaml` and the built catalog, plus exported types
- `src/render.ts`: setup value validation and rendering, shared with the platform
- `src/checks.ts`: content checks (placeholders, platform sections, org-specific values, sample render)
- `src/load.ts`: reads template folders from the working tree or a git ref
- `src/catalog.ts`: catalog build, change detection, version-bump rule
- `api/catalog.ts`: serves `dist/catalog.json` (bearer-token gated, same as mcp-registry)

## Template layout

```
agents-catalog/<slug>/
  template.yaml     # manifest
  AGENTS.md         # owner part of the agent's instructions
  seed/             # files copied into the agent's workspace folder
  README.md         # shown in the gallery
  CHANGELOG.md
  INSTALL.md        # optional, steps for an agent installing through MCP
```

See `src/schema.ts` for the authoritative shape of `template.yaml`. Summary:

- `slug`, `version` (MAJOR.MINOR.PATCH), `displayName`, `description`, `avatar` (`PLACEHOLDER` until one exists), `category?`
- `config`: `harness` (`claude` \| `codex`), `model?`, `effort` (`low`..`xhigh` or `null`), `ambientReplies`, `schedules` (UTC cron)
- `connectors[]`: `slug` (mcp-registry key), `required`, `account` (`agent` \| `messaging_user`), `tools`, `reason`
- `setup[]`: `name`, `label`, `description?`, `type`, `required`, `placeholder?`, plus `defaultValue`, `options` or `validation` depending on the type
- `files`: `agentsMd` and the `seed` paths (all under `seed/`)
- `installGuide?`

Setup param types: `string`, `text`, `url`, `integer`, `boolean`, `enum`,
`slack_user_list`, `slack_channel`. There are no secret params: rendered
values end up in a Git repo, so credentials belong to connectors.

## Placeholders

`AGENTS.md` and `seed/` files can use:

| Placeholder | Value |
|---|---|
| `{{agent.name}}`, `{{agent.slug}}` | The installed agent's name and slug |
| `{{setup.<name>}}` | A setup value |
| `{{install.date}}`, `{{install.by}}` | Install date (YYYY-MM-DD) and who installed it |

Substitution only: no conditionals or loops. `${{ ... }}` (GitHub Actions) is
left alone. How setup values render:

- Slack users: `Name (Slack ID U…)`, comma-separated
- Slack channels: `#name (Slack channel C…)`
- Booleans: `yes` / `no`
- Optional values left empty: an empty string

## Adding a template

1. Draft it from a trained agent's workspace folder:
   `npm run extract -- --from <agent-folder> --slug <slug> --name "<display name>" [--alias <short name>]`.
   This keeps the owner part of `AGENTS.md`, replaces the agent's names with
   `{{agent.name}}`, copies data files into `seed/` (CSVs keep only their
   header) and lists the org-specific values it found.
2. Turn each finding into a `setup` param and a placeholder, or remove it.
   Go through every seeded data file, whatever its name: move what the agent
   learned that applies to any customer into `AGENTS.md`, drop what is
   specific to the org, and replace org data with a file that tells the admin
   what to provide.
3. Fill `config` and `connectors` from the source agent (`get_coworker_agent`
   in the `mintmcp` admin connector; connectors from its page).
4. Run `npm run validate`.

## Versioning

A published `slug@version` never changes. A PR that changes a template folder
must raise its version (`check-versions`). The catalog serves each
template's current version; the platform keeps the version it installed from
on the agent.

## CI gates

`Checks` (`.github/workflows/ci.yml`): `lint` → `typecheck` → `validate` → `test` → `build`.

PRs touching `agents-catalog/` also run `Template checks`
(`.github/workflows/template-checks.yml`):

- `changed-slugs` and `check-versions` against the PR base
- `check-connectors` against mcp-registry's catalog, which needs the
  `MCP_REGISTRY_READ_TOKEN` secret (contents:read on `d8e-ai/mcp-registry`)

Locally: `npm run check-connectors -- --catalog ../mcp-registry/src/catalog.json`.
