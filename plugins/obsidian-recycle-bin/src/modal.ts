import { App, Modal, Notice, Setting } from "obsidian";
import { errorMessage } from "./helpers";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

/** 通用确认弹窗，支持异步确认和失败提示。 */
export class ConfirmModal extends Modal {
  private busy = false;
  private confirmButton: HTMLButtonElement | null = null;

  constructor(
    app: App,
    private readonly options: ConfirmOptions,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.options.title);
    this.contentEl.createEl("p", { text: this.options.message });

    const setting = new Setting(this.contentEl).setClass("recycle-bin-confirm-actions");
    setting.addButton((button) => {
      button.setButtonText("取消").onClick(() => this.close());
    });
    setting.addButton((button) => {
      this.confirmButton = button.buttonEl;
      button.setButtonText(this.options.confirmText).onClick(() => {
        void this.confirm();
      });
      if (this.options.destructive) {
        button.setWarning();
      } else {
        button.setCta();
      }
    });
  }

  private async confirm(): Promise<void> {
    if (this.busy) {
      return;
    }
    const button = this.confirmButton;
    this.busy = true;
    if (button) {
      button.disabled = true;
      button.setText("处理中…");
    }
    try {
      await this.options.onConfirm();
      this.close();
    } catch (error) {
      new Notice(`操作失败：${errorMessage(error)}`, 6000);
      this.busy = false;
      if (button) {
        button.disabled = false;
        button.setText(this.options.confirmText);
      }
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
