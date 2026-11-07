export const BUILTIN_PLACEHOLDERS: Record<string, readonly string[]> = {
  agent: ["name", "slug"],
  install: ["date", "by"],
};

export const NAMESPACES = [...Object.keys(BUILTIN_PLACEHOLDERS), "setup"];

// The `$` lookbehind skips GitHub Actions expressions (`${{ github.x }}`),
// which agents that work on workflows quote in their instructions.
const PLACEHOLDER_RE = /(?<!\$)\{\{\s*([a-z]+)\.([a-z0-9_]+)\s*\}\}/g;

export type PlaceholderRef = {
  namespace: string;
  key: string;
  raw: string;
  line: number;
};

export function findPlaceholders(text: string): PlaceholderRef[] {
  const refs: PlaceholderRef[] = [];
  const lines = text.split("\n");
  lines.forEach((lineText, i) => {
    for (const match of lineText.matchAll(PLACEHOLDER_RE)) {
      refs.push({ namespace: match[1], key: match[2], raw: match[0], line: i + 1 });
    }
  });
  return refs;
}

export function substitute(
  text: string,
  resolve: (namespace: string, key: string) => string | undefined,
): { output: string; unresolved: string[] } {
  const unresolved: string[] = [];
  const output = text.replace(PLACEHOLDER_RE, (raw, namespace: string, key: string) => {
    const value = resolve(namespace, key);
    if (value === undefined) {
      unresolved.push(raw);
      return raw;
    }
    return value;
  });
  return { output, unresolved };
}
