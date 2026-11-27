import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
mkdirSync(join(root, "test", ".tmp"), { recursive: true });

await build({
  entryPoints: [join(root, "test", "entry.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  outfile: join(root, "test", ".tmp", "core.mjs"),
  logLevel: "silent",
});

const result = spawnSync(
  process.execPath,
  ["--test", join(root, "test", "core.test.mjs")],
  { cwd: root, stdio: "inherit" },
);

process.exit(result.status ?? 1);
