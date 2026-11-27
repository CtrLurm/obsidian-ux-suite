import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  baseName,
  canMoveIntoFolder,
  clampLongPress,
  formatCount,
  isDescendantPath,
  joinVaultPath,
  normalizeFolder,
  normalizeRect,
  rectsIntersect,
  targetPathFor,
  topLevelPaths,
  uniquePaths,
} from "./.tmp/core.mjs";

test("normalizeRect handles drag in any direction", () => {
  assert.deepEqual(normalizeRect(30, 40, 10, 5), {
    left: 10,
    top: 5,
    right: 30,
    bottom: 40,
  });
});

test("rectsIntersect detects overlap and touching edges", () => {
  const a = { left: 0, top: 0, right: 10, bottom: 10 };
  assert.equal(rectsIntersect(a, { left: 5, top: 5, right: 20, bottom: 20 }), true);
  assert.equal(rectsIntersect(a, { left: 10, top: 0, right: 20, bottom: 10 }), true);
  assert.equal(rectsIntersect(a, { left: 11, top: 0, right: 20, bottom: 10 }), false);
});

test("uniquePaths removes empty entries and duplicates", () => {
  assert.deepEqual(uniquePaths(["a", "", "a", "b"]), ["a", "b"]);
});

test("topLevelPaths keeps only the outermost selected folders", () => {
  assert.deepEqual(topLevelPaths(["a/b/c.md", "a", "x/y", "z"]), ["a", "z", "x/y"]);
});

test("path helpers normalize slashes and build target paths", () => {
  assert.equal(normalizeFolder("/notes/deep/"), "notes/deep");
  assert.equal(normalizeFolder("\\notes\\deep"), "notes/deep");
  assert.equal(joinVaultPath("notes", "a.md"), "notes/a.md");
  assert.equal(joinVaultPath("", "a.md"), "a.md");
  assert.equal(baseName("notes/deep/a.md"), "a.md");
  assert.equal(baseName("a.md"), "a.md");
  assert.equal(targetPathFor("old/a.md", "new"), "new/a.md");
  assert.equal(targetPathFor("old/a.md", ""), "a.md");
});

test("isDescendantPath does not treat siblings as children", () => {
  assert.equal(isDescendantPath("a/b.md", "a"), true);
  assert.equal(isDescendantPath("ab/b.md", "a"), false);
  assert.equal(isDescendantPath("a", "a"), false);
  assert.equal(isDescendantPath("a", ""), true);
});

test("canMoveIntoFolder rejects self and descendants", () => {
  assert.equal(canMoveIntoFolder("a", "a"), false);
  assert.equal(canMoveIntoFolder("a", "a/b"), false);
  assert.equal(canMoveIntoFolder("a", "b"), true);
  assert.equal(canMoveIntoFolder("a", ""), true);
  assert.equal(canMoveIntoFolder("a/b.md", "a"), true);
});

test("formatCount renders a readable count", () => {
  assert.equal(formatCount(3, "项"), "3 项");
  assert.equal(formatCount(0, "个文件"), "0 个文件");
});

test("clampLongPress keeps the setting in the supported range", () => {
  assert.equal(clampLongPress(100), 160);
  assert.equal(clampLongPress(320), 320);
  assert.equal(clampLongPress(2000), 900);
  assert.equal(clampLongPress(Number.NaN), DEFAULT_SETTINGS.longPressMs);
});

test("default settings are friendly for first run", () => {
  assert.deepEqual(DEFAULT_SETTINGS, {
    enabled: true,
    longPressMs: 320,
    showToolbar: true,
    enableTearOff: true,
  });
});
