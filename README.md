# Obsidian UX Suite

[![English](https://img.shields.io/badge/English-2f81f7?style=flat-square)](./README.md)
[![简体中文](https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-d73a4a?style=flat-square)](./README.zh-CN.md)

A collection of desktop-only Obsidian plugins that reduce mouse friction and make everyday file operations safer. The suite is deliberately small: each plugin does one job, keeps Obsidian's native behavior as the fallback, and avoids changing your notes.

## Plugins at a glance

| Plugin | ID | What it does | Main use |
| --- | --- | --- | --- |
| **Mouse Gesture** | `mouse-gesture` | Edge-style right-button gestures for navigation, tabs, scrolling, and commands. | Hold the right button, draw a direction, release. |
| **Recycle Bin** | `obsidian-recycle-bin` | An in-app recycle bin that keeps the original vault path and supports multi-select restore or permanent delete. | Delete normally, then open the bin from the ribbon or command palette. |
| **File Marquee & Floating Panels** | `file-marquee-floating` | Long-press marquee selection, batch move/delete, and Photoshop-style floating panels for the file explorer and ribbon. | Long-press empty file-list space to select; long-press the header or ribbon blank area to tear off. |

## Installation

### Option A — Release package (recommended)

1. Open the [Releases](https://github.com/CtrLurm/obsidian-ux-suite/releases) page and download the zip for the plugin you want.
2. Extract it into:

   ```text
   <your-vault>/.obsidian/plugins/<plugin-id>/
   ```

   The folder should contain `main.js`, `manifest.json`, and `styles.css`.
3. In Obsidian, open **Settings → Community plugins**, refresh the installed list, and enable the plugin.
4. Reload Obsidian if the plugin does not appear immediately.

### Option B — From this repository

Clone the repository, then copy the runtime files of a plugin:

```bash
mkdir -p "<your-vault>/.obsidian/plugins/mouse-gesture"
cp plugins/mouse-gesture/{main.js,manifest.json,styles.css} \
   "<your-vault>/.obsidian/plugins/mouse-gesture/"
```

Do the same with `obsidian-recycle-bin` or `file-marquee-floating`.

### Notes

- All three plugins are desktop-only (`isDesktopOnly: true`); mobile Obsidian will not load them.
- No vault data is included in this repository. The test runs used temporary files, which were removed afterwards.
- The plugins are provided as-is, without warranty. Test in a copy of your vault first if the data is important.

## 1. Mouse Gesture

**Function**

Hold the right mouse button and draw a direction; release to run an action. A plain right-click still opens Obsidian's native context menu. The gesture trail and a small action bubble are rendered above the UI. The default map covers back/forward, scroll, top/bottom, tab switching, close/reopen tab, new tab, and reload.

**Usage**

1. Hold the **right mouse button** and move at least ~8 px.
2. Draw one or more straight segments; each segment should be at least ~26 px for reliable recognition.
3. Release. If no direction was drawn, the normal context menu opens.
4. Open **Settings → Mouse Gesture** to edit the mapping, trail color, HUD, or disable gestures in Canvas/Excalidraw.

**Default gestures**

| Gesture | Action |
| --- | --- |
| `←` | Back |
| `→` | Forward |
| `↑` | Scroll up |
| `↓` | Scroll down |
| `↓↑` | Scroll to top |
| `↑↓` | Scroll to bottom |
| `↓→` | Close tab |
| `←↑` | Reopen closed tab |
| `→↑` | New tab |
| `↑←` | Previous tab |
| `↑→` | Next tab |
| `→↓` | Reload Obsidian |

**Custom mapping**

Each line is `gesture = action`; directions are `U/D/L/R` (or `↑↓←→`). Comments start with `#` or `//`. `none` disables a gesture; `cmd:<command-id>` runs any Obsidian command.

```text
L = back
R = forward
DR = close-tab
RL = cmd:my-plugin:some-command
D = none
```

**Settings:** enable, trail color, action HUD, disable in Canvas/Excalidraw, editable mapping table.

## 2. Recycle Bin

**Function**

Instead of sending deleted files straight to the system trash, this plugin intercepts Obsidian's `FileManager.trashFile` flow, copies the file or folder into a plugin-owned bin, records its original vault path, and only then deletes the source. The bin can be opened as a sidebar view; entries can be restored individually or in bulk, permanently deleted, or emptied.

**Usage**

1. Delete a file or folder in Obsidian as usual (file explorer, tab menu, or delete confirmation).
2. Open the bin from the left ribbon trash icon, or run **Recycle Bin: Open recycle bin** from the command palette.
3. Tick entries (or select all) and choose **Restore selected** or **Delete permanently**.
4. Restoring recreates the file/folder at its original path through the Vault API; if something already exists there, the item is skipped and reported as a conflict instead of being overwritten.

**Settings:** enable/disable interception, show a notice after moving an item, show the bin's absolute path, empty the bin.

**How it stores data**

```text
<vault>/.obsidian/plugins/obsidian-recycle-bin/bin/
├── index.json                 # originalPath, type, deletedAt, size
└── data/<entry-id>/<name>     # copied file or folder tree
```

**Compatibility:** works alongside the native Obsidian trash setting; when the plugin is disabled, Obsidian's original delete behavior returns. Only deletions that go through `FileManager.trashFile` are intercepted.

## 3. File Marquee & Floating Panels

**Function**

A desktop interaction layer for the left file explorer:

- **Long-press marquee selection**: hold the left button on empty file-list space, drag a rectangle, and select all intersecting files/folders.
- **Batch actions**: move selected items into another folder, or delete them through Obsidian's normal trash flow (which can feed the Recycle Bin plugin above).
- **Tear-off floating panels**: long-press the file-list header to pull the real file explorer into a floating window; long-press blank ribbon space to pull out a Photoshop-style ribbon panel.
- **Ribbon panel behavior**: the original ribbon is completely hidden while the floating panel exists; dragging the panel to the left edge (28 px) docks it back and restores the ribbon; eight resize handles support left-button resizing; icons are arranged in an adaptive 2–5 column grid.
- **Native tooltips stay visible**: when a floating panel is open, Obsidian's tooltip layer is raised above the panel.

**Usage**

1. **Marquee**: press and hold the left button on blank file-list space (~0.3 s), drag, release. The bottom toolbar shows `Selected N / Move… / Delete / Cancel`.
2. Hold **Ctrl** (Cmd on macOS) while marquee-selecting to add to the current selection.
3. **Move**: click **Move…**, search/choose a destination folder; same-name conflicts are skipped, not overwritten.
4. **Delete**: click **Delete** and confirm; the normal Obsidian trash flow is used.
5. **Floating file explorer**: long-press the file-list header blank area and drag. The real explorer leaf is moved into a floating panel; scrolling, context menus, and marquee selection keep working. Use **Restore** or **×** to put it back.
6. **Floating ribbon**: long-press blank ribbon space and drag. The original ribbon is hidden; drag the panel near the left edge to dock it back. Resize from any edge/corner; icons reflow in a grid.
7. Commands: **Float file explorer**, **Float ribbon**, **Clear marquee selection**, **Toggle file marquee**.

**Settings:** enable, long-press duration (160–900 ms, default 320), show selection toolbar, enable floating panels, reset defaults.

**Limitations:** desktop only; marquee applies to the file explorer only; moving conflicts are skipped; unusual themes or future Obsidian DOM changes may require selector updates.

## Repository layout

```text
.
├── README.md                 # English overview
├── README.zh-CN.md           # Chinese overview
├── LICENSE
├── .gitignore
└── plugins/
    ├── mouse-gesture/        # source, tests, runtime files, bilingual docs
    ├── obsidian-recycle-bin/
    └── file-marquee-floating/
```

Each plugin directory contains its TypeScript source, build/test scripts, `manifest.json`, and the built `main.js` + `styles.css` so it can be copied directly into a vault.

## Build from source

Each plugin is independent. For example:

```bash
cd plugins/file-marquee-floating
npm install
npm run build
npm test
npm run smoke
npm run package
```

`npm run release` runs build + tests + smoke + packaging. Use `npm.cmd` on Windows PowerShell if script execution policy blocks `npm.ps1`.

## Tested

Windows desktop Obsidian **1.15.1**:

- Mouse gestures: native right-click menu, new-tab and close-tab gestures, settings parsing.
- Recycle bin: real file deletion, folder deletion, single/all restore, permanent delete, settings page.
- File marquee: marquee selection, batch move/delete, selection inside a floating explorer, floating explorer/ribbon open/close/dock, resize, cloned ribbon button mapping, tooltip layering, full ribbon hiding.

The three plugins have 22, 13, and 10 automated tests respectively, plus a smoke test that loads the built `main.js` with an Obsidian stub.

## License

MIT — see [LICENSE](LICENSE). Author: **CtrLurm**.

## AI disclosure

This project was built with AI assistance under CtrLurm's direction. The plugin code, tests, and documentation were reviewed and exercised in a real Obsidian 1.15.1 installation, but AI-generated software can still contain mistakes. Use it at your own risk.
