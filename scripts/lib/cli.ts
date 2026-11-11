// Argument parsing shared by the catalog scripts: node's parseArgs with its
// errors turned into a one-line usage failure.

import { type ParseArgsConfig, parseArgs } from "node:util";

type Options = NonNullable<ParseArgsConfig["options"]>;

export function parseCli<O extends Options>(
  options: O,
): ReturnType<typeof parseArgs<{ options: O }>>["values"] {
  try {
    return parseArgs({ options }).values;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  }
}
