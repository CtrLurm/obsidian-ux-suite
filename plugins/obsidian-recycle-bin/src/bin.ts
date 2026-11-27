import type { App, TAbstractFile, TFolder } from "obsidian";
import * as fs from "fs";
import * as path from "path";
import {
  errorMessage,
  isSafeVaultPath,
  toArrayBuffer,
  vaultBasename,
  vaultParent,
} from "./helpers";

export interface RecycleItem {
  /** 回收站内唯一 id，同时是 bin/data 下的目录名 */
  id: string;
  /** 删除前的 vault 相对路径，例如 "笔记/旧稿.md" */
  originalPath: string;
  type: "file" | "folder";
  deletedAt: number;
  size: number;
}

export interface RestoreOutcome {
  restored: number;
  conflicts: Array<{ item: RecycleItem; reason: string }>;
  errors: Array<{ item: RecycleItem; reason: string }>;
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{5,63}$/;

function isFolder(file: TAbstractFile): file is TFolder {
  return Array.isArray((file as unknown as TFolder).children);
}

function isItem(value: unknown): value is RecycleItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<RecycleItem>;
  return (
    typeof item.id === "string" &&
    ID_PATTERN.test(item.id) &&
    typeof item.originalPath === "string" &&
    isSafeVaultPath(item.originalPath) &&
    (item.type === "file" || item.type === "folder") &&
    typeof item.deletedAt === "number" &&
    Number.isFinite(item.deletedAt) &&
    typeof item.size === "number" &&
    Number.isFinite(item.size) &&
    item.size >= 0
  );
}

export function sanitizeItems(value: unknown): RecycleItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isItem).map((item) => ({
    id: item.id,
    originalPath: item.originalPath,
    type: item.type,
    deletedAt: item.deletedAt,
    size: item.size,
  }));
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.promises.access(target);
    return true;
  } catch {
    return false;
  }
}

async function directorySize(target: string): Promise<number> {
  let total = 0;
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(target, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) {
      total += await directorySize(child);
    } else if (entry.isFile()) {
      try {
        total += (await fs.promises.stat(child)).size;
      } catch {
        // 文件在遍历中被移走时忽略
      }
    }
  }
  return total;
}

function makeId(): string {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${time}-${random}`;
}

/**
 * 把删除的文件保存在插件目录下的 bin/ 中：
 *   bin/index.json                元数据
 *   bin/data/<id>/<原文件名>       实际内容
 *
 * 每个条目保留原始 vault 路径，所以恢复时可以回到原位置。
 */
export class RecycleBinService {
  private readonly binRoot: string;
  private readonly dataRoot: string;
  private readonly indexFile: string;

  constructor(
    private readonly app: App,
    private readonly basePath: string,
    pluginDir: string,
  ) {
    this.binRoot = path.join(basePath, pluginDir, "bin");
    this.dataRoot = path.join(this.binRoot, "data");
    this.indexFile = path.join(this.binRoot, "index.json");
  }

  getPath(): string {
    return this.binRoot;
  }

  async init(): Promise<void> {
    await fs.promises.mkdir(this.dataRoot, { recursive: true });
    if (!(await pathExists(this.indexFile))) {
      await this.writeIndex([]);
    }
  }

  private getItemRoot(id: string): string {
    return path.join(this.dataRoot, id);
  }

  private getItemSource(item: RecycleItem): string {
    return path.join(this.getItemRoot(item.id), vaultBasename(item.originalPath));
  }

  private async readIndex(): Promise<RecycleItem[]> {
    try {
      const raw = await fs.promises.readFile(this.indexFile, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return sanitizeItems(parsed);
      }
      if (parsed && typeof parsed === "object" && "items" in parsed) {
        return sanitizeItems((parsed as { items?: unknown }).items);
      }
      return [];
    } catch {
      return [];
    }
  }

  private async writeIndex(items: RecycleItem[]): Promise<void> {
    await fs.promises.mkdir(this.binRoot, { recursive: true });
    const temp = `${this.indexFile}.tmp`;
    const payload = {
      version: 1,
      items: items.slice().sort((a, b) => b.deletedAt - a.deletedAt),
    };
    await fs.promises.writeFile(temp, JSON.stringify(payload, null, 2), "utf8");
    await fs.promises.rename(temp, this.indexFile);
  }

  async list(): Promise<RecycleItem[]> {
    const items = await this.readIndex();
    const existing: RecycleItem[] = [];
    for (const item of items) {
      if (await pathExists(this.getItemRoot(item.id))) {
        existing.push(item);
      }
    }
    if (existing.length !== items.length) {
      await this.writeIndex(existing);
    }
    return existing.sort((a, b) => b.deletedAt - a.deletedAt);
  }

  async moveToBin(file: TAbstractFile): Promise<RecycleItem> {
    const originalPath = file.path;
    if (!isSafeVaultPath(originalPath)) {
      throw new Error(`不支持的路径：${originalPath}`);
    }
    if (file === this.app.vault.getRoot()) {
      throw new Error("不能删除 vault 根目录");
    }

    const item: RecycleItem = {
      id: makeId(),
      originalPath,
      type: isFolder(file) ? "folder" : "file",
      deletedAt: Date.now(),
      size: 0,
    };
    const itemRoot = this.getItemRoot(item.id);
    const sourceAbs = path.join(this.basePath, originalPath);
    const name = vaultBasename(originalPath);

    try {
      await fs.promises.mkdir(itemRoot, { recursive: true });
      const target = path.join(itemRoot, name);
      if (item.type === "folder") {
        await fs.promises.cp(sourceAbs, target, { recursive: true, errorOnExist: true });
      } else {
        await fs.promises.copyFile(sourceAbs, target);
      }
      item.size =
        item.type === "folder"
          ? await directorySize(target)
          : (await fs.promises.stat(target)).size;
      const items = await this.readIndex();
      items.push(item);
      await this.writeIndex(items);
      return item;
    } catch (error) {
      await fs.promises.rm(itemRoot, { recursive: true, force: true }).catch(() => undefined);
      throw new Error(`复制到回收站失败：${errorMessage(error)}`);
    }
  }

  private async ensureParentFolder(vaultPath: string): Promise<void> {
    const parent = vaultParent(vaultPath);
    if (!parent) {
      return;
    }
    let current = "";
    for (const part of parent.split("/")) {
      if (!part) {
        continue;
      }
      current = current ? `${current}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (!existing) {
        await this.app.vault.createFolder(current);
      } else if (!isFolder(existing)) {
        throw new Error(`路径 ${current} 已被同名文件占用`);
      }
    }
  }

  private async copyTreeToVault(source: string, vaultPath: string): Promise<void> {
    const entries = await fs.promises.readdir(source, { withFileTypes: true });
    for (const entry of entries) {
      const childVaultPath = `${vaultPath}/${entry.name}`;
      const childSource = path.join(source, entry.name);
      if (entry.isDirectory()) {
        await this.app.vault.createFolder(childVaultPath);
        await this.copyTreeToVault(childSource, childVaultPath);
      } else if (entry.isFile()) {
        const data = await fs.promises.readFile(childSource);
        await this.app.vault.createBinary(childVaultPath, toArrayBuffer(data));
      }
    }
  }

  async restore(item: RecycleItem): Promise<"ok" | "conflict" | "missing" | "invalid"> {
    if (!isSafeVaultPath(item.originalPath) || !ID_PATTERN.test(item.id)) {
      return "invalid";
    }
    const source = this.getItemSource(item);
    if (!(await pathExists(source))) {
      return "missing";
    }
    if (this.app.vault.getAbstractFileByPath(item.originalPath)) {
      return "conflict";
    }

    await this.ensureParentFolder(item.originalPath);
    if (item.type === "folder") {
      await this.app.vault.createFolder(item.originalPath);
      await this.copyTreeToVault(source, item.originalPath);
    } else {
      const data = await fs.promises.readFile(source);
      await this.app.vault.createBinary(item.originalPath, toArrayBuffer(data));
    }

    await this.removeItem(item.id);
    return "ok";
  }

  async restoreMany(ids: string[]): Promise<RestoreOutcome> {
    const wanted = new Set(ids);
    const items = (await this.list()).filter((item) => wanted.has(item.id));
    const outcome: RestoreOutcome = { restored: 0, conflicts: [], errors: [] };

    for (const item of items) {
      try {
        const result = await this.restore(item);
        if (result === "ok") {
          outcome.restored++;
        } else if (result === "conflict") {
          outcome.conflicts.push({ item, reason: "原位置已有同名文件或文件夹" });
        } else if (result === "missing") {
          outcome.errors.push({ item, reason: "回收站中的文件已丢失" });
        } else {
          outcome.errors.push({ item, reason: "条目数据无效" });
        }
      } catch (error) {
        outcome.errors.push({ item, reason: errorMessage(error) });
      }
    }
    return outcome;
  }

  async removeItem(id: string, deleteData = true): Promise<void> {
    const items = await this.readIndex();
    const next = items.filter((item) => item.id !== id);
    if (deleteData) {
      await fs.promises.rm(this.getItemRoot(id), { recursive: true, force: true }).catch(() => undefined);
    }
    if (next.length !== items.length) {
      await this.writeIndex(next);
    }
  }

  async deleteMany(ids: string[]): Promise<number> {
    const wanted = new Set(ids);
    const items = await this.readIndex();
    const next: RecycleItem[] = [];
    let deleted = 0;
    for (const item of items) {
      if (wanted.has(item.id)) {
        await fs.promises.rm(this.getItemRoot(item.id), { recursive: true, force: true }).catch(() => undefined);
        deleted++;
      } else {
        next.push(item);
      }
    }
    if (deleted > 0) {
      await this.writeIndex(next);
    }
    return deleted;
  }

  async empty(): Promise<number> {
    const items = await this.readIndex();
    await fs.promises.rm(this.dataRoot, { recursive: true, force: true }).catch(() => undefined);
    await fs.promises.mkdir(this.dataRoot, { recursive: true });
    await this.writeIndex([]);
    return items.length;
  }
}
