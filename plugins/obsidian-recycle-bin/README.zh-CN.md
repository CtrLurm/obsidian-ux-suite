# 回收站

[![English](https://img.shields.io/badge/English-2f81f7?style=flat-square)](./README.md)
[![简体中文](https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-d73a4a?style=flat-square)](./README.zh-CN.md)

Obsidian 桌面版的内嵌回收站。删除的文件会连同原始路径保留在仓库内，可以集中查看、恢复或彻底删除，不必去系统回收站里翻找。

## 功能

- 启用时拦截 Obsidian 正常的 `FileManager.trashFile` 删除流程。
- 删除源文件前，先把文件或完整文件夹树复制到插件自己的回收站。
- 记录原始仓库路径、类型、删除时间和大小。
- 侧边栏视图支持复选框、全选、恢复、彻底删除和清空。
- 通过 Vault API 恢复；原位置有同名项时跳过，不覆盖。
- 停用或卸载后恢复 Obsidian 原生删除行为。

## 用法

1. 在 Obsidian 中正常删除文件或文件夹。
2. 从左侧功能区垃圾桶图标打开回收站，或执行 **回收站: 打开回收站**。
3. 勾选条目或全选，然后选择 **恢复所选** 或 **彻底删除**。
4. 需要全部清空时，点击 **清空回收站** 并确认。

双击单行可恢复该条目。

## 设置

- 启用或停用拦截。
- 删除后显示提示。
- 显示回收站绝对路径。
- 清空回收站。

## 数据位置

```text
<仓库>/.obsidian/plugins/obsidian-recycle-bin/bin/
├── index.json                 # originalPath、type、deletedAt、size
└── data/<条目 ID>/<名称>       # 复制的文件或文件夹树
```

回收站不会被 Obsidian 索引，因此不会作为笔记或附件出现。

## 兼容性与限制

- 仅桌面版。
- 可与 Obsidian 原生“删除文件”设置共存。
- 只拦截经过 `FileManager.trashFile` 的删除；在 Obsidian 之外删除，或代码直接调用 Vault API 删除的，不会被捕获。
- 恢复文件夹时会重建其中的文件和子文件夹；空文件夹不会保留。
- 删除大文件或大文件夹时，因为要先完整复制，耗时会比原生删除更长。

## 安装

见[套件安装说明](../../README.md#%E4%B8%AD%E6%96%87)。插件 ID 为 `obsidian-recycle-bin`。

属于 [Obsidian 体验优化套件](../../README.md#%E4%B8%AD%E6%96%87)。
