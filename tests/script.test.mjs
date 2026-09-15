import { World } from '../src/engine/world.js';
import { applyTemplate } from '../src/engine/templates.js';
import { BLOCK_SPECS, createVm, newBlock, startVm, stepVm, stopVm } from '../src/engine/script.js';
import { dist } from '../src/engine/math.js';

let failures = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
  if (!ok) failures++;
};

function harness(world = new World()) {
  const log = [];
  const rig = { pivotId: null, angleDeg: 0, scale: 1, tx: 0, ty: 0, swayAmp: 0, swayFreq: 0.45 };
  const pending = [];
  const ctx = {
    world,
    rig: () => rig,
    pendingRig: (patch) => pending.push(patch),
    flush: () => {
      if (pending.length) Object.assign(rig, ...pending.splice(0, pending.length));
    },
    actions: {
      setVisibilityMode: (m) => log.push(`view:${m}`),
      bump: () => {},
      setRig: (p) => {
        Object.assign(rig, p);
        log.push(`sway:${p.swayAmp ?? rig.swayAmp}`);
      },
      resetPose: () => log.push('pose:reset'),
      setSpinResolved: (id, o) => log.push(`spin:${id}:${o}`),
      setForceResolved: (id, m, d) => log.push(`force:${id}:${m}:${d}`),
    },
  };
  return { ctx, log, rig };
}

const mk = (type, params = {}, children = []) => {
  const b = newBlock(type);
  Object.assign(b.params, params);
  b.children = children;
  return b;
};

const runFor = (vm, ctx, seconds, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) stepVm(vm, ctx, dt);
};

// 1. 顺序执行 + 等待
{
  const { ctx, log } = harness();
  const vm = createVm();
  startVm(vm, [
    mk('whenRun'),
    mk('setSway', { amp: 6, freq: 0.5 }),
    mk('wait', { sec: 0.4 }),
    mk('setView', { view: 'sprites' }),
  ]);
  runFor(vm, ctx, 0.2);
  check('等待期间不越过', log.length === 1 && log[0] === 'sway:6', JSON.stringify(log));
  runFor(vm, ctx, 0.5);
  check('等待结束后继续执行', log.length === 2 && log[1] === 'view:sprites', JSON.stringify(log));
  check('脚本执行完毕后 vm 停止', vm.running === false);
}

// 2. 重复 N 次
{
  const { ctx, log } = harness();
  const vm = createVm();
  startVm(vm, [mk('repeat', { times: 3 }, [mk('setView', { view: 'parts' })])]);
  runFor(vm, ctx, 0.1);
  check('重复 3 次执行 3 遍', log.filter((x) => x === 'view:parts').length === 3, `count=${log.length}`);
  check('重复结束后停止', vm.running === false);
}

// 3. 嵌套重复 2×3 = 6
{
  const { ctx, log } = harness();
  const vm = createVm();
  const inner = mk('repeat', { times: 3 }, [mk('setView', { view: 'all' })]);
  startVm(vm, [mk('repeat', { times: 2 }, [inner])]);
  runFor(vm, ctx, 0.1);
  check('嵌套重复 2×3=6 次', log.filter((x) => x === 'view:all').length === 6, `count=${log.length}`);
}

// 4. 一直重复不会自己结束
{
  const { ctx, log } = harness();
  const vm = createVm();
  startVm(vm, [mk('forever', {}, [mk('setView', { view: 'all' })])]);
  runFor(vm, ctx, 0.1);
  check('一直重复仍在运行', vm.running === true);
  stopVm(vm);
  const before = log.length;
  runFor(vm, ctx, 0.2);
  check('停止后不再执行', log.length === before && vm.running === false);
}

// 5. 旋转补间：真的转动了机构
{
  const world = new World();
  applyTemplate(world, 'fourbar');
  const { ctx, rig } = harness(world);
  const A = [...world.nodes.values()].find((n) => n.label === 'A');
  const O = [...world.nodes.values()].find((n) => n.label === 'O2');
  const r0 = dist(A, O);
  const a0 = Math.atan2(A.y - O.y, A.x - O.x);
  const vm = createVm();
  startVm(vm, [mk('rotateTo', { deg: 20, dur: 0.5 })]);
  runFor(vm, ctx, 0.1);
  const aMid = Math.atan2(A.y - O.y, A.x - O.x);
  check('补间过程中已开始旋转', Math.abs(aMid - a0) > 0.02, `d=${(aMid - a0).toFixed(3)}`);
  runFor(vm, ctx, 0.6);
  const aEnd = Math.atan2(A.y - O.y, A.x - O.x);
  check('补间结束角度正确', Math.abs(aEnd - a0 - (20 * Math.PI) / 180) < 1e-3, `d=${((aEnd - a0) * 180) / Math.PI}°`);
  check('旋转不改变杆长', Math.abs(dist(A, O) - r0) < 1e-6);
  check('flush 回写了 rig.angleDeg', Math.abs(rig.angleDeg - 20) < 1e-6, `angleDeg=${rig.angleDeg}`);
  check('补间结束 vm 停止', vm.running === false);
}

// 6. 移动补间
{
  const world = new World();
  applyTemplate(world, 'humanoid');
  const { ctx, rig } = harness(world);
  const n0 = [...world.nodes.values()].map((n) => ({ x: n.x, y: n.y }));
  const vm = createVm();
  startVm(vm, [mk('moveTo', { x: 1.5, y: -0.5, dur: 0.4 })]);
  runFor(vm, ctx, 0.6);
  const n1 = [...world.nodes.values()];
  const dx = n1.map((n, i) => n.x - n0[i].x);
  const dy = n1.map((n, i) => n.y - n0[i].y);
  const uniform = dx.every((d) => Math.abs(d - dx[0]) < 1e-6) && dy.every((d) => Math.abs(d - dy[0]) < 1e-6);
  check('移动补间整体平移', uniform && Math.abs(dx[0] - 1.5) < 1e-6 && Math.abs(dy[0] + 0.5) < 1e-6, `dx=${dx[0].toFixed(3)} dy=${dy[0].toFixed(3)}`);
  check('移动不回写 rig', Math.abs(rig.tx - 1.5) < 1e-6);
}

// 7. 部件动作解析
{
  const world = new World();
  applyTemplate(world, 'fourbar');
  const crank = [...world.parts.values()].find((p) => p.label === '曲柄');
  const { ctx, log } = harness(world);
  const vm = createVm();
  startVm(vm, [mk('setForce', { part: crank.id, mag: 4, deg: 90 })]);
  runFor(vm, ctx, 0.05);
  check('外力积木解析到部件', log.some((x) => x.startsWith('force:')), JSON.stringify(log));
}

// 8. 所有积木类型都有默认参数
{
  let ok = true;
  let bad = '';
  for (const type of Object.keys(BLOCK_SPECS)) {
    const b = newBlock(type);
    for (const p of BLOCK_SPECS[type].parts) {
      if ((p.kind === 'number' || p.kind === 'select' || p.kind === 'part') && !(p.key in b.params)) {
        ok = false;
        bad = `${type}.${p.key}`;
      }
    }
  }
  check('每种积木默认参数齐全', ok, bad);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
