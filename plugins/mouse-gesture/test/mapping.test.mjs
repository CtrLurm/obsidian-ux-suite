import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MAPPING_TEXT,
  DEFAULT_SETTINGS,
  GESTURE_ACTION_IDS,
  GESTURE_ACTIONS,
  formatGesture,
  parseGestureMapping,
  sanitizeTrailColor,
} from "./.tmp/core.mjs";

test("默认映射全部有效且为 12 条", () => {
  const parsed = parseGestureMapping(DEFAULT_MAPPING_TEXT);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.count, 12);
  assert.equal(parsed.mapping.L, "back");
  assert.equal(parsed.mapping.R, "forward");
  assert.equal(parsed.mapping.DR, "close-tab");
  assert.equal(parsed.mapping.RU, "new-tab");
  assert.equal(parsed.mapping.RD, "reload");
});

test("默认映射引用的动作都存在", () => {
  const parsed = parseGestureMapping(DEFAULT_MAPPING_TEXT);
  for (const action of Object.values(parsed.mapping)) {
    assert.equal(GESTURE_ACTION_IDS.has(action), true, `未知动作 ${action}`);
  }
});

test("支持注释、空行、大小写和箭头符号", () => {
  const parsed = parseGestureMapping(
    ["# 注释", "// 另一种注释", "", "r = forward", "↓ → = close-tab", "u = scroll-up"].join("\n"),
  );
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.count, 3);
  assert.equal(parsed.mapping.R, "forward");
  assert.equal(parsed.mapping.DR, "close-tab");
  assert.equal(parsed.mapping.U, "scroll-up");
});

test("支持 cmd: 自定义命令与 none", () => {
  const parsed = parseGestureMapping(
    ["RL = cmd:my-plugin:do-something", "D = scroll-down", "D = none"].join("\n"),
  );
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.mapping.RL, "cmd:my-plugin:do-something");
  assert.equal(parsed.mapping.D, undefined);
  assert.equal(parsed.count, 1);
  assert.equal(parsed.warnings.length, 1);
});

test("错误行带上行号且不会生效", () => {
  const parsed = parseGestureMapping(
    ["L", "X = back", "R = nope", "U =", "D = scroll-down"].join("\n"),
  );
  assert.equal(parsed.errors.length, 4);
  assert.match(parsed.errors[0], /第 1 行/);
  assert.match(parsed.errors[0], /缺少 "="/);
  assert.match(parsed.errors[1], /第 2 行/);
  assert.match(parsed.errors[2], /第 3 行/);
  assert.match(parsed.errors[3], /第 4 行/);
  assert.equal(parsed.mapping.D, "scroll-down");
  assert.equal(parsed.count, 1);
});

test("重复手势以最后一行为准并给出警告", () => {
  const parsed = parseGestureMapping(["R = forward", "R = back"].join("\n"));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.mapping.R, "back");
  assert.equal(parsed.warnings.length, 1);
  assert.match(parsed.warnings[0], /↓|→|手势/);
});

test("手势过长会报错", () => {
  const parsed = parseGestureMapping("UUUUUUUUU = back");
  assert.equal(parsed.errors.length, 1);
  assert.match(parsed.errors[0], /过长/);
});

test("动作目录覆盖设置中展示的内置动作", () => {
  assert.ok(GESTURE_ACTIONS.length >= 20);
  for (const action of GESTURE_ACTIONS) {
    assert.equal(GESTURE_ACTION_IDS.has(action.id), true);
  }
  assert.equal(new Set(GESTURE_ACTIONS.map((action) => action.id)).size, GESTURE_ACTIONS.length);
});

test("formatGesture 用于显示", () => {
  assert.equal(formatGesture("DR"), "↓→");
});

test("颜色只接受 3 或 6 位十六进制", () => {
  assert.equal(sanitizeTrailColor("#8b5cf6"), "#8b5cf6");
  assert.equal(sanitizeTrailColor("#ABC"), "#ABC");
  assert.equal(sanitizeTrailColor("red"), DEFAULT_SETTINGS.trailColor);
  assert.equal(sanitizeTrailColor("#12345"), DEFAULT_SETTINGS.trailColor);
  assert.equal(sanitizeTrailColor(" #abcdef "), "#abcdef");
});
