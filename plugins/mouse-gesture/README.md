# Mouse Gesture

[![English](https://img.shields.io/badge/English-2f81f7?style=flat-square)](./README.md)
[![简体中文](https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-d73a4a?style=flat-square)](./README.zh-CN.md)

Edge-style right-button mouse gestures for Obsidian desktop. Draw a direction over the interface, release the button, and run a navigation, tab, scroll, or any custom command.

## Features

- Right-button gesture recognition with live trail and action bubble.
- A plain right-click still opens Obsidian's native context menu.
- 12 default gestures covering navigation, tabs, scrolling, and reload.
- Every gesture can be remapped, disabled with `none`, or bound to any command with `cmd:<command-id>`.
- Optional suspension inside Canvas and Excalidraw.
- Settings for trail color, action HUD, and the mapping table.

## Default gestures

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

## Usage

1. Hold the **right mouse button** and move at least about 8 px.
2. Draw one or more straight segments. Each segment should be at least about 26 px.
3. Release to run the mapped action. If no direction was drawn, the native menu opens.
4. Open **Settings → Mouse Gesture** to change the mapping, color, HUD, or per-view suspension.

## Custom mapping

One line per gesture:

```text
L = back
R = forward
DR = close-tab
RL = cmd:my-plugin:some-command
D = none
```

Directions are `U/D/L/R` or `↑↓←→`. Comments start with `#` or `//`. `none` disables a gesture; `cmd:<command-id>` runs any installed Obsidian command.

## Install

See the [suite installation guide](../../README.md#installation). The plugin ID is `mouse-gesture`.

## Notes

- Desktop only.
- The plugin listens at window level, so gestures work over the editor, sidebars, tab bar, and settings.
- Inputs and text fields keep their normal right-click behavior.
- A gesture mapping is saved in the plugin data file; it survives restarts.

Part of the [Obsidian UX Suite](../../README.md).
