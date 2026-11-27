import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

class Plugin {
  constructor(app, manifest) {
    this.app = app;
    this.manifest = manifest;
    this._data = null;
    this._events = [];
    this._commands = [];
    this._ribbon = [];
    this._views = [];
    this._settingsTabs = [];
  }

  async loadData() {
    return this._data;
  }

  async saveData(data) {
    this._data = data;
  }

  registerView(type, factory) {
    this._views.push({ type, factory });
  }

  addRibbonIcon(icon, title, callback) {
    const item = { icon, title, callback };
    this._ribbon.push(item);
    return item;
  }

  addCommand(command) {
    this._commands.push(command);
  }

  addSettingTab(tab) {
    this._settingsTabs.push(tab);
  }

  register(callback) {
    this._events.push(callback);
  }
}

class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = {};
  }
}

class ItemView {
  constructor(leaf) {
    this.leaf = leaf;
    this.contentEl = {};
  }
}

class Modal {
  constructor(app) {
    this.app = app;
    this.titleEl = {};
    this.contentEl = {};
  }
}

class Setting {
  constructor(containerEl) {
    this.containerEl = containerEl;
  }

  setName() {
    return this;
  }

  setDesc() {
    return this;
  }

  setClass() {
    return this;
  }

  addToggle() {
    return this;
  }

  addButton() {
    return this;
  }
}

class Notice {
  constructor(message, duration) {
    this.message = message;
    this.duration = duration;
  }
}

const require = createRequire(import.meta.url);
const originalLoad = require("node:module")._load;
require("node:module")._load = function load(request, parent, isMain) {
  if (request === "obsidian") {
    return { Plugin, PluginSettingTab, ItemView, Modal, Setting, Notice };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const base = mkdtempSync(path.join(tmpdir(), "obsidian-recycle-bin-smoke-"));
const source = path.join(base, "notes", "a.md");
const pluginDir = path.join(base, ".obsidian", "plugins", "obsidian-recycle-bin");
mkdirSync(path.dirname(source), { recursive: true });
mkdirSync(pluginDir, { recursive: true });
writeFileSync(source, "smoke", "utf8");

const root = { path: "", name: "", children: [] };
let physicalDeleted = false;
const app = {
  vault: {
    configDir: ".obsidian",
    adapter: {
      getBasePath: () => base,
    },
    getRoot: () => root,
    getAbstractFileByPath: () => null,
    delete: async () => {
      physicalDeleted = true;
      rmSync(source, { force: true });
    },
  },
  workspace: {
    getLeavesOfType: () => [],
    getRightLeaf: () => null,
    rightSplit: { expand: () => undefined },
    revealLeaf: async () => undefined,
  },
};

let originalCalls = 0;
const originalTrash = async () => {
  originalCalls++;
  return true;
};
app.fileManager = { trashFile: originalTrash };

try {
  const module = require(path.join(process.cwd(), "main.js"));
  const PluginClass = module.default;
  assert.equal(typeof PluginClass, "function");

  const plugin = new PluginClass(app, { id: "obsidian-recycle-bin", dir: "obsidian-recycle-bin" });
  await plugin.onload();

  assert.equal(plugin.settings.enabled, true);
  assert.equal(plugin._views[0].type, "recycle-bin-view");
  assert.ok(plugin._commands.some((command) => command.id === "open-recycle-bin"));
  assert.equal(plugin._ribbon[0].icon, "trash-2");
  assert.equal(plugin._settingsTabs.length, 1);
  assert.notEqual(app.fileManager.trashFile, originalTrash);

  const deleted = await app.fileManager.trashFile({ path: "notes/a.md" });
  assert.equal(deleted, true);
  assert.equal(physicalDeleted, true);
  assert.equal(existsSync(source), false);

  const index = JSON.parse(
    readFileSync(path.join(pluginDir, "bin", "index.json"), "utf8"),
  );
  assert.equal(index.items.length, 1);
  assert.equal(index.items[0].originalPath, "notes/a.md");

  plugin.onunload();
  assert.equal(app.fileManager.trashFile, originalTrash);
  assert.equal(originalCalls, 0);

  console.log("smoke ok：main.js 可加载，删除被接管并写入插件回收站");
} finally {
  require("node:module")._load = originalLoad;
  rmSync(base, { recursive: true, force: true });
}
