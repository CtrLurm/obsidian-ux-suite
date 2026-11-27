import { Notice, Plugin } from "obsidian";
import type { CustomActionId } from "./actions";
import { GESTURE_ACTIONS, getActionLabel } from "./actions";
import {
  ACTIVATION_DISTANCE,
  GestureTracker,
  formatGesture,
  type Point,
} from "./gesture";
import { parseGestureMapping, type ParsedMapping } from "./mapping";
import { GestureOverlay } from "./overlay";
import { DEFAULT_SETTINGS, sanitizeTrailColor, type MouseGestureSettings } from "./settings";
import { MouseGestureSettingTab } from "./settings-tab";

interface CommandsApi {
  executeCommandById?: (id: string) => boolean;
}

interface SettingsApi {
  open?: () => void;
  openTabById?: (id: string) => void;
}

interface InternalApp {
  commands?: CommandsApi;
  setting?: SettingsApi;
}

export default class MouseGesturePlugin extends Plugin {
  settings!: MouseGestureSettings;

  private mapping: Record<string, string> = {};
  private readonly tracker = new GestureTracker();
  private overlay: GestureOverlay | null = null;
  private trackingPointerId: number | null = null;
  private gestureStart: Point | null = null;
  private gestureActive = false;
  private lastCursor: Point | null = null;
  private suppressContextMenuUntil = 0;
  private saveTimer: number | null = null;
  private drawFrame: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new MouseGestureSettingTab(this.app, this));
    this.addCommand({
      id: "toggle-enabled",
      name: "开/关 鼠标手势",
      callback: () => {
        void this.toggleEnabled();
      },
    });
    this.addCommand({
      id: "open-settings",
      name: "打开鼠标手势设置",
      callback: () => this.openPluginSettings(),
    });

    this.registerDomEvent(window, "pointerdown", (event) => this.handlePointerDown(event), true);
    this.registerDomEvent(window, "pointermove", (event) => this.handlePointerMove(event), true);
    this.registerDomEvent(window, "pointerup", (event) => this.handlePointerUp(event), true);
    this.registerDomEvent(window, "pointercancel", (event) => this.handlePointerCancel(event), true);
    this.registerDomEvent(window, "contextmenu", (event) => this.handleContextMenu(event), true);
    this.registerDomEvent(window, "blur", () => this.cancelGesture());
    this.registerDomEvent(window, "resize", () => {
      if (!this.overlay) {
        return;
      }
      this.overlay.resize();
      this.scheduleDraw();
    });
  }

  onunload(): void {
    this.cancelGesture();
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
      void this.saveSettings();
    }
    this.destroyOverlay();
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<MouseGestureSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});

    this.settings.enabled = this.settings.enabled !== false;
    this.settings.showHud = this.settings.showHud !== false;
    this.settings.disableInCanvas = this.settings.disableInCanvas !== false;
    this.settings.mappingText =
      typeof this.settings.mappingText === "string"
        ? this.settings.mappingText
        : DEFAULT_SETTINGS.mappingText;
    this.settings.trailColor = sanitizeTrailColor(
      typeof this.settings.trailColor === "string"
        ? this.settings.trailColor
        : DEFAULT_SETTINGS.trailColor,
    );

    this.mapping = parseGestureMapping(this.settings.mappingText).mapping;
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

  setMappingText(text: string): ParsedMapping {
    this.settings.mappingText = text;
    const parsed = parseGestureMapping(text);
    this.mapping = parsed.mapping;
    return parsed;
  }

  async toggleEnabled(): Promise<void> {
    this.settings.enabled = !this.settings.enabled;
    await this.saveSettings();
    if (!this.settings.enabled) {
      this.cancelGesture();
    }
    new Notice(this.settings.enabled ? "鼠标手势已启用" : "鼠标手势已禁用");
  }

  /** 设置页切换开关时调用，静默取消当前手势 */
  cancelGesture(): void {
    if (this.trackingPointerId === null) {
      return;
    }
    this.suppressContextMenuUntil = 0;
    this.stopTracking();
  }

  private handlePointerDown(event: PointerEvent): void {
    if (!event.isTrusted || !this.settings.enabled || event.button !== 2) {
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return;
    }

    this.suppressContextMenuUntil = 0;

    const target = event.target;
    if (target instanceof Element) {
      // 输入框保留系统右键菜单，也不从输入框开始手势
      if (target.closest("input, textarea, select")) {
        return;
      }
    }
    if (this.settings.disableInCanvas && this.isCanvasContext(target)) {
      return;
    }

    if (this.trackingPointerId !== null) {
      this.stopTracking();
    }

    this.trackingPointerId = event.pointerId;
    this.gestureStart = { x: event.clientX, y: event.clientY };
    this.lastCursor = { x: event.clientX, y: event.clientY };
    this.gestureActive = false;
    this.tracker.start(event.clientX, event.clientY);
  }

  private handlePointerMove(event: PointerEvent): void {
    if (this.trackingPointerId !== event.pointerId) {
      return;
    }

    this.lastCursor = { x: event.clientX, y: event.clientY };

    if (event.pointerType === "mouse" && (event.buttons & 2) === 0) {
      // 在窗口外松开时可能收不到 pointerup，用按键状态兜底
      this.cancelGesture();
      return;
    }

    const start = this.gestureStart;
    if (!start) {
      return;
    }

    if (!this.gestureActive) {
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (distance < ACTIVATION_DISTANCE) {
        return;
      }
      this.gestureActive = true;
      this.ensureOverlay();
    }

    this.tracker.moveTo(event.clientX, event.clientY);
    this.scheduleDraw();
  }

  private handlePointerUp(event: PointerEvent): void {
    if (this.trackingPointerId !== event.pointerId) {
      return;
    }
    this.finishGesture(event.clientX, event.clientY);
  }

  private handlePointerCancel(event: PointerEvent): void {
    if (this.trackingPointerId !== event.pointerId) {
      return;
    }
    this.cancelGesture();
  }

  private handleContextMenu(event: MouseEvent): void {
    // 允许我们自己派发的合成菜单（isTrusted === false）
    if (!event.isTrusted) {
      return;
    }

    if (this.trackingPointerId !== null) {
      // 原生 contextmenu 在按下右键时就可能触发，此时先压住菜单，
      // 松开时再根据有没有画出手势决定是否重新派发。
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (Date.now() < this.suppressContextMenuUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  private finishGesture(x: number, y: number): void {
    const key = this.tracker.getKey();
    const wasActive = this.gestureActive;
    this.stopTracking();

    if (!wasActive || !key) {
      // 只是普通右键（或移动距离不足以构成手势）：还原 Obsidian 的右键菜单
      this.openContextMenuAt(x, y);
      return;
    }

    this.suppressContextMenuUntil = Date.now() + 500;
    if (key) {
      window.setTimeout(() => {
        this.executeGestureAction(key);
      }, 0);
    }
  }

  private openContextMenuAt(x: number, y: number): void {
    // 压住紧随其后的原生 contextmenu，避免出现两个菜单
    this.suppressContextMenuUntil = Date.now() + 300;
    const target = document.elementFromPoint(x, y) ?? document.body;
    target.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: x,
        clientY: y,
        screenX: window.screenX + x,
        screenY: window.screenY + y,
        button: 2,
      }),
    );
  }

  private stopTracking(): void {
    this.trackingPointerId = null;
    this.gestureStart = null;
    this.gestureActive = false;
    this.lastCursor = null;
    this.tracker.reset();
    this.destroyOverlay();
  }

  private ensureOverlay(): void {
    if (this.overlay) {
      this.overlay.resize();
      return;
    }
    try {
      this.overlay = new GestureOverlay({
        color: sanitizeTrailColor(this.settings.trailColor),
        showHud: this.settings.showHud,
      });
    } catch (error) {
      console.error("[鼠标手势] 无法创建轨迹层", error);
      this.overlay = null;
    }
  }

  private scheduleDraw(): void {
    if (this.drawFrame !== null || !this.overlay) {
      return;
    }
    this.drawFrame = window.requestAnimationFrame(() => {
      this.drawFrame = null;
      const overlay = this.overlay;
      if (!overlay) {
        return;
      }

      const key = this.tracker.getKey();
      let hudText = "右键手势";
      if (key) {
        const actionId = this.mapping[key];
        hudText = actionId
          ? `${formatGesture(key)}  ${getActionLabel(actionId)}`
          : formatGesture(key);
      }

      overlay.draw(this.tracker.getPath(), hudText, this.lastCursor);
    });
  }

  private destroyOverlay(): void {
    if (this.drawFrame !== null) {
      window.cancelAnimationFrame(this.drawFrame);
      this.drawFrame = null;
    }
    this.overlay?.destroy();
    this.overlay = null;
  }

  private executeGestureAction(key: string): void {
    const actionId = this.mapping[key];
    if (!actionId) {
      return;
    }

    try {
      if (actionId.startsWith("cmd:")) {
        const commandId = actionId.slice(4).trim();
        if (!commandId || !this.runCommand(commandId)) {
          new Notice(`命令不可用：${commandId || "(空)"}`);
        }
        return;
      }

      const action = GESTURE_ACTIONS.find((item) => item.id === actionId);
      if (!action) {
        return;
      }
      if (action.custom) {
        this.runCustomAction(action.custom);
        return;
      }
      if (action.command && !this.runCommand(action.command)) {
        console.warn(`[鼠标手势] 命令未执行：${action.command}`);
      }
    } catch (error) {
      console.error(`[鼠标手势] 执行 ${key} → ${actionId} 失败`, error);
      new Notice(`鼠标手势执行失败：${getActionLabel(actionId)}`);
    }
  }

  private runCustomAction(action: CustomActionId): void {
    switch (action) {
      case "scroll-up":
        this.scrollBy(-0.9);
        return;
      case "scroll-down":
        this.scrollBy(0.9);
        return;
      case "top":
        this.scrollToEdge("top");
        return;
      case "bottom":
        this.scrollToEdge("bottom");
        return;
      case "reload":
        if (!this.runCommand("app:reload")) {
          new Notice("无法重新加载 Obsidian");
        }
        return;
      case "plugin-settings":
        this.openPluginSettings();
        return;
    }
  }

  private runCommand(commandId: string): boolean {
    const commands = (this.app as unknown as InternalApp).commands;
    if (!commands?.executeCommandById) {
      return false;
    }
    try {
      return commands.executeCommandById(commandId) === true;
    } catch (error) {
      console.error(`[鼠标手势] 执行命令失败：${commandId}`, error);
      return false;
    }
  }

  private openPluginSettings(): void {
    const setting = (this.app as unknown as InternalApp).setting;
    if (!setting?.open || !setting.openTabById) {
      new Notice("无法打开鼠标手势设置，请手动打开 设置 → 第三方插件");
      return;
    }
    try {
      setting.open();
      setting.openTabById(this.manifest.id);
    } catch (error) {
      console.error("[鼠标手势] 打开设置页失败", error);
      new Notice("无法打开鼠标手势设置，请手动打开 设置 → 第三方插件");
    }
  }

  private isCanvasContext(target: EventTarget | null = null): boolean {
    // Canvas 可能不是当前 active leaf（例如分屏），优先看实际点击位置
    if (
      target instanceof Element &&
      target.closest(".canvas-wrapper, .canvas-node, .excalidraw, .excalidraw-plugin")
    ) {
      return true;
    }

    const view = this.app.workspace.activeLeaf?.view;
    if (!view) {
      return false;
    }
    const viewType = view.getViewType();
    if (viewType === "canvas" || viewType === "excalidraw") {
      return true;
    }
    return (
      view.containerEl.classList.contains("excalidraw") ||
      view.containerEl.querySelector(".excalidraw") !== null
    );
  }

  private scrollBy(fraction: number): void {
    const scroller = this.getActiveScroller();
    if (!scroller) {
      return;
    }
    this.smoothScroll(scroller, scroller.clientHeight * fraction);
  }

  private scrollToEdge(mode: "top" | "bottom"): void {
    const scroller = this.getActiveScroller();
    if (!scroller) {
      return;
    }
    const target = mode === "top" ? 0 : scroller.scrollHeight;
    this.smoothScroll(scroller, target - scroller.scrollTop);
  }

  private getActiveScroller(): HTMLElement | null {
    const fromActive = this.findScrollable(
      this.app.workspace.activeLeaf?.view?.containerEl ?? null,
    );
    if (fromActive) {
      return fromActive;
    }

    const roots = Array.from(
      document.querySelectorAll<HTMLElement>(".workspace-leaf-content"),
    );
    for (const root of roots) {
      if (root.getClientRects().length === 0) {
        continue;
      }
      const style = getComputedStyle(root);
      if (style.display === "none" || style.visibility === "hidden") {
        continue;
      }
      const scroller = this.findScrollable(root);
      if (scroller) {
        return scroller;
      }
    }
    return null;
  }

  private findScrollable(root: HTMLElement | null): HTMLElement | null {
    if (!root) {
      return null;
    }
    const selector =
      ".cm-scroller, .markdown-preview-view, .pdf-container, .pdf-viewer, .canvas-wrapper, .view-content";
    const candidates: HTMLElement[] = [root];
    candidates.push(...Array.from(root.querySelectorAll<HTMLElement>(selector)));

    for (const element of candidates) {
      if (element.scrollHeight <= element.clientHeight + 4) {
        continue;
      }
      if (getComputedStyle(element).overflowY === "hidden") {
        continue;
      }
      return element;
    }
    return null;
  }

  private smoothScroll(element: HTMLElement, delta: number): void {
    const start = element.scrollTop;
    const target = start + delta;
    const duration = Math.min(420, Math.max(180, Math.abs(delta) * 0.25));
    const startedAt = performance.now();

    const step = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.scrollTop = start + (target - start) * eased;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }
}
