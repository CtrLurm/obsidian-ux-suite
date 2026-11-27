/** 与 Obsidian、Node 无关的小工具，方便单元测试。 */

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = value >= 100 || unit === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

export function formatDateTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "未知时间";
  }
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

/** 取 vault 路径的最后一段，兼容 / 分隔符。 */
export function vaultBasename(vaultPath: string): string {
  const normalized = vaultPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  return index === -1 ? normalized : normalized.slice(index + 1);
}

/** 取 vault 路径的父目录；根目录返回空字符串。 */
export function vaultParent(vaultPath: string): string {
  const normalized = vaultPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

/** 只允许 vault 内的相对路径，防止 index.json 被篡改后越界写文件。 */
export function isSafeVaultPath(vaultPath: string): boolean {
  if (typeof vaultPath !== "string" || vaultPath.length === 0) {
    return false;
  }
  if (vaultPath.startsWith("/") || vaultPath.startsWith("\\") || /^[a-zA-Z]:/.test(vaultPath)) {
    return false;
  }
  if (vaultPath.includes("\0")) {
    return false;
  }
  return !vaultPath.split(/[\\/]/).some((part) => part === ".." || part === ".");
}

/** 把 Node Buffer 转成 Vault.createBinary 需要的 ArrayBuffer。 */
export function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}
