export const vec = (x = 0, y = 0) => ({ x, y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const len = (a) => Math.hypot(a.x, a.y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a) => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};
export const perp = (a) => ({ x: -a.y, y: a.x });
export const angleOf = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const deg = (r) => (r * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;
export const round = (v, p = 1000) => Math.round(v * p) / p;

export function normalizeAngle(a) {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

export function rotatePoint(p, origin, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
}

export function intersectCircles(c1, r1, c2, r2) {
  const d = dist(c1, c2);
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  const h = Math.sqrt(Math.max(0, h2));
  const ux = (c2.x - c1.x) / d;
  const uy = (c2.y - c1.y) / d;
  const mx = c1.x + a * ux;
  const my = c1.y + a * uy;
  return [
    { x: mx + h * -uy, y: my + h * ux },
    { x: mx - h * -uy, y: my - h * ux },
  ];
}

export function projectOnSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby || 1e-9;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2;
  t = clamp(t, 0, 1);
  return { x: a.x + t * abx, y: a.y + t * aby, t };
}

export function distToSegment(p, a, b) {
  const q = projectOnSegment(p, a, b);
  return dist(p, q);
}

export function projectOnLine(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby || 1e-9;
  const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2;
  return { x: a.x + t * abx, y: a.y + t * aby, t };
}

export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const hit = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function formatNum(v, digits = 3) {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(digits);
}
