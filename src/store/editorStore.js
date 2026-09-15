import { create } from 'zustand';
import { World, syncIdCounter } from '../engine/world.js';
import { applyTemplate, modeTemplates, defaultTemplate } from '../engine/templates.js';
import { serialize, restore, toFile, fromFile, clone } from '../io/serialize.js';
import { defaultProfile } from '../engine/profile.js';
import { dist } from '../engine/math.js';
import { rotateNodes, scaleNodes, translateNodes, pivotOf } from '../engine/rig.js';
import {
  BLOCK_SPECS,
  cloneBlocks,
  createVm,
  demoScript,
  findBlock,
  isContainer,
  newBlock,
  startVm,
  stepVm,
  stopVm,
} from '../engine/script.js';

const scriptVm = createVm();

const TOUR_KEY = 'mechanism-studio-tour-done';

function readTourDone() {
  try {
    return window.localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return false;
  }
}

function initialMode() {
  try {
    const m = new URLSearchParams(window.location.search).get('mode');
    return m === 'l2d' ? 'l2d' : 'mechanism';
  } catch {
    return 'mechanism';
  }
}

function initialTourOpen() {
  try {
    if (new URLSearchParams(window.location.search).get('tour') === '0') return false;
  } catch {
    /* ignore */
  }
  return !readTourDone();
}

const world = new World();
const MODE = initialMode();
const initialTemplate = (() => {
  try {
    const id = new URLSearchParams(window.location.search).get('template');
    const ok = modeTemplates(MODE).some((t) => t.id === id);
    return ok ? id : defaultTemplate(MODE);
  } catch {
    return defaultTemplate(MODE);
  }
})();
applyTemplate(world, initialTemplate);

export const viewportApi = { frameAll: null, resetView: null, zoomBy: null };

const fileToDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function targetWidth(w, targetId) {
  const part = w.parts.get(targetId);
  if (!part) return 2;
  if (part.type === 'link') return Math.max(0.4, dist(w.node(part.a), w.node(part.b)));
  if (part.type === 'gear') return part.radius * 2;
  if (part.type === 'slider') return (part.width ?? 0.9) * 1.2;
  if (part.type === 'rack') return 3;
  if (part.type === 'guide') return dist(w.node(part.a), w.node(part.b));
  return 2;
}

function findTrace(w, nodeId) {
  for (const p of w.parts.values()) if (p.type === 'trace' && p.node === nodeId) return p;
  return null;
}

export const useEditor = create((set, get) => ({
  world,
  rev: 0,
  mode: MODE,
  tool: MODE === 'l2d' ? 'pose' : 'select',
  selection: null,
  hover: null,
  running: false,
  timeScale: 1,
  showGrid: true,
  snap: true,
  gridStep: 0.25,
  visibilityMode: 'all',
  pairInternal: false,
  gearRadius: 1.4,
  pending: null,
  history: [],
  future: [],
  tourOpen: initialTourOpen(),
  showScript: (() => {
    try {
      return new URLSearchParams(window.location.search).get('script') === '1';
    } catch {
      return false;
    }
  })(),
  script: { blocks: demoScript(MODE) },
  scriptRunning: false,
  selectedBlockId: null,
  rig: { pivotId: null, angleDeg: 0, scale: 1, tx: 0, ty: 0, swayAmp: 0, swayFreq: 0.45 },
  status: MODE === 'l2d' ? '拖骨骼摆姿势 · 右键绑定图片' : '拖曳铰点即可运动 · 选模板快速开始',

  bump: () => set((s) => ({ rev: s.rev + 1 })),
  setStatus: (status) => set({ status }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),
  setVisibilityMode: (visibilityMode) => set({ visibilityMode }),
  setPairInternal: (pairInternal) => set({ pairInternal }),
  setGearRadius: (gearRadius) => set({ gearRadius: Math.max(0.2, gearRadius) }),

  setMode: (mode) => {
    if (mode === get().mode) return;
    const s = get();
    s.pushHistory();
    applyTemplate(s.world, defaultTemplate(mode));
    set((st) => ({
      mode,
      rev: st.rev + 1,
      tool: mode === 'l2d' ? 'pose' : 'select',
      selection: null,
      hover: null,
      running: false,
      pending: null,
      visibilityMode: 'all',
      rig: { pivotId: null, angleDeg: 0, scale: 1, tx: 0, ty: 0, swayAmp: 0, swayFreq: 0.45 },
      script: { blocks: s.script.blocks.length ? s.script.blocks : demoScript(mode) },
      scriptRunning: false,
      selectedBlockId: null,
      status: mode === 'l2d' ? '拖骨骼摆姿势，右侧调动作参数' : '拖曳铰点即可运动',
    }));
    stopVm(scriptVm);
    viewportApi.frameAll?.();
  },

  setRig: (patch) => set((s) => ({ rig: { ...s.rig, ...patch } })),

  rigPivot: () => {
    const { world: w, rig } = get();
    if (rig.pivotId) {
      const n = w.node(rig.pivotId);
      if (n) return n;
    }
    for (const n of w.nodes.values()) if (n.fixed) return n;
    const b = w.bounds();
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  },

  rotateRig: (deltaRad) => {
    if (!deltaRad) return;
    const s = get();
    rotateNodes(s.world, s.rigPivot(), deltaRad);
    set((st) => ({ rev: st.rev + 1 }));
  },

  scaleRig: (factor) => {
    if (!factor || factor === 1) return;
    const s = get();
    scaleNodes(s.world, s.rigPivot(), factor);
    set((st) => ({ rev: st.rev + 1 }));
  },

  translateRig: (dx, dy) => {
    if (!dx && !dy) return;
    const s = get();
    translateNodes(s.world, dx, dy);
    set((st) => ({ rev: st.rev + 1 }));
  },

  resetPose: () => {
    const s = get();
    s.world.reset();
    s.world.build();
    set((st) => ({
      rev: st.rev + 1,
      running: false,
      rig: { ...st.rig, angleDeg: 0, scale: 1, tx: 0, ty: 0 },
      status: '姿势已复位',
    }));
  },

  setPivotFromSelection: () => {
    const { selection, world: w } = get();
    if (selection?.type !== 'node' || !w.node(selection.id)) {
      set({ status: '先选一个铰点作为根节点' });
      return;
    }
    set((s) => ({ rig: { ...s.rig, pivotId: selection.id }, status: `根节点已设为 ${selection.id}` }));
  },

  openTour: () => set({ tourOpen: true }),
  closeTour: () => set({ tourOpen: false }),
  toggleScript: () => set((s) => ({ showScript: !s.showScript })),
  disableTour: () => {
    try {
      window.localStorage.setItem(TOUR_KEY, '1');
    } catch {
      /* ignore */
    }
    set({ tourOpen: false, status: '已关闭新手引导，点右上角 ? 可再看' });
  },

  setTool: (tool) => set({ tool, pending: null, status: toolHint(tool) }),
  select: (selection) => set({ selection, pending: null }),
  setHover: (hover) => {
    const cur = get().hover;
    if ((cur?.id || null) === (hover?.id || null)) return;
    set({ hover });
  },
  setPending: (pending) => set({ pending }),

  getSelected: () => {
    const { world: w, selection } = get();
    if (!selection) return null;
    if (selection.type === 'node') return w.node(selection.id) || null;
    if (selection.type === 'sprite') return w.sprites.get(selection.id) || null;
    return w.parts.get(selection.id) || null;
  },

  pushHistory: () => {
    const s = get();
    set({ history: [...s.history, serialize(s.world)].slice(-80), future: [] });
  },

  commit: (fn, opts = {}) => {
    const s = get();
    if (opts.history !== false) s.pushHistory();
    fn(s.world);
    s.world.build();
    syncIdCounter(s.world);
    set((st) => ({ rev: st.rev + 1 }));
  },

  loadTemplate: (id) => {
    const s = get();
    s.pushHistory();
    applyTemplate(s.world, id);
    set((st) => ({
      rev: st.rev + 1,
      selection: null,
      running: false,
      pending: null,
      rig: { ...st.rig, pivotId: null, angleDeg: 0, scale: 1, tx: 0, ty: 0 },
      status: '已载入模板，按空格播放',
    }));
    viewportApi.frameAll?.();
  },

  toggleRun: () => {
    const running = !get().running;
    set({ running, status: running ? '播放中…' : '已暂停' });
  },
  setRunning: (running) => set({ running }),
  stepOnce: () => {
    get().world.step(1 / 60, true);
    set((s) => ({ rev: s.rev + 1, running: false }));
  },
  resetSim: () => {
    get().world.reset();
    set((s) => ({ rev: s.rev + 1, running: false, status: '已复位' }));
  },
  setTimeScale: (timeScale) => set({ timeScale }),
  setPendingLive: (pending) => set({ pending }),

  undo: () => {
    const s = get();
    if (!s.history.length) return;
    const prev = s.history[s.history.length - 1];
    const cur = serialize(s.world);
    restore(s.world, prev);
    set((st) => ({
      history: st.history.slice(0, -1),
      future: [cur, ...st.future].slice(0, 80),
      rev: st.rev + 1,
      selection: null,
      status: '撤销',
    }));
  },

  redo: () => {
    const s = get();
    if (!s.future.length) return;
    const next = s.future[0];
    const cur = serialize(s.world);
    restore(s.world, next);
    set((st) => ({
      future: st.future.slice(1),
      history: [...st.history, cur].slice(-80),
      rev: st.rev + 1,
      selection: null,
      status: '重做',
    }));
  },

  deleteSelection: () => {
    const { selection } = get();
    if (!selection) return;
    if (selection.type === 'sprite') {
      get().removeSprite(selection.id);
      return;
    }
    get().commit((w) => w.remove(selection.id));
    set({ selection: null, status: '已删除' });
  },

  updateNode: (id, patch) => {
    get().commit((w) => {
      const n = w.node(id);
      if (!n) return;
      Object.assign(n, patch);
      if ('fixed' in patch) {
        n.mass = patch.fixed ? 0 : 1;
        n.invMass = patch.fixed ? 0 : 1;
        n.vx = 0;
        n.vy = 0;
      }
      if ('x' in patch || 'y' in patch) {
        n.px = n.x;
        n.py = n.y;
      }
    });
  },

  patchNodeLive: (id, patch) => {
    const n = get().world.node(id);
    if (!n) return;
    Object.assign(n, patch);
    set((s) => ({ rev: s.rev + 1 }));
  },

  updatePart: (id, patch) => {
    get().commit((w) => {
      const p = w.parts.get(id);
      if (!p) return;
      const angle = 'angle' in patch;
      Object.assign(p, patch);
      if (p.type === 'gear') {
        p.invInertia = p.fixedAngle ? 0 : 1 / (p.inertia || p.radius * p.radius * 0.5);
      }
      if (p.type === 'link' && 'rest' in patch) {
        const a = w.node(p.a);
        const b = w.node(p.b);
        const cur = dist(a, b);
        const dir = { x: (b.x - a.x) / (cur || 1), y: (b.y - a.y) / (cur || 1) };
        const target = Math.max(1e-4, p.rest);
        b.x = a.x + dir.x * target;
        b.y = a.y + dir.y * target;
        b.px = b.x;
        b.py = b.y;
      }
      if (angle && p.type === 'gear') {
        p.driven = true;
        w.constraints.forEach((c) => {
          if (c.ga === p) c.a0 = p.angle;
          if (c.gb === p) c.b0 = p.angle;
        });
      }
    });
  },

  patchLive: (id, patch, kind = 'part') => {
    const w = get().world;
    const target = kind === 'part' ? w.parts.get(id) : kind === 'sprite' ? w.sprites.get(id) : w.node(id);
    if (!target) return;
    Object.assign(target, patch);
    set((s) => ({ rev: s.rev + 1 }));
  },

  commitLive: () => {
    const s = get();
    s.world.build();
    set((st) => ({ rev: st.rev + 1 }));
  },

  setGearSize: (id, radius) => {
    get().commit((w) => {
      const g = w.parts.get(id);
      if (!g || g.type !== 'gear') return;
      const r = Math.max(0.2, radius);
      g.radius = r;
      g.teeth = Math.max(8, Math.round(r * 10));
      g.inertia = r * r * 0.5;
      g.invInertia = g.fixedAngle ? 0 : 1 / g.inertia;
    });
  },

  setLinkLength: (id, rest) => get().updatePart(id, { rest }),

  setForce: (id, magnitude, angleRad) => {
    const m = Math.max(0, magnitude);
    get().patchLive(id, { fx: m * Math.cos(angleRad), fy: m * Math.sin(angleRad), exprX: null, exprY: null });
  },

  setForceExpr: (id, exprX, exprY) => {
    get().patchLive(id, { exprX: exprX || null, exprY: exprY || null });
  },

  setNodeTrace: (nodeId, on) => {
    get().commit((w) => {
      const existing = findTrace(w, nodeId);
      if (on && !existing) w.addTrace(nodeId);
      if (!on && existing) w.parts.delete(existing.id);
    });
  },

  updateSprite: (id, patch) => {
    const sp = get().world.sprites.get(id);
    if (!sp) return;
    Object.assign(sp, patch);
    set((s) => ({ rev: s.rev + 1 }));
  },

  removeSprite: (id) => {
    get().world.sprites.delete(id);
    set((s) => ({ rev: s.rev + 1, selection: null, status: '已移除图像' }));
  },

  bindSprite: async (file, targetId) => {
    const src = await fileToDataURL(file);
    const w = get().world;
    const img = await new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
    const iw = img?.naturalWidth || 300;
    const ih = img?.naturalHeight || 300;
    const tw = targetWidth(w, targetId);
    const scale = tw / iw;
    const part = w.parts.get(targetId);
    const offsetX = part && part.type === 'link' ? dist(w.node(part.a), w.node(part.b)) / 2 : 0;
    let createdId = null;
    get().commit((ww) => {
      const sprite = ww.addSprite(targetId, src, { name: file.name, scale, width: iw, height: ih, offsetX });
      createdId = sprite.id;
    });
    set({
      selection: createdId ? { type: 'sprite', id: createdId } : null,
      status: '已绑定图像到部件',
    });
  },

  autoMeshGear: (gearId) => {
    get().commit((w) => {
      const g = w.parts.get(gearId);
      if (!g || g.type !== 'gear') return;
      const c = w.node(g.center);
      if (!c) return;
      const paired = new Set();
      for (const p of w.parts.values()) {
        if (p.type === 'gearPair' && (p.a === g.id || p.b === g.id)) paired.add(p.a === g.id ? p.b : p.a);
      }
      let added = 0;
      for (const other of [...w.parts.values()]) {
        if (other.type !== 'gear' || other.id === g.id || paired.has(other.id)) continue;
        const oc = w.node(other.center);
        if (!oc) continue;
        const d = dist(c, oc);
        const tol = Math.min(g.radius, other.radius) * 0.3;
        if (Math.abs(d - (g.radius + other.radius)) < tol) {
          w.addGearPair(g.id, other.id, false);
          added++;
        } else if (Math.abs(d - Math.abs(g.radius - other.radius)) < tol) {
          w.addGearPair(g.id, other.id, true);
          added++;
        }
      }
      set({ status: added ? `已自动啮合 ${added} 对齿轮` : '附近没有可啮合的齿轮' });
    });
  },

  addGear: (centerId, radius) => {
    let gid = null;
    get().commit((w) => {
      const teeth = Math.max(9, Math.round(radius * 10));
      const g = w.addGear(centerId, { radius, teeth });
      gid = g.id;
    });
    if (gid) {
      get().autoMeshGear(gid);
      set({ selection: { type: 'part', id: gid } });
    }
  },

  addSliderOnGuide: (guideId, point) => {
    get().commit((w) => {
      const n = w.addNode(point.x, point.y, { label: 'B' });
      const s = w.addSlider(n.id, guideId);
      set({ selection: { type: 'part', id: s.id } });
    });
  },

  addRackOnGuide: (guideId, gearId, point) => {
    get().commit((w) => {
      const n = w.addNode(point.x, point.y, { label: 'R' });
      const r = w.addRack(n.id, guideId, gearId);
      set({ selection: { type: 'part', id: r.id } });
    });
  },

  addGearPair: (aId, bId, internal) => {
    get().commit((w) => {
      const p = w.addGearPair(aId, bId, internal);
      set({ selection: { type: 'part', id: p.id } });
    });
  },

  addMotor: (nodeId, centerId, preset = 'constant') => {
    get().commit((w) => {
      const m = w.addMotor(nodeId, centerId, { profile: defaultProfile(preset) });
      set({ selection: { type: 'part', id: m.id } });
    });
  },

  addAngleMotor: (gearId, preset = 'constant') => {
    get().commit((w) => {
      const m = w.addAngleMotor(gearId, { profile: defaultProfile(preset) });
      set({ selection: { type: 'part', id: m.id } });
    });
  },

  setMotorSpin: (id, omega, kind = 'motor') => {
    get().commit((w) => {
      const p = w.parts.get(id);
      if (!p) return;
      p.profile = { ...(p.profile || defaultProfile('constant')), preset: kind, omega };
    });
  },

  addForceTo: (targetId) => {
    get().commit((w) => {
      const f = w.addForce(`p:${targetId}`, 5, 0);
      set({ selection: { type: 'part', id: f.id } });
    });
  },

  addTraceTo: (nodeId) => {
    get().commit((w) => {
      const t = w.addTrace(nodeId);
      set({ selection: { type: 'part', id: t.id } });
    });
  },

  clearTraces: () => {
    get().world.clearTraces();
    set((s) => ({ rev: s.rev + 1, status: '已清空轨迹' }));
  },

  exportJSON: () => {
    toFile(get().world, 'mechanism.json');
    set({ status: '已导出' });
  },

  importJSON: async (file) => {
    try {
      const data = await fromFile(file);
      const s = get();
      s.pushHistory();
      restore(s.world, data);
      set((st) => ({ rev: st.rev + 1, selection: null, running: false, status: '已导入' }));
      viewportApi.frameAll?.();
    } catch {
      set({ status: '导入失败：文件格式不正确' });
    }
  },

  duplicatePoseSnapshot: () => clone(get().world.snapshotPose()),

  /* --------------------------- Scratch 式积木编排 --------------------------- */

  patchScript: (fn) => {
    const s = get();
    const next = cloneBlocks(s.script.blocks);
    fn(next);
    set({ script: { blocks: next }, scriptDirty: (s.scriptDirty || 0) + 1, rev: s.rev + 1 });
  },

  addBlock: (type) => {
    const s = get();
    if (!BLOCK_SPECS[type]) return;
    s.pushHistory();
    const block = newBlock(type);
    let inserted = false;
    get().patchScript((blocks) => {
      const root = blocks;
      if (type === 'whenRun') {
        root.unshift(block);
        inserted = true;
        return;
      }
      const sel = s.selectedBlockId ? findBlock(root, s.selectedBlockId) : null;
      if (sel && isContainer(sel.block.type)) {
        sel.block.children.push(block);
        inserted = true;
        return;
      }
      if (sel) {
        const idx = sel.list.indexOf(sel.block);
        sel.list.splice(idx + 1, 0, block);
        inserted = true;
        return;
      }
      const hatIdx = root.findIndex((b) => b.type === 'whenRun');
      root.splice(hatIdx >= 0 ? hatIdx + 1 : 0, 0, block);
      inserted = true;
    });
    if (inserted) set({ selectedBlockId: block.id, status: '已加入积木' });
  },

  removeBlock: (id) => {
    get().pushHistory();
    get().patchScript((blocks) => {
      const found = findBlock(blocks, id);
      if (!found) return;
      found.list.splice(found.list.indexOf(found.block), 1);
    });
    set((s) => ({ selectedBlockId: s.selectedBlockId === id ? null : s.selectedBlockId }));
  },

  moveBlock: (id, dir) => {
    get().patchScript((blocks) => {
      const found = findBlock(blocks, id);
      if (!found) return;
      const i = found.list.indexOf(found.block);
      const j = i + dir;
      if (j < 0 || j >= found.list.length) return;
      if (found.list[j].type === 'whenRun') return;
      const [b] = found.list.splice(i, 1);
      found.list.splice(j, 0, b);
    });
  },

  patchBlockParams: (id, patch) => {
    get().patchScript((blocks) => {
      const found = findBlock(blocks, id);
      if (!found) return;
      found.block.params = { ...found.block.params, ...patch };
    });
  },

  setSelectedBlock: (selectedBlockId) => set({ selectedBlockId }),

  clearScript: () => {
    get().pushHistory();
    set({ script: { blocks: [] }, selectedBlockId: null, status: '脚本已清空' });
  },

  loadDemoScript: () => {
    get().pushHistory();
    set((s) => ({ script: { blocks: demoScript(s.mode) }, selectedBlockId: null, status: '已载入示例脚本' }));
  },

  runScript: () => {
    stopVm(scriptVm);
    startVm(scriptVm, cloneBlocks(get().script.blocks));
    set((s) => ({ scriptRunning: true, running: true, status: '脚本运行中…', rev: s.rev + 1 }));
  },

  stopScript: () => {
    stopVm(scriptVm);
    set({ scriptRunning: false, status: '脚本已停止' });
  },

  tickScript: (dt) => {
    const s = get();
    if (!s.scriptRunning) return;
    const pending = [];
    stepVm(
      scriptVm,
      {
        world: s.world,
        rig: () => get().rig,
        pendingRig: (patch) => pending.push(patch),
        flush: () => {
          if (pending.length) {
            const merged = Object.assign({}, ...pending);
            pending.length = 0;
            get().setRig(merged);
          }
          get().bump();
        },
        actions: {
          setVisibilityMode: (m) => get().setVisibilityMode(m),
          bump: () => get().bump(),
          setRig: (p) => get().setRig(p),
          resetPose: () => get().resetPose(),
          setSpinResolved: (id, o) => get().setSpinResolved(id, o),
          setForceResolved: (id, m, d) => get().setForceResolved(id, m, d),
        },
      },
      dt,
    );
    if (!scriptVm.running) set({ scriptRunning: false, status: '脚本执行完毕' });
  },

  setSpinResolved: (partId, omega) => {
    const w = get().world;
    const part = w.parts.get(partId);
    if (!part) {
      set({ status: '这块积木还没选部件' });
      return;
    }
    let motor = null;
    if (part.type === 'motor' || part.type === 'angleMotor') motor = part;
    else {
      for (const p of w.parts.values()) {
        if (p.type === 'motor' && (p.node === partId || p.center === partId)) {
          motor = p;
          break;
        }
        if (p.type === 'angleMotor' && p.gear === partId) {
          motor = p;
          break;
        }
      }
      if (!motor) {
        if (part.type === 'gear') {
          motor = w.addAngleMotor(part.id, { profile: { ...defaultProfile('constant'), omega } });
          w.build();
        } else if (part.type === 'link') {
          const a = w.node(part.a);
          const b = w.node(part.b);
          const anchor = a && a.fixed ? a : b && b.fixed ? b : null;
          if (anchor) {
            const other = anchor === a ? b : a;
            motor = w.addMotor(other.id, anchor.id, { profile: { ...defaultProfile('constant'), omega } });
            w.build();
          }
        }
      }
    }
    if (!motor) {
      set({ status: '这个部件没有可驱动的关节' });
      return;
    }
    const preset = motor.profile?.preset === 'sine' ? 'sine' : 'constant';
    motor.profile = { ...(motor.profile || defaultProfile('constant')), preset, omega };
    set((s) => ({ rev: s.rev + 1, status: '转速已更新' }));
  },

  setForceResolved: (partId, mag, deg) => {
    const w = get().world;
    if (!partId || (!w.parts.has(partId) && !w.nodes.has(partId))) {
      set({ status: '这块积木还没选部件' });
      return;
    }
    const target = w.nodes.has(partId) ? `n:${partId}` : `p:${partId}`;
    const rad = (deg * Math.PI) / 180;
    const fx = mag * Math.cos(rad);
    const fy = mag * Math.sin(rad);
    let force = null;
    for (const p of w.parts.values()) {
      if (p.type === 'force' && p.target === target) {
        force = p;
        break;
      }
    }
    if (force) {
      force.fx = fx;
      force.fy = fy;
      force.exprX = null;
      force.exprY = null;
    } else {
      w.addForce(target, fx, fy);
      w.build();
    }
    set((s) => ({ rev: s.rev + 1 }));
  },
}));

function toolHint(tool) {
  switch (tool) {
    case 'select':
      return '拖铰点或部件即可运动；点选后可改属性';
    case 'node':
      return '点空白放置铰点；点已有铰点切换固定/自由';
    case 'link':
      return '依次点两个铰点连线';
    case 'gear':
      return '按住并拖动确定齿轮大小；靠近别的齿轮会自动啮合';
    case 'guide':
      return '依次点两点生成导轨';
    case 'slider':
      return '点导轨放置滑块';
    case 'rack':
      return '先选中齿轮，再点导轨放齿条';
    case 'motor':
      return '先点动铰点，再点中心铰点';
    case 'force':
      return '点一个部件施加外力，用右侧进度条调大小和方向';
    case 'pose':
      return '拖动关节摆姿势，子骨骼会跟着动';
    case 'bone':
      return '依次点两个关节连成一根骨头';
    case 'bind':
      return '点一根骨骼，选择图片绑定上去';
    case 'root':
      return '点一个关节，把它设为整机的旋转中心';
    default:
      return '';
  }
}

export { toolHint };
