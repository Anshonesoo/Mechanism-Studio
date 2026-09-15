import { cross, dist, sub, norm, dot } from './math.js';

export const effInvMass = (n) => (!n || n.fixed || n.driven || n.grab ? 0 : n.invMass);
export const effInvInertia = (g) => (!g || g.fixedAngle || g.driven ? 0 : g.invInertia);

export class DistanceConstraint {
  constructor(a, b, rest, stiffness = 1) {
    this.a = a;
    this.b = b;
    this.rest = rest;
    this.stiffness = stiffness;
  }

  solve() {
    const { a, b, rest } = this;
    const wa = effInvMass(a);
    const wb = effInvMass(b);
    const w = wa + wb;
    if (w <= 0) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1e-9;
    const diff = ((d - rest) / d) * this.stiffness;
    a.x += dx * diff * (wa / w);
    a.y += dy * diff * (wa / w);
    b.x -= dx * diff * (wb / w);
    b.y -= dy * diff * (wb / w);
  }
}

export class PointOnLineConstraint {
  constructor(p, a, b, stiffness = 1) {
    this.p = p;
    this.a = a;
    this.b = b;
    this.stiffness = stiffness;
  }

  solve() {
    const { p, a, b } = this;
    const ax = a.x;
    const ay = a.y;
    const bx = b.x;
    const by = b.y;
    const px = p.x;
    const py = p.y;
    const C = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    const gax = by - py;
    const gay = px - bx;
    const gbx = py - ay;
    const gby = ax - px;
    const gpx = ay - by;
    const gpy = bx - ax;
    const wa = effInvMass(a);
    const wb = effInvMass(b);
    const wp = effInvMass(p);
    const denom = wa * (gax * gax + gay * gay) + wb * (gbx * gbx + gby * gby) + wp * (gpx * gpx + gpy * gpy);
    if (denom <= 0) return;
    const l = (-C / denom) * this.stiffness;
    a.x += wa * gax * l;
    a.y += wa * gay * l;
    b.x += wb * gbx * l;
    b.y += wb * gby * l;
    p.x += wp * gpx * l;
    p.y += wp * gpy * l;
  }
}

export class GearPairConstraint {
  constructor(ga, gb, internal = false, ca = null, cb = null) {
    this.ga = ga;
    this.gb = gb;
    this.s = internal ? -1 : 1;
    this.ca = ca;
    this.cb = cb;
    this.moving = !!(ca && cb && ca !== cb);
    this.a0 = ga.angle;
    this.b0 = gb.angle;
    this.phi0 = this.moving ? Math.atan2(cb.y - ca.y, cb.x - ca.x) : 0;
    this.phiPrev = this.phi0;
    this.ratio = this.moving ? (internal ? ga.radius - gb.radius : ga.radius + gb.radius) : 0;
    this.C0 = ga.radius * this.a0 + this.s * gb.radius * this.b0 - this.ratio * this.phi0;
  }

  carrierAngle() {
    if (!this.moving) return 0;
    let phi = Math.atan2(this.cb.y - this.ca.y, this.cb.x - this.ca.x);
    while (phi - this.phiPrev > Math.PI) phi -= Math.PI * 2;
    while (phi - this.phiPrev < -Math.PI) phi += Math.PI * 2;
    this.phiPrev = phi;
    return phi;
  }

  solve() {
    const { ga, gb, s } = this;
    const wa = effInvInertia(ga);
    const wb = effInvInertia(gb);
    const ra = Math.max(1e-4, ga.radius);
    const rb = Math.max(1e-4, gb.radius);
    const phi = this.carrierAngle();
    const C = ra * ga.angle + s * rb * gb.angle - this.ratio * phi - this.C0;

    const gThA = ra;
    const gThB = s * rb;
    let gax = 0;
    let gay = 0;
    let gbx = 0;
    let gby = 0;
    let wca = 0;
    let wcb = 0;
    if (this.moving) {
      wca = effInvMass(this.ca);
      wcb = effInvMass(this.cb);
      const dx = this.cb.x - this.ca.x;
      const dy = this.cb.y - this.ca.y;
      const d2 = dx * dx + dy * dy || 1e-9;
      gax = (-this.ratio * dy) / d2;
      gay = (this.ratio * dx) / d2;
      gbx = (this.ratio * dy) / d2;
      gby = (-this.ratio * dx) / d2;
    }

    const denom =
      wa * gThA * gThA + wb * gThB * gThB + wca * (gax * gax + gay * gay) + wcb * (gbx * gbx + gby * gby);
    if (denom <= 0) return;
    const l = -C / denom;
    ga.angle += wa * gThA * l;
    gb.angle += wb * gThB * l;
    if (this.moving) {
      this.ca.x += wca * gax * l;
      this.ca.y += wca * gay * l;
      this.cb.x += wcb * gbx * l;
      this.cb.y += wcb * gby * l;
    }
  }
}

export class RackPinionConstraint {
  constructor(rackNode, guideA, guideB, gear, sign = 1) {
    this.p = rackNode;
    this.a = guideA;
    this.b = guideB;
    this.gear = gear;
    this.sign = sign;
    this.theta0 = gear.angle;
    const u = norm(sub(guideB, guideA));
    this.offset = dot(sub(rackNode, guideA), u) - sign * gear.radius * (gear.angle - this.theta0);
  }

  solve() {
    const u = norm(sub(this.b, this.a));
    const r = this.gear.radius;
    const C = dot(sub(this.p, this.a), u) - this.sign * r * (this.gear.angle - this.theta0) - this.offset;
    const wp = effInvMass(this.p);
    const wa = effInvMass(this.a);
    const wg = effInvInertia(this.gear);
    const gth = -this.sign * r;
    const denom = wp + wa + wg * gth * gth;
    if (denom <= 0) return;
    const l = -C / denom;
    this.p.x += wp * u.x * l;
    this.p.y += wp * u.y * l;
    this.a.x -= wa * u.x * l;
    this.a.y -= wa * u.y * l;
    this.gear.angle += wg * gth * l;
  }
}

export class GuideTangentConstraint {
  constructor(center, a, b, h) {
    this.c = center;
    this.a = a;
    this.b = b;
    this.h = h;
  }

  solve() {
    const u = norm(sub(this.b, this.a));
    const C = cross(u, sub(this.c, this.a)) - this.h;
    const wc = effInvMass(this.c);
    const wa = effInvMass(this.a);
    const gcx = -u.y;
    const gcy = u.x;
    const gax = u.y;
    const gay = -u.x;
    const denom = wc + wa;
    if (denom <= 0) return;
    const l = -C / denom;
    this.c.x += wc * gcx * l;
    this.c.y += wc * gcy * l;
    this.a.x += wa * gax * l;
    this.a.y += wa * gay * l;
  }
}

export class PointConstraint {
  constructor(p, target, stiffness = 1) {
    this.p = p;
    this.target = target;
    this.stiffness = stiffness;
  }

  solve() {
    const p = this.p;
    const w = effInvMass(p);
    if (w <= 0) return;
    p.x += (this.target.x - p.x) * this.stiffness;
    p.y += (this.target.y - p.y) * this.stiffness;
  }
}

export { cross, dist, sub, norm, dot };
