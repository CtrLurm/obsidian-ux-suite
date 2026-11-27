export type Direction = "U" | "D" | "L" | "R";

export interface Point {
  x: number;
  y: number;
}

export interface GestureSegment {
  direction: Direction;
  point: Point;
}

export interface GestureOptions {
  /** 识别一段方向所需的最小位移（像素） */
  step?: number;
  /** 主轴相对副轴的领先倍数，用于过滤斜向抖动 */
  dominance?: number;
}

/** 默认每段方向的最小位移 */
export const DEFAULT_STEP = 26;
/** 默认主轴领先倍数 */
export const DEFAULT_DOMINANCE = 1.4;
/** 右键移动超过该距离后，才认为用户是在画手势并接管右键菜单 */
export const ACTIVATION_DISTANCE = 8;

const MAX_SEGMENTS = 8;
const MAX_POINTS = 600;
/** 接近 45° 的斜线需要移动更远才按主轴归类 */
const AMBIGUOUS_RATIO = 1.75;

const DIRECTION_ARROWS: Record<Direction, string> = {
  U: "↑",
  D: "↓",
  L: "←",
  R: "→",
};

const INPUT_ALIASES: Record<string, Direction> = {
  U: "U",
  u: "U",
  "↑": "U",
  D: "D",
  d: "D",
  "↓": "D",
  L: "L",
  l: "L",
  "←": "L",
  R: "R",
  r: "R",
  "→": "R",
};

/**
 * 把右鍵拖动轨迹转换成由 U/D/L/R 组成的方向序列。
 *
 * 识别方式：从上一个锚点出发，位移超过 step 后判断主轴方向；
 * 方向改变时记录一段并移动锚点，因此 "先下后右" 会得到 "DR"。
 */
export class GestureTracker {
  private readonly step: number;
  private readonly dominance: number;
  private points: Point[] = [];
  private segments: GestureSegment[] = [];
  private anchor: Point | null = null;
  private lastDirection: Direction | null = null;
  private startPosition: Point | null = null;

  constructor(options: GestureOptions = {}) {
    this.step = Math.max(8, options.step ?? DEFAULT_STEP);
    this.dominance = Math.max(1, options.dominance ?? DEFAULT_DOMINANCE);
  }

  get isTracking(): boolean {
    return this.anchor !== null;
  }

  get startPoint(): Point | null {
    return this.startPosition ? { ...this.startPosition } : null;
  }

  get lastPoint(): Point | null {
    const point = this.points[this.points.length - 1];
    return point ? { ...point } : null;
  }

  reset(): void {
    this.points = [];
    this.segments = [];
    this.anchor = null;
    this.lastDirection = null;
    this.startPosition = null;
  }

  start(x: number, y: number): void {
    this.reset();
    const point = { x, y };
    this.startPosition = point;
    this.anchor = point;
    this.points = [point];
  }

  /**
   * 记录一个移动点。
   * @returns 本次调用是否识别出了一个新方向
   */
  moveTo(x: number, y: number): boolean {
    const anchor = this.anchor;
    if (!anchor) {
      return false;
    }

    const previous = this.points[this.points.length - 1];
    if (previous && previous.x === x && previous.y === y) {
      return false;
    }

    const point = { x, y };
    this.points.push(point);
    if (this.points.length > MAX_POINTS) {
      this.points.splice(0, this.points.length - MAX_POINTS);
    }

    const dx = x - anchor.x;
    const dy = y - anchor.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < this.step) {
      return false;
    }

    const direction = this.quantize(dx, dy);
    if (!direction) {
      return false;
    }

    if (direction === this.lastDirection) {
      // 同方向继续移动时推动锚点，避免缓慢转向永远无法触发
      this.anchor = point;
      return false;
    }

    if (this.segments.length >= MAX_SEGMENTS) {
      return false;
    }

    this.segments.push({ direction, point });
    this.lastDirection = direction;
    this.anchor = point;
    return true;
  }

  getDirections(): Direction[] {
    return this.segments.map((segment) => segment.direction);
  }

  getKey(): string {
    return this.getDirections().join("");
  }

  getPath(): Point[] {
    return this.points.map((point) => ({ ...point }));
  }

  getSegments(): GestureSegment[] {
    return this.segments.map((segment) => ({
      direction: segment.direction,
      point: { ...segment.point },
    }));
  }

  private quantize(dx: number, dy: number): Direction | null {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);

    if (ax >= ay * this.dominance) {
      return dx > 0 ? "R" : "L";
    }
    if (ay >= ax * this.dominance) {
      return dy > 0 ? "D" : "U";
    }

    // 接近 45° 的斜线：等位移足够大后再按主轴归类，避免手抖产生杂方向
    if (Math.max(ax, ay) >= this.step * AMBIGUOUS_RATIO) {
      return ax > ay ? (dx > 0 ? "R" : "L") : (dy > 0 ? "D" : "U");
    }

    return null;
  }
}

/** 便捷函数：把一条完整轨迹转换为方向数组 */
export function pathToGesture(
  points: readonly Point[],
  options: GestureOptions = {},
): Direction[] {
  if (points.length === 0) {
    return [];
  }

  const tracker = new GestureTracker(options);
  tracker.start(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    tracker.moveTo(points[index].x, points[index].y);
  }
  return tracker.getDirections();
}

/** 把 "DR" 之类的内部键转换为 "↓→" */
export function formatGesture(key: string): string {
  return Array.from(key)
    .map((character) => DIRECTION_ARROWS[character as Direction] ?? character)
    .join("");
}

/** 解析设置中用户输入的手势键（支持大小写和箭头符号） */
export function normalizeGestureKey(input: string): string | null {
  let key = "";
  for (const character of Array.from(input.trim())) {
    if (/\s/.test(character)) {
      continue;
    }
    const direction = INPUT_ALIASES[character];
    if (!direction) {
      return null;
    }
    key += direction;
  }
  return key.length > 0 ? key : null;
}
