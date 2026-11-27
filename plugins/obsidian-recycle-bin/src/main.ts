import { Notice, Plugin } from "obsidian";
import type { TAbstractFile, WorkspaceLeaf } from "obsidian";
import { RecycleBinService } from "./bin";
import { errorMessage } from "./helpers";
import { RecycleBinSettingTab } from "./settings-tab";
import { RecycleBinView, VIEW_TYPE_RECYCLE_BIN } from "./view";
import { DEFAULT_SETTINGS, type RecycleBinSettings } from "./settings";

type TrashFile = (file: TAbstractFile) => Promise<boolean>;

interface FileManagerLike {
  trashFile: TrashFile;
}

export default class RecycleBinPlugin extends Plugin {
  settings: RecycleBinSettings = { ...DEFAULT_SETTINGS };
  service!: RecycleBinService;

  private originalTrashFile: TrashFile | null = null;
  private patchedTrashFile: TrashFile | null = null;
  private saveTimer: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    const adapter = this.app.vault.adapter as unknown as { getBasePath?: () => string };
    const basePath = typeof adapter.getBasePath === "function" ? adapter.getBasePath() : "";
    if (!basePath) {
      new Notice("回收站插件仅支持桌面版本地 vault。");
      return;
    }

    const pluginDir = `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
    this.service = new RecycleBinService(this.app, basePath, pluginDir);
    await this.service.init();

    this.registerView(VIEW_TYPE_RECYCLE_BIN, (leaf: WorkspaceLeaf) => new RecycleBinView(leaf, this));

    this.addRibbonIcon("trash-2", "打开回收站", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-recycle-bin",
      name: "打开回收站",
      callback: () => {
        void this.activateView();
      },
    });

    this.addSettingTab(new RecycleBinSettingTab(this.app, this));
    this.installTrashInterceptor();
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<RecycleBinSettings> | null;
    this.settings = {
      enabled: data?.enabled !== false,
      notifyOnDelete: data?.notifyOnDelete === true,
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  saveSettingsDebounced(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.saveSettings();
    }, 400);
  }

  private installTrashInterceptor(): void {
    const fileManager = this.app.fileManager as unknown as FileManagerLike;
    if (typeof fileManager.trashFile !== "function") {
      new Notice("无法接管 Obsidian 的删除操作：trashFile 不存在。");
      return;
    }

    this.originalTrashFile = fileManager.trashFile;
    const patched: TrashFile = (file) => this.handleTrash(file);
    this.patchedTrashFile = patched;
    fileManager.trashFile = patched;

    this.register(() => {
      if (this.patchedTrashFile && fileManager.trashFile === this.patchedTrashFile) {
        fileManager.trashFile = this.originalTrashFile as TrashFile;
      }
    });
  }

  private async handleTrash(file: TAbstractFile): Promise<boolean> {
    if (!this.settings.enabled) {
      return this.originalTrashFile
        ? await this.originalTrashFile.call(this.app.fileManager, file)
        : false;
    }

    try {
      const item = await this.service.moveToBin(file);
      try {
        await this.app.vault.delete(file, true);
      } catch (error) {
        await this.service.removeItem(item.id);
        throw error;
      }
      if (this.settings.notifyOnDelete) {
        new Notice(`已移入回收站：${item.originalPath}`, 3500);
      }
      this.refreshViews();
      return true;
    } catch (error) {
      new Notice(`删除失败：${errorMessage(error)}`, 6000);
      return false;
    }
  }

  refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_RECYCLE_BIN)) {
      const view = leaf.view;
      if (view instanceof RecycleBinView) {
        void view.refresh();
      }
    }
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_RECYCLE_BIN)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (!leaf) {
        new Notice("无法打开回收站视图。");
        return;
      }
      await leaf.setViewState({
        type: VIEW_TYPE_RECYCLE_BIN,
        active: true,
      });
    }
    workspace.rightSplit.expand();
    await workspace.revealLeaf(leaf);
  }

  onunload(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const fileManager = this.app.fileManager as unknown as FileManagerLike;
    if (this.patchedTrashFile && fileManager.trashFile === this.patchedTrashFile) {
      fileManager.trashFile = this.originalTrashFile as TrashFile;
    }
  }
}
