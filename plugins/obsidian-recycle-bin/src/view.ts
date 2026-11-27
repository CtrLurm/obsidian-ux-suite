import { ItemView, Notice } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type RecycleBinPlugin from "./main";
import type { RecycleItem } from "./bin";
import { ConfirmModal } from "./modal";
import { formatDateTime, formatSize } from "./helpers";

export const VIEW_TYPE_RECYCLE_BIN = "recycle-bin-view";

export class RecycleBinView extends ItemView {
  private items: RecycleItem[] = [];
  private readonly selected = new Set<string>();
  private loading = false;
  private busy = false;

  private summaryEl!: HTMLElement;
  private listEl!: HTMLElement;
  private emptyEl!: HTMLElement;
  private selectAllCheckbox!: HTMLInputElement;
  private restoreButton!: HTMLButtonElement;
  private deleteButton!: HTMLButtonElement;
  private emptyButton!: HTMLButtonElement;
  private refreshButton!: HTMLButtonElement;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: RecycleBinPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_RECYCLE_BIN;
  }

  getDisplayText(): string {
    return "回收站";
  }

  getIcon(): string {
    return "trash-2";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("recycle-bin-view");

    const header = container.createDiv({ cls: "recycle-bin-header" });
    const title = header.createDiv({ cls: "recycle-bin-title" });
    title.createEl("h4", { text: "回收站" });
    this.summaryEl = title.createDiv({ cls: "recycle-bin-summary" });

    const actions = header.createDiv({ cls: "recycle-bin-actions" });
    const selectAll = actions.createEl("label", { cls: "recycle-bin-select-all" });
    this.selectAllCheckbox = selectAll.createEl("input", { type: "checkbox" });
    selectAll.createSpan({ text: "全选" });
    this.selectAllCheckbox.addEventListener("change", () => {
      if (this.selectAllCheckbox.checked) {
        for (const item of this.items) {
          this.selected.add(item.id);
        }
      } else {
        this.selected.clear();
      }
      this.render();
    });

    this.restoreButton = actions.createEl("button", {
      text: "恢复所选",
      cls: "mod-cta",
    });
    this.restoreButton.addEventListener("click", () => {
      void this.restoreSelected();
    });

    this.deleteButton = actions.createEl("button", {
      text: "彻底删除",
      cls: "mod-warning",
    });
    this.deleteButton.addEventListener("click", () => {
      void this.deleteSelected();
    });

    this.emptyButton = actions.createEl("button", { text: "清空回收站" });
    this.emptyButton.addEventListener("click", () => {
      void this.emptyBin();
    });

    this.refreshButton = actions.createEl("button", { text: "刷新" });
    this.refreshButton.addEventListener("click", () => {
      void this.refresh();
    });

    this.listEl = container.createDiv({ cls: "recycle-bin-list" });
    this.emptyEl = container.createDiv({ cls: "recycle-bin-empty" });
    this.emptyEl.setText("回收站是空的。在文件浏览器或标签页中删除文件后，会出现在这里。");

    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.loading) {
      return;
    }
    this.loading = true;
    this.setBusy(true);
    try {
      const items = await this.plugin.service.list();
      const validIds = new Set(items.map((item) => item.id));
      for (const id of Array.from(this.selected)) {
        if (!validIds.has(id)) {
          this.selected.delete(id);
        }
      }
      this.items = items;
      this.render();
    } catch (error) {
      new Notice(`读取回收站失败：${error instanceof Error ? error.message : String(error)}`, 6000);
    } finally {
      this.loading = false;
      this.setBusy(false);
    }
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.listEl.toggleClass("is-loading", busy);
    this.refreshButton.disabled = busy;
    this.restoreButton.disabled = busy || this.selected.size === 0;
    this.deleteButton.disabled = busy || this.selected.size === 0;
    this.emptyButton.disabled = busy || this.items.length === 0;
    this.selectAllCheckbox.disabled = busy || this.items.length === 0;
  }

  private render(): void {
    const totalSize = this.items.reduce((sum, item) => sum + item.size, 0);
    this.summaryEl.setText(
      this.items.length === 0
        ? "暂无条目"
        : `${this.items.length} 个条目 · ${formatSize(totalSize)}`,
    );

    this.listEl.empty();
    for (const item of this.items) {
      const row = this.listEl.createDiv({ cls: "recycle-bin-row" });
      const checkbox = row.createEl("input", {
        type: "checkbox",
        cls: "recycle-bin-check",
      });
      checkbox.checked = this.selected.has(item.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          this.selected.add(item.id);
        } else {
          this.selected.delete(item.id);
        }
        this.render();
      });

      const icon = row.createDiv({ cls: "recycle-bin-type" });
      icon.setText(item.type === "folder" ? "📁" : "📄");

      const meta = row.createDiv({ cls: "recycle-bin-meta" });
      meta.createDiv({ cls: "recycle-bin-path", text: item.originalPath });
      meta.createDiv({
        cls: "recycle-bin-sub",
        text: `${item.type === "folder" ? "文件夹" : "文件"} · ${formatSize(item.size)} · ${formatDateTime(item.deletedAt)}`,
      });

      row.addEventListener("dblclick", () => {
        void this.restoreOne(item);
      });
    }

    this.emptyEl.toggleClass("is-hidden", this.items.length > 0);
    this.selectAllCheckbox.checked = this.items.length > 0 && this.selected.size === this.items.length;
    this.selectAllCheckbox.indeterminate =
      this.selected.size > 0 && this.selected.size < this.items.length;
    this.restoreButton.disabled = this.busy || this.selected.size === 0;
    this.deleteButton.disabled = this.busy || this.selected.size === 0;
    this.emptyButton.disabled = this.busy || this.items.length === 0;
    this.selectAllCheckbox.disabled = this.busy || this.items.length === 0;
  }

  private async restoreOne(item: RecycleItem): Promise<void> {
    if (this.busy) {
      return;
    }
    await this.withBusy(async () => {
      const outcome = await this.plugin.service.restoreMany([item.id]);
      this.selected.delete(item.id);
      await this.refresh();
      this.reportRestore(outcome);
    });
  }

  private async restoreSelected(): Promise<void> {
    if (this.selected.size === 0) {
      return;
    }
    await this.withBusy(async () => {
      const outcome = await this.plugin.service.restoreMany(Array.from(this.selected));
      this.selected.clear();
      await this.refresh();
      this.reportRestore(outcome);
    });
  }

  private reportRestore(outcome: {
    restored: number;
    conflicts: Array<{ item: RecycleItem; reason: string }>;
    errors: Array<{ item: RecycleItem; reason: string }>;
  }): void {
    const lines = [`已恢复 ${outcome.restored} 个条目`];
    for (const conflict of outcome.conflicts.slice(0, 3)) {
      lines.push(`冲突：${conflict.item.originalPath}（${conflict.reason}）`);
    }
    for (const error of outcome.errors.slice(0, 3)) {
      lines.push(`失败：${error.item.originalPath}（${error.reason}）`);
    }
    if (outcome.conflicts.length + outcome.errors.length > 3) {
      lines.push("其余问题请查看条目列表或开发者控制台。");
    }
    new Notice(lines.join("\n"), 7000);
  }

  private async deleteSelected(): Promise<void> {
    if (this.selected.size === 0) {
      return;
    }
    const count = this.selected.size;
    new ConfirmModal(this.app, {
      title: "彻底删除",
      message: `确定要彻底删除选中的 ${count} 个条目吗？此操作不可撤销。`,
      confirmText: "彻底删除",
      destructive: true,
      onConfirm: async () => {
        await this.withBusy(async () => {
          const deleted = await this.plugin.service.deleteMany(Array.from(this.selected));
          this.selected.clear();
          await this.refresh();
          new Notice(`已彻底删除 ${deleted} 个条目`, 4000);
        });
      },
    }).open();
  }

  private async emptyBin(): Promise<void> {
    if (this.items.length === 0) {
      return;
    }
    new ConfirmModal(this.app, {
      title: "清空回收站",
      message: `确定要清空回收站中的全部 ${this.items.length} 个条目吗？此操作不可撤销。`,
      confirmText: "清空",
      destructive: true,
      onConfirm: async () => {
        await this.withBusy(async () => {
          const count = await this.plugin.service.empty();
          this.selected.clear();
          await this.refresh();
          new Notice(`回收站已清空（${count} 个条目）`, 4000);
        });
      },
    }).open();
  }

  private async withBusy(task: () => Promise<void>): Promise<void> {
    if (this.busy) {
      return;
    }
    this.setBusy(true);
    try {
      await task();
    } catch (error) {
      new Notice(`操作失败：${error instanceof Error ? error.message : String(error)}`, 6000);
    } finally {
      this.setBusy(false);
    }
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }
}
