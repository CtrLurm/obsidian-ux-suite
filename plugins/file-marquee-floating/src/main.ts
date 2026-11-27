import { Plugin, Notice } from "obsidian";
import { DEFAULT_SETTINGS, FileMarqueeSettings, clampLongPress } from "./settings";
import { MarqueeController } from "./marquee";
import { FloatingPanelManager } from "./floating";
import { FileMarqueeSettingTab } from "./settings-tab";

export default class FileMarqueePlugin extends Plugin {
  settings!: FileMarqueeSettings;
  marquee!: MarqueeController;
  floating!: FloatingPanelManager;
  private saveTimer: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.marquee = new MarqueeController(this);
    this.floating = new FloatingPanelManager(this);
    this.marquee.start();
    this.floating.start();

    this.addSettingTab(new FileMarqueeSettingTab(this.app, this));

    this.addRibbonIcon("scan", "文件框选与浮窗", () => {
      this.floating.openExplorerPanel();
    });

    this.addCommand({
      id: "float-file-explorer",
      name: "浮窗显示文件列表",
      callback: () => this.floating.openExplorerPanel(),
    });

    this.addCommand({
      id: "float-ribbon",
      name: "浮窗显示功能区",
      callback: () => this.floating.openRibbonPanel(),
    });

    this.addCommand({
      id: "clear-selection",
      name: "清除文件框选",
      callback: () => this.marquee.clearSelection(),
    });

    this.addCommand({
      id: "toggle-enabled",
      name: "启用或停用文件框选",
      callback: async () => {
        this.settings.enabled = !this.settings.enabled;
        await this.saveSettings();
        new Notice(this.settings.enabled ? "文件框选与浮窗已启用" : "文件框选与浮窗已停用");
      },
    });

    this.registerDomEvent(window, "beforeunload", () => {
      this.floating.restoreAll();
    });
  }

  onunload(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.floating?.destroy();
    this.marquee?.destroy();
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<FileMarqueeSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
    this.settings.enabled = Boolean(this.settings.enabled);
    this.settings.showToolbar = Boolean(this.settings.showToolbar);
    this.settings.enableTearOff = Boolean(this.settings.enableTearOff);
    this.settings.longPressMs = clampLongPress(Number(this.settings.longPressMs));
  }

  refreshControllers(): void {
    this.marquee?.refresh();
    this.floating?.refresh();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.refreshControllers();
  }

  saveSettingsDebounced(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.saveSettings();
    }, 320);
  }
}
