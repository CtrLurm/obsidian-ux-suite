import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainPath = path.join(root, "main.js");

if (!fs.existsSync(mainPath)) {
  console.error("找不到 main.js，请先运行 npm run build");
  process.exit(1);
}

const notices = [];
const commandCalls = [];
const handlers = [];

class Plugin {
  constructor(app, manifest) {
    this.app = app;
    this.manifest = manifest;
    this.commands = [];
    this.settingTab = null;
  }

  addCommand(command) {
    this.commands.push(command);
    return command;
  }

  addSettingTab(tab) {
    this.settingTab = tab;
  }

  registerDomEvent(element, type, callback, options) {
    handlers.push({ element, type, callback, options });
  }

  async loadData() {
    return null;
  }

  async saveData() {
    /* 测试中不落盘 */
  }
}

class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = null;
  }
}

class Setting {}

class Notice {
  constructor(message) {
    notices.push(message);
  }
}

const obsidianStub = { Plugin, PluginSettingTab, Setting, Notice };

const app = {
  workspace: {
    activeLeaf: null,
    containerEl: { querySelectorAll: () => [] },
  },
  commands: {
    executeCommandById(id) {
      commandCalls.push(id);
      return true;
    },
  },
};

globalThis.window = {
  setTimeout,
  clearTimeout,
  requestAnimationFrame: (callback) => setTimeout(() => callback(Date.now()), 0),
  cancelAnimationFrame: clearTimeout,
};

const require = createRequire(import.meta.url);
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "obsidian") {
    return obsidianStub;
  }
  return originalLoad.call(this, request, parent, isMain);
};

try {
  const loaded = require(mainPath);
  const MouseGesturePlugin = loaded.default ?? loaded;
  assert.equal(typeof MouseGesturePlugin, "function", "main.js 应默认导出插件类");

  const plugin = new MouseGesturePlugin(app, {
    id: "mouse-gesture",
    version: "1.0.0",
  });
  await plugin.onload();

  assert.equal(plugin.settings.enabled, true);
  assert.equal(plugin.settings.trailColor, "#8b5cf6");
  assert.equal(plugin.commands.length, 2);
  assert.ok(
    handlers.some((item) => item.type === "pointerdown"),
    "应注册 pointerdown 监听",
  );
  assert.ok(
    handlers.some((item) => item.type === "contextmenu"),
    "应注册 contextmenu 监听",
  );

  const parsed = plugin.setMappingText("R = forward\nDR = close-tab\nLL = cmd:my-plugin:do");
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.count, 3);

  plugin.executeGestureAction("R");
  plugin.executeGestureAction("DR");
  plugin.executeGestureAction("LL");
  assert.deepEqual(commandCalls, [
    "app:go-forward",
    "workspace:close",
    "my-plugin:do",
  ]);

  plugin.cancelGesture();
  plugin.onunload();
  assert.ok(handlers.length >= 7);
  console.log("smoke ok：main.js 可加载、设置可解析、命令可执行");
} finally {
  Module._load = originalLoad;
}
