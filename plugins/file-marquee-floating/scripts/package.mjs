import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;
const releaseDir = join(root, "release");
const required = ["main.js", "manifest.json", "styles.css"];

for (const file of required) {
  if (!existsSync(join(root, file))) {
    throw new Error(`缺少构建产物：${file}`);
  }
}

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });
for (const file of required) {
  copyFileSync(join(root, file), join(releaseDir, file));
}

const zipPath = join(root, `file-marquee-floating-${version}.zip`);
rmSync(zipPath, { force: true });
const files = required.map((file) => join(releaseDir, file).replace(/'/g, "''"));
const command = `Compress-Archive -LiteralPath '${files.join("','")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`;
const result = spawnSync(
  "powershell.exe",
  ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
  { stdio: "inherit" },
);

if (result.status !== 0) {
  throw new Error(`Compress-Archive 失败（exit ${result.status ?? "unknown"}）`);
}
if (!existsSync(zipPath)) {
  throw new Error("zip 未生成");
}

const size = statSync(zipPath).size;
console.log(`已生成 ${zipPath}（${(size / 1024).toFixed(1)} KB）`);
for (const file of required) {
  console.log(`  release/${file}  ${statSync(join(releaseDir, file)).size} 字节`);
}
