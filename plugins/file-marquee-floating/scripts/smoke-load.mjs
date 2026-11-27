import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;

const noop = () => {};

class Plugin {
  constructor(app, manifest) {
    this.app = app;
    this.manifest = manifest;
    this.commands = new Map();
    this.ribbonIcons = [];
    this.settingTab = null;
  }

  async loadData() {
    return null;
  }

  async saveData() {}

  addRibbonIcon(icon, title, callback) {
    this.ribbonIcons.push({ icon, title, callback });
  }

  addCommand(command) {
    this.commands.set(command.id, command);
  }

  addSettingTab(tab) {
    this.settingTab = tab;
  }

  registerDomEvent() {}
}

class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = {
      empty: noop,
      addClass: noop,
      createEl: () => ({ createEl: () => ({}) }),
    };
  }
}

class Setting {
  setName() {
    return this;
  }

  setDesc() {
    return this;
  }

  setClass() {
    return this;
  }

  addToggle(callback) {
    callback({
      setValue() {
        return this;
      },
      onChange() {
        return this;
      },
    });
    return this;
  }

  addSlider(callback) {
    callback({
      setLimits() {
        return this;
      },
      setValue() {
        return this;
      },
      setDynamicTooltip() {
        return this;
      },
      onChange() {
        return this;
      },
    });
    return this;
  }

  addButton(callback) {
    callback({
      setButtonText() {
        return this;
      },
      onClick() {
        return this;
      },
    });
    return this;
  }
}

class Modal {
  constructor(app) {
    this.app = app;
  }

  open() {}

  close() {}
}

class Notice {}

const obsidianStub = { Plugin, PluginSettingTab, Setting, Modal, Notice };

Module._load = function (request, parent, isMain) {
  if (request === "obsidian") {
    return obsidianStub;
  }
  return originalLoad(request, parent, isMain);
};

globalThis.window = {
  addEventListener: noop,
  removeEventListener: noop,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  innerWidth: 1920,
  innerHeight: 1080,
  getSelection: () => ({ removeAllRanges: noop }),
  getComputedStyle: () => ({ overflowY: "auto" }),
};

globalThis.document = {
  addEventListener: noop,
  removeEventListener: noop,
  createElement: () => ({
    style: {},
    classList: { add: noop, remove: noop },
    appendChild: noop,
    remove: noop,
    addEventListener: noop,
    setAttribute: noop,
    removeAttribute: noop,
    querySelectorAll: () => [],
  }),
  querySelector: () => null,
  querySelectorAll: () => [],
  body: { appendChild: noop },
  elementFromPoint: () => null,
};

try {
  const loaded = await import(pathToFileURL(join(process.cwd(), "main.js")).href);
  const FileMarqueePlugin = loaded.default?.default ?? loaded.default;
  const plugin = new FileMarqueePlugin({}, { id: "file-marquee-floating" });
  await plugin.onload();

  assert.equal(plugin.settings.enabled, true);
  assert.equal(plugin.settings.longPressMs, 320);
  assert.equal(plugin.settings.showToolbar, true);
  assert.equal(plugin.settings.enableTearOff, true);
  assert.equal(plugin.commands.has("float-file-explorer"), true);
  assert.equal(plugin.commands.has("float-ribbon"), true);
  assert.equal(plugin.commands.has("clear-selection"), true);
  assert.equal(plugin.ribbonIcons.length, 1);
  assert.ok(plugin.marquee);
  assert.ok(plugin.floating);
  assert.ok(plugin.settingTab);

  plugin.onunload();
  console.log("smoke ok: file-marquee-floating main.js 可加载、设置可解析、命令已注册");
} finally {
  Module._load = originalLoad;
}
