import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const outfile = path.join(root, "test", ".tmp", "core.mjs");

await rm(path.dirname(outfile), { recursive: true, force: true });
await mkdir(path.dirname(outfile), { recursive: true });

await build({
  entryPoints: [path.join(root, "test", "entry.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outfile,
  sourcemap: false,
  logLevel: "warning",
  external: ["obsidian"],
});

const result = spawnSync(
  process.execPath,
  ["--test", path.join(root, "test", "helpers.test.mjs"), path.join(root, "test", "bin.test.mjs")],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
