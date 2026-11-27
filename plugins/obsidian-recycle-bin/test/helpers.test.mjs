import test from "node:test";
import assert from "node:assert/strict";
import {
  errorMessage,
  formatDateTime,
  formatSize,
  isSafeVaultPath,
  toArrayBuffer,
  vaultBasename,
  vaultParent,
} from "./.tmp/core.mjs";

test("formatSize 输出常用单位", () => {
  assert.equal(formatSize(0), "0 B");
  assert.equal(formatSize(512), "512 B");
  assert.equal(formatSize(1024), "1.0 KB");
  assert.equal(formatSize(1536), "1.5 KB");
  assert.equal(formatSize(1024 * 1024), "1.0 MB");
});

test("formatDateTime 处理非法时间和正常时间", () => {
  assert.equal(formatDateTime(0), "未知时间");
  assert.equal(formatDateTime(Number.NaN), "未知时间");
  const text = formatDateTime(Date.UTC(2025, 0, 2, 3, 4));
  assert.ok(text.length > 0);
  assert.ok(/\d{4}/.test(text));
});

test("vault 路径工具兼容正反斜杠", () => {
  assert.equal(vaultBasename("笔记/旧稿.md"), "旧稿.md");
  assert.equal(vaultBasename("笔记\\旧稿.md"), "旧稿.md");
  assert.equal(vaultBasename("根文件.md"), "根文件.md");
  assert.equal(vaultParent("笔记/子目录/旧稿.md"), "笔记/子目录");
  assert.equal(vaultParent("旧稿.md"), "");
});

test("isSafeVaultPath 拒绝越界和绝对路径", () => {
  assert.equal(isSafeVaultPath("笔记/旧稿.md"), true);
  assert.equal(isSafeVaultPath("a/b/c"), true);
  assert.equal(isSafeVaultPath(""), false);
  assert.equal(isSafeVaultPath("/etc/passwd"), false);
  assert.equal(isSafeVaultPath("C:\\Windows\\x"), false);
  assert.equal(isSafeVaultPath("../outside.md"), false);
  assert.equal(isSafeVaultPath("a/../b"), false);
  assert.equal(isSafeVaultPath("a/./b"), false);
  assert.equal(isSafeVaultPath("a\0b"), false);
});

test("toArrayBuffer 保留 UTF-8 内容", () => {
  const buffer = Buffer.from("回收站内容", "utf8");
  const arrayBuffer = toArrayBuffer(buffer);
  assert.ok(arrayBuffer instanceof ArrayBuffer);
  assert.equal(Buffer.from(arrayBuffer).toString("utf8"), "回收站内容");
});

test("errorMessage 兼容 Error 和普通值", () => {
  assert.equal(errorMessage(new Error("失败")), "失败");
  assert.equal(errorMessage("文本错误"), "文本错误");
});
