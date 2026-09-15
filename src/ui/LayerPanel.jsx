import { useEditor } from '../store/editorStore.js';

const TYPE_ICON = {
  link: '▱',
  gear: '⚙',
  guide: '═',
  slider: '▭',
  rack: '≡',
  motor: '⟳',
  angleMotor: '⟳',
  gearPair: '⚭',
  force: '➜',
  trace: '∿',
  sprite: '🖼',
};

export default function LayerPanel() {
  const world = useEditor((s) => s.world);
  useEditor((s) => s.rev);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const patchLive = useEditor((s) => s.patchLive);

  const rows = [];
  for (const p of world.parts.values()) {
    if (p.type === 'gearPair' || p.type === 'angleMotor') continue;
    rows.push({ kind: 'part', id: p.id, z: p.zIndex ?? 10, label: p.label || p.type, visible: p.visible !== false, icon: TYPE_ICON[p.type] || '•' });
  }
  for (const s of world.sprites.values()) {
    rows.push({ kind: 'sprite', id: s.id, z: s.zIndex ?? 60, label: s.name || '图像', visible: s.visible !== false, icon: TYPE_ICON.sprite });
  }
  rows.sort((a, b) => b.z - a.z);

  return (
    <div className="layer-section">
      <h2>图层 / 显示</h2>
      <div className="layer-list">
        {rows.map((row) => (
          <div key={row.id} className={`layer-row${selection?.id === row.id ? ' active' : ''}`}>
            <button
              className="layer-eye"
              onClick={() => patchLive(row.id, { visible: !row.visible }, row.kind)}
              title="显示/隐藏"
            >
              {row.visible ? '👁' : '🚫'}
            </button>
            <button className="layer-main" onClick={() => select({ type: row.kind, id: row.id })}>
              <i>{row.icon}</i>
              <span className="layer-name">{row.label}</span>
            </button>
            <button className="layer-move" onClick={() => patchLive(row.id, { zIndex: Math.min(200, row.z + 1) }, row.kind)}>
              ⤒
            </button>
            <button className="layer-move" onClick={() => patchLive(row.id, { zIndex: Math.max(0, row.z - 1) }, row.kind)}>
              ⤓
            </button>
          </div>
        ))}
        {!rows.length && <p className="muted">暂无部件。</p>}
      </div>
    </div>
  );
}
