export type CustomActionId =
  | "scroll-up"
  | "scroll-down"
  | "top"
  | "bottom"
  | "reload"
  | "plugin-settings";

export interface GestureAction {
  /** 设置文件里使用的动作 id */
  id: string;
  /** 设置页和轨迹提示里显示的中文名称 */
  label: string;
  /** Obsidian 命令 ID（与 custom 二选一） */
  command?: string;
  /** 由插件自己实现的特殊动作 */
  custom?: CustomActionId;
}

/**
 * 所有内置动作。
 * 命令 ID 已在本机 Obsidian 1.15.1 的 obsidian.asar 中逐项确认存在。
 */
export const GESTURE_ACTIONS: readonly GestureAction[] = [
  { id: "back", label: "后退", command: "app:go-back" },
  { id: "forward", label: "前进", command: "app:go-forward" },
  { id: "scroll-up", label: "向上滚动一屏", custom: "scroll-up" },
  { id: "scroll-down", label: "向下滚动一屏", custom: "scroll-down" },
  { id: "top", label: "滚动到顶部", custom: "top" },
  { id: "bottom", label: "滚动到底部", custom: "bottom" },
  { id: "close-tab", label: "关闭当前标签页", command: "workspace:close" },
  { id: "close-others", label: "关闭其他标签页", command: "workspace:close-others" },
  { id: "reopen-tab", label: "重新打开已关闭的标签页", command: "workspace:undo-close-pane" },
  { id: "prev-tab", label: "切换到左侧标签页", command: "workspace:previous-tab" },
  { id: "next-tab", label: "切换到右侧标签页", command: "workspace:next-tab" },
  { id: "new-tab", label: "新建标签页", command: "workspace:new-tab" },
  { id: "split-right", label: "向右分屏", command: "workspace:split-vertical" },
  { id: "split-down", label: "向下分屏", command: "workspace:split-horizontal" },
  { id: "reading-view", label: "切换阅读视图", command: "markdown:toggle-preview" },
  { id: "command-palette", label: "打开命令面板", command: "command-palette:open" },
  { id: "quick-switcher", label: "打开快速切换", command: "switcher:open" },
  { id: "graph", label: "打开关系图谱", command: "graph:open" },
  { id: "left-sidebar", label: "切换左侧边栏", command: "app:toggle-left-sidebar" },
  { id: "right-sidebar", label: "切换右侧边栏", command: "app:toggle-right-sidebar" },
  { id: "daily-note", label: "打开今日日记", command: "daily-notes" },
  { id: "save", label: "保存当前文件", command: "editor:save-file" },
  { id: "settings", label: "打开 Obsidian 设置", command: "app:open-settings" },
  { id: "reload", label: "重新加载 Obsidian", custom: "reload" },
  { id: "plugin-settings", label: "打开鼠标手势设置", custom: "plugin-settings" },
];

export const GESTURE_ACTION_IDS: ReadonlySet<string> = new Set(
  GESTURE_ACTIONS.map((action) => action.id),
);

export function getActionLabel(actionId: string): string {
  if (actionId.startsWith("cmd:")) {
    return `执行命令 ${actionId.slice(4)}`;
  }
  return GESTURE_ACTIONS.find((action) => action.id === actionId)?.label ?? actionId;
}
