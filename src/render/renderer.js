import { angleOf, clamp } from '../engine/math.js';
import { drawSprite } from './sprites.js';

export const THEME = {
  bg: '#f4fbfb',
  grid: '#e3f0f0',
  gridMajor: '#d2e6e6',
  axis: '#b6d4d4',
  muted: '#84a0a0',
  accent: '#0e9f9f',
  text: '#0e3331',
  select: '#e07b00',
  hover: '#12b0a8',
};

export function sceneBounds(world) {
  return world.bounds();
}

export function drawWorld(ctx, world, cam, view, opts = {}) {
  const dpr = view.dpr || 1;
  const w = view.w;
  const h = view.h;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, w, h);

  if (opts.showGrid !== false) drawGrid(ctx, cam, w, h);
  drawAxes(ctx, cam, w, h);

  const toS = (p) => cam.toScreen(p, w, h);

  const items = [];
  if (opts.visibilityMode !== 'sprites') {
    for (const part of world.parts.values()) {
      if (part.type === 'gearPair' || part.type === 'angleMotor') continue;
      if (part.type === 'trace' && opts.showTraces === false) continue;
      if (!part.visible) continue;
      items.push({ z: part.zIndex ?? 10, kind: 'part', part });
    }
  }
  if (opts.visibilityMode !== 'parts') {
    for (const sprite of world.sprites.values()) {
      if (!sprite.visible) continue;
      items.push({ z: sprite.zIndex ?? 60, kind: 'sprite', sprite });
    }
  }
  items.sort((a, b) => a.z - b.z);

  const selectionId = opts.selection?.id;
  const hoverId = opts.hover?.id;

  for (const item of items) {
    if (item.kind === 'sprite') {
      drawSprite(ctx, item.sprite, world, cam, view);
      continue;
    }
    const part = item.part;
    const selected = selectionId === part.id;
    const hovered = hoverId === part.id;
    switch (part.type) {
      case 'guide':
        drawGuide(ctx, world, part, cam, toS, selected || hovered);
        break;
      case 'trace':
        drawTrace(ctx, world, part, toS, selected);
        break;
      case 'link':
        if (opts.mode === 'l2d') drawBone(ctx, world, part, cam, toS, selected, hovered);
        else drawLink(ctx, world, part, cam, toS, selected, hovered);
        break;
      case 'gear':
        drawGear(ctx, world, part, cam, toS, selected, hovered);
        break;
      case 'rack':
        drawRack(ctx, world, part, cam, toS, selected, hovered);
        break;
      case 'slider':
        drawSlider(ctx, world, part, cam, toS, selected, hovered);
        break;
      case 'motor':
        drawMotor(ctx, world, part, cam, toS, selected);
        break;
      case 'force':
        if (opts.showForces !== false) drawForce(ctx, world, part, cam, toS, selected);
        break;
      default:
        break;
    }
  }

  if (opts.showJoints !== false && opts.visibilityMode !== 'sprites') {
    for (const n of world.nodes.values()) {
      if (!n.visible) continue;
      const selected = selectionId === n.id;
      const hovered = hoverId === n.id;
      drawJoint(ctx, n, toS, selected, hovered);
    }
  }

  if (opts.mode === 'l2d' && opts.pivot) {
    const p = toS(opts.pivot);
    ctx.save();
    ctx.strokeStyle = THEME.accent;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(p.x - 9, p.y);
    ctx.lineTo(p.x + 9, p.y);
    ctx.moveTo(p.x, p.y - 9);
    ctx.lineTo(p.x, p.y + 9);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawGrid(ctx, cam, w, h) {
  const target = 46;
  let step = 1;
  const raw = target / cam.scale;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  const mult = raw / pow;
  step = (mult > 5 ? 10 : mult > 2 ? 5 : mult > 1 ? 2 : 1) * pow;
  const tl = cam.toWorld(0, 0, w, h);
  const br = cam.toWorld(w, h, w, h);
  const x0 = Math.floor(tl.x / step) * step;
  const y0 = Math.floor(tl.y / step) * step;
  ctx.lineWidth = 1;
  for (let x = x0; x <= br.x; x += step) {
    const sx = cam.toScreen({ x, y: 0 }, w, h).x;
    const major = Math.abs(Math.round(x / step)) % 5 === 0;
    ctx.strokeStyle = major ? THEME.gridMajor : THEME.grid;
    ctx.beginPath();
    ctx.moveTo(Math.round(sx) + 0.5, 0);
    ctx.lineTo(Math.round(sx) + 0.5, h);
    ctx.stroke();
  }
  for (let y = y0; y <= br.y; y += step) {
    const sy = cam.toScreen({ x: 0, y }, w, h).y;
    const major = Math.abs(Math.round(y / step)) % 5 === 0;
    ctx.strokeStyle = major ? THEME.gridMajor : THEME.grid;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(sy) + 0.5);
    ctx.lineTo(w, Math.round(sy) + 0.5);
    ctx.stroke();
  }
}

function drawAxes(ctx, cam, w, h) {
  const o = cam.toScreen({ x: 0, y: 0 }, w, h);
  ctx.strokeStyle = THEME.axis;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, Math.round(o.y) + 0.5);
  ctx.lineTo(w, Math.round(o.y) + 0.5);
  ctx.moveTo(Math.round(o.x) + 0.5, 0);
  ctx.lineTo(Math.round(o.x) + 0.5, h);
  ctx.stroke();
  ctx.fillStyle = THEME.muted;
  ctx.font = '11px Consolas, monospace';
  ctx.fillText('+X', w - 30, o.y - 6);
  ctx.fillText('+Y', o.x + 6, h - 8);
}

function drawGuide(ctx, world, part, cam, toS, active) {
  const a = world.node(part.a);
  const b = world.node(part.b);
  if (!a || !b) return;
  const sa = toS(a);
  const sb = toS(b);
  let dx = sb.x - sa.x;
  let dy = sb.y - sa.y;
  const l = Math.hypot(dx, dy) || 1;
  dx /= l;
  dy /= l;
  const EXT = 4000;
  ctx.save();
  ctx.setLineDash([9, 7]);
  ctx.lineWidth = active ? 2.4 : 1.6;
  ctx.strokeStyle = active ? THEME.select : part.color || '#a9b8b6';
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(sa.x - dx * EXT, sa.y - dy * EXT);
  ctx.lineTo(sa.x + dx * EXT, sa.y + dy * EXT);
  ctx.stroke();
  ctx.restore();
  const ticks = 22;
  const A = { x: sa.x - dx * EXT, y: sa.y - dy * EXT };
  const B = { x: sa.x + dx * EXT, y: sa.y + dy * EXT };
  const px = -dy;
  const py = dx;
  ctx.save();
  ctx.strokeStyle = part.color || '#a9b8b6';
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1;
  for (let i = 0; i < ticks; i++) {
    const t = (i + 0.5) / ticks;
    const x = A.x + (B.x - A.x) * t;
    const y = A.y + (B.y - A.y) * t;
    if (x < -50 || x > 1e5) continue;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + px * 7, y + py * 7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTrace(ctx, world, part, toS, selected) {
  const pts = part.points;
  if (!pts || pts.length < 2) return;
  ctx.save();
  ctx.lineWidth = selected ? 2.4 : 1.8;
  ctx.strokeStyle = selected ? THEME.select : part.color || '#e0a800';
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const s = toS(pts[i]);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBone(ctx, world, part, cam, toS, selected, hovered) {
  const a = world.node(part.a);
  const b = world.node(part.b);
  if (!a || !b) return;
  const sa = toS(a);
  const sb = toS(b);
  const L = Math.hypot(sb.x - sa.x, sb.y - sa.y) || 1;
  const ux = (sb.x - sa.x) / L;
  const uy = (sb.y - sa.y) / L;
  const px = -uy;
  const py = ux;
  const wA = Math.max(4.5, L * 0.15);
  const wB = Math.max(3, L * 0.09);
  const color = selected ? THEME.select : hovered ? THEME.hover : part.color || '#8fa5a1';
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sa.x + px * (wA / 2), sa.y + py * (wA / 2));
  ctx.lineTo(sb.x + px * (wB / 2), sb.y + py * (wB / 2));
  ctx.lineTo(sb.x - px * (wB / 2), sb.y - py * (wB / 2));
  ctx.lineTo(sa.x - px * (wA / 2), sa.y - py * (wA / 2));
  ctx.closePath();
  ctx.fillStyle = 'rgba(14,159,159,0.10)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = selected ? 2.4 : 1.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sa.x, sa.y, wA * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = selected ? 2.2 : 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawLink(ctx, world, part, cam, toS, selected, hovered) {
  const a = world.node(part.a);
  const b = world.node(part.b);
  if (!a || !b) return;
  const sa = toS(a);
  const sb = toS(b);
  const lw = Math.max(2.2, (part.width || 0.09) * cam.scale);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(14,51,49,0.16)';
  ctx.lineWidth = lw + 3;
  ctx.beginPath();
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.stroke();
  ctx.strokeStyle = selected ? THEME.select : hovered ? THEME.hover : part.color || '#2fa88f';
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.stroke();
  if (selected) {
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = THEME.select;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawGear(ctx, world, part, cam, toS, selected, hovered) {
  const c = world.node(part.center);
  if (!c) return;
  const sc = toS(c);
  const R = part.radius * cam.scale;
  const teeth = Math.max(6, part.teeth | 0);
  const color = selected ? THEME.select : hovered ? THEME.hover : part.color || '#3d7fd6';
  ctx.save();
  ctx.translate(sc.x, sc.y);

  if (part.internal) {
    const ro = R * 1.16;
    const rt = R * 0.9;
    const rr = R * 1.02;
    ctx.beginPath();
    const n2 = teeth * 2;
    for (let i = 0; i < n2; i++) {
      const ang = part.angle + (i * Math.PI * 2) / n2;
      const rad = i % 2 === 0 ? rt : rr;
      const x = rad * Math.cos(ang);
      const y = rad * Math.sin(ang);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(139,92,246,0.12)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = selected ? 2.6 : 1.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, ro, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = selected ? 3 : 2.2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 0, ro * 1.04, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(14,51,49,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    const rt = R * 1.07;
    const rr = R * 0.88;
    ctx.beginPath();
    const n2 = teeth * 2;
    for (let i = 0; i < n2; i++) {
      const ang = part.angle + (i * Math.PI * 2) / n2;
      const rad = i % 2 === 0 ? rr : rt;
      const x = rad * Math.cos(ang);
      const y = rad * Math.sin(ang);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(61,127,214,0.12)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = selected ? 2.6 : 1.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(3, R * 0.22), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(61,127,214,0.26)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2, R), 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(14,51,49,0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  if (!part.internal) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(R * 0.82 * Math.cos(part.angle), R * 0.82 * Math.sin(part.angle));
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawRack(ctx, world, part, cam, toS, selected, hovered) {
  const n = world.node(part.node);
  const g = world.parts.get(part.guide);
  const gear = world.parts.get(part.gear);
  if (!n || !g) return;
  const a = world.node(g.a);
  const b = world.node(g.b);
  if (!a || !b) return;
  const ang = angleOf(a, b);
  const p = toS(n);
  const gearR = gear ? gear.radius : 0.8;
  const N = gear ? Math.max(6, gear.teeth) : 12;
  const module = (2 * Math.PI * gearR) / N;
  const tip = module * 0.28;
  const body = module * 0.55;
  const teeth = Math.max(6, part.teeth | 0);
  const half = (teeth * module) / 2;
  const dir = (part.offset ?? gearR) >= 0 ? 1 : -1;
  const color = selected ? THEME.select : hovered ? THEME.hover : part.color || '#d98b00';

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(ang);
  ctx.scale(cam.scale, cam.scale);
  ctx.beginPath();
  ctx.rect(-half, dir > 0 ? -body : 0, half * 2, body);
  ctx.fillStyle = 'rgba(217,139,0,0.14)';
  ctx.fill();
  ctx.lineWidth = (selected ? 2.6 : 1.6) / cam.scale;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const x0 = -half + i * module;
    const x1 = x0 + module * 0.5;
    ctx.moveTo(x0, 0);
    ctx.lineTo(x1, dir * tip);
    ctx.lineTo(x0 + module, 0);
  }
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1.4 / cam.scale;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawSlider(ctx, world, part, cam, toS, selected, hovered) {
  const n = world.node(part.node);
  const g = world.parts.get(part.guide);
  if (!n) return;
  const p = toS(n);
  const a = g ? world.node(g.a) : null;
  const b = g ? world.node(g.b) : null;
  const ang = a && b ? angleOf(a, b) : 0;
  const W = (part.width ?? 0.9) * cam.scale;
  const H = (part.height ?? 0.5) * cam.scale;
  const color = selected ? THEME.select : hovered ? THEME.hover : part.color || '#e0655c';
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(ang);
  const rr = Math.min(6, H * 0.25);
  ctx.beginPath();
  ctx.roundRect(-W / 2, -H / 2, W, H, rr);
  ctx.fillStyle = part.sleeve ? 'rgba(224,101,92,0.10)' : 'rgba(224,101,92,0.20)';
  ctx.fill();
  ctx.lineWidth = selected ? 2.6 : 1.8;
  ctx.strokeStyle = color;
  ctx.stroke();
  if (part.sleeve) {
    ctx.beginPath();
    ctx.moveTo(0, -H / 2);
    ctx.lineTo(0, H / 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawMotor(ctx, world, part, cam, toS, selected) {
  const c = world.node(part.center);
  if (!c) return;
  const sc = toS(c);
  const color = selected ? THEME.select : '#0e9f9f';
  const R = selected ? 17 : 14;
  const a1 = part.phi ?? 0;
  ctx.save();
  ctx.translate(sc.x, sc.y);
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(14,159,159,0.30)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, R, a1 - 1.0, a1 + Math.PI * 1.4);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  const ea = a1 + Math.PI * 1.4;
  const rx = Math.cos(ea);
  const ry = Math.sin(ea);
  const tx = -Math.sin(ea);
  const ty = Math.cos(ea);
  ctx.beginPath();
  ctx.moveTo(rx * R + tx * 7, ry * R + ty * 7);
  ctx.lineTo(rx * (R + 4.5), ry * (R + 4.5));
  ctx.lineTo(rx * (R - 4.5), ry * (R - 4.5));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawForce(ctx, world, part, cam, toS, selected) {
  const nodes = world.targetNodes(part.target);
  if (!nodes.length) return;
  let ox = 0;
  let oy = 0;
  for (const n of nodes) {
    ox += n.x;
    oy += n.y;
  }
  ox /= nodes.length;
  oy /= nodes.length;
  const mag = Math.hypot(part.fx, part.fy) || 0;
  if (mag < 1e-6) return;
  const dirX = part.fx / mag;
  const dirY = part.fy / mag;
  const len = clamp(26 + Math.log10(1 + mag) * 42, 26, 130);
  const o = toS({ x: ox, y: oy });
  const ex = o.x + dirX * len;
  const ey = o.y + dirY * len;
  const color = selected ? THEME.select : part.enabled ? '#ef6c3f' : '#c2cccb';
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = selected ? 3 : 2.2;
  ctx.beginPath();
  ctx.moveTo(o.x + dirX * 12, o.y + dirY * 12);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  const px = -dirY;
  const py = dirX;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - dirX * 11 + px * 5.5, ey - dirY * 11 + py * 5.5);
  ctx.lineTo(ex - dirX * 11 - px * 5.5, ey - dirY * 11 - py * 5.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawJoint(ctx, n, toS, selected, hovered) {
  const p = toS(n);
  const base = n.fixed ? '#8fa5a1' : '#0e3331';
  const color = selected ? THEME.select : hovered ? THEME.hover : base;
  const r = selected ? 6 : 4.6;
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, r + 1.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = selected ? 3 : 2.2;
  ctx.strokeStyle = color;
  ctx.stroke();
  if (n.fixed) {
    ctx.beginPath();
    ctx.moveTo(p.x - 11, p.y + 11);
    ctx.lineTo(p.x + 11, p.y + 11);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(p.x + i * 5, p.y + 11);
      ctx.lineTo(p.x + i * 5 - 4, p.y + 17);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  }
  ctx.restore();
}
