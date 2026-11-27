import { GESTURE_ACTION_IDS } from "./actions";
import { formatGesture, normalizeGestureKey } from "./gesture";

export interface ParsedMapping {
  /** 手势键（如 "DR"）到动作 id 的映射 */
  mapping: Record<string, string>;
  errors: string[];
  warnings: string[];
  /** 成功解析的手势数量 */
  count: number;
}

const MAX_KEY_LENGTH = 8;

/**
 * 解析设置页中的映射文本。
 *
 * 支持：
 *   L = back
 *   DR = close-tab
 *   cmd:my-plugin:some-command
 *   D = none
 * 空行、# 和 // 注释会被忽略。
 */
export function parseGestureMapping(text: string): ParsedMapping {
  const mapping: Record<string, string> = {};
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) {
      return;
    }

    const separator = line.indexOf("=");
    if (separator < 0) {
      errors.push(`第 ${lineNumber} 行缺少 "="：${line}`);
      return;
    }

    const rawKey = line.slice(0, separator).trim();
    const rawAction = line.slice(separator + 1).trim();

    const key = normalizeGestureKey(rawKey);
    if (!key) {
      errors.push(`第 ${lineNumber} 行手势无效："${rawKey}"，只能使用 U/D/L/R 或 ↑↓←→`);
      return;
    }
    if (key.length > MAX_KEY_LENGTH) {
      errors.push(`第 ${lineNumber} 行手势过长（最多 ${MAX_KEY_LENGTH} 段）`);
      return;
    }
    if (!rawAction) {
      errors.push(`第 ${lineNumber} 行动作为空`);
      return;
    }

    let action = rawAction;
    if (action !== "none" && !action.startsWith("cmd:")) {
      action = action.toLowerCase();
    }

    if (action.startsWith("cmd:")) {
      const commandId = action.slice(4).trim();
      if (!commandId) {
        errors.push(`第 ${lineNumber} 行缺少命令 ID`);
        return;
      }
      action = `cmd:${commandId}`;
    } else if (action !== "none" && !GESTURE_ACTION_IDS.has(action)) {
      errors.push(`第 ${lineNumber} 行动作未知："${rawAction}"`);
      return;
    }

    if (seen.has(key)) {
      warnings.push(`手势 ${formatGesture(key)} 重复，最后一行生效`);
    }
    seen.add(key);

    if (action === "none") {
      delete mapping[key];
    } else {
      mapping[key] = action;
    }
  });

  return {
    mapping,
    errors,
    warnings,
    count: Object.keys(mapping).length,
  };
}
