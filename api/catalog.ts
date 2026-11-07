import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { VercelRequest, VercelResponse } from "@vercel/node";

type CatalogPayload = {
  version: string;
  generatedAt: string;
  catalog: Record<string, unknown>;
};

const CATALOG_JSON_PATH = fileURLToPath(new URL("../dist/catalog.json", import.meta.url));

let cached: { raw: string; payload: CatalogPayload } | null = null;

if (!process.env.CATALOG_API_TOKEN) {
  console.error("[catalog_auth] CATALOG_API_TOKEN unset; refusing all requests");
}

function loadCatalog(): { raw: string; payload: CatalogPayload } {
  if (cached) return cached;
  let raw: string;
  try {
    raw = readFileSync(CATALOG_JSON_PATH, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`catalog.json missing at ${CATALOG_JSON_PATH} — did \`vercel-build\` run?`);
    }
    throw err;
  }
  const payload = JSON.parse(raw) as CatalogPayload;
  cached = { raw, payload };
  return cached;
}

function unauthorized(req: VercelRequest, res: VercelResponse): void {
  res
    .status(401)
    .setHeader("Content-Type", "application/json")
    .setHeader("WWW-Authenticate", 'Bearer realm="catalog"');
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.send(JSON.stringify({ error: "unauthorized" }));
}

function checkBearer(req: VercelRequest): boolean {
  const expected = process.env.CATALOG_API_TOKEN;
  if (!expected) return false;

  const header = req.headers.authorization;
  if (typeof header !== "string") return false;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const provided = match[1].trim();

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// RFC 7232 §3.2: `If-None-Match` may be `*`, a comma-separated list of tags,
// or weak tags (`W/"..."`). Matching is by weak comparison (strip the `W/`
// prefix on both sides before equality check).
function matchesIfNoneMatch(header: string | string[] | undefined, etag: string): boolean {
  if (typeof header !== "string") return false;
  const trimmed = header.trim();
  if (!trimmed) return false;
  const bare = etag.replace(/^W\//, "");
  for (const raw of trimmed.split(",")) {
    const tag = raw.trim();
    if (tag === "*") return true;
    if (tag.replace(/^W\//, "") === bare) return true;
  }
  return false;
}

function logUnauthorized(req: VercelRequest): void {
  const fwd = req.headers["x-forwarded-for"];
  const ip = Array.isArray(fwd) ? fwd[0] : (fwd ?? "unknown");
  const ua = req.headers["user-agent"] ?? "unknown";
  console.warn(
    `[catalog_auth] 401 method=${JSON.stringify(req.method)} ip=${JSON.stringify(ip)} ua=${JSON.stringify(ua)}`,
  );
}

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).send("Method Not Allowed");
    return;
  }

  if (!checkBearer(req)) {
    logUnauthorized(req);
    unauthorized(req, res);
    return;
  }

  let loaded: { raw: string; payload: CatalogPayload };
  try {
    loaded = loadCatalog();
  } catch (err) {
    console.error("Failed to load catalog.json", err);
    res
      .status(500)
      .setHeader("Content-Type", "application/json")
      .send(JSON.stringify({ error: "catalog_unavailable" }));
    return;
  }

  // Weak ETag: the served body includes `generatedAt` which changes per build,
  // so two builds with identical catalog content produce the same `version`
  // (and thus same ETag) but byte-different bodies. RFC 7232 §2.3 requires
  // strong ETags to identify byte-identical representations.
  const etag = `W/"${loaded.payload.version}"`;
  res.setHeader("ETag", etag);
  // `private` (not `public`): the response is bearer-token-gated, and we don't
  // want intermediary/proxy caches replaying authenticated payloads. Vercel's
  // edge CDN honors `s-maxage` regardless.
  res.setHeader("Cache-Control", "private, max-age=0, s-maxage=10, stale-while-revalidate=20");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (matchesIfNoneMatch(req.headers["if-none-match"], etag)) {
    res.status(304).end();
    return;
  }

  if (req.method === "HEAD") {
    res.setHeader("Content-Length", Buffer.byteLength(loaded.raw, "utf8"));
    res.status(200).end();
    return;
  }

  res.status(200).send(loaded.raw);
}
