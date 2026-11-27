import type { Point } from "./gesture";

export interface GestureOverlayOptions {
  color: string;
  showHud: boolean;
}

/**
 * 手势轨迹层：一个覆盖整个窗口、不接收鼠标事件的 canvas。
 * 每次手势开始时创建，结束后销毁，避免长期占用 DOM。
 */
export class GestureOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly color: string;
  private readonly showHud: boolean;
  private width = 0;
  private height = 0;
  private dpr = 1;

  constructor(options: GestureOverlayOptions) {
    const canvas = document.createElement("canvas");
    canvas.className = "mouse-gesture-overlay";

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("无法创建 Canvas 2D 上下文");
    }

    this.canvas = canvas;
    this.ctx = ctx;
    this.color = options.color;
    this.showHud = options.showHud;

    document.body.appendChild(canvas);
    this.resize();
    this.clear();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.max(1, Math.floor(this.width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(this.height * this.dpr));
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  draw(points: readonly Point[], hudText: string, cursor: Point | null): void {
    this.clear();
    if (points.length === 0) {
      return;
    }

    const ctx = this.ctx;
    ctx.save();

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      ctx.lineTo(points[index].x, points[index].y);
    }
    ctx.stroke();

    // 起点小圆点
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, 3, 0, Math.PI * 2);
    ctx.fill();

    // 当前光标位置
    const end = cursor ?? points[points.length - 1];
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(end.x, end.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (this.showHud && hudText) {
      this.drawHud(hudText, end);
    }

    ctx.restore();
  }

  destroy(): void {
    this.canvas.remove();
  }

  private drawHud(text: string, cursor: Point): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font =
      "600 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif";

    const paddingX = 9;
    const paddingY = 6;
    const textWidth = ctx.measureText(text).width;
    const boxWidth = textWidth + paddingX * 2;
    const boxHeight = 13 + paddingY * 2;

    let x = cursor.x + 16;
    let y = cursor.y + 18;
    if (x + boxWidth > this.width - 8) {
      x = cursor.x - boxWidth - 16;
    }
    if (y + boxHeight > this.height - 8) {
      y = cursor.y - boxHeight - 16;
    }
    x = Math.max(8, x);
    y = Math.max(8, y);

    ctx.fillStyle = "rgba(17, 24, 39, 0.88)";
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    this.roundRect(x, y, boxWidth, boxHeight, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + paddingX, y + boxHeight / 2 + 0.5);
    ctx.restore();
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }
}
