import { angleOf, cross, dist, distToSegment, dot, norm, sub } from './math.js';
import {
  DistanceConstraint,
  GearPairConstraint,
  GuideTangentConstraint,
  PointOnLineConstraint,
  RackPinionConstraint,
} from './constraints.js';
import { omegaAt, defaultProfile, evalExpression, MAX_NODE_SPEED, DIVERGE_LIMIT } from './profile.js';

let ID = 1;
export const makeId = (prefix = 'x') => `${prefix}${ID++}`;

export function syncIdCounter(world) {
  let max = 0;
  const scan = (id) => {
    const m = /(\d+)$/.exec(String(id || ''));
    if (m) max = Math.max(max, Number(m[1]));
  };
  for (const id of world.nodes.keys()) scan(id);
  for (const id of world.parts.keys()) scan(id);
  for (const id of world.sprites.keys()) scan(id);
  ID = Math.max(ID, max + 1);
  return ID;
}

const DEFAULT_COLORS = {
  link: '#2fa88f',
  ground: '#8fa5a1',
  gear: '#3d7fd6',
  ring: '#8b5cf6',
  rack: '#d98b00',
  guide: '#a9b8b6',
  slider: '#e0655c',
  motor: '#0e9f9f',
  force: '#ef6c3f',
  trace: '#e0a800',
};

export class World {
  constructor() {
    this.nodes = new Map();
    this.parts = new Map();
    this.sprites = new Map();
    this.constraints = [];
    this.time = 0;
    this.settings = {
      gravity: { x: 0, y: 0 },
      damping: 1.6,
      iterations: 12,
      substeps: 4,
    };
    this.drag = null;
    this.initial = null;
    this.diverged = false;
    this.stats = { nodes: 0, parts: 0, dof: 0, sprites: 0 };
  }

  clear() {
    this.nodes.clear();
    this.parts.clear();
    this.sprites.clear();
    this.constraints = [];
    this.time = 0;
    this.drag = null;
    this.initial = null;
    this.settings = {
      gravity: { x: 0, y: 0 },
      damping: 1.6,
      iterations: 12,
      substeps: 4,
    };
  }

  addNode(x, y, opts = {}) {
    const fixed = !!opts.fixed;
    const node = {
      id: opts.id || makeId('n'),
      type: 'node',
      x,
      y,
      px: x,
      py: y,
      vx: 0,
      vy: 0,
      ax: 0,
      ay: 0,
      mass: fixed ? 0 : opts.mass ?? 1,
      invMass: fixed ? 0 : 1 / (opts.mass ?? 1),
      fixed,
      driven: false,
      grab: false,
      label: opts.label || '',
      zIndex: opts.zIndex ?? 40,
      visible: opts.visible !== false,
    };
    this.nodes.set(node.id, node);
    return node;
  }

  addLink(a, b, opts = {}) {
    const link = {
      id: opts.id || makeId('L'),
      type: 'link',
      a,
      b,
      rest: opts.rest ?? dist(this.node(a), this.node(b)),
      width: opts.width ?? 0.09,
      color: opts.color || DEFAULT_COLORS.link,
      visible: opts.visible !== false,
      zIndex: opts.zIndex ?? 20,
      label: opts.label || '连杆',
      spriteId: opts.spriteId || null,
    };
    this.parts.set(link.id, link);
    return link;
  }

  addGear(center, opts = {}) {
    const radius = opts.radius ?? 1.6;
    const inertia = opts.inertia ?? radius * radius * 0.5;
    const gear = {
      id: opts.id || makeId('G'),
      type: 'gear',
      center,
      radius,
      teeth: opts.teeth ?? Math.max(8, Math.round(radius * 8)),
      angle: opts.angle ?? 0,
      fixedAngle: !!opts.fixedAngle,
      driven: false,
      inertia,
      invInertia: opts.fixedAngle ? 0 : 1 / inertia,
      internal: !!opts.internal,
      color: opts.color || (opts.internal ? DEFAULT_COLORS.ring : DEFAULT_COLORS.gear),
      visible: opts.visible !== false,
      zIndex: opts.zIndex ?? 10,
      label: opts.label || (opts.internal ? '内齿圈' : '齿轮'),
      spriteId: opts.spriteId || null,
    };
    this.parts.set(gear.id, gear);
    return gear;
  }

  addGuide(a, b, opts = {}) {
    const guide = {
      id: opts.id || makeId('D'),
      type: 'guide',
      a,
      b,
      color: opts.color || DEFAULT_COLORS.guide,
      visible: opts.visible !== false,
      zIndex: opts.zIndex ?? 5,
      label: opts.label || '导轨',
      spriteId: opts.spriteId || null,
    };
    this.parts.set(guide.id, guide);
    return guide;
  }

  addSlider(node, guide, opts = {}) {
    const slider = {
      id: opts.id || makeId('S'),
      type: 'slider',
      node,
      guide,
      sleeve: !!opts.sleeve,
      width: opts.width ?? 0.9,
      height: opts.height ?? 0.5,
      color: opts.color || DEFAULT_COLORS.slider,
      visible: opts.visible !== false,
      zIndex: opts.zIndex ?? 30,
      label: opts.label || (opts.sleeve ? '套筒' : '滑块'),
      spriteId: opts.spriteId || null,
    };
    this.parts.set(slider.id, slider);
    return slider;
  }

  addRack(node, guide, gear, opts = {}) {
    const g = this.parts.get(gear);
    const rack = {
      id: opts.id || makeId('R'),
      type: 'rack',
      node,
      guide,
      gear,
      sign: opts.sign ?? 1,
      teeth: opts.teeth ?? 18,
      height: opts.height ?? 0.4,
      color: opts.color || DEFAULT_COLORS.rack,
      visible: opts.visible !== false,
      zIndex: opts.zIndex ?? 15,
      label: opts.label || '齿条',
      spriteId: opts.spriteId || null,
    };
    if (g) {
      const u = norm(sub(this.node(this.part(guide).b), this.node(this.part(guide).a)));
      rack.offset = cross(u, sub(this.node(g.center), this.node(this.part(guide).a)));
    }
    this.parts.set(rack.id, rack);
    return rack;
  }

  addGearPair(a, b, internal = false, opts = {}) {
    const pair = {
      id: opts.id || makeId('P'),
      type: 'gearPair',
      a,
      b,
      internal,
      visible: false,
      zIndex: 1,
      label: internal ? '内啮合副' : '齿轮副',
    };
    this.parts.set(pair.id, pair);
    return pair;
  }

  addMotor(node, center, opts = {}) {
    const c = this.node(center);
    const p = this.node(node);
    const phi = Math.atan2(p.y - c.y, p.x - c.x);
    const motor = {
      id: opts.id || makeId('M'),
      type: 'motor',
      node,
      center,
      radius: opts.radius ?? dist(p, c),
      profile: opts.profile || defaultProfile(opts.preset || 'constant'),
      phi,
      phi0: phi,
      t: 0,
      visible: opts.visible !== false,
      zIndex: opts.zIndex ?? 45,
      label: opts.label || '转动电机',
    };
    this.parts.set(motor.id, motor);
    return motor;
  }

  addAngleMotor(gear, opts = {}) {
    const motor = {
      id: opts.id || makeId('A'),
      type: 'angleMotor',
      gear,
      profile: opts.profile || defaultProfile(opts.preset || 'constant'),
      t: 0,
      visible: false,
      zIndex: 1,
      label: opts.label || '齿轮驱动',
    };
    this.parts.set(motor.id, motor);
    return motor;
  }

  addForce(target, fx, fy, opts = {}) {
    const force = {
      id: opts.id || makeId('F'),
      type: 'force',
      target,
      fx: fx ?? 6,
      fy: fy ?? 0,
      enabled: opts.enabled !== false,
      visible: true,
      zIndex: opts.zIndex ?? 50,
      label: opts.label || '外力',
    };
    this.parts.set(force.id, force);
    return force;
  }

  addTrace(node, opts = {}) {
    const trace = {
      id: opts.id || makeId('T'),
      type: 'trace',
      node,
      points: opts.points || [],
      max: opts.max ?? 1400,
      color: opts.color || DEFAULT_COLORS.trace,
      enabled: opts.enabled !== false,
      visible: true,
      zIndex: 3,
      label: opts.label || '轨迹',
    };
    this.parts.set(trace.id, trace);
    return trace;
  }

  addSprite(target, src, opts = {}) {
    const part = this.parts.get(target);
    const frame = this.partFrame(part);
    const sprite = {
      id: opts.id || makeId('I'),
      type: 'sprite',
      target,
      src,
      name: opts.name || '图像',
      anchorX: opts.anchorX ?? 0.5,
      anchorY: opts.anchorY ?? 0.5,
      scale: opts.scale ?? 0.01,
      offsetX: opts.offsetX ?? 0,
      offsetY: opts.offsetY ?? 0,
      angle: opts.angle ?? 0,
      rotate: opts.rotate !== false,
      opacity: opts.opacity ?? 1,
      width: opts.width ?? 0,
      height: opts.height ?? 0,
      baseAngle: frame ? frame.angle : 0,
      baseX: frame ? frame.pos.x : 0,
      baseY: frame ? frame.pos.y : 0,
      visible: opts.visible !== false,
      zIndex: opts.zIndex ?? 60,
    };
    this.sprites.set(sprite.id, sprite);
    return sprite;
  }

  node(id) {
    return this.nodes.get(id);
  }

  part(id) {
    return this.parts.get(id);
  }

  partFrame(part) {
    if (!part) return null;
    switch (part.type) {
      case 'link': {
        const a = this.node(part.a);
        const b = this.node(part.b);
        if (!a || !b) return null;
        return { pos: { x: a.x, y: a.y }, angle: angleOf(a, b) };
      }
      case 'gear': {
        const c = this.node(part.center);
        if (!c) return null;
        return { pos: { x: c.x, y: c.y }, angle: part.angle };
      }
      case 'slider': {
        const n = this.node(part.node);
        const g = this.parts.get(part.guide);
        if (!n || !g) return null;
        const a = this.node(g.a);
        const b = this.node(g.b);
        return { pos: { x: n.x, y: n.y }, angle: a && b ? angleOf(a, b) : 0 };
      }
      case 'rack': {
        const n = this.node(part.node);
        const g = this.parts.get(part.guide);
        if (!n || !g) return null;
        const a = this.node(g.a);
        const b = this.node(g.b);
        return { pos: { x: n.x, y: n.y }, angle: a && b ? angleOf(a, b) : 0 };
      }
      case 'guide': {
        const a = this.node(part.a);
        const b = this.node(part.b);
        if (!a || !b) return null;
        return { pos: { x: a.x, y: a.y }, angle: angleOf(a, b) };
      }
      default:
        return null;
    }
  }

  remove(id) {
    if (this.nodes.has(id)) return this.removeNode(id);
    const part = this.parts.get(id);
    if (!part) return false;
    this.parts.delete(id);
    for (const [sid, sprite] of [...this.sprites]) {
      if (sprite.target === id) this.sprites.delete(sid);
    }
    for (const [pid, p] of [...this.parts]) {
      if (p.type === 'gearPair' && (p.a === id || p.b === id)) this.parts.delete(pid);
      if (p.type === 'angleMotor' && p.gear === id) this.parts.delete(pid);
      if (p.type === 'motor' && (p.node === id || p.center === id)) this.parts.delete(pid);
      if (p.type === 'rack' && p.gear === id) this.parts.delete(pid);
      if (p.type === 'force' && (p.target === id || p.target === `p:${id}` || p.target === `n:${id}`)) this.parts.delete(pid);
      if (p.type === 'trace' && p.node === id) this.parts.delete(pid);
    }
    return true;
  }

  removeNode(id) {
    if (!this.nodes.has(id)) return false;
    for (const [pid, p] of [...this.parts]) {
      if (p.a === id || p.b === id || p.center === id || p.node === id) this.parts.delete(pid);
    }
    for (const [sid, sprite] of [...this.sprites]) {
      if (!this.parts.has(sprite.target)) this.sprites.delete(sid);
    }
    this.nodes.delete(id);
    for (const [pid, p] of [...this.parts]) {
      if (p.type === 'gearPair' && (!this.parts.has(p.a) || !this.parts.has(p.b))) this.parts.delete(pid);
    }
    return true;
  }

  build() {
    const c = [];
    const rigidPairs = new Set();
    const movable = (n) => !!n && !n.fixed;
    const addRigid = (na, nb, rest) => {
      if (!na || !nb || na === nb) return;
      if (na.fixed && nb.fixed) return;
      const key = na.id < nb.id ? `${na.id}|${nb.id}` : `${nb.id}|${na.id}`;
      if (rigidPairs.has(key)) return;
      rigidPairs.add(key);
      c.push(new DistanceConstraint(na, nb, rest));
    };
    for (const part of this.parts.values()) {
      if (part.type === 'link') {
        const a = this.node(part.a);
        const b = this.node(part.b);
        if (a && b) {
          part.rest = part.rest ?? dist(a, b);
          addRigid(a, b, part.rest);
        }
      } else if (part.type === 'slider') {
        const n = this.node(part.node);
        const g = this.parts.get(part.guide);
        if (n && g) {
          const a = this.node(g.a);
          const b = this.node(g.b);
          if (a && b && (movable(n) || movable(a) || movable(b))) c.push(new PointOnLineConstraint(n, a, b));
        }
      } else if (part.type === 'rack') {
        const n = this.node(part.node);
        const g = this.parts.get(part.guide);
        const gear = this.parts.get(part.gear);
        if (n && g) {
          const a = this.node(g.a);
          const b = this.node(g.b);
          if (a && b) {
            if (movable(n) || movable(a) || movable(b)) c.push(new PointOnLineConstraint(n, a, b));
            if (gear) {
              c.push(new RackPinionConstraint(n, a, b, gear, part.sign));
              const center = this.node(gear.center);
              if (center && (movable(center) || movable(a) || movable(b))) {
                c.push(new GuideTangentConstraint(center, a, b, part.offset ?? gear.radius));
              }
            }
          }
        }
      } else if (part.type === 'gearPair') {
        const ga = this.parts.get(part.a);
        const gb = this.parts.get(part.b);
        if (ga && gb) {
          const ca = this.node(ga.center);
          const cb = this.node(gb.center);
          c.push(new GearPairConstraint(ga, gb, part.internal, ca, cb));
          if (ca && cb && ca !== cb) {
            const rest = part.internal ? Math.abs(ga.radius - gb.radius) : ga.radius + gb.radius;
            addRigid(ca, cb, rest);
          }
        }
      }
    }
    this.constraints = c;
    let dof = 0;
    for (const n of this.nodes.values()) if (!n.fixed) dof += 2;
    for (const p of this.parts.values()) if (p.type === 'gear' && !p.fixedAngle) dof += 1;
    this.stats = {
      nodes: this.nodes.size,
      parts: this.parts.size,
      sprites: this.sprites.size,
      dof: dof - c.length,
      constraints: c.length,
    };
    return this;
  }

  targetNodes(target) {
    if (!target) return [];
    const [kind, id] = String(target).includes(':') ? String(target).split(':') : ['p', target];
    if (kind === 'n') {
      const n = this.nodes.get(id);
      return n ? [n] : [];
    }
    const part = this.parts.get(id);
    if (!part) {
      const node = this.nodes.get(id);
      return node ? [node] : [];
    }
    if (part.type === 'link') return [this.node(part.a), this.node(part.b)].filter(Boolean);
    if (part.type === 'gear') {
      const n = this.node(part.center);
      return n ? [n] : [];
    }
    if (part.type === 'slider' || part.type === 'rack') {
      const n = this.node(part.node);
      return n ? [n] : [];
    }
    if (part.type === 'guide') return [this.node(part.a), this.node(part.b)].filter(Boolean);
    return [];
  }

  applyForces() {
    for (const part of this.parts.values()) {
      if (part.type !== 'force' || !part.enabled) continue;
      const nodes = this.targetNodes(part.target);
      if (!nodes.length) continue;
      let m = 0;
      for (const n of nodes) m += n.mass || 0.0001;
      if (m <= 0) continue;
      const fx = part.exprX ? evalExpression(part.exprX, this.time) : part.fx;
      const fy = part.exprY ? evalExpression(part.exprY, this.time) : part.fy;
      const ax = fx / m;
      const ay = fy / m;
      for (const n of nodes) {
        n.ax += ax;
        n.ay += ay;
      }
    }
  }

  applyDrivers(h, advance) {
    const dragged = this.drag ? new Set(this.drag.targets.map((t) => t.id)) : null;
    for (const part of this.parts.values()) {
      if (part.type === 'motor') {
        const c = this.node(part.center);
        const p = this.node(part.node);
        if (!c || !p) continue;
        if (dragged && dragged.has(p.id)) continue;
        if (advance) {
          part.phi += omegaAt(part.profile, part.t) * h;
          part.t += h;
        }
        p.x = c.x + part.radius * Math.cos(part.phi);
        p.y = c.y + part.radius * Math.sin(part.phi);
        p.driven = true;
        p.vx = 0;
        p.vy = 0;
      } else if (part.type === 'angleMotor') {
        const g = this.parts.get(part.gear);
        if (!g) continue;
        if (advance) {
          g.angle += omegaAt(part.profile, part.t) * h;
          part.t += h;
        }
        g.driven = true;
      }
    }
  }

  substep(h, advance) {
    const dragIds = this.drag ? new Set(this.drag.targets.map((t) => t.id)) : null;
    for (const n of this.nodes.values()) {
      n.driven = false;
      n.ax = 0;
      n.ay = 0;
    }
    for (const p of this.parts.values()) if (p.type === 'gear') p.driven = false;

    if (advance) {
      if (this.settings.gravity.x || this.settings.gravity.y) {
        for (const n of this.nodes.values()) {
          if (n.fixed) continue;
          n.ax += this.settings.gravity.x;
          n.ay += this.settings.gravity.y;
        }
      }
      this.applyForces();
      const damp = Math.exp(-this.settings.damping * h);
      for (const n of this.nodes.values()) {
        n.px = n.x;
        n.py = n.y;
        if (n.fixed) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx += n.ax * h;
        n.vy += n.ay * h;
        n.vx *= damp;
        n.vy *= damp;
        n.x += n.vx * h;
        n.y += n.vy * h;
      }
    } else {
      for (const n of this.nodes.values()) {
        n.px = n.x;
        n.py = n.y;
      }
    }

    this.applyDrivers(h, advance);

    if (this.drag) {
      const k = this.drag.stiffness ?? 0.45;
      for (const t of this.drag.targets) {
        const n = this.node(t.id);
        if (!n || n.fixed) continue;
        n.x += (t.x - n.x) * k;
        n.y += (t.y - n.y) * k;
      }
    }

    for (let it = 0; it < this.settings.iterations; it++) {
      for (let i = 0; i < this.constraints.length; i++) this.constraints[i].solve();
    }

    for (const n of this.nodes.values()) {
      if (n.fixed || n.driven || (dragIds && dragIds.has(n.id))) {
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      if (advance) {
        n.vx = (n.x - n.px) / h;
        n.vy = (n.y - n.py) / h;
        const sp = Math.hypot(n.vx, n.vy);
        if (sp > MAX_NODE_SPEED) {
          const k = MAX_NODE_SPEED / sp;
          n.vx *= k;
          n.vy *= k;
        }
      } else {
        n.vx = 0;
        n.vy = 0;
      }
    }
  }

  sanitize() {
    for (const n of this.nodes.values()) {
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y) || Math.abs(n.x) > DIVERGE_LIMIT || Math.abs(n.y) > DIVERGE_LIMIT) {
        this.reset();
        this.diverged = true;
        return true;
      }
    }
    return false;
  }

  step(dt, advance = true) {
    const sub = Math.max(1, this.settings.substeps | 0);
    const h = Math.max(1e-5, dt / sub);
    for (let s = 0; s < sub; s++) this.substep(h, advance);
    if (advance) this.time += dt;
    this.recordTraces();
    if (this.sanitize()) this.recordTraces();
  }

  recordTraces() {
    for (const part of this.parts.values()) {
      if (part.type !== 'trace' || !part.enabled) continue;
      const n = this.node(part.node);
      if (!n) continue;
      const last = part.points[part.points.length - 1];
      if (!last || Math.hypot(n.x - last.x, n.y - last.y) > 0.01) {
        part.points.push({ x: n.x, y: n.y });
        if (part.points.length > part.max) part.points.shift();
      }
    }
  }

  clearTraces() {
    for (const part of this.parts.values()) if (part.type === 'trace') part.points = [];
  }

  captureInitial() {
    this.initial = this.snapshotPose();
  }

  snapshotPose() {
    return {
      time: this.time,
      nodes: [...this.nodes.values()].map((n) => ({ id: n.id, x: n.x, y: n.y, fixed: n.fixed })),
      gears: [...this.parts.values()]
        .filter((p) => p.type === 'gear')
        .map((g) => ({ id: g.id, angle: g.angle })),
      motors: [...this.parts.values()]
        .filter((p) => p.type === 'motor' || p.type === 'angleMotor')
        .map((m) => ({ id: m.id, phi: m.phi ?? 0, t: m.t ?? 0 })),
    };
  }

  applyPose(pose) {
    if (!pose) return;
    for (const item of pose.nodes) {
      const n = this.node(item.id);
      if (n) {
        n.x = item.x;
        n.y = item.y;
        n.px = item.x;
        n.py = item.y;
        n.vx = 0;
        n.vy = 0;
      }
    }
    for (const item of pose.gears) {
      const g = this.parts.get(item.id);
      if (g) g.angle = item.angle;
    }
    for (const item of pose.motors) {
      const m = this.parts.get(item.id);
      if (m) {
        if (m.type === 'motor') m.phi = item.phi;
        m.t = item.t;
      }
    }
    this.time = pose.time ?? 0;
  }

  reset() {
    if (this.initial) this.applyPose(this.initial);
    for (const n of this.nodes.values()) {
      n.vx = 0;
      n.vy = 0;
      n.px = n.x;
      n.py = n.y;
    }
    for (const part of this.parts.values()) {
      if (part.type === 'motor' || part.type === 'angleMotor') part.t = 0;
    }
    this.drag = null;
    this.clearTraces();
    this.build();
  }

  bounds() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const push = (x, y, r = 0) => {
      minX = Math.min(minX, x - r);
      minY = Math.min(minY, y - r);
      maxX = Math.max(maxX, x + r);
      maxY = Math.max(maxY, y + r);
    };
    for (const n of this.nodes.values()) push(n.x, n.y, 0.3);
    for (const g of this.parts.values()) {
      if (g.type === 'gear') {
        const c = this.node(g.center);
        if (c) push(c.x, c.y, g.radius);
      }
    }
    if (!Number.isFinite(minX)) return { minX: -5, minY: -5, maxX: 5, maxY: 5 };
    return { minX, minY, maxX, maxY };
  }

  hitTest(point, tol = 0.35) {
    let best = null;
    let bestZ = -Infinity;
    for (const part of this.parts.values()) {
      if (!part.visible) continue;
      let hit = false;
      if (part.type === 'link') {
        const a = this.node(part.a);
        const b = this.node(part.b);
        if (a && b) hit = distToSegment(point, a, b) < tol * 0.7;
      } else if (part.type === 'gear') {
        const c = this.node(part.center);
        if (c) {
          const d = dist(point, c);
          hit = d < part.radius + tol * 0.5;
        }
      } else if (part.type === 'guide') {
        const a = this.node(part.a);
        const b = this.node(part.b);
        if (a && b) {
          const u = norm(sub(b, a));
          hit = Math.abs(cross(u, sub(point, a))) < tol * 0.6;
        }
      } else if (part.type === 'slider' || part.type === 'rack') {
        const n = this.node(part.node);
        if (n) hit = dist(point, n) < tol * 2;
      } else if (part.type === 'force') {
        const nodes = this.targetNodes(part.target);
        if (nodes.length) hit = dist(point, nodes[0]) < tol * 1.5;
      }
      if (hit && (part.zIndex ?? 0) >= bestZ) {
        best = { type: 'part', id: part.id, part: part.type };
        bestZ = part.zIndex ?? 0;
      }
    }
    let nodeBest = null;
    let nodeDist = tol * 0.9;
    for (const n of this.nodes.values()) {
      if (!n.visible) continue;
      const d = dist(point, n);
      if (d < nodeDist) {
        nodeDist = d;
        nodeBest = n.id;
      }
    }
    if (nodeBest) return { type: 'node', id: nodeBest, part: 'node' };
    return best;
  }

  snapNode(point, tol = 0.4) {
    let best = null;
    let bestD = tol;
    for (const n of this.nodes.values()) {
      const d = dist(point, n);
      if (d < bestD) {
        bestD = d;
        best = n.id;
      }
    }
    return best;
  }
}

export { DEFAULT_COLORS, omegaAt, defaultProfile };
