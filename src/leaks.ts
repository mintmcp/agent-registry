// Org-specific values that must never ship in a template. Extraction starts
// from a live agent's workspace, so these are the leftovers to look for.

export type LeakFinding = {
  file: string;
  line: number;
  kind: string;
  match: string;
};

type LeakPattern = {
  kind: string;
  re: RegExp;
  allow?: (match: string) => boolean;
};

const EXAMPLE_HOST = /(^|[.@/])(example|yourorg|your-org)[.-]/i;

const LEAK_PATTERNS: LeakPattern[] = [
  // Slack user, channel and team IDs. Requiring a digit keeps upper-case
  // words like "CONSTRAINTS" out.
  { kind: "slack-id", re: /\b[UWCGT](?=[A-Z0-9]*\d)[A-Z0-9]{8,12}\b/g },
  {
    kind: "mint-id",
    re: /\b(?:agt|mcp|gmw|org|user|astr)_[A-Za-z0-9]{10,}\b|\bg_[A-Za-z0-9]{20,}\b/g,
  },
  {
    kind: "hosted-connector-id",
    re: /\bhosted-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g,
  },
  {
    kind: "email",
    re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g,
    allow: (m) => EXAMPLE_HOST.test(m) || /@example\.(com|org|net)$/i.test(m),
  },
  {
    kind: "salesforce-host",
    re: /\b[\w-]+(?:\.[\w-]+)*\.(?:salesforce|force|site)\.com\b/g,
    allow: (m) => EXAMPLE_HOST.test(m) || /^(?:login|test)\.salesforce\.com$/.test(m),
  },
];

export function scanForLeaks(file: string, text: string): LeakFinding[] {
  const findings: LeakFinding[] = [];
  text.split("\n").forEach((lineText, i) => {
    for (const pattern of LEAK_PATTERNS) {
      for (const match of lineText.matchAll(pattern.re)) {
        if (pattern.allow?.(match[0])) continue;
        findings.push({ file, line: i + 1, kind: pattern.kind, match: match[0] });
      }
    }
  });
  return findings;
}
