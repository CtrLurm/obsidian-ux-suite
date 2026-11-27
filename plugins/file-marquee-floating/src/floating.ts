import type FileMarqueePlugin from "./main";

const EXPLORER_CONTENT = '.workspace-leaf-content[data-type="file-explorer"]';
const IGNORE_TARGET =
  "button, input, textarea, select, .clickable-icon, .sidebar-toggle-button, .nav-buttons-container, .file-marquee-floating-panel";

type FloatingKind = "explorer" | "ribbon";
type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface FloatingPanel {
  kind: FloatingKind;
  element: HTMLElement;
  body: HTMLElement;
  leaf?: HTMLElement;
  ribbonClone?: HTMLElement;
  placeholder?: HTMLElement;
  originalParent?: HTMLElement;
  originalNextSibling?: Node | null;
  originalStyle?: {
    width: string;
    height: string;
    flex: string;
    minWidth: string;
    minHeight: string;
  };
}

interface TearState {
  kind: FloatingKind;
  source: HTMLElement;
  startX: number;
  startY: number;
  panel: FloatingPanel | null;
  dragOffsetX: number;
  dragOffsetY: number;
}

interface DragState {
  panel: FloatingPanel;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  moved: boolean;
}

interface ResizeState {
  element: HTMLElement;
  edge: ResizeEdge;
  startX: number;
  startY: number;
  rect: DOMRect;
}

const MIN_PANEL_WIDTH = 240;
const MIN_PANEL_HEIGHT = 260;
const MIN_RIBBON_WIDTH = 76;
const MIN_RIBBON_HEIGHT = 140;
const RIBBON_DOCK_MARGIN = 28;

export class FloatingPanelManager {
  private timer: number | null = null;
  private pointerDown = false;
  private tear: TearState | null = null;
  private panels: FloatingPanel[] = [];
  private drag: DragState | null = null;
  private resize: ResizeState | null = null;
  private hiddenRibbon: HTMLElement | null = null;

  constructor(private readonly plugin: FileMarqueePlugin) {}

  start(): void {
    document.addEventListener("pointerdown", this.onPointerDown, true);
    document.addEventListener("pointermove", this.onPointerMove, true);
    document.addEventListener("pointerup", this.onPointerUp, true);
    document.addEventListener("pointercancel", this.onPointerCancel, true);
    window.addEventListener("blur", this.onBlur);
  }

  destroy(): void {
    document.removeEventListener("pointerdown", this.onPointerDown, true);
    document.removeEventListener("pointermove", this.onPointerMove, true);
    document.removeEventListener("pointerup", this.onPointerUp, true);
    document.removeEventListener("pointercancel", this.onPointerCancel, true);
    window.removeEventListener("blur", this.onBlur);
    this.clearTimer();
    this.drag = null;
    this.resize = null;
    this.tear = null;
    this.restoreAll();
    this.showRibbon();
  }

  refresh(): void {
    if (!this.plugin.settings.enabled || !this.plugin.settings.enableTearOff) {
      this.clearTimer();
      this.tear = null;
      this.pointerDown = false;
      this.drag = null;
      this.resize = null;
      const ribbonPanel = this.panels.find((panel) => panel.kind === "ribbon");
      if (ribbonPanel) {
        this.closePanel(ribbonPanel);
      }
      this.showRibbon();
    }
  }

  openExplorerPanel(): void {
    const leaf = document.querySelector(`${EXPLORER_CONTENT}`)?.closest(".workspace-leaf");
    if (!(leaf instanceof HTMLElement)) {
      return;
    }
    const existing = this.panels.find((panel) => panel.kind === "explorer" && panel.leaf === leaf);
    if (existing) {
      existing.element.focus();
      return;
    }
    const rect = leaf.getBoundingClientRect();
    const panel = this.createExplorerPanel(leaf, Math.max(16, rect.right + 20), Math.max(60, rect.top + 30));
    if (panel) {
      this.panels.push(panel);
      this.syncBodyState();
    }
  }

  openRibbonPanel(): void {
    const ribbon = document.querySelector(".workspace-ribbon");
    if (!(ribbon instanceof HTMLElement)) {
      return;
    }
    const existing = this.panels.find((panel) => panel.kind === "ribbon");
    if (existing) {
      existing.element.focus();
      return;
    }
    const rect = ribbon.getBoundingClientRect();
    const panel = this.createRibbonPanel(ribbon, Math.max(16, rect.right + 30), 100);
    if (panel) {
      this.panels.push(panel);
      this.syncBodyState();
    }
  }

  restoreAll(): void {
    for (const panel of [...this.panels]) {
      this.closePanel(panel);
    }
    this.panels = [];
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.plugin.settings.enabled || !this.plugin.settings.enableTearOff) {
      return;
    }
    if (event.button !== 0 || !event.isPrimary) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const ribbon = target.closest(".workspace-ribbon");
    if (
      ribbon instanceof HTMLElement &&
      !ribbon.closest(".file-marquee-floating-panel") &&
      !target.closest(IGNORE_TARGET)
    ) {
      this.beginTear("ribbon", ribbon, event);
      return;
    }

    const header = target.closest(`${EXPLORER_CONTENT} .view-header, .nav-header`);
    if (header instanceof HTMLElement && !target.closest(IGNORE_TARGET)) {
      const leaf = header.closest(EXPLORER_CONTENT)?.closest(".workspace-leaf");
      if (leaf instanceof HTMLElement) {
        this.beginTear("explorer", leaf, event);
      }
    }
  };

  private beginTear(kind: FloatingKind, source: HTMLElement, event: PointerEvent): void {
    this.clearTimer();
    this.pointerDown = true;
    this.tear = {
      kind,
      source,
      startX: event.clientX,
      startY: event.clientY,
      panel: null,
      dragOffsetX: 18,
      dragOffsetY: 12,
    };
    this.timer = window.setTimeout(() => this.activateTear(), this.plugin.settings.longPressMs);
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (this.resize) {
      event.preventDefault();
      this.applyResize(event);
      return;
    }
    if (this.drag) {
      event.preventDefault();
      const element = this.drag.panel.element;
      if (Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY) > 4) {
        this.drag.moved = true;
      }
      element.style.left = `${this.clampX(event.clientX - this.drag.offsetX, element.offsetWidth)}px`;
      element.style.top = `${this.clampY(event.clientY - this.drag.offsetY, element.offsetHeight)}px`;
      this.updateDockHint();
      return;
    }
    if (!this.pointerDown || !this.tear) {
      return;
    }
    if (!this.tear.panel) {
      if (Math.hypot(event.clientX - this.tear.startX, event.clientY - this.tear.startY) > 9) {
        this.clearTimer();
        this.tear = null;
        this.pointerDown = false;
      }
      return;
    }

    event.preventDefault();
    const panel = this.tear.panel;
    panel.element.style.left = `${this.clampX(event.clientX - this.tear.dragOffsetX, panel.element.offsetWidth)}px`;
    panel.element.style.top = `${this.clampY(event.clientY - this.tear.dragOffsetY, panel.element.offsetHeight)}px`;
  };

  private onPointerUp = (): void => {
    this.clearTimer();
    const dragged = this.drag;
    if (this.resize) {
      this.resize.element.classList.remove("is-resizing");
    }
    this.drag = null;
    this.resize = null;
    if (dragged) {
      dragged.panel.element.classList.remove("is-dock-target");
      if (
        dragged.panel.kind === "ribbon" &&
        dragged.moved &&
        this.isNearRibbonDock(dragged.panel.element)
      ) {
        this.closePanel(dragged.panel);
        this.showRibbon();
        this.tear = null;
        this.pointerDown = false;
        return;
      }
    }
    if (this.tear && this.tear.panel) {
      this.panels.push(this.tear.panel);
    }
    this.tear = null;
    this.pointerDown = false;
    this.syncBodyState();
  };

  private onPointerCancel = (): void => {
    this.clearTimer();
    this.pointerDown = false;
    if (this.drag) {
      this.drag.panel.element.classList.remove("is-dock-target");
    }
    if (this.resize) {
      this.resize.element.classList.remove("is-resizing");
    }
    if (this.tear?.panel) {
      this.panels.push(this.tear.panel);
    }
    this.tear = null;
    this.drag = null;
    this.resize = null;
    this.syncBodyState();
  };

  private onBlur = (): void => {
    this.clearTimer();
    this.pointerDown = false;
    if (this.drag) {
      this.drag.panel.element.classList.remove("is-dock-target");
    }
    if (this.resize) {
      this.resize.element.classList.remove("is-resizing");
    }
    this.tear = null;
    this.drag = null;
    this.resize = null;
  };

  private activateTear(): void {
    this.timer = null;
    if (!this.pointerDown || !this.tear || !this.plugin.settings.enabled) {
      return;
    }
    const tear = this.tear;
    if (tear.kind === "explorer") {
      const panel = this.createExplorerPanel(tear.source, tear.startX - tear.dragOffsetX, tear.startY - tear.dragOffsetY);
      if (panel) {
        tear.panel = panel;
        this.bindActiveDrag(panel, tear.startX - tear.dragOffsetX, tear.startY - tear.dragOffsetY);
      } else {
        this.tear = null;
        this.pointerDown = false;
      }
    } else {
      const panel = this.createRibbonPanel(tear.source, tear.startX - tear.dragOffsetX, tear.startY - tear.dragOffsetY);
      if (panel) {
        tear.panel = panel;
        this.bindActiveDrag(panel, tear.startX - tear.dragOffsetX, tear.startY - tear.dragOffsetY);
      } else {
        this.tear = null;
        this.pointerDown = false;
      }
    }
  }

  private bindActiveDrag(panel: FloatingPanel, x: number, y: number): void {
    panel.element.style.left = `${this.clampX(x, panel.element.offsetWidth)}px`;
    panel.element.style.top = `${this.clampY(y, panel.element.offsetHeight)}px`;
    panel.element.classList.add("is-tearing");
  }

  private createExplorerPanel(leaf: HTMLElement, x: number, y: number): FloatingPanel | null {
    const parent = leaf.parentElement;
    if (!parent) {
      return null;
    }
    const rect = leaf.getBoundingClientRect();
    const placeholder = document.createElement("div");
    placeholder.className = "file-marquee-floating-placeholder";
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;
    placeholder.style.flex = "0 0 auto";
    parent.insertBefore(placeholder, leaf);

    const panel = this.createPanelShell(
      "文件列表",
      x,
      y,
      Math.max(MIN_PANEL_WIDTH, Math.round(rect.width)),
      Math.max(MIN_PANEL_HEIGHT, Math.min(640, Math.round(rect.height || 520))),
    );
    const floating: FloatingPanel = {
      kind: "explorer",
      element: panel.element,
      body: panel.body,
      leaf,
      placeholder,
      originalParent: parent,
      originalNextSibling: leaf.nextSibling,
      originalStyle: {
        width: leaf.style.width,
        height: leaf.style.height,
        flex: leaf.style.flex,
        minWidth: leaf.style.minWidth,
        minHeight: leaf.style.minHeight,
      },
    };
    leaf.style.width = "100%";
    leaf.style.height = "100%";
    leaf.style.flex = "1 1 auto";
    leaf.style.minWidth = "0";
    leaf.style.minHeight = "0";
    panel.body.appendChild(leaf);
    this.addPanelCloseButtons(floating);
    return floating;
  }

  private createRibbonPanel(ribbon: HTMLElement, x: number, y: number): FloatingPanel | null {
    const panel = this.createPanelShell("功能区", x, y, 136, 330);
    panel.element.classList.add("is-ribbon");
    panel.body.classList.add("is-ribbon");

    const grid = document.createElement("div");
    grid.className = "file-marquee-ribbon-grid";

    const groups: Array<{ source: HTMLElement | null; kind: "primary" | "settings" }> = [
      { source: ribbon.querySelector<HTMLElement>(".side-dock-actions"), kind: "primary" },
      { source: ribbon.querySelector<HTMLElement>(".side-dock-settings"), kind: "settings" },
    ];
    let groupCount = 0;
    for (const group of groups) {
      if (!group.source) {
        continue;
      }
      const built = this.buildRibbonGroup(group.source, group.kind);
      if (built) {
        grid.appendChild(built);
        groupCount += 1;
      }
    }

    if (groupCount === 0) {
      const fallback = this.buildRibbonGroup(ribbon, "primary");
      if (fallback) {
        grid.appendChild(fallback);
      }
    }

    panel.body.appendChild(grid);
    this.addRibbonResizeHandles(panel.element);
    this.hideRibbon(ribbon);

    const floating: FloatingPanel = {
      kind: "ribbon",
      element: panel.element,
      body: panel.body,
      ribbonClone: grid,
    };
    this.addPanelCloseButtons(floating);
    return floating;
  }

  private buildRibbonGroup(source: HTMLElement, kind: "primary" | "settings"): HTMLElement | null {
    const originals = Array.from(
      source.querySelectorAll<HTMLElement>(".clickable-icon, .sidebar-toggle-button"),
    ).filter(
      (element) =>
        !element.classList.contains("sidebar-toggle-button") &&
        !element.closest(".sidebar-toggle-button"),
    );
    if (originals.length === 0) {
      return null;
    }

    const group = document.createElement("div");
    group.className = `file-marquee-ribbon-group is-${kind}`;
    for (const original of originals) {
      const button = original.cloneNode(true) as HTMLElement;
      button.classList.add("file-marquee-ribbon-button");
      button.removeAttribute("id");
      button.querySelectorAll<HTMLElement>("[id]").forEach((element) => element.removeAttribute("id"));
      button.setAttribute("data-tooltip-position", "top");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        original.click();
      });
      group.appendChild(button);
    }
    return group;
  }

  private createPanelShell(
    title: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): { element: HTMLElement; body: HTMLElement } {
    const element = document.createElement("div");
    element.className = "file-marquee-floating-panel";
    element.tabIndex = -1;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.style.left = `${this.clampX(x, width)}px`;
    element.style.top = `${this.clampY(y, height)}px`;

    const header = document.createElement("div");
    header.className = "file-marquee-floating-header";
    const label = document.createElement("span");
    label.className = "file-marquee-floating-title";
    label.textContent = title;
    header.appendChild(label);

    const actions = document.createElement("div");
    actions.className = "file-marquee-floating-actions";
    const dock = document.createElement("button");
    dock.type = "button";
    dock.className = "file-marquee-floating-button";
    dock.textContent = "还原";
    dock.title = "还原到原位置";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "file-marquee-floating-button mod-close";
    close.textContent = "×";
    close.title = "关闭浮窗";
    actions.appendChild(dock);
    actions.appendChild(close);
    header.appendChild(actions);

    const body = document.createElement("div");
    body.className = "file-marquee-floating-body";
    element.appendChild(header);
    element.appendChild(body);
    document.body.appendChild(element);

    element.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.closeByElement(element);
      }
    });

    header.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element) || target.closest("button")) {
        return;
      }
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const panel = this.panels.find((entry) => entry.element === element) ?? this.tear?.panel;
      if (!panel) {
        return;
      }
      this.drag = {
        panel,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };
    });

    dock.addEventListener("click", (event) => {
      event.preventDefault();
      this.closeByElement(element);
    });
    close.addEventListener("click", (event) => {
      event.preventDefault();
      this.closeByElement(element);
    });
    return { element, body };
  }

  private addPanelCloseButtons(panel: FloatingPanel): void {
    // 面板按钮在 createPanelShell 里已绑定；这里保留成对调用的入口，便于后续扩展。
    void panel;
  }

  private closeByElement(element: HTMLElement): void {
    this.drag = null;
    const panel = this.panels.find((entry) => entry.element === element);
    if (panel) {
      this.closePanel(panel);
      return;
    }
    if (this.tear?.panel?.element === element) {
      this.closePanel(this.tear.panel);
      this.tear = null;
    }
  }

  private closePanel(panel: FloatingPanel): void {
    if (panel.kind === "ribbon") {
      this.showRibbon();
    }
    this.resize = null;
    panel.element.classList.remove("is-dock-target", "is-resizing");
    if (panel.kind === "explorer" && panel.leaf && panel.placeholder) {
      const placeholder = panel.placeholder;
      const parent = placeholder.parentElement;
      if (parent) {
        parent.insertBefore(panel.leaf, placeholder);
      }
      placeholder.remove();
      if (panel.originalStyle) {
        panel.leaf.style.width = panel.originalStyle.width;
        panel.leaf.style.height = panel.originalStyle.height;
        panel.leaf.style.flex = panel.originalStyle.flex;
        panel.leaf.style.minWidth = panel.originalStyle.minWidth;
        panel.leaf.style.minHeight = panel.originalStyle.minHeight;
      }
    }
    panel.element.remove();
    this.panels = this.panels.filter((entry) => entry !== panel);
    this.syncBodyState();
  }

  private syncBodyState(): void {
    document.body.classList.toggle(
      "file-marquee-has-floating-panel",
      this.panels.length > 0,
    );
  }

  private hideRibbon(ribbon: HTMLElement): void {
    if (this.hiddenRibbon && this.hiddenRibbon !== ribbon) {
      this.showRibbon();
    }
    this.hiddenRibbon = ribbon;
    ribbon.classList.add("file-marquee-ribbon-hidden");
    ribbon.setAttribute("aria-hidden", "true");
  }

  private showRibbon(): void {
    if (!this.hiddenRibbon) {
      return;
    }
    this.hiddenRibbon.classList.remove("file-marquee-ribbon-hidden");
    this.hiddenRibbon.removeAttribute("aria-hidden");
    this.hiddenRibbon = null;
  }

  private isNearRibbonDock(element: HTMLElement): boolean {
    return element.getBoundingClientRect().left <= RIBBON_DOCK_MARGIN;
  }

  private updateDockHint(): void {
    if (!this.drag) {
      return;
    }
    const shouldDock =
      this.drag.panel.kind === "ribbon" &&
      this.drag.moved &&
      this.isNearRibbonDock(this.drag.panel.element);
    this.drag.panel.element.classList.toggle("is-dock-target", shouldDock);
  }

  private addRibbonResizeHandles(element: HTMLElement): void {
    const edges: ResizeEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
    for (const edge of edges) {
      const handle = document.createElement("div");
      handle.className = `file-marquee-resize-handle is-${edge}`;
      handle.setAttribute("aria-hidden", "true");
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.resize = {
          element,
          edge,
          startX: event.clientX,
          startY: event.clientY,
          rect: element.getBoundingClientRect(),
        };
        element.classList.add("is-resizing");
      });
      element.appendChild(handle);
    }
  }

  private applyResize(event: PointerEvent): void {
    const state = this.resize;
    if (!state) {
      return;
    }
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    let width = state.rect.width;
    let height = state.rect.height;
    if (state.edge.includes("e")) {
      width = state.rect.width + dx;
    }
    if (state.edge.includes("w")) {
      width = state.rect.width - dx;
    }
    if (state.edge.includes("s")) {
      height = state.rect.height + dy;
    }
    if (state.edge.includes("n")) {
      height = state.rect.height - dy;
    }
    width = Math.max(MIN_RIBBON_WIDTH, Math.min(width, Math.max(MIN_RIBBON_WIDTH, window.innerWidth - 8)));
    height = Math.max(MIN_RIBBON_HEIGHT, Math.min(height, Math.max(MIN_RIBBON_HEIGHT, window.innerHeight - 8)));

    let left = state.edge.includes("w") ? state.rect.right - width : state.rect.left;
    let top = state.edge.includes("n") ? state.rect.bottom - height : state.rect.top;
    left = Math.max(0, Math.min(left, Math.max(0, window.innerWidth - width)));
    top = Math.max(0, Math.min(top, Math.max(0, window.innerHeight - height)));

    state.element.style.width = `${width}px`;
    state.element.style.height = `${height}px`;
    state.element.style.left = `${left}px`;
    state.element.style.top = `${top}px`;
  }

  private clampX(x: number, width: number): number {
    return Math.max(0, Math.min(Math.max(0, window.innerWidth - width), x));
  }

  private clampY(y: number, height: number): number {
    return Math.max(0, Math.min(Math.max(0, window.innerHeight - height), y));
  }
}
