import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { RecycleBinService, sanitizeItems } from "./.tmp/core.mjs";

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function createFakeApp(base) {
  const entries = new Map();
  const root = { path: "", name: "", children: [] };
  entries.set("", root);

  function parentOf(vaultPath) {
    const index = vaultPath.lastIndexOf("/");
    return index === -1 ? "" : vaultPath.slice(0, index);
  }

  function addEntry(entry) {
    entries.set(entry.path, entry);
    const parent = entries.get(parentOf(entry.path));
    if (parent && Array.isArray(parent.children)) {
      parent.children.push(entry);
    }
  }

  const vault = {
    getRoot: () => root,
    getAbstractFileByPath: (vaultPath) => entries.get(vaultPath) ?? null,
    createFolder: async (vaultPath) => {
      if (entries.has(vaultPath)) {
        throw new Error(`已存在：${vaultPath}`);
      }
      await mkdir(path.join(base, vaultPath), { recursive: true });
      const folder = { path: vaultPath, name: vaultPath.split("/").pop(), children: [] };
      addEntry(folder);
      return folder;
    },
    createBinary: async (vaultPath, data) => {
      if (entries.has(vaultPath)) {
        throw new Error(`已存在：${vaultPath}`);
      }
      await mkdir(path.dirname(path.join(base, vaultPath)), { recursive: true });
      await writeFile(path.join(base, vaultPath), Buffer.from(data));
      const file = {
        path: vaultPath,
        name: vaultPath.split("/").pop(),
        data: Buffer.from(data),
      };
      addEntry(file);
      return file;
    },
    delete: async (file) => {
      await rm(path.join(base, file.path), { recursive: true, force: true });
      for (const key of Array.from(entries.keys())) {
        if (key === file.path || key.startsWith(`${file.path}/`)) {
          entries.delete(key);
        }
      }
    },
  };

  return { vault, entries };
}

async function makeFixture() {
  const base = await mkdtemp(path.join(tmpdir(), "obsidian-recycle-bin-"));
  const app = createFakeApp(base);
  const service = new RecycleBinService(app, base, "plugins/recycle");
  await service.init();
  return { base, app, service };
}

async function cleanup(base) {
  await rm(base, { recursive: true, force: true });
}

test("sanitizeItems 过滤损坏和越界条目", () => {
  const items = sanitizeItems([
    {
      id: "abc-def",
      originalPath: "笔记/旧稿.md",
      type: "file",
      deletedAt: 123,
      size: 4,
    },
    {
      id: "bad id",
      originalPath: "笔记/a.md",
      type: "file",
      deletedAt: 1,
      size: 1,
    },
    {
      id: "abc-ghi",
      originalPath: "../outside.md",
      type: "file",
      deletedAt: 1,
      size: 1,
    },
    {
      id: "abc-jkl",
      originalPath: "a.md",
      type: "file",
      deletedAt: 1,
      size: -1,
    },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].originalPath, "笔记/旧稿.md");
});

test("文件移入回收站后可恢复原路径和内容", async () => {
  const { base, app, service } = await makeFixture();
  try {
    await mkdir(path.join(base, "笔记"), { recursive: true });
    await writeFile(path.join(base, "笔记", "旧稿.md"), "旧内容", "utf8");
    const source = { path: "笔记/旧稿.md" };

    const item = await service.moveToBin(source);
    assert.equal(item.type, "file");
    assert.equal(item.originalPath, "笔记/旧稿.md");
    assert.ok(item.size > 0);
    assert.ok(await exists(path.join(base, "plugins", "recycle", "bin", "data", item.id, "旧稿.md")));

    await app.vault.delete(source);
    assert.equal(await exists(path.join(base, "笔记", "旧稿.md")), false);

    const result = await service.restore(item);
    assert.equal(result, "ok");
    assert.equal((await readFile(path.join(base, "笔记", "旧稿.md"), "utf8")), "旧内容");
    assert.equal((await service.list()).length, 0);
  } finally {
    await cleanup(base);
  }
});

test("文件夹及其子文件整体移入回收站并恢复", async () => {
  const { base, app, service } = await makeFixture();
  try {
    await mkdir(path.join(base, "资料", "子目录"), { recursive: true });
    await writeFile(path.join(base, "资料", "子目录", "a.txt"), "A", "utf8");
    await writeFile(path.join(base, "资料", "b.txt"), "B", "utf8");

    const item = await service.moveToBin({ path: "资料", children: [] });
    assert.equal(item.type, "folder");
    assert.ok(item.size >= 2);

    await rm(path.join(base, "资料"), { recursive: true, force: true });
    const result = await service.restore(item);
    assert.equal(result, "ok");
    assert.equal((await readFile(path.join(base, "资料", "b.txt"), "utf8")), "B");
    assert.equal((await readFile(path.join(base, "资料", "子目录", "a.txt"), "utf8")), "A");
    assert.equal((await service.list()).length, 0);
  } finally {
    await cleanup(base);
  }
});

test("原位置已有同名文件时恢复返回 conflict 并保留条目", async () => {
  const { base, app, service } = await makeFixture();
  try {
    await mkdir(path.join(base, "笔记"), { recursive: true });
    await writeFile(path.join(base, "笔记", "冲突.md"), "旧", "utf8");
    const item = await service.moveToBin({ path: "笔记/冲突.md" });
    await app.vault.delete({ path: "笔记/冲突.md" });
    await mkdir(path.join(base, "笔记"), { recursive: true });
    await writeFile(path.join(base, "笔记", "冲突.md"), "新", "utf8");
    app.vault.getAbstractFileByPath = (vaultPath) =>
      vaultPath === "笔记/冲突.md" ? { path: vaultPath } : app.entries.get(vaultPath) ?? null;

    const result = await service.restore(item);
    assert.equal(result, "conflict");
    assert.equal((await service.list()).length, 1);
  } finally {
    await cleanup(base);
  }
});

test("彻底删除和清空回收站会删除实际数据", async () => {
  const { base, service } = await makeFixture();
  try {
    await mkdir(path.join(base, "笔记"), { recursive: true });
    await writeFile(path.join(base, "笔记", "a.md"), "A", "utf8");
    await writeFile(path.join(base, "笔记", "b.md"), "B", "utf8");
    const first = await service.moveToBin({ path: "笔记/a.md" });
    const second = await service.moveToBin({ path: "笔记/b.md" });

    await service.deleteMany([first.id]);
    assert.equal((await service.list()).length, 1);
    assert.equal(await exists(path.join(base, "plugins", "recycle", "bin", "data", first.id)), false);

    const count = await service.empty();
    assert.equal(count, 1);
    assert.equal((await service.list()).length, 0);
    assert.equal(await exists(path.join(base, "plugins", "recycle", "bin", "data", second.id)), false);
  } finally {
    await cleanup(base);
  }
});

test("list 会过滤掉已被手工删除的数据目录", async () => {
  const { base, service } = await makeFixture();
  try {
    await mkdir(path.join(base, "笔记"), { recursive: true });
    await writeFile(path.join(base, "笔记", "a.md"), "A", "utf8");
    const item = await service.moveToBin({ path: "笔记/a.md" });
    await rm(path.join(base, "plugins", "recycle", "bin", "data", item.id), {
      recursive: true,
      force: true,
    });
    assert.equal((await service.list()).length, 0);
  } finally {
    await cleanup(base);
  }
});

test("拒绝不安全的原始路径", async () => {
  const { base, service } = await makeFixture();
  try {
    await assert.rejects(() => service.moveToBin({ path: "../outside.md" }), /不支持的路径/);
  } finally {
    await cleanup(base);
  }
});
