export interface RecycleBinSettings {
  /** 接管 Obsidian 的删除操作，把文件移入插件回收站 */
  enabled: boolean;
  /** 移入回收站后显示一条轻提示 */
  notifyOnDelete: boolean;
}

export const DEFAULT_SETTINGS: RecycleBinSettings = {
  enabled: true,
  notifyOnDelete: false,
};
