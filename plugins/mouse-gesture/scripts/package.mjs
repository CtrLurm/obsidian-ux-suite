import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const releaseDir = path.join(root, "release");
const files = ["main.js", "manifest.json", "styles.css"];

for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`缺少 ${file}，请先运行 npm run build`);
    process.exit(1);
  }
}

fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });
for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(releaseDir, file));
}

const zipPath = path.join(root, `mouse-gesture-${manifest.version}.zip`);
fs.rmSync(zipPath, { force: true });

const archiveScript = [
  "$ErrorActionPreference = 'Stop'",
  `Compress-Archive -Path '${path.join(releaseDir, "*")}' -DestinationPath '${zipPath}' -Force`,
].join("; ");

const shells = ["powershell.exe", "pwsh"];
let lastError = null;
let packed = false;

for (const shell of shells) {
  const result = spawnSync(
    shell,
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", archiveScript],
    { stdio: "inherit" },
  );

  if (result.error) {
    lastError = result.error;
    continue;
  }
  if (result.status === 0) {
    packed = true;
    break;
  }
  lastError = new Error(`${shell} 退出码 ${result.status ?? "unknown"}`);
}

if (!packed) {
  console.error("创建 zip 失败；release 目录仍然可用");
  if (lastError) {
    console.error(lastError.message);
  }
  process.exit(1);
}

console.log(`release/ 已生成：${files.join(", ")}`);
console.log(`压缩包：${zipPath}`);
