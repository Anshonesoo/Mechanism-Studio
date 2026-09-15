import { useEditor, viewportApi } from '../store/editorStore.js';
import Range from './Range.jsx';
import { deg, rad } from '../engine/math.js';

function NameField({ value, onChange }) {
  return (
    <label className="field">
      <span>名称</span>
      <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function CheckField({ label, value, onChange }) {
  return (
    <label className="field row-check">
      <span>{label}</span>
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function MotorEditor({ part, onPatch }) {
  const p = part.profile || {};
  const kind = p.preset === 'sine' ? 'sine' : 'constant';
  const omega = p.omega ?? 2;
  const apply = (nextKind, v) => {
    if (nextKind === 'sine') {
      onPatch({ profile: { preset: 'sine', omega: v, amplitude: Math.max(0.5, Math.abs(v) * 0.6), frequency: 0.45, phase: 0 } });
    } else {
      onPatch({ profile: { preset: 'constant', omega: v } });
    }
  };
  return (
    <>
      <label className="field">
        <span>类型</span>
        <select value={kind} onChange={(e) => apply(e.target.value, omega)}>
          <option value="constant">匀速转</option>
          <option value="sine">变速转（正弦）</option>
        </select>
      </label>
      <Range label="转速" value={omega} min={-8} max={8} step={0.1} onChange={(v) => apply(kind, v)} format={(v) => v.toFixed(1)} />
    </>
  );
}

export default function Inspector() {
  const selection = useEditor((s) => s.selection);
  const world = useEditor((s) => s.world);
  const l2d = useEditor((s) => s.mode === 'l2d');
  useEditor((s) => s.rev);
  const patchLive = useEditor((s) => s.patchLive);
  const patchNodeLive = useEditor((s) => s.patchNodeLive);
  const updateNode = useEditor((s) => s.updateNode);
  const updatePart = useEditor((s) => s.updatePart);
  const setGearSize = useEditor((s) => s.setGearSize);
  const setForce = useEditor((s) => s.setForce);
  const setNodeTrace = useEditor((s) => s.setNodeTrace);
  const updateSprite = useEditor((s) => s.updateSprite);
  const removeSprite = useEditor((s) => s.removeSprite);
  const deleteSelection = useEditor((s) => s.deleteSelection);
  const clearTraces = useEditor((s) => s.clearTraces);
  const addAngleMotor = useEditor((s) => s.addAngleMotor);
  const autoMeshGear = useEditor((s) => s.autoMeshGear);
  const addForceTo = useEditor((s) => s.addForceTo);
  const setTool = useEditor((s) => s.setTool);

  if (!selection) return <p className="muted">未选中。点画布上的铰点或部件，或从右侧列表选。</p>;

  if (selection.type === 'sprite') {
    const sp = world.sprites.get(selection.id);
    if (!sp) return null;
    return (
      <div className="inspector">
        <h2>图像</h2>
        <NameField value={sp.name} onChange={(v) => updateSprite(sp.id, { name: v })} />
        <Range label="大小" value={sp.scale} min={0.001} max={0.06} step={0.0005} onChange={(v) => updateSprite(sp.id, { scale: v })} format={(v) => v.toFixed(3)} />
        <Range label="左右" value={sp.offsetX} min={-6} max={6} step={0.02} onChange={(v) => updateSprite(sp.id, { offsetX: v })} />
        <Range label="上下" value={sp.offsetY} min={-6} max={6} step={0.02} onChange={(v) => updateSprite(sp.id, { offsetY: v })} />
        <Range label="旋转" value={deg(sp.angle || 0)} min={-180} max={180} step={1} onChange={(v) => updateSprite(sp.id, { angle: rad(v) })} format={(v) => `${Math.round(v)}°`} />
        <Range label="不透明" value={sp.opacity ?? 1} min={0} max={1} step={0.02} onChange={(v) => updateSprite(sp.id, { opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <Range label="图层" value={sp.zIndex} min={0} max={120} step={1} onChange={(v) => updateSprite(sp.id, { zIndex: Math.round(v) })} format={(v) => String(Math.round(v))} />
        <CheckField label="跟着部件转" value={sp.rotate} onChange={(v) => updateSprite(sp.id, { rotate: v })} />
        <CheckField label="可见" value={sp.visible} onChange={(v) => updateSprite(sp.id, { visible: v })} />
        <button className="danger" onClick={() => removeSprite(sp.id)}>
          移除图像
        </button>
      </div>
    );
  }

  if (selection.type === 'node') {
    const n = world.node(selection.id);
    if (!n) return null;
    const traced = [...world.parts.values()].some((p) => p.type === 'trace' && p.node === n.id);
    return (
      <div className="inspector">
        <h2>铰点</h2>
        <NameField value={n.label} onChange={(v) => patchNodeLive(n.id, { label: v })} />
        <CheckField label="固定不动" value={n.fixed} onChange={(v) => updateNode(n.id, { fixed: v })} />
        <CheckField label="记录运动轨迹" value={traced} onChange={(v) => setNodeTrace(n.id, v)} />
        <button className="danger" onClick={deleteSelection}>
          删除
        </button>
      </div>
    );
  }

  const part = world.parts.get(selection.id);
  if (!part) return null;

  const forceMag = Math.hypot(part.fx || 0, part.fy || 0);
  const forceDeg = deg(Math.atan2(part.fy || 0, part.fx || 0));

  return (
    <div className="inspector">
      <h2>{part.label || part.type}</h2>
      <NameField value={part.label} onChange={(v) => patchLive(part.id, { label: v })} />

      {part.type === 'link' && (
        <Range label="杆长" value={part.rest} min={0.2} max={8} step={0.05} onChange={(v) => updatePart(part.id, { rest: v })} />
      )}

      {part.type === 'gear' && (
        <>
          <Range label="大小" value={part.radius} min={0.25} max={5} step={0.05} onChange={(v) => setGearSize(part.id, v)} />
          <CheckField label="锁定不转" value={part.fixedAngle} onChange={(v) => updatePart(part.id, { fixedAngle: v })} />
          <CheckField label="内齿轮" value={part.internal} onChange={(v) => updatePart(part.id, { internal: v })} />
        </>
      )}

      {part.type === 'slider' && (
        <>
          <Range label="长度" value={part.width} min={0.2} max={2.5} step={0.05} onChange={(v) => patchLive(part.id, { width: v })} />
          <CheckField label="套筒样式" value={part.sleeve} onChange={(v) => patchLive(part.id, { sleeve: v })} />
        </>
      )}

      {part.type === 'rack' && (
        <Range label="齿数" value={part.teeth} min={6} max={60} step={1} onChange={(v) => patchLive(part.id, { teeth: Math.round(v) })} format={(v) => String(Math.round(v))} />
      )}

      {part.type === 'gearPair' && <CheckField label="内啮合" value={part.internal} onChange={(v) => updatePart(part.id, { internal: v })} />}

      {(part.type === 'motor' || part.type === 'angleMotor') && (
        <MotorEditor part={part} onPatch={(patch) => patchLive(part.id, patch)} />
      )}

      {part.type === 'force' && (
        <>
          {part.exprX ? (
            <>
              <p className="muted">当前是自动往复外力（悬浮）。</p>
              <button onClick={() => patchLive(part.id, { exprX: null, exprY: null, fx: 5, fy: 0 })}>改成手动</button>
            </>
          ) : (
            <>
              <Range label="大小" value={forceMag} min={0} max={20} step={0.1} onChange={(m) => setForce(part.id, m, rad(forceDeg))} format={(v) => v.toFixed(1)} />
              <Range label="方向" value={forceDeg} min={-180} max={180} step={1} onChange={(d) => setForce(part.id, forceMag, rad(d))} format={(v) => `${Math.round(v)}°`} />
            </>
          )}
        </>
      )}

      {part.type === 'trace' && (
        <button onClick={clearTraces}>清空轨迹</button>
      )}

      {(part.type === 'gear' || part.type === 'link' || part.type === 'slider' || part.type === 'rack') && (
        <div className="actions">
          {l2d ? (
            part.type === 'link' && <button onClick={() => viewportApi.requestBind?.(part.id)}>选图片绑定到这根骨骼</button>
          ) : (
            <>
              {part.type === 'gear' && <button onClick={() => addAngleMotor(part.id)}>让它转起来</button>}
              {part.type === 'gear' && <button onClick={() => autoMeshGear(part.id)}>自动啮合附近齿轮</button>}
              <button onClick={() => addForceTo(part.id)}>施加外力</button>
              {part.type === 'link' && <button onClick={() => setTool('motor')}>用它做驱动…</button>}
            </>
          )}
        </div>
      )}

      <button className="danger" onClick={deleteSelection}>
        删除
      </button>
    </div>
  );
}
