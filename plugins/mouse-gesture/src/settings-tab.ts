import { Notice, PluginSettingTab, Setting } from "obsidian";
import type { App, TextAreaComponent } from "obsidian";
import { GESTURE_ACTIONS } from "./actions";
import { parseGestureMapping, type ParsedMapping } from "./mapping";
import { DEFAULT_MAPPING_TEXT, sanitizeTrailColor } from "./settings";
import type MouseGesturePlugin from "./main";

export class MouseGestureSettingTab extends PluginSettingTab {
  private readonly plugin: MouseGesturePlugin;
  private feedbackEl: HTMLElement | null = null;

  constructor(app: App, plugin: MouseGesturePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("mouse-gesture-settings");

    containerEl.createEl("h2", { text: "鼠标手势" });
    containerEl.createEl("p", {
      cls: "mouse-gesture-desc",
      text:
        "按住鼠标右键拖动，画出 ↓→ 这样的轨迹后松开即可执行动作。每段方向至少移动约 26 像素；普通右键（没有拖动）会正常弹出菜单。",
    });

    new Setting(containerEl)
      .setName("启用鼠标手势")
      .setDesc("关闭后右键完全恢复 Obsidian 的默认行为。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
          this.plugin.settings.enabled = value;
          await this.plugin.saveSettings();
          if (!value) {
            this.plugin.cancelGesture();
          }
        }),
      );

    new Setting(containerEl)
      .setName("轨迹颜色")
      .setDesc("手势轨迹和动作提示气泡的颜色。")
      .addColorPicker((picker) =>
        picker.setValue(this.plugin.settings.trailColor).onChange((value) => {
          this.plugin.settings.trailColor = sanitizeTrailColor(value);
          this.plugin.saveSettingsDebounced();
        }),
      );

    new Setting(containerEl)
      .setName("显示动作提示")
      .setDesc("在鼠标旁显示当前手势和即将执行的动作。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showHud).onChange(async (value) => {
          this.plugin.settings.showHud = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("在 Canvas / Excalidraw 中禁用")
      .setDesc("这些视图自己有右键操作，建议保持开启。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.disableInCanvas).onChange(async (value) => {
          this.plugin.settings.disableInCanvas = value;
          await this.plugin.saveSettings();
        }),
      );

    containerEl.createEl("h3", { text: "手势映射" });
    containerEl.createEl("p", {
      cls: "mouse-gesture-desc",
      text:
        "每行一条：手势 = 动作。U/D/L/R 分别代表上/下/左/右，可以组合，例如 DR 表示先下后右；也支持 ↑↓←→ 和 # // 注释。",
    });

    let mappingTextArea: TextAreaComponent | null = null;

    new Setting(containerEl)
      .setName("映射表")
      .setDesc("同一手势重复出现时，最后一行生效；未知动作会在下方提示。")
      .setClass("mouse-gesture-mapping-setting")
      .addTextArea((text) => {
        mappingTextArea = text;
        text.setValue(this.plugin.settings.mappingText);
        text.inputEl.rows = 14;
        text.inputEl.addClass("mouse-gesture-mapping-input");
        text.onChange((value) => {
          const parsed = this.plugin.setMappingText(value);
          this.renderMappingFeedback(parsed);
          this.plugin.saveSettingsDebounced();
        });
      });

    this.feedbackEl = containerEl.createDiv({ cls: "mouse-gesture-feedback" });
    this.renderMappingFeedback(parseGestureMapping(this.plugin.settings.mappingText));

    new Setting(containerEl)
      .setName("恢复默认映射")
      .setDesc("只重置手势映射，不改变颜色和开关。")
      .addButton((button) =>
        button.setButtonText("恢复默认").onClick(async () => {
          if (!mappingTextArea) {
            return;
          }
          mappingTextArea.setValue(DEFAULT_MAPPING_TEXT);
          const parsed = this.plugin.setMappingText(DEFAULT_MAPPING_TEXT);
          this.renderMappingFeedback(parsed);
          await this.plugin.saveSettings();
          new Notice("已恢复默认手势映射");
        }),
      );

    const actionsDetails = containerEl.createEl("details", {
      cls: "mouse-gesture-actions",
    });
    actionsDetails.createEl("summary", { text: "可用动作与内置命令" });
    const actionList = actionsDetails.createEl("ul", {
      cls: "mouse-gesture-action-list",
    });
    for (const action of GESTURE_ACTIONS) {
      const item = actionList.createEl("li");
      item.createEl("code", { text: action.id });
      item.createSpan({ text: `  ${action.label}` });
      if (action.command) {
        item.createSpan({
          cls: "mouse-gesture-command",
          text: `  ${action.command}`,
        });
      }
    }

    const tip = actionsDetails.createDiv({ cls: "mouse-gesture-actions-tip" });
    tip.createSpan({ text: "执行任意 Obsidian 命令：写 " });
    tip.createEl("code", { text: "cmd:命令ID" });
    tip.createSpan({ text: "；禁用某个手势：写 " });
    tip.createEl("code", { text: "none" });
    tip.createSpan({ text: "。" });
  }

  private renderMappingFeedback(parsed: ParsedMapping): void {
    const el = this.feedbackEl;
    if (!el) {
      return;
    }

    el.empty();
    el.removeClass("is-error");
    el.removeClass("is-warning");

    if (parsed.errors.length > 0) {
      el.addClass("is-error");
      el.createDiv({
        text: `${parsed.errors.length} 处错误（这些行不会生效）：`,
      });
      const list = el.createEl("ul");
      parsed.errors.slice(0, 8).forEach((error) => {
        list.createEl("li", { text: error });
      });
      if (parsed.errors.length > 8) {
        el.createDiv({ text: `……另有 ${parsed.errors.length - 8} 条错误` });
      }
      return;
    }

    if (parsed.warnings.length > 0) {
      el.addClass("is-warning");
      parsed.warnings.forEach((warning) => {
        el.createDiv({ text: warning });
      });
    }

    el.createDiv({ text: `已生效 ${parsed.count} 个手势。` });
  }
}
