import { useMemo, useRef, useState } from 'react';
import { useEditor } from '../store/editorStore.js';

export default function SpritePanel() {
  const world = useEditor((s) => s.world);
  const rev = useEditor((s) => s.rev);
  const selection = useEditor((s) => s.selection);
  const bindSprite = useEditor((s) => s.bindSprite);
  const select = useEditor((s) => s.select);
  const patchLive = useEditor((s) => s.patchLive);
  const removeSprite = useEditor((s) => s.removeSprite);
  const visibilityMode = useEditor((s) => s.visibilityMode);
  const setVisibilityMode = useEditor((s) => s.setVisibilityMode);
  const fileRef = useRef(null);
  const [target, setTarget] = useState('');

  const bindable = useMemo(() => {
    const list = [];
    for (const p of world.parts.values()) {
      if (p.type === 'gearPair' || p.type === 'angleMotor' || p.type === 'force' || p.type === 'trace') continue;
      list.push({ id: p.id, label: p.label || p.type });
    }
    return list;
  }, [world, rev]);

  const effectiveTarget = target || (selection?.type === 'part' ? selection.id : '');
  const sprites = [...world.sprites.values()];

  return (
    <div className="sprite-section">
      <h2>图像绑定</h2>
      <p className="muted">把图片绑到部件上，再切到“仅图像”，就像零件在动。</p>

      <label className="field">
        <span>绑到</span>
        <select value={effectiveTarget} onChange={(e) => setTarget(e.target.value)}>
          <option value="">选择部件…</option>
          {bindable.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      <button className="wide" disabled={!effectiveTarget} onClick={() => fileRef.current?.click()}>
        ⬆ 上传图片并绑定
      </button>
      <input
        ref={fileRef}
        className="hidden-file"
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f && effectiveTarget) {
            setTarget(effectiveTarget);
            await bindSprite(f, effectiveTarget);
          }
          e.target.value = '';
        }}
      />

      <div className="segmented full">
        {[
          ['all', '全部'],
          ['parts', '仅构件'],
          ['sprites', '仅图像'],
        ].map(([id, label]) => (
          <button key={id} className={`segment${visibilityMode === id ? ' active' : ''}`} onClick={() => setVisibilityMode(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="sprite-list">
        {sprites.map((sp) => (
          <div key={sp.id} className={`sprite-item${selection?.type === 'sprite' && selection.id === sp.id ? ' active' : ''}`}>
            <img src={sp.src} alt={sp.name} onClick={() => select({ type: 'sprite', id: sp.id })} />
            <div className="sprite-meta">
              <strong>{sp.name}</strong>
              <div className="sprite-ctrls">
                <button onClick={() => select({ type: 'sprite', id: sp.id })}>调整</button>
                <button onClick={() => patchLive(sp.id, { visible: !sp.visible }, 'sprite')}>{sp.visible ? '隐藏' : '显示'}</button>
                <button onClick={() => removeSprite(sp.id)}>删除</button>
              </div>
            </div>
          </div>
        ))}
        {!sprites.length && <p className="muted">还没有绑定图像。</p>}
      </div>
    </div>
  );
}
