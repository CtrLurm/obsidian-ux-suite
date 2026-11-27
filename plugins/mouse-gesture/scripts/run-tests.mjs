import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outdir = path.join(root, "test", ".tmp");

fs.rmSync(outdir, { recursive: true, force: true });

await build({
  absWorkingDir: root,
  entryPoints: ["test/entry.ts"],
  outfile: path.join(outdir, "core.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: false,
  logLevel: "warning",
});

const result = spawnSync(
  process.execPath,
  ["--test", "test/gesture.test.mjs", "test/mapping.test.mjs"],
  { cwd: root, stdio: "inherit" },
);

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
