# File Marquee & Floating Panels

[![English](https://img.shields.io/badge/English-2f81f7?style=flat-square)](./README.md)
[![简体中文](https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-d73a4a?style=flat-square)](./README.zh-CN.md)

A desktop interaction layer for Obsidian's left file explorer: drag a marquee to select multiple files, move or delete them in one go, and tear the file explorer or ribbon into a floating panel when you need more room.

## Features

- **Long-press marquee selection** on empty file-list space.
- **Batch move** into another folder with a searchable folder picker.
- **Batch delete** through Obsidian's normal trash flow; works with the Recycle Bin plugin.
- **Ctrl/Cmd append selection** while dragging.
- **Floating file explorer**: moves the real explorer leaf into a floating panel, so scrolling, context menus, and selection keep working.
- **Floating ribbon**: a Photoshop-style panel with hidden original ribbon, adaptive grid, eight resize handles, and dock-back behavior.
- **Native tooltips stay above floating panels**.

## Usage

1. **Select**: press and hold the left button on blank file-list space (~0.3 s), drag, release.
2. **Move**: click **Move…**, choose a folder, and confirm. Existing same-name items are skipped.
3. **Delete**: click **Delete** and confirm.
4. **Add to selection**: hold **Ctrl** (Cmd on macOS) while dragging.
5. **Floating file explorer**: long-press the file-list header blank area, drag, and release. Use **Restore** or **×** to put it back.
6. **Floating ribbon**: long-press blank ribbon space. Drag near the left edge (28 px) to dock it back and restore the original ribbon.
7. **Resize**: drag any edge or corner of a floating ribbon; icons reflow in a 2–5 column grid.

## Settings

- Enable or disable the plugin.
- Long-press duration: 160–900 ms, default 320.
- Show or hide the selection toolbar.
- Enable or disable floating panels.
- Reset to defaults.

## Commands

- **Float file explorer**
- **Float ribbon**
- **Clear marquee selection**
- **Toggle file marquee**

## Limits

- Desktop only.
- Marquee selection applies to the file explorer only.
- Moving conflicts are skipped, not overwritten.
- Unusual themes or future Obsidian DOM changes may require selector updates.
- Floating panels move live DOM; avoid closing the panel while Obsidian is rearranging the workspace.

## Install

See the [suite installation guide](../../README.md#installation). The plugin ID is `file-marquee-floating`.

Part of the [Obsidian UX Suite](../../README.md).
