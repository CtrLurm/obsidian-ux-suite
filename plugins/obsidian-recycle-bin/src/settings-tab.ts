import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type RecycleBinPlugin from "./main";
import { ConfirmModal } from "./modal";

export class RecycleBinSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: RecycleBinPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "回收站设置" });
    containerEl.createEl("p", {
      text: "启用后，在 Obsidian 文件浏览器、标签页或确认删除中删除的文件会先进入插件回收站，而不是系统回收站。",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("启用回收站")
      .setDesc("关闭后恢复 Obsidian 原本的删除行为。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
          this.plugin.settings.enabled = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("删除时显示提示")
      .setDesc("文件移入回收站后显示一条轻提示。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.notifyOnDelete).onChange(async (value) => {
          this.plugin.settings.notifyOnDelete = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("回收站位置")
      .setDesc(this.plugin.service.getPath())
      .addButton((button) =>
        button.setButtonText("打开回收站").onClick(() => {
          void this.plugin.activateView();
        }),
      );

    new Setting(containerEl)
      .setName("清空回收站")
      .setDesc("永久删除回收站中的所有文件，此操作不可撤销。")
      .addButton((button) =>
        button
          .setWarning()
          .setButtonText("清空")
          .onClick(() => {
            new ConfirmModal(this.app, {
              title: "清空回收站",
              message: "确定要永久删除回收站中的全部条目吗？此操作不可撤销。",
              confirmText: "清空",
              destructive: true,
              onConfirm: async () => {
                const count = await this.plugin.service.empty();
                this.plugin.refreshViews();
                this.display();
                new Notice(`回收站已清空（${count} 个条目）`, 4000);
              },
            }).open();
          }),
      );
  }
}
