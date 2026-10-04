import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Node decides whether a .js file is ESM or CJS from the nearest package.json
 * "type" field. tsc emits .js for both builds, so without these markers Node
 * would read dist/esm/index.js as CommonJS and crash on its `export` keyword.
 */
const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

for (const [folder, type] of [
  ["cjs", "commonjs"],
  ["esm", "module"],
]) {
  const target = join(dist, folder);
  mkdirSync(target, { recursive: true });
  writeFileSync(
    join(target, "package.json"),
    JSON.stringify({ type }, null, 2) + "\n",
  );
}
