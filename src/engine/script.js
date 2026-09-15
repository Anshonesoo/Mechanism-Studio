import { rotateNodes, scaleNodes, translateNodes, pivotOf } from './rig.js';

let SID = 1;
const nextId = () => `blk${SID++}`;

export const CATEGORIES = [
  { id: 'event', label: '事件', color: '#e0a63c' },
  { id: 'control', label: '控制', color: '#d69a2f' },
  { id: 'look', label: '外观', color: '#8b5cf6' },
  { id: 'motion', label: '机构', color: '#0e9f9f' },
  { id: 'rig', label: '动作', color: '#22a06b' },
];

const T = (text) => ({ kind: 'text', text });
const N = (key, def, extra = {}) => ({ kind: 'number', key, def, step: 0.1, ...extra });
const S = (key, def, options) => ({ kind: 'select', key, def, options });
const PART = (key) => ({ kind: 'part', key });

export const BLOCK_SPECS = {
  whenRun: { cat: 'event', hat: true, parts: [T('当'), { kind: 'flag' }, T('被点击')] },
  wait: { cat: 'control', parts: [T('等待'), N('sec', 0.5, { min: 0.05, max: 30, step: 0.05 }), T('秒')] },
  repeat: {
    cat: 'control',
    container: true,
    parts: [T('重复'), N('times', 3, { min: 1, max: 99, step: 1 }), T('次')],
  },
  forever: { cat: 'control', container: true, parts: [T('一直重复')] },
  setView: {
    cat: 'look',
    parts: [
      T('显示切换为'),
      S('view', 'all', [
        ['all', '全部'],
        ['parts', '仅构件'],
        ['sprites', '仅图像'],
      ]),
    ],
  },
  showPart: {
    cat: 'look',
    parts: [
      S('action', 'hide', [
        ['hide', '隐藏'],
        ['show', '显示'],
      ]),
      PART('part'),
    ],
  },
  setSpin: {
    cat: 'motion',
    parts: [T('把'), PART('part'), T('转速设为'), N('omega', 2, { min: -8, max: 8 }), T('rad/s')],
  },
  setForce: {
    cat: 'motion',
    parts: [
      T('给'),
      PART('part'),
      T('加外力 大小'),
      N('mag', 5, { min: 0, max: 20 }),
      T('方向'),
      N('deg', 0, { min: -180, max: 180, step: 5 }),
      T('°'),
    ],
  },
  rotateTo: {
    cat: 'rig',
    parts: [
      T('整体旋转到'),
      N('deg', 15, { min: -45, max: 45, step: 1 }),
      T('° 耗时'),
      N('dur', 1, { min: 0.1, max: 10, step: 0.1 }),
      T('秒'),
    ],
  },
  scaleTo: {
    cat: 'rig',
    parts: [
      T('整体大小到'),
      N('scale', 1, { min: 0.3, max: 2, step: 0.01 }),
      T('耗时'),
      N('dur', 1, { min: 0.1, max: 10, step: 0.1 }),
      T('秒'),
    ],
  },
  moveTo: {
    cat: 'rig',
    parts: [
      T('整体移动到 x'),
      N('x', 0, { min: -4, max: 4 }),
      T('y'),
      N('y', 0, { min: -4, max: 4 }),
      T('耗时'),
      N('dur', 1, { min: 0.1, max: 10, step: 0.1 }),
      T('秒'),
    ],
  },
  setSway: {
    cat: 'rig',
    parts: [
      T('摇摆 幅度'),
      N('amp', 8, { min: 0, max: 15, step: 0.5 }),
      T('° 速度'),
      N('freq', 0.5, { min: 0.1, max: 2, step: 0.05 }),
      T('Hz'),
    ],
  },
  setPose: { cat: 'rig', parts: [T('复位姿势')] },
};

export function defaultParams(type) {
  const spec = BLOCK_SPECS[type];
  const out = {};
  if (!spec) return out;
  for (const p of spec.parts) {
    if (p.kind === 'number' || p.kind === 'select') out[p.key] = p.def;
    if (p.kind === 'part') out[p.key] = '';
  }
  return out;
}

export function newBlock(type) {
  return { id: nextId(), type, params: defaultParams(type), children: [] };
}

function mk(type, params = {}, children = []) {
  const b = newBlock(type);
  Object.assign(b.params, params);
  b.children = children;
  return b;
}

export function demoScript(mode) {
  if (mode === 'l2d') {
    return [
      mk('whenRun'),
      mk('setSway', { amp: 6, freq: 0.4 }),
      mk('forever', {}, [
        mk('rotateTo', { deg: 7, dur: 1.6 }),
        mk('wait', { sec: 1.2 }),
        mk('rotateTo', { deg: -7, dur: 1.6 }),
        mk('wait', { sec: 1.2 }),
      ]),
    ];
  }
  return [
    mk('whenRun'),
    mk('setView', { view: 'all' }),
    mk('repeat', { times: 2 }, [
      mk('wait', { sec: 1.5 }),
      mk('setView', { view: 'sprites' }),
      mk('wait', { sec: 2 }),
      mk('setView', { view: 'parts' }),
    ]),
    mk('setView', { view: 'all' }),
  ];
}

export function cloneBlocks(list) {
  return (list || []).map((b) => ({
    id: b.id,
    type: b.type,
    params: { ...(b.params || {}) },
    children: cloneBlocks(b.children),
  }));
}

export function findBlock(list, id) {
  for (const b of list) {
    if (b.id === id) return { block: b, list };
    const r = findBlock(b.children || [], id);
    if (r) return r;
  }
  return null;
}

export function isContainer(type) {
  return !!BLOCK_SPECS[type]?.container;
}

/* ------------------------------- 运行虚拟机 ------------------------------- */

export function createVm() {
  return { frames: [], wait: 0, tween: null, running: false };
}

export function startVm(vm, blocks) {
  vm.frames = [{ list: blocks || [], index: 0 }];
  vm.wait = 0;
  vm.tween = null;
  vm.running = true;
}

export function stopVm(vm) {
  vm.running = false;
  vm.frames = [];
  vm.wait = 0;
  vm.tween = null;
}

export function stepVm(vm, ctx, dt) {
  if (!vm.running) return;

  if (vm.tween) {
    const tw = vm.tween;
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    tw.apply(1 - Math.pow(1 - k, 3));
    if (k >= 1) {
      vm.tween = null;
      ctx.flush();
    }
    return;
  }

  if (vm.wait > 0) {
    vm.wait = Math.max(0, vm.wait - dt);
    if (vm.wait > 0) return;
  }

  let guard = 0;
  while (guard++ < 400) {
    const frame = vm.frames[vm.frames.length - 1];
    if (!frame) {
      vm.running = false;
      ctx.flush();
      return;
    }
    if (frame.index >= frame.list.length) {
      if (frame.infinite) {
        frame.index = 0;
      } else if ((frame.remaining || 1) > 1) {
        frame.remaining -= 1;
        frame.index = 0;
      } else {
        vm.frames.pop();
      }
      continue;
    }
    const block = frame.list[frame.index];
    frame.index += 1;
    if (execBlock(block, vm, ctx) === 'pause') return;
  }
}

function execBlock(block, vm, ctx) {
  const p = block.params || {};
  const num = (k, d = 0) => {
    const v = Number(p[k]);
    return Number.isFinite(v) ? v : d;
  };

  switch (block.type) {
    case 'whenRun':
      return undefined;

    case 'wait': {
      vm.wait = Math.max(0, num('sec', 0));
      return vm.wait > 0 ? 'pause' : undefined;
    }

    case 'repeat':
      vm.frames.push({ list: block.children || [], index: 0, remaining: Math.max(1, Math.round(num('times', 1))) });
      return undefined;

    case 'forever':
      vm.frames.push({ list: block.children || [], index: 0, infinite: true });
      return undefined;

    case 'setView':
      ctx.actions.setVisibilityMode(p.view || 'all');
      return undefined;

    case 'showPart': {
      const part = ctx.world.parts.get(p.part);
      if (part) {
        part.visible = p.action !== 'hide';
        ctx.actions.bump();
      }
      return undefined;
    }

    case 'setSpin':
      ctx.actions.setSpinResolved(p.part, num('omega', 0));
      return undefined;

    case 'setForce':
      ctx.actions.setForceResolved(p.part, num('mag', 0), num('deg', 0));
      return undefined;

    case 'setSway':
      ctx.actions.setRig({ swayAmp: num('amp', 0), swayFreq: num('freq', 0.45) });
      return undefined;

    case 'setPose':
      ctx.actions.resetPose();
      return undefined;

    case 'rotateTo': {
      const from = ctx.rig().angleDeg;
      const to = num('deg', 0);
      let last = from;
      vm.tween = {
        t: 0,
        dur: Math.max(0.05, num('dur', 1)),
        apply: (k) => {
          const v = from + (to - from) * k;
          rotateNodes(ctx.world, pivotOf(ctx.world, ctx.rig().pivotId), ((v - last) * Math.PI) / 180);
          last = v;
        },
      };
      ctx.pendingRig({ angleDeg: to });
      return 'pause';
    }

    case 'scaleTo': {
      const from = ctx.rig().scale || 1;
      const to = Math.max(0.05, num('scale', 1));
      let last = from;
      vm.tween = {
        t: 0,
        dur: Math.max(0.05, num('dur', 1)),
        apply: (k) => {
          const v = from + (to - from) * k;
          scaleNodes(ctx.world, pivotOf(ctx.world, ctx.rig().pivotId), v / (last || 1));
          last = v;
        },
      };
      ctx.pendingRig({ scale: to });
      return 'pause';
    }

    case 'moveTo': {
      const fx = ctx.rig().tx || 0;
      const fy = ctx.rig().ty || 0;
      const tx = num('x', 0);
      const ty = num('y', 0);
      let lx = fx;
      let ly = fy;
      vm.tween = {
        t: 0,
        dur: Math.max(0.05, num('dur', 1)),
        apply: (k) => {
          const x = fx + (tx - fx) * k;
          const y = fy + (ty - fy) * k;
          translateNodes(ctx.world, x - lx, y - ly);
          lx = x;
          ly = y;
        },
      };
      ctx.pendingRig({ tx, ty });
      return 'pause';
    }

    default:
      return undefined;
  }
}
