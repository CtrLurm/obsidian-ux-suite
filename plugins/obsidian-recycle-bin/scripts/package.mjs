import { copyFile, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const release = path.join(root, "release");
const files = ["main.js", "manifest.json", "styles.css"];
const zipName = "obsidian-recycle-bin-1.0.0.zip";
const zipPath = path.join(root, zipName);

await rm(release, { recursive: true, force: true });
await mkdir(release, { recursive: true });
await rm(zipPath, { force: true });
for (const file of files) {
  const source = path.join(root, file);
  try {
    await copyFile(source, path.join(release, file));
  } catch {
    throw new Error(`缺少构建产物：${file}，请先运行 npm run build`);
  }
}

const command = [
  "$ErrorActionPreference='Stop'",
  `Compress-Archive -Path '${files.map((file) => path.join(release, file)).join("','")}' -DestinationPath '${zipPath}' -Force`,
].join("; ");

let result = spawnSync(
  "powershell.exe",
  ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
  { stdio: "inherit" },
);

if (result.error || result.status !== 0) {
  result = spawnSync(
    "pwsh",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
    { stdio: "inherit" },
  );
}

if (result.error || result.status !== 0) {
  throw new Error("生成 zip 失败：未找到 powershell.exe 或 pwsh");
}

console.log(`已生成 ${zipName}（release/ 中同时保留了 main.js、manifest.json、styles.css）`);
