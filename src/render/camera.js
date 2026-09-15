export class Camera {
  constructor(x = 0, y = 0, scale = 48) {
    this.x = x;
    this.y = y;
    this.scale = scale;
  }

  toScreen(p, w, h) {
    return { x: (p.x - this.x) * this.scale + w / 2, y: (p.y - this.y) * this.scale + h / 2 };
  }

  toWorld(sx, sy, w, h) {
    return { x: (sx - w / 2) / this.scale + this.x, y: (sy - h / 2) / this.scale + this.y };
  }

  zoomAt(sx, sy, factor, w, h) {
    const before = this.toWorld(sx, sy, w, h);
    const next = Math.min(400, Math.max(6, this.scale * factor));
    this.scale = next;
    const after = this.toWorld(sx, sy, w, h);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }

  panByScreen(dx, dy) {
    this.x -= dx / this.scale;
    this.y -= dy / this.scale;
  }

  frame(bounds, w, h, padding = 70) {
    if (!bounds) return;
    const bw = Math.max(1e-3, bounds.maxX - bounds.minX);
    const bh = Math.max(1e-3, bounds.maxY - bounds.minY);
    const s = Math.min((w - padding * 2) / bw, (h - padding * 2) / bh);
    this.scale = Math.min(400, Math.max(6, s));
    this.x = (bounds.minX + bounds.maxX) / 2;
    this.y = (bounds.minY + bounds.maxY) / 2;
  }
}

export const DEFAULT_CAMERA = () => new Camera(0, 0, 48);
