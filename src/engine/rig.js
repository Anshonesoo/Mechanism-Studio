import { rotatePoint } from './math.js';

export function rotateNodes(world, pivot, deltaRad) {
  if (!deltaRad) return;
  for (const n of world.nodes.values()) {
    const q = rotatePoint(n, pivot, deltaRad);
    n.x = q.x;
    n.y = q.y;
    n.px = q.x;
    n.py = q.y;
    n.vx = 0;
    n.vy = 0;
  }
}

export function scaleNodes(world, pivot, factor) {
  if (!factor || factor === 1) return;
  for (const n of world.nodes.values()) {
    n.x = pivot.x + (n.x - pivot.x) * factor;
    n.y = pivot.y + (n.y - pivot.y) * factor;
    n.px = n.x;
    n.py = n.y;
    n.vx = 0;
    n.vy = 0;
  }
}

export function translateNodes(world, dx, dy) {
  if (!dx && !dy) return;
  for (const n of world.nodes.values()) {
    n.x += dx;
    n.y += dy;
    n.px = n.x;
    n.py = n.y;
    n.vx = 0;
    n.vy = 0;
  }
}

export function pivotOf(world, pivotId) {
  if (pivotId) {
    const n = world.node(pivotId);
    if (n) return n;
  }
  for (const n of world.nodes.values()) if (n.fixed) return n;
  const b = world.bounds();
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}
