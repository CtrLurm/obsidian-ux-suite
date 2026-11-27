import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVATION_DISTANCE,
  DEFAULT_STEP,
  GestureTracker,
  formatGesture,
  normalizeGestureKey,
  pathToGesture,
} from "./.tmp/core.mjs";

test("直线向右识别为 R", () => {
  const tracker = new GestureTracker();
  tracker.start(0, 0);
  for (let x = 5; x <= 120; x += 5) {
    tracker.moveTo(x, 0);
  }
  assert.equal(tracker.getKey(), "R");
  assert.deepEqual(tracker.getDirections(), ["R"]);
  assert.ok(tracker.getPath().length > 0);
});

test("先下后右识别为 DR", () => {
  const tracker = new GestureTracker();
  tracker.start(0, 0);
  tracker.moveTo(0, 30);
  tracker.moveTo(0, 60);
  tracker.moveTo(30, 60);
  assert.deepEqual(tracker.getDirections(), ["D", "R"]);
  assert.equal(tracker.getKey(), "DR");
  assert.equal(tracker.getSegments().length, 2);
});

test("先上后右识别为 UR", () => {
  const tracker = new GestureTracker();
  tracker.start(0, 100);
  tracker.moveTo(0, 60);
  tracker.moveTo(0, 20);
  tracker.moveTo(50, 20);
  assert.equal(tracker.getKey(), "UR");
});

test("先下后上识别为 DU", () => {
  const tracker = new GestureTracker();
  tracker.start(0, 0);
  tracker.moveTo(0, 60);
  tracker.moveTo(0, 10);
  assert.equal(tracker.getKey(), "DU");
});

test("小幅抖动不会被识别为额外方向", () => {
  const tracker = new GestureTracker();
  tracker.start(0, 0);
  tracker.moveTo(10, 2);
  tracker.moveTo(20, -1);
  tracker.moveTo(40, 1);
  assert.equal(tracker.getKey(), "R");
});

test("45 度斜线在足够长后按主轴归类", () => {
  const tracker = new GestureTracker();
  tracker.start(0, 0);
  tracker.moveTo(60, 60);
  assert.equal(tracker.getKey(), "D");
});

test("未达到阈值的移动不产生手势", () => {
  const tracker = new GestureTracker();
  tracker.start(0, 0);
  tracker.moveTo(10, 0);
  tracker.moveTo(0, 10);
  assert.equal(tracker.getKey(), "");
  assert.equal(tracker.getDirections().length, 0);
});

test("最多记录 8 段方向", () => {
  const tracker = new GestureTracker();
  tracker.start(0, 0);
  const points = [
    [30, 0],
    [30, 30],
    [0, 30],
    [0, 0],
    [30, 0],
    [30, 30],
    [0, 30],
    [0, 0],
    [30, 0],
  ];
  for (const [x, y] of points) {
    tracker.moveTo(x, y);
  }
  assert.equal(tracker.getKey(), "RDLURDLU");
});

test("reset 清空轨迹与方向", () => {
  const tracker = new GestureTracker();
  tracker.start(0, 0);
  tracker.moveTo(50, 0);
  assert.equal(tracker.getKey(), "R");
  tracker.reset();
  assert.equal(tracker.getKey(), "");
  assert.equal(tracker.isTracking, false);
  assert.equal(tracker.startPoint, null);
});

test("pathToGesture 可以转换整条轨迹并使用自定义阈值", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 15, y: 0 },
    { x: 40, y: 0 },
    { x: 70, y: 0 },
  ];
  assert.deepEqual(pathToGesture(points), ["R"]);
  assert.deepEqual(pathToGesture(points, { step: 80 }), []);
});

test("formatGesture 和 normalizeGestureKey", () => {
  assert.equal(formatGesture("DR"), "↓→");
  assert.equal(formatGesture("ULRD"), "↑←→↓");
  assert.equal(normalizeGestureKey("↓ →"), "DR");
  assert.equal(normalizeGestureKey("dr"), "DR");
  assert.equal(normalizeGestureKey("DX"), null);
  assert.equal(normalizeGestureKey("   "), null);
});

test("默认参数符合设计", () => {
  assert.equal(DEFAULT_STEP, 26);
  assert.equal(ACTIVATION_DISTANCE, 8);
});
