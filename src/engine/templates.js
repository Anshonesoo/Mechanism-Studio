import { World } from './world.js';
import { angleOf, intersectCircles, dist } from './math.js';
import { defaultProfile } from './profile.js';

const constProfile = (omega) => ({ ...defaultProfile('constant'), omega });
const sineProfile = (omega, amplitude, frequency) => ({
  ...defaultProfile('sine'),
  omega,
  amplitude,
  frequency,
});

function addCouplerPoint(world, aId, bId, along, off) {
  const a = world.node(aId);
  const b = world.node(bId);
  const ang = angleOf(a, b);
  const L = dist(a, b);
  return {
    x: a.x + Math.cos(ang) * L * along - Math.sin(ang) * off,
    y: a.y + Math.sin(ang) * L * along + Math.cos(ang) * off,
  };
}

function fourbar(world, opts = {}) {
  const flip = opts.flip ? -1 : 1;
  const ground = 4.2;
  const crank = 1.2;
  const couplerLen = 3.6;
  const rocker = 2.6;
  const o2 = world.addNode(0, 0, { fixed: true, label: 'O2' });
  const o4 = world.addNode(ground, 0, { fixed: true, label: 'O4' });
  const angle = opts.angle ?? Math.PI / 3;
  const A = world.addNode(o2.x + crank * Math.cos(angle), o2.y + crank * Math.sin(angle), { label: 'A' });
  const pts = intersectCircles({ x: o4.x, y: o4.y }, rocker, { x: A.x, y: A.y }, couplerLen);
  const B = pts.length
    ? world.addNode(pts[flip ? 1 : 0].x, pts[flip ? 1 : 0].y, { label: 'B' })
    : world.addNode(A.x + couplerLen * Math.cos(angle * 0.5), A.y + couplerLen, { label: 'B' });

  world.addLink(o2.id, o4.id, { label: '机架', color: '#8fa5a1', width: 0.15, zIndex: 6 });
  world.addLink(o2.id, A.id, { label: '曲柄', color: '#7fd1b9' });
  world.addLink(A.id, B.id, { label: '连杆', color: '#3d7fd6' });
  world.addLink(o4.id, B.id, { label: '摇杆', color: '#d98b00' });

  const cp = addCouplerPoint(world, A.id, B.id, 0.5, 0.9 * flip);
  const C = world.addNode(cp.x, cp.y, { label: 'C' });
  world.addLink(A.id, C.id, { label: '连杆', color: '#3d7fd6', width: 0.07, zIndex: 21 });
  world.addLink(B.id, C.id, { label: '连杆', color: '#3d7fd6', width: 0.07, zIndex: 21 });

  const motor = world.addMotor(A.id, o2.id, { profile: opts.profile || constProfile(1.6) });
  motor.label = '曲柄驱动';
  world.addTrace(C.id, { label: '连杆点轨迹' });
  return world;
}

function sliderCrank(world, opts = {}) {
  const crank = 1.2;
  const rod = 3.6;
  const o2 = world.addNode(0, 0, { fixed: true, label: 'O2' });
  const angle = opts.angle ?? Math.PI / 4;
  const A = world.addNode(o2.x + crank * Math.cos(angle), o2.y + crank * Math.sin(angle), { label: 'A' });
  const bx = A.x + Math.sqrt(Math.max(0.0001, rod * rod - A.y * A.y));
  const g1 = world.addNode(-4.5, 0, { fixed: true, label: 'G1' });
  const g2 = world.addNode(5.5, 0, { fixed: true, label: 'G2' });
  const B = world.addNode(bx, 0, { label: 'B' });
  const guide = world.addGuide(g1.id, g2.id, { label: '机架导轨' });
  world.addLink(o2.id, A.id, { label: '曲柄' });
  world.addLink(A.id, B.id, { label: '连杆', color: '#3d7fd6' });
  world.addSlider(B.id, guide.id, { label: '滑块' });
  const motor = world.addMotor(A.id, o2.id, { profile: opts.profile || constProfile(2.2) });
  motor.label = '曲柄驱动';
  world.addTrace(B.id, { label: '滑块行程' });
  return world;
}

function gearPair(world, opts = {}) {
  const r1 = opts.r1 ?? 1.6;
  const r2 = opts.r2 ?? 2.4;
  const teeth = (r) => Math.max(8, Math.round(r * 10));
  const c1 = world.addNode(-r1, 0, { fixed: true, label: 'O1' });
  const c2 = world.addNode(r2, 0, { fixed: true, label: 'O2' });
  const g1 = world.addGear(c1.id, { radius: r1, teeth: teeth(r1), label: '主动轮' });
  const g2 = world.addGear(c2.id, { radius: r2, teeth: teeth(r2), label: '从动轮' });
  world.addLink(c1.id, c2.id, { label: '中心距', color: '#8fa5a1', width: 0.09, zIndex: 5 });
  world.addGearPair(g1.id, g2.id, false);
  const m = world.addAngleMotor(g1.id, { profile: opts.profile || constProfile(1.3) });
  m.label = '主动轮驱动';
  return world;
}

function rackPinion(world, opts = {}) {
  const r = opts.radius ?? 1.2;
  const c = world.addNode(0, 0, { fixed: true, label: 'O' });
  const g1 = world.addGear(c.id, { radius: r, teeth: Math.max(8, Math.round(r * 10)), label: '小齿轮' });
  const g1n = world.addNode(-5, r, { fixed: true, label: 'G1' });
  const g2n = world.addNode(5, r, { fixed: true, label: 'G2' });
  const guide = world.addGuide(g1n.id, g2n.id, { label: '齿条导轨' });
  const rn = world.addNode(0, r, { label: 'R' });
  const rack = world.addRack(rn.id, guide.id, g1.id, { label: '齿条' });
  rack.sign = 1;
  const m = world.addAngleMotor(g1.id, { profile: opts.profile || constProfile(1.5) });
  m.label = '小齿轮驱动';
  world.addTrace(rn.id, { label: '齿条行程' });
  return world;
}

function planetary(world, opts = {}) {
  const rSun = 2.0;
  const rPlanet = 1.0;
  const rRing = rSun + rPlanet * 2;
  const S = world.addNode(0, 0, { fixed: true, label: 'S' });
  const P = world.addNode(rSun + rPlanet, 0, { label: 'P' });
  const sun = world.addGear(S.id, { radius: rSun, teeth: 24, label: '太阳轮' });
  const planet = world.addGear(P.id, { radius: rPlanet, teeth: 12, label: '行星轮' });
  const ring = world.addGear(S.id, { radius: rRing, teeth: 48, internal: true, fixedAngle: true, label: '齿圈(固定)' });
  world.addLink(S.id, P.id, { label: '行星架', color: '#d98b00', width: 0.10, zIndex: 6 });
  world.addGearPair(sun.id, planet.id, false);
  world.addGearPair(planet.id, ring.id, true);
  const m = world.addAngleMotor(sun.id, { profile: opts.profile || constProfile(1.2) });
  m.label = '太阳轮驱动';
  world.addTrace(P.id, { label: '行星轮中心轨迹' });
  return world;
}

function internalMesh(world, opts = {}) {
  const c = world.addNode(0, 0, { fixed: true, label: 'O' });
  const pinion = world.addGear(c.id, { radius: 1.4, teeth: 14, label: '小齿轮' });
  const ring = world.addGear(c.id, { radius: 3.4, teeth: 34, internal: true, label: '内齿圈' });
  world.addGearPair(pinion.id, ring.id, true);
  const m = world.addAngleMotor(pinion.id, { profile: opts.profile || constProfile(1.6) });
  m.label = '小齿轮驱动';
  return world;
}

function hoverFourbar(world, opts = {}) {
  const ground = 3.4;
  const crank = 1.1;
  const couplerLen = 3.0;
  const rocker = 2.2;
  const o2 = world.addNode(0, 0, { label: 'O2' });
  const o4 = world.addNode(ground, 0, { label: 'O4' });
  const A = world.addNode(crank * Math.cos(Math.PI / 3), crank * Math.sin(Math.PI / 3), { label: 'A' });
  const pts = intersectCircles({ x: o4.x, y: o4.y }, rocker, { x: A.x, y: A.y }, couplerLen);
  const B = world.addNode(pts[0].x, pts[0].y, { label: 'B' });
  world.addLink(o2.id, o4.id, { label: '机架', color: '#8fa5a1', width: 0.15, zIndex: 6 });
  world.addLink(o2.id, A.id, { label: '曲柄' });
  world.addLink(A.id, B.id, { label: '连杆', color: '#3d7fd6' });
  world.addLink(o4.id, B.id, { label: '摇杆', color: '#d98b00' });
  const motor = world.addMotor(A.id, o2.id, { profile: sineProfile(1.4, 1.0, 0.45) });
  motor.label = '变速驱动';

  const bobX = '6*sin(2*pi*0.22*t)';
  const bobY = '-3*sin(2*pi*0.22*t)';
  for (const n of [o2, o4]) {
    const f = world.addForce(n.id, 0, 0, { label: '悬浮外力' });
    f.exprX = bobX;
    f.exprY = bobY;
  }

  world.settings.gravity = { x: 0, y: 0 };
  world.settings.damping = 1.1;
  world.addTrace(B.id, { label: '摇杆端轨迹' });
  return world;
}

export const TEMPLATES = [
  { id: 'fourbar', name: '四杆机构', icon: '▱', desc: '曲柄摇杆 + 连杆点轨迹，可拖曳或匀速/变速驱动。', build: fourbar },
  { id: 'sliderCrank', name: '曲柄滑块', icon: '▭', desc: '曲柄 + 连杆 + 滑块套筒导轨，滑块往复运动。', build: sliderCrank },
  { id: 'gearPair', name: '齿轮副', icon: '⚙', desc: '外啮合定轴齿轮，传动比由节圆半径决定。', build: gearPair },
  { id: 'internalMesh', name: '内啮合齿轮', icon: '◉', desc: '小齿轮与内齿圈同向啮合。', build: internalMesh },
  { id: 'rackPinion', name: '齿轮齿条', icon: '≡', desc: '旋转运动转换为直线运动。', build: rackPinion },
  { id: 'planetary', name: '行星轮系', icon: '✳', desc: '太阳轮 + 行星轮 + 固定齿圈 + 行星架。', build: planetary },
  { id: 'hover', name: '悬浮机构', icon: '☁', desc: '无重力 + 外力牵引，整机悬浮漂移并变速运转。', build: hoverFourbar },
];

/* ------------------------------------------------------------------ */
/*  L2D 模式：骨架模板（骨骼就是连杆，图片绑到骨骼上跟随运动）           */
/* ------------------------------------------------------------------ */

const BONE_COLOR = '#8fa5a1';

function chain(world, opts = {}) {
  const root = world.addNode(0, 0, { fixed: opts.fixed !== false, label: '根' });
  let prev = root;
  const n = opts.segments ?? 4;
  for (let i = 1; i <= n; i++) {
    const node = world.addNode(i * 0.28, i * 1.15, { label: `骨${i}` });
    world.addLink(prev.id, node.id, { label: `第${i}节`, color: BONE_COLOR, width: 0.07 });
    prev = node;
  }
  return world;
}

function humanoid(world) {
  const bone = (a, b, label) => world.addLink(a.id, b.id, { label, color: BONE_COLOR, width: 0.07 });
  const hip = world.addNode(0, 0, { fixed: true, label: '髋' });
  const chest = world.addNode(0, -1.7, { label: '胸' });
  const head = world.addNode(0, -3.0, { label: '头' });
  const shL = world.addNode(-0.8, -2.35, { label: '左肩' });
  const elL = world.addNode(-1.8, -1.05, { label: '左肘' });
  const haL = world.addNode(-2.3, 0.25, { label: '左手' });
  const shR = world.addNode(0.8, -2.35, { label: '右肩' });
  const elR = world.addNode(1.8, -1.05, { label: '右肘' });
  const haR = world.addNode(2.3, 0.25, { label: '右手' });
  const knL = world.addNode(-0.5, 1.7, { label: '左膝' });
  const ftL = world.addNode(-0.5, 3.25, { label: '左脚' });
  const knR = world.addNode(0.5, 1.7, { label: '右膝' });
  const ftR = world.addNode(0.5, 3.25, { label: '右脚' });
  bone(hip, chest, '躯干');
  bone(chest, head, '脖子');
  bone(chest, shL, '左上臂');
  bone(shL, elL, '左小臂');
  bone(elL, haL, '左手');
  bone(chest, shR, '右上臂');
  bone(shR, elR, '右小臂');
  bone(elR, haR, '右手');
  bone(hip, knL, '左大腿');
  bone(knL, ftL, '左小腿');
  bone(hip, knR, '右大腿');
  bone(knR, ftR, '右小腿');
  return world;
}

function emptyRig(world) {
  world.addNode(0, 0, { fixed: true, label: '根' });
  return world;
}

export const L2D_TEMPLATES = [
  { id: 'humanoid', name: '人形骨架', icon: '🧍', desc: '13 个关节的全身骨架，给每根骨头绑一张切片图。', build: humanoid },
  { id: 'chain', name: '链式骨架', icon: '〰', desc: '根 + 4 节链条，适合尾巴 / 手臂 / 飘带。', build: chain },
  { id: 'emptyRig', name: '空白骨架', icon: '⬤', desc: '只有一个根节点，自己从零画骨骼。', build: emptyRig },
];

export function modeTemplates(mode) {
  return mode === 'l2d' ? L2D_TEMPLATES : TEMPLATES;
}

export function defaultTemplate(mode) {
  return mode === 'l2d' ? 'humanoid' : 'fourbar';
}

function findPreset(id) {
  return TEMPLATES.find((t) => t.id === id) || L2D_TEMPLATES.find((t) => t.id === id);
}

export function applyTemplate(world, id, opts = {}) {
  const preset = findPreset(id) || TEMPLATES[0];
  world.clear();
  preset.build(world, opts);
  world.build();
  world.captureInitial();
  return world;
}

export function createWorldFromTemplate(id, opts = {}) {
  const world = new World();
  applyTemplate(world, id, opts);
  return world;
}

export { fourbar, sliderCrank, gearPair, planetary, rackPinion, internalMesh, hoverFourbar, humanoid, chain, emptyRig };
