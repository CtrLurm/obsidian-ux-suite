# Recycle Bin

[![English](https://img.shields.io/badge/English-2f81f7?style=flat-square)](./README.md)
[![简体中文](https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-d73a4a?style=flat-square)](./README.zh-CN.md)

An in-app recycle bin for Obsidian desktop. Deletions are kept inside the vault with their original paths, so files and folders can be reviewed, restored, or permanently removed without digging through the system trash.

## Features

- Intercepts Obsidian's normal `FileManager.trashFile` flow while enabled.
- Copies files and complete folder trees into a plugin-owned bin before deleting the source.
- Records the original vault path, type, deletion time, and size.
- Sidebar view with checkboxes, select-all, restore, permanent delete, and empty bin.
- Restores through the Vault API; same-name conflicts are skipped instead of overwritten.
- Restores the original delete behavior when disabled or unloaded.

## Usage

1. Delete a file or folder as usual in Obsidian.
2. Open the bin from the left ribbon trash icon or run **Recycle Bin: Open recycle bin**.
3. Tick entries, or select all, then use **Restore selected** or **Delete permanently**.
4. To clear everything, use the **Empty bin** action and confirm.

Double-clicking a single row restores that item.

## Settings

- Enable or disable interception.
- Show a notice after an item is moved to the bin.
- Show the bin's absolute path.
- Empty the bin.

## Data location

```text
<vault>/.obsidian/plugins/obsidian-recycle-bin/bin/
├── index.json                 # originalPath, type, deletedAt, size
└── data/<entry-id>/<name>     # copied file or folder tree
```

The bin is not indexed by Obsidian, so it will not appear as notes or attachments.

## Compatibility and limits

- Desktop only.
- Works alongside Obsidian's native deleted-files setting.
- Only deletions routed through `FileManager.trashFile` are intercepted. Deletions made outside Obsidian, or by code that calls the vault API directly, are not captured.
- Restoring a folder recreates its files and subfolders; empty folders are not preserved.
- Large vaults take longer to copy on deletion because the plugin makes a full copy before removing the source.

## Install

See the [suite installation guide](../../README.md#installation). The plugin ID is `obsidian-recycle-bin`.

Part of the [Obsidian UX Suite](../../README.md).
