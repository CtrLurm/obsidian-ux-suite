import { Notice } from "obsidian";
import type { App, TAbstractFile, TFolder } from "obsidian";
import {
  canMoveIntoFolder,
  normalizeFolder,
  normalizeRect,
  rectsIntersect,
  targetPathFor,
  topLevelPaths,
} from "./core";
import { ConfirmModal, FolderPickerModal } from "./modal";
import type FileMarqueePlugin from "./main";

const EXPLORER_CONTENT = '.workspace-leaf-content[data-type="file-explorer"]';
const TITLE_SELECTOR = ".nav-file-title, .nav-folder-title";
const INTERACTIVE_SELECTOR =
  "button, input, textarea, select, .clickable-icon, .nav-header, .view-header, .nav-buttons-container, .file-marquee-toolbar";
const TITLE_ACTIVATION_DISTANCE = 9;

interface Point {
  x: number;
  y: number;
}

function isFolderFile(file: TAbstractFile): file is TFolder {
  return "children" in file;
}

function getPath(element: Element | null): string | null {
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  const path = element.dataset.path;
  return typeof path === "string" && path.length > 0 ? path : null;
}

function getScrollContainer(element: HTMLElement): HTMLElement {
  let current: HTMLElement | null = element;
  while (current) {
    if (current.scrollHeight > current.clientHeight + 2) {
      const overflow = window.getComputedStyle(current).overflowY;
      if (overflow === "auto" || overflow === "scroll") {
        return current;
      }
    }
    current = current.parentElement;
  }
  return element;
}

export class MarqueeController {
  private timer: number | null = null;
  private active = false;
  private candidate = false;
  private pointerDown = false;
  private startPoint: Point = { x: 0, y: 0 };
  private last: Point = { x: 0, y: 0 };
  private nav: HTMLElement | null = null;
  private scroller: HTMLElement | null = null;
  private box: HTMLElement | null = null;
  private toolbar: HTMLElement | null = null;
  private selected = new Map<string, HTMLElement>();
  private baseSelection = new Set<string>();
  private scrollTimer: number | null = null;
  private suppressClickUntil = 0;

  constructor(private readonly plugin: FileMarqueePlugin) {}

  private get app(): App {
    return this.plugin.app;
  }

  start(): void {
    document.addEventListener("pointerdown", this.onPointerDown, true);
    document.addEventListener("pointermove", this.onPointerMove, true);
    document.addEventListener("pointerup", this.onPointerUp, true);
    document.addEventListener("pointercancel", this.onPointerCancel, true);
    document.addEventListener("click", this.onClick, true);
    document.addEventListener("keydown", this.onKeyDown, true);
    window.addEventListener("resize", this.onViewportChange);
    window.addEventListener("blur", this.onBlur);
  }

  destroy(): void {
    document.removeEventListener("pointerdown", this.onPointerDown, true);
    document.removeEventListener("pointermove", this.onPointerMove, true);
    document.removeEventListener("pointerup", this.onPointerUp, true);
    document.removeEventListener("pointercancel", this.onPointerCancel, true);
    document.removeEventListener("click", this.onClick, true);
    document.removeEventListener("keydown", this.onKeyDown, true);
    window.removeEventListener("resize", this.onViewportChange);
    window.removeEventListener("blur", this.onBlur);
    this.cancelGesture();
    this.clearSelection();
    this.toolbar?.remove();
    this.toolbar = null;
  }

  clearSelection(): void {
    for (const element of this.selected.values()) {
      element.classList.remove("file-marquee-selected");
    }
    this.selected.clear();
    this.baseSelection.clear();
    this.hideToolbar();
  }

  cancelGesture(): void {
    this.clearTimer();
    this.candidate = false;
    this.active = false;
    this.pointerDown = false;
    this.stopAutoScroll();
    this.box?.remove();
    this.box = null;
    this.nav?.classList.remove("file-marquee-selecting");
    this.nav = null;
    this.scroller = null;
  }

  refresh(): void {
    if (!this.plugin.settings.enabled) {
      this.cancelGesture();
      this.clearSelection();
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.plugin.settings.enabled || event.button !== 0 || !event.isPrimary) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest(".file-marquee-toolbar, .modal-container, .modal")) {
      return;
    }

    if (this.selected.size > 0) {
      if (target.closest(TITLE_SELECTOR)) {
        // 点击标题交给 Obsidian 处理；click 阶段再清除选框。
      } else if (!event.ctrlKey && !event.metaKey) {
        this.clearSelection();
      }
    }

    const leaf = target.closest(EXPLORER_CONTENT);
    if (!(leaf instanceof HTMLElement)) {
      return;
    }
    const nav = leaf.querySelector(".nav-files-container");
    if (!(nav instanceof HTMLElement) || !nav.contains(target)) {
      return;
    }
    if (target.closest(TITLE_SELECTOR) || target.closest(INTERACTIVE_SELECTOR)) {
      return;
    }

    this.resetGestureState();
    this.pointerDown = true;
    this.candidate = true;
    this.nav = nav;
    this.scroller = getScrollContainer(nav);
    this.startPoint = { x: event.clientX, y: event.clientY };
    this.last = { ...this.startPoint };
    this.baseSelection =
      event.ctrlKey || event.metaKey ? new Set(this.selected.keys()) : new Set<string>();
    this.timer = window.setTimeout(() => this.activate(), this.plugin.settings.longPressMs);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.pointerDown) {
      return;
    }
    if (!this.active) {
      if (this.candidate) {
        const distance = Math.hypot(
          event.clientX - this.startPoint.x,
          event.clientY - this.startPoint.y,
        );
        if (distance > TITLE_ACTIVATION_DISTANCE) {
          this.clearTimer();
          this.candidate = false;
        }
      }
      return;
    }

    if (event.pointerType === "mouse" && (event.buttons & 1) === 0) {
      this.finishGesture(event.clientX, event.clientY);
      return;
    }
    event.preventDefault();
    this.last = { x: event.clientX, y: event.clientY };
    this.updateSelection(event.clientX, event.clientY);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.pointerDown) {
      return;
    }
    const wasActive = this.active;
    const wasCandidate = this.candidate;
    this.pointerDown = false;
    this.clearTimer();
    if (wasActive) {
      this.finishGesture(event.clientX, event.clientY);
    } else if (wasCandidate) {
      this.candidate = false;
    }
  };

  private onPointerCancel = (): void => {
    if (this.active || this.candidate) {
      this.cancelGesture();
    }
    this.pointerDown = false;
  };

  private onBlur = (): void => {
    if (this.active || this.candidate) {
      this.cancelGesture();
    }
    this.pointerDown = false;
  };

  private activate(): void {
    this.timer = null;
    if (!this.pointerDown || !this.candidate || !this.plugin.settings.enabled || !this.nav) {
      return;
    }
    this.candidate = false;
    this.active = true;
    this.nav.classList.add("file-marquee-selecting");
    window.getSelection()?.removeAllRanges();

    const box = document.createElement("div");
    box.className = "file-marquee-box";
    box.style.width = "0px";
    box.style.height = "0px";
    document.body.appendChild(box);
    this.box = box;

    this.ensureToolbar();
    this.startAutoScroll();
    this.updateSelection(this.startPoint.x, this.startPoint.y);
  }

  private finishGesture(clientX: number, clientY: number): void {
    if (!this.active) {
      return;
    }
    this.updateSelection(clientX, clientY);
    this.active = false;
    this.pointerDown = false;
    this.clearTimer();
    this.stopAutoScroll();
    this.box?.remove();
    this.box = null;
    this.nav?.classList.remove("file-marquee-selecting");
    this.suppressClickUntil = Date.now() + 350;

    if (this.selected.size > 0) {
      this.showToolbar();
      this.positionToolbar();
    } else {
      this.hideToolbar();
    }
  }

  private resetGestureState(): void {
    this.clearTimer();
    this.stopAutoScroll();
    this.box?.remove();
    this.box = null;
    this.nav?.classList.remove("file-marquee-selecting");
    this.active = false;
    this.candidate = false;
  }

  private updateSelection(clientX: number, clientY: number): void {
    const box = this.box;
    const nav = this.nav;
    if (!box || !nav) {
      return;
    }
    const rect = normalizeRect(this.startPoint.x, this.startPoint.y, clientX, clientY);
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${Math.max(1, rect.right - rect.left)}px`;
    box.style.height = `${Math.max(1, rect.bottom - rect.top)}px`;

    const elementsByPath = new Map<string, HTMLElement>();
    for (const element of Array.from(nav.querySelectorAll(TITLE_SELECTOR))) {
      if (!(element instanceof HTMLElement)) {
        continue;
      }
      const path = getPath(element);
      if (!path) {
        continue;
      }
      const elementRect = element.getBoundingClientRect();
      if (elementRect.width === 0 || elementRect.height === 0) {
        continue;
      }
      if (rectsIntersect(rect, elementRect)) {
        elementsByPath.set(path, element);
      }
    }

    const nextPaths = new Set(this.baseSelection);
    for (const path of elementsByPath.keys()) {
      nextPaths.add(path);
    }

    for (const [path, element] of this.selected) {
      if (!nextPaths.has(path)) {
        element.classList.remove("file-marquee-selected");
      }
    }

    this.selected.clear();
    for (const path of nextPaths) {
      const element = elementsByPath.get(path);
      if (!element) {
        continue;
      }
      element.classList.add("file-marquee-selected");
      this.selected.set(path, element);
    }
    this.updateToolbar();
  }

  private startAutoScroll(): void {
    this.stopAutoScroll();
    this.scrollTimer = window.setInterval(() => {
      if (!this.active || !this.nav || !this.scroller) {
        return;
      }
      const rect = this.nav.getBoundingClientRect();
      let delta = 0;
      if (this.last.y < rect.top + 28) {
        delta = -14;
      } else if (this.last.y > rect.bottom - 28) {
        delta = 14;
      }
      if (delta === 0) {
        return;
      }
      const before = this.scroller.scrollTop;
      this.scroller.scrollTop += delta;
      if (this.scroller.scrollTop !== before) {
        this.updateSelection(this.last.x, this.last.y);
      }
    }, 16);
  }

  private stopAutoScroll(): void {
    if (this.scrollTimer !== null) {
      window.clearInterval(this.scrollTimer);
      this.scrollTimer = null;
    }
  }

  private ensureToolbar(): void {
    if (this.toolbar) {
      return;
    }
    const toolbar = document.createElement("div");
    toolbar.className = "file-marquee-toolbar";
    toolbar.innerHTML = `
      <span class="file-marquee-count">已选 0 项</span>
      <div class="file-marquee-actions">
        <button type="button" class="file-marquee-button" data-action="move">移动…</button>
        <button type="button" class="file-marquee-button mod-warning" data-action="delete">删除</button>
        <button type="button" class="file-marquee-button mod-muted" data-action="clear">取消</button>
      </div>
    `;
    toolbar.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const button = target.closest("button[data-action]");
      if (!(button instanceof HTMLElement)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.action;
      if (action === "move") {
        void this.openFolderPicker();
      } else if (action === "delete") {
        void this.confirmDelete();
      } else if (action === "clear") {
        this.clearSelection();
      }
    });
    document.body.appendChild(toolbar);
    this.toolbar = toolbar;
  }

  private updateToolbar(): void {
    if (!this.toolbar) {
      return;
    }
    const count = this.toolbar.querySelector(".file-marquee-count");
    if (count instanceof HTMLElement) {
      count.textContent = `已选 ${this.selected.size} 项`;
    }
    const disabled = this.selected.size === 0;
    for (const button of Array.from(this.toolbar.querySelectorAll("button"))) {
      if (button.dataset.action !== "clear") {
        button.disabled = disabled;
      }
    }
    if (this.selected.size === 0) {
      this.hideToolbar();
    } else if (this.plugin.settings.showToolbar) {
      this.toolbar.style.display = "flex";
    } else {
      this.toolbar.style.display = "none";
    }
  }

  private showToolbar(): void {
    this.ensureToolbar();
    if (this.toolbar && this.plugin.settings.showToolbar) {
      this.toolbar.style.display = "flex";
    }
  }

  private hideToolbar(): void {
    if (this.toolbar) {
      this.toolbar.style.display = "none";
    }
  }

  private positionToolbar(): void {
    if (!this.toolbar || !this.nav || this.selected.size === 0) {
      return;
    }
    const rect = this.nav.getBoundingClientRect();
    const width = Math.min(420, Math.max(220, rect.width - 12));
    this.toolbar.style.width = `${width}px`;
    this.toolbar.style.left = `${Math.max(8, rect.left + 6)}px`;
    this.toolbar.style.top = `${Math.max(8, rect.bottom - 54)}px`;
  }

  private onViewportChange = (): void => {
    if (this.selected.size > 0) {
      this.positionToolbar();
    }
  };

  private onClick = (event: MouseEvent): void => {
    if (Date.now() < this.suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest(".file-marquee-toolbar, .file-marquee-floating-panel")) {
      return;
    }
    if (this.selected.size > 0) {
      if (target.closest(EXPLORER_CONTENT)) {
        this.clearSelection();
      }
    }
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable=true]")) {
      return;
    }
    if (event.key === "Escape") {
      if (this.active || this.candidate) {
        this.cancelGesture();
      } else if (this.selected.size > 0) {
        this.clearSelection();
      }
      return;
    }
    if (event.key === "Delete" && this.selected.size > 0) {
      event.preventDefault();
      void this.confirmDelete();
    }
  };

  private async openFolderPicker(): Promise<void> {
    const selectedPaths = topLevelPaths(Array.from(this.selected.keys()));
    if (selectedPaths.length === 0) {
      return;
    }
    const forbidden = selectedPaths.filter((path) => {
      const file = this.app.vault.getAbstractFileByPath(path);
      return file !== null && isFolderFile(file);
    });
    const folders = this.app.vault
      .getAllLoadedFiles()
      .filter((file): file is TFolder => isFolderFile(file))
      .map((folder) => folder.path)
      .filter((path) => path && path !== "/")
      .filter((path) => !path.split("/").some((part) => part.startsWith(".")))
      .filter((path) => !forbidden.some((item) => path === item || path.startsWith(`${item}/`)))
      .sort((a, b) => a.localeCompare(b));

    new FolderPickerModal(this.app, folders, (folder) => {
      void this.moveSelectedTo(folder);
    }).open();
  }

  private async moveSelectedTo(destination: string): Promise<void> {
    const normalized = normalizeFolder(destination);
    const paths = topLevelPaths(Array.from(this.selected.keys()));
    let moved = 0;
    let skipped = 0;
    const reasons: string[] = [];

    for (const path of paths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!file) {
        skipped++;
        continue;
      }
      if (!canMoveIntoFolder(path, normalized)) {
        skipped++;
        reasons.push(`${path}：不能移动到自身或子文件夹`);
        continue;
      }
      const target = targetPathFor(path, normalized);
      if (target === path) {
        skipped++;
        continue;
      }
      if (this.app.vault.getAbstractFileByPath(target)) {
        skipped++;
        reasons.push(`${path}：目标位置已存在同名项目`);
        continue;
      }
      try {
        await this.app.fileManager.renameFile(file, target);
        moved++;
      } catch (error) {
        skipped++;
        reasons.push(`${path}：${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.clearSelection();
    if (moved > 0) {
      new Notice(`已移动 ${moved} 项${skipped > 0 ? `，跳过 ${skipped} 项` : ""}。`, 5000);
    } else if (skipped > 0) {
      new Notice(`没有项目被移动：${reasons[0] ?? "目标位置不可用"}`, 6000);
    }
    if (reasons.length > 0) {
      console.warn("[file-marquee] move skipped", reasons);
    }
  }

  private async confirmDelete(): Promise<void> {
    const paths = topLevelPaths(Array.from(this.selected.keys()));
    const files = paths
      .map((path) => this.app.vault.getAbstractFileByPath(path))
      .filter((file): file is TAbstractFile => file !== null);
    if (files.length === 0) {
      this.clearSelection();
      return;
    }
    new ConfirmModal(this.app, {
      title: `删除所选 ${files.length} 项？`,
      message: "删除会经过 Obsidian 的删除流程。如果启用了回收站插件，项目会先进入插件回收站。",
      confirmText: "删除",
      destructive: true,
      onConfirm: async () => {
        let deleted = 0;
        let failed = 0;
        for (const file of files) {
          try {
            await this.app.fileManager.trashFile(file);
            deleted++;
          } catch (error) {
            failed++;
            console.warn("[file-marquee] delete failed", file.path, error);
          }
        }
        this.clearSelection();
        if (deleted > 0) {
          new Notice(`已删除 ${deleted} 项${failed > 0 ? `，${failed} 项失败` : ""}。`, 5000);
        } else {
          new Notice("没有项目被删除。", 5000);
        }
      },
    }).open();
  }
}
