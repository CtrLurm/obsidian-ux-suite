export interface MouseGestureSettings {
  /** 是否启用右键手势 */
  enabled: boolean;
  /** 原始映射文本，保留用户注释与排版 */
  mappingText: string;
  /** 轨迹和提示气泡颜色（十六进制） */
  trailColor: string;
  /** 是否在鼠标旁显示动作提示 */
  showHud: boolean;
  /** 在 Canvas / Excalidraw 中不接管右键 */
  disableInCanvas: boolean;
}

/**
 * 默认映射参考 Edge / 经典鼠标手势：
 * ← 后退、→ 前进、↑ 向上滚动、↓ 向下滚动、↓↑ 回顶部、↑↓ 回底部、
 * ↓→ 关闭标签、←↑ 恢复标签、→↑ 新建标签、↑← 左标签、↑→ 右标签、→↓ 刷新。
 */
export const DEFAULT_MAPPING_TEXT = `# 鼠标手势映射：手势 = 动作
# 方向：U 上 / D 下 / L 左 / R 右，可组合，例如 DR = 先下后右
# 以 # 或 // 开头的行会被忽略；同一手势重复时最后一行生效

L = back
R = forward
U = scroll-up
D = scroll-down
DU = top
UD = bottom
DR = close-tab
LU = reopen-tab
RU = new-tab
UL = prev-tab
UR = next-tab
RD = reload
`;

export const DEFAULT_SETTINGS: MouseGestureSettings = {
  enabled: true,
  mappingText: DEFAULT_MAPPING_TEXT,
  trailColor: "#8b5cf6",
  showHud: true,
  disableInCanvas: true,
};

export const TRAIL_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function sanitizeTrailColor(value: string): string {
  const color = value.trim();
  return TRAIL_COLOR_PATTERN.test(color) ? color : DEFAULT_SETTINGS.trailColor;
}
