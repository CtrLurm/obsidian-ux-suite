import { App, Modal, Notice, Setting } from "obsidian";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

export class ConfirmModal extends Modal {
  private busy = false;

  constructor(
    app: App,
    private readonly options: ConfirmOptions,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("file-marquee-confirm-modal");
    contentEl.createEl("h2", { text: this.options.title });
    contentEl.createEl("p", { text: this.options.message, cls: "file-marquee-modal-description" });

    const setting = new Setting(contentEl).setClass("file-marquee-modal-buttons");
    setting.addButton((button) => {
      button.setButtonText("取消").onClick(() => this.close());
    });
    setting.addButton((button) => {
      button.setButtonText(this.options.confirmText);
      if (this.options.destructive) {
        button.setWarning();
      } else {
        button.setCta();
      }
      button.onClick(async () => {
        if (this.busy) {
          return;
        }
        this.busy = true;
        button.setDisabled(true);
        try {
          await this.options.onConfirm();
          this.close();
        } catch (error) {
          this.busy = false;
          button.setDisabled(false);
          new Notice(`操作失败：${error instanceof Error ? error.message : String(error)}`);
        }
      });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class FolderPickerModal extends Modal {
  constructor(
    app: App,
    private readonly folders: string[],
    private readonly onChoose: (folder: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("file-marquee-folder-picker");

    contentEl.createEl("h2", { text: "移动所选项目" });
    contentEl.createEl("p", {
      text: "选择目标文件夹。原位置存在同名项目时会跳过，不会覆盖。",
      cls: "file-marquee-modal-description",
    });

    const search = contentEl.createEl("input", {
      type: "text",
      cls: "file-marquee-folder-search",
      attr: { placeholder: "搜索文件夹…" },
    });

    const list = contentEl.createDiv({ cls: "file-marquee-folder-list" });
    const allFolders = ["", ...this.folders];

    const render = (filter: string): void => {
      list.empty();
      const query = filter.trim().toLowerCase();
      const visible = allFolders.filter((folder) => {
        const label = folder || "Vault 根目录";
        return !query || label.toLowerCase().includes(query);
      });
      if (visible.length === 0) {
        list.createDiv({ text: "没有匹配的文件夹", cls: "file-marquee-empty" });
        return;
      }
      for (const folder of visible) {
        const row = list.createEl("button", { cls: "file-marquee-folder-row" });
        const icon = row.createSpan({ cls: "file-marquee-folder-icon", text: folder ? "📁" : "🏠" });
        icon.setAttribute("aria-hidden", "true");
        row.createSpan({ cls: "file-marquee-folder-name", text: folder || "Vault 根目录" });
        row.addEventListener("click", () => {
          this.close();
          this.onChoose(folder);
        });
      }
    };

    search.addEventListener("input", () => render(search.value));
    render("");
    search.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
