export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function normalizeRect(x1: number, y1: number, x2: number, y2: number): RectLike {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2),
  };
}

export function rectsIntersect(a: RectLike, b: RectLike): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

export function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths.filter((path) => typeof path === "string" && path.length > 0)));
}

export function pathDepth(path: string): number {
  return path.split("/").filter(Boolean).length;
}

/** path 是否位于 parent 之下（不包含 parent 本身）。 */
export function isDescendantPath(path: string, parent: string): boolean {
  if (!parent) {
    return path.length > 0;
  }
  return path.startsWith(`${parent}/`);
}

/**
 * 如果同时选中了文件夹和它里面的文件，只保留最外层的条目。
 * 删除/移动父文件夹时子项已经包含在内，避免重复操作。
 */
export function topLevelPaths(paths: string[]): string[] {
  const sorted = uniquePaths(paths).sort((a, b) => {
    const depth = pathDepth(a) - pathDepth(b);
    return depth !== 0 ? depth : a.localeCompare(b);
  });
  const result: string[] = [];
  for (const path of sorted) {
    if (!result.some((parent) => isDescendantPath(path, parent))) {
      result.push(path);
    }
  }
  return result;
}

export function normalizeFolder(folder: string): string {
  return folder.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export function joinVaultPath(folder: string, name: string): string {
  const normalized = normalizeFolder(folder);
  return normalized ? `${normalized}/${name}` : name;
}

export function baseName(path: string): string {
  const normalized = normalizeFolder(path);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? normalized : normalized.slice(index + 1);
}

export function canMoveIntoFolder(sourcePath: string, folder: string): boolean {
  const normalized = normalizeFolder(folder);
  if (!normalized) {
    return true;
  }
  if (normalized === sourcePath) {
    return false;
  }
  return !isDescendantPath(normalized, sourcePath);
}

export function targetPathFor(sourcePath: string, folder: string): string {
  return joinVaultPath(folder, baseName(sourcePath));
}

export function formatCount(count: number, noun: string): string {
  return `${count} ${noun}`;
}
