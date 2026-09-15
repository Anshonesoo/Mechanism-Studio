import { useEditor } from '../store/editorStore.js';
import Range from './Range.jsx';

export default function RigPanel() {
  const rig = useEditor((s) => s.rig);
  const world = useEditor((s) => s.world);
  useEditor((s) => s.rev);
  const setRig = useEditor((s) => s.setRig);
  const rotateRig = useEditor((s) => s.rotateRig);
  const scaleRig = useEditor((s) => s.scaleRig);
  const translateRig = useEditor((s) => s.translateRig);
  const resetPose = useEditor((s) => s.resetPose);
  const setPivotFromSelection = useEditor((s) => s.setPivotFromSelection);
  const selection = useEditor((s) => s.selection);

  const pivotNode = rig.pivotId ? world.node(rig.pivotId) : null;

  return (
    <div className="rig-panel">
      <h2>动作参数</h2>

      <Range
        label="整体旋转"
        value={rig.angleDeg}
        min={-45}
        max={45}
        step={0.5}
        onChange={(v) => {
          rotateRig(((v - rig.angleDeg) * Math.PI) / 180);
          setRig({ angleDeg: v });
        }}
        format={(v) => `${v.toFixed(0)}°`}
      />

      <Range
        label="整体大小"
        value={rig.scale}
        min={0.4}
        max={2}
        step={0.01}
        onChange={(v) => {
          scaleRig(v / (rig.scale || 1));
          setRig({ scale: v });
        }}
        format={(v) => `${v.toFixed(2)}×`}
      />

      <Range
        label="左右移动"
        value={rig.tx}
        min={-4}
        max={4}
        step={0.02}
        onChange={(v) => {
          translateRig(v - rig.tx, 0);
          setRig({ tx: v });
        }}
      />

      <Range
        label="上下移动"
        value={rig.ty}
        min={-4}
        max={4}
        step={0.02}
        onChange={(v) => {
          translateRig(0, v - rig.ty);
          setRig({ ty: v });
        }}
      />

      <h2>自动摇摆</h2>
      <Range label="幅度" value={rig.swayAmp} min={0} max={15} step={0.5} onChange={(v) => setRig({ swayAmp: v })} format={(v) => `${v.toFixed(1)}°`} />
      <Range label="速度" value={rig.swayFreq} min={0.1} max={2} step={0.05} onChange={(v) => setRig({ swayFreq: v })} format={(v) => `${v.toFixed(2)}Hz`} />
      <p className="muted">点播放即可看到整机摇摆，适合做呼吸/摇曳。</p>

      <div className="actions">
        <button onClick={resetPose}>复位姿势</button>
        <button onClick={setPivotFromSelection} disabled={selection?.type !== 'node'}>
          {pivotNode ? `根节点：${pivotNode.label || pivotNode.id}` : '把选中关节设为根节点'}
        </button>
      </div>
    </div>
  );
}
