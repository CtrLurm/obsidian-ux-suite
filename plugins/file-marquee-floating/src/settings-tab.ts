import { App, PluginSettingTab, Setting } from "obsidian";
import type FileMarqueePlugin from "./main";
import { clampLongPress, DEFAULT_SETTINGS } from "./settings";

export class FileMarqueeSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: FileMarqueePlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("file-marquee-settings");

    containerEl.createEl("h2", { text: "文件框选与浮窗" });
    containerEl.createEl("p", {
      text: "在左侧文件列表中长按空白处并拖动可框选文件；长按功能区空白处或文件列表标题栏并拖动可拉出浮动小窗。",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("启用插件")
      .setDesc("关闭后不响应长按框选和浮窗拖拽。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
          this.plugin.settings.enabled = value;
          await this.plugin.saveSettings();
          this.plugin.refreshControllers();
        }),
      );

    new Setting(containerEl)
      .setName("长按时间")
      .setDesc("按住鼠标左键多久后开始框选或拉出浮窗（毫秒）。")
      .addSlider((slider) =>
        slider
          .setLimits(160, 900, 20)
          .setValue(this.plugin.settings.longPressMs)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.longPressMs = clampLongPress(value);
            await this.plugin.saveSettings();
            this.plugin.refreshControllers();
          }),
      );

    new Setting(containerEl)
      .setName("显示选框工具条")
      .setDesc("框选后在文件列表底部显示“移动 / 删除 / 取消”工具条。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showToolbar).onChange(async (value) => {
          this.plugin.settings.showToolbar = value;
          await this.plugin.saveSettings();
          this.plugin.refreshControllers();
        }),
      );

    new Setting(containerEl)
      .setName("启用浮窗")
      .setDesc("允许长按功能区或文件列表标题栏，把对应区域拉出为可拖动的小窗。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableTearOff).onChange(async (value) => {
          this.plugin.settings.enableTearOff = value;
          await this.plugin.saveSettings();
          this.plugin.refreshControllers();
        }),
      );

    new Setting(containerEl)
      .setName("恢复默认设置")
      .setDesc("恢复长按时间、工具条和浮窗开关的默认值。")
      .addButton((button) =>
        button.setButtonText("恢复默认").onClick(async () => {
          this.plugin.settings = { ...DEFAULT_SETTINGS };
          await this.plugin.saveSettings();
          this.plugin.refreshControllers();
          this.display();
        }),
      );

    containerEl.createEl("h3", { text: "使用提示" });
    const tips = containerEl.createEl("ul", { cls: "file-marquee-tips" });
    tips.createEl("li", { text: "框选时按住 Ctrl / Cmd 可以追加选择；按 Esc 或点击空白处取消。" });
    tips.createEl("li", { text: "框选后点击“移动”选择目标文件夹，或把选中的项目直接拖到文件夹上。" });
    tips.createEl("li", { text: "删除走 Obsidian 的删除流程；如果同时启用了回收站插件，会先进入插件回收站。" });
    tips.createEl("li", { text: "浮窗右上角可还原或关闭；文件列表浮窗使用原视图，功能保持完整。" });
  }
}
