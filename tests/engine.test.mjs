import { applyTemplate } from '../src/engine/templates.js';
import { World } from '../src/engine/world.js';
import { dist } from '../src/engine/math.js';

let failures = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
  if (!ok) failures++;
};

function make(id) {
  const w = new World();
  applyTemplate(w, id);
  return w;
}

function run(w, seconds = 3, stepsPerSec = 120) {
  const n = Math.round(seconds * stepsPerSec);
  const dt = 1 / stepsPerSec;
  for (let i = 0; i < n; i++) w.step(dt, true);
  return w;
}

function gearC0(w) {
  const map = new Map();
  for (const p of w.parts.values()) {
    if (p.type !== 'gearPair') continue;
    const ga = w.parts.get(p.a);
    const gb = w.parts.get(p.b);
    const ca = w.node(ga.center);
    const cb = w.node(gb.center);
    const moving = !!(ca && cb && ca !== cb);
    const phi = moving ? Math.atan2(cb.y - ca.y, cb.x - ca.x) : 0;
    const ratio = moving ? (p.internal ? ga.radius - gb.radius : ga.radius + gb.radius) : 0;
    const s = p.internal ? -1 : 1;
    map.set(p.id, {
      ga,
      gb,
      s,
      ca,
      cb,
      moving,
      ratio,
      phiPrev: phi,
      c0: ga.radius * ga.angle + s * gb.radius * gb.angle - ratio * phi,
    });
  }
  return map;
}

function maxGearErr(w, base) {
  let err = 0;
  for (const [, b] of base) {
    let phi = 0;
    if (b.moving) {
      phi = Math.atan2(b.cb.y - b.ca.y, b.cb.x - b.ca.x);
      while (phi - b.phiPrev > Math.PI) phi -= Math.PI * 2;
      while (phi - b.phiPrev < -Math.PI) phi += Math.PI * 2;
      b.phiPrev = phi;
    }
    const c = b.ga.radius * b.ga.angle + b.s * b.gb.radius * b.gb.angle - b.ratio * phi;
    err = Math.max(err, Math.abs(c - b.c0));
  }
  return err;
}

function maxLinkError(w) {
  let err = 0;
  for (const p of w.parts.values()) {
    if (p.type !== 'link') continue;
    err = Math.max(err, Math.abs(dist(w.node(p.a), w.node(p.b)) - p.rest));
  }
  return err;
}

function maxLineError(w) {
  let err = 0;
  for (const p of w.parts.values()) {
    if (p.type !== 'slider' && p.type !== 'rack') continue;
    const g = w.parts.get(p.guide);
    const a = w.node(g.a);
    const b = w.node(g.b);
    const n = w.node(p.node);
    const u = { x: b.x - a.x, y: b.y - a.y };
    const l = Math.hypot(u.x, u.y);
    err = Math.max(err, Math.abs((u.x * (n.y - a.y) - u.y * (n.x - a.x)) / l));
  }
  return err;
}

const byLabel = (w, label) => [...w.parts.values()].find((p) => p.label === label);
const nodeLabel = (w, label) => [...w.nodes.values()].find((n) => n.label === label);

// 1. four-bar
{
  const w = make('fourbar');
  const base = gearC0(w);
  const motor = byLabel(w, '曲柄驱动');
  const phi0 = motor.phi;
  w.step(1 / 120, true);
  const motor2 = byLabel(w, '曲柄驱动');
  check('fourbar 电机开始积分', motor2.phi !== phi0, `dphi=${(motor2.phi - phi0).toExponential(2)}`);
  run(w, 3);
  check('fourbar 杆长守恒', maxLinkError(w) < 1e-2, `maxErr=${maxLinkError(w).toExponential(2)}`);
  check('fourbar 齿轮无冲突', maxGearErr(w, base) < 1e-6);
  const trace = [...w.parts.values()].find((p) => p.type === 'trace');
  check('fourbar 轨迹已记录', trace.points.length > 50, `pts=${trace.points.length}`);
  const A = nodeLabel(w, 'A');
  check('fourbar 曲柄绕固定铰转', Math.abs(dist(A, nodeLabel(w, 'O2')) - 1.2) < 1e-2, `r=${dist(A, nodeLabel(w, 'O2')).toFixed(3)}`);
}

// 2. slider-crank
{
  const w = make('sliderCrank');
  run(w, 3);
  check('sliderCrank 杆长守恒', maxLinkError(w) < 1e-2, `${maxLinkError(w).toExponential(2)}`);
  check('sliderCrank 滑块贴合导轨', maxLineError(w) < 1e-2, `${maxLineError(w).toExponential(2)}`);
  const B = nodeLabel(w, 'B');
  check('sliderCrank 滑块往复', Math.abs(B.x) > 0.05, `x=${B.x.toFixed(3)}`);
}

// 3. gear pair
{
  const w = make('gearPair');
  const base = gearC0(w);
  run(w, 3);
  check('gearPair 传动比守恒', maxGearErr(w, base) < 1e-6, `${maxGearErr(w, base).toExponential(2)}`);
  const gears = [...w.parts.values()].filter((p) => p.type === 'gear');
  check('gearPair 两轮反向', Math.sign(gears[0].angle) !== Math.sign(gears[1].angle), `a=${gears[0].angle.toFixed(2)} b=${gears[1].angle.toFixed(2)}`);
  const ratio = Math.abs(gears[0].angle / gears[1].angle);
  check('gearPair 传动比=r2/r1', Math.abs(ratio - gears[1].radius / gears[0].radius) < 1e-3, `i=${ratio.toFixed(4)}`);
}

// 4. internal mesh
{
  const w = make('internalMesh');
  const base = gearC0(w);
  run(w, 3);
  check('内啮合同心齿轮守恒', maxGearErr(w, base) < 1e-6, `${maxGearErr(w, base).toExponential(2)}`);
  const gears = [...w.parts.values()].filter((p) => p.type === 'gear');
  check('内啮合同向', Math.sign(gears[0].angle) === Math.sign(gears[1].angle), `a=${gears[0].angle.toFixed(2)} b=${gears[1].angle.toFixed(2)}`);
}

// 5. rack pinion
{
  const w = make('rackPinion');
  const base = gearC0(w);
  run(w, 3);
  check('rackPinion 齿条贴合导轨', maxLineError(w) < 1e-2, `${maxLineError(w).toExponential(2)}`);
  check('rackPinion 无齿轮冲突', maxGearErr(w, base) < 1e-6);
  const gear = byLabel(w, '小齿轮');
  const rack = byLabel(w, '齿条');
  const rn = w.node(rack.node);
  const pred = gear.radius * Math.abs(gear.angle);
  check('rackPinion 位移≈rθ', Math.abs(Math.abs(rn.x) - pred) < 0.2, `x=${rn.x.toFixed(3)} rθ=${pred.toFixed(3)}`);
}

// 6. planetary
{
  const w = make('planetary');
  const base = gearC0(w);
  run(w, 4);
  check('行星轮系啮合守恒', maxGearErr(w, base) < 1e-4, `${maxGearErr(w, base).toExponential(2)}`);
  const planet = byLabel(w, '行星轮');
  const ring = [...w.parts.values()].find((p) => p.internal);
  const sun = byLabel(w, '太阳轮');
  check('齿圈固定不动', Math.abs(ring.angle) < 1e-9, `θ=${ring.angle}`);
  check('行星轮已自转', Math.abs(planet.angle) > 0.1, `θ=${planet.angle.toFixed(3)}`);
  const S = nodeLabel(w, 'S');
  const P = nodeLabel(w, 'P');
  const carrier = Math.atan2(P.y - S.y, P.x - S.x);
  const iExpected = sun.radius / (sun.radius + ring.radius);
  const iActual = carrier / sun.angle;
  check('行星架转速=ω_s·rs/(rs+rr)', Math.abs(iActual - iExpected) < 1e-3, `i=${iActual.toFixed(4)} expect=${iExpected.toFixed(4)}`);
  check('行星轮中心半径=r_sun+r_planet', Math.abs(dist(S, P) - 3) < 1e-3, `r=${dist(S, P).toFixed(4)}`);
}

// 7. hover / force
{
  const w = make('hover');
  const before = [...w.nodes.values()].map((n) => ({ x: n.x, y: n.y }));
  run(w, 3);
  const after = [...w.nodes.values()].map((n) => ({ x: n.x, y: n.y }));
  let moved = 0;
  for (let i = 0; i < before.length; i++) moved += Math.hypot(after[i].x - before[i].x, after[i].y - before[i].y);
  check('悬浮机构受外力产生位移', moved > 0.5, `总位移=${moved.toFixed(2)}`);
  check('悬浮机构约束守恒', maxLinkError(w) < 2e-2, `${maxLinkError(w).toExponential(2)}`);

  // 长时间运行必须停留在视野内（不发散、不飘走）
  const w2 = make('hover');
  run(w2, 20);
  const peak = Math.max(...[...w2.nodes.values()].flatMap((n) => [Math.abs(n.x), Math.abs(n.y)]));
  check('悬浮机构长时间稳定不飘走', peak < 30, `peakCoord=${peak.toFixed(2)}`);
  check('悬浮机构未发散复位', w2.diverged === false);

  // 运行中拖拽也不得发散
  const w3 = make('hover');
  const free = [...w3.nodes.values()].filter((n) => !n.fixed);
  w3.drag = { targets: [{ id: free[0].id, x: free[0].x + 3, y: free[0].y + 3 }] };
  run(w3, 6);
  const peak3 = Math.max(...[...w3.nodes.values()].flatMap((n) => [Math.abs(n.x), Math.abs(n.y)]));
  check('悬浮机构运行中拖拽不发散', peak3 < 12, `peakCoord=${peak3.toFixed(2)}`);
}

// 7b. 发散兜底自动复位
{
  const w = make('fourbar');
  const n = [...w.nodes.values()][0];
  n.x = 1e9;
  w.step(1 / 60, false);
  check('越界自动复位', w.diverged === true && Math.abs(n.x) < 100, `x=${n.x.toFixed(3)} diverged=${w.diverged}`);
}

// 8. soft drag projection (paused)
{
  const w = make('fourbar');
  const A = nodeLabel(w, 'A');
  w.drag = { targets: [{ id: A.id, x: 1.1, y: 0.4 }] };
  for (let i = 0; i < 120; i++) w.step(1 / 60, false);
  w.drag = null;
  check('暂停拖曳后杆长仍守恒', maxLinkError(w) < 1e-2, `${maxLinkError(w).toExponential(2)}`);
  check('拖曳点收敛到目标附近', Math.hypot(A.x - 1.1, A.y - 0.4) < 0.2, `d=${Math.hypot(A.x - 1.1, A.y - 0.4).toFixed(3)}`);
  const B = nodeLabel(w, 'B');
  check('拖曳带动其它铰点', dist(A, B) > 0.5, `AB=${dist(A, B).toFixed(2)}`);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
