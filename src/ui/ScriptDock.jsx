import { useMemo } from 'react';
import { useEditor } from '../store/editorStore.js';
import { BLOCK_SPECS, CATEGORIES } from '../engine/script.js';

const catColor = (type) => CATEGORIES.find((c) => c.id === BLOCK_SPECS[type]?.cat)?.color || '#8899a6';

function ParamControl({ spec, value, onChange, partOptions }) {
  if (spec.kind === 'text') return <span className="blk-text">{spec.text}</span>;
  if (spec.kind === 'flag') return <span className="blk-flag">▶</span>;
  if (spec.kind === 'number') {
    return (
      <input
        className="blk-num"
        type="number"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value ?? spec.def}
        onChange={(e) => onChange(Number(e.target.value))}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }
  if (spec.kind === 'select') {
    return (
      <select
        className="blk-sel"
        value={value ?? spec.def}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      >
        {spec.options.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    );
  }
  if (spec.kind === 'part') {
    return (
      <select
        className="blk-sel"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="">（选部件）</option>
        {partOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return null;
}

function BlockNode({ block, depth, partOptions }) {
  const spec = BLOCK_SPECS[block.type];
  const selectedId = useEditor((s) => s.selectedBlockId);
  const setSelectedBlock = useEditor((s) => s.setSelectedBlock);
  const removeBlock = useEditor((s) => s.removeBlock);
  const moveBlock = useEditor((s) => s.moveBlock);
  const patchBlockParams = useEditor((s) => s.patchBlockParams);

  if (!spec) return null;
  const selected = selectedId === block.id;
  const color = catColor(block.type);

  return (
    <div className={`blk-wrap${selected ? ' selected' : ''}`} style={{ '--blk': color }}>
      <div className={`blk${spec.hat ? ' hat' : ''}${spec.container ? ' container' : ''}`} onClick={() => setSelectedBlock(block.id)}>
        <div className="blk-head">
          {spec.parts.map((p, i) => (
            <ParamControl
              key={`${p.kind}-${p.key || p.text || i}`}
              spec={p}
              value={p.key ? block.params[p.key] : undefined}
              onChange={(v) => patchBlockParams(block.id, { [p.key]: v })}
              partOptions={partOptions}
            />
          ))}
          {selected && block.type !== 'whenRun' && (
            <span className="blk-tools">
              <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, -1); }} title="上移">
                ⤒
              </button>
              <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 1); }} title="下移">
                ⤓
              </button>
              <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }} title="删除">
                ✕
              </button>
            </span>
          )}
        </div>
      </div>

      {spec.container && (
        <div className="blk-body">
          {block.children.length === 0 && <div className="blk-empty">选中我，再从左边点积木就会加到这里</div>}
          {block.children.map((child) => (
            <BlockNode key={child.id} block={child} depth={depth + 1} partOptions={partOptions} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScriptDock() {
  const world = useEditor((s) => s.world);
  const rev = useEditor((s) => s.rev);
  const script = useEditor((s) => s.script);
  const scriptRunning = useEditor((s) => s.scriptRunning);
  const selectedBlockId = useEditor((s) => s.selectedBlockId);
  const addBlock = useEditor((s) => s.addBlock);
  const runScript = useEditor((s) => s.runScript);
  const stopScript = useEditor((s) => s.stopScript);
  const clearScript = useEditor((s) => s.clearScript);
  const loadDemoScript = useEditor((s) => s.loadDemoScript);
  const toggleScript = useEditor((s) => s.toggleScript);

  const partOptions = useMemo(() => {
    const list = [];
    for (const p of world.parts.values()) {
      if (p.type === 'gearPair' || p.type === 'angleMotor' || p.type === 'trace' || p.type === 'force') continue;
      list.push({ id: p.id, label: p.label || p.type });
    }
    return list;
  }, [world, rev]);

  const found = selectedBlockId ? findSpec(script.blocks, selectedBlockId) : null;
  const insertHint = found
    ? BLOCK_SPECS[found.type]?.container
      ? `新积木会加到「${labelOf(found.type)}」里面`
      : `新积木会插到「${labelOf(found.type)}」后面`
    : '新积木会加到脚本末尾';

  return (
    <section className="script-dock">
      <header className="dock-head">
        <strong>积木编排</strong>
        <span className="dock-hint">{insertHint}</span>
        <span className="dock-spacer" />
        <button className={scriptRunning ? 'danger' : 'primary'} onClick={scriptRunning ? stopScript : runScript}>
          {scriptRunning ? '⏹ 停止' : '▶ 运行'}
        </button>
        <button onClick={loadDemoScript}>示例</button>
        <button onClick={clearScript}>🗑 清空</button>
        <button onClick={toggleScript} title="收起">
          ⤓ 收起
        </button>
      </header>

      <div className="dock-body">
        <div className="palette">
          {CATEGORIES.map((cat) => {
            const items = Object.entries(BLOCK_SPECS).filter(([, s]) => s.cat === cat.id);
            if (!items.length) return null;
            return (
              <div key={cat.id} className="palette-group">
                <span className="palette-title" style={{ color: cat.color }}>
                  {cat.label}
                </span>
                <div className="palette-list">
                  {items.map(([type, spec]) => (
                    <button
                      key={type}
                      className="blk-palette"
                      style={{ '--blk': cat.color }}
                      onClick={() => addBlock(type)}
                      title="点击加入脚本"
                    >
                      {spec.parts
                        .map((p) => (p.kind === 'text' ? p.text : p.kind === 'flag' ? '▶' : p.kind === 'number' ? p.def : p.kind === 'part' ? '部件' : p.options[0][1]))
                        .join(' ')}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="script-area" onClick={() => useEditor.getState().setSelectedBlock(null)}>
          {script.blocks.length === 0 && (
            <p className="muted">从左边点积木，搭出一条动作流程。像 Scratch 一样从上往下执行。</p>
          )}
          {script.blocks.map((b) => (
            <div key={b.id} onClick={(e) => e.stopPropagation()}>
              <BlockNode block={b} depth={0} partOptions={partOptions} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function findSpec(list, id) {
  for (const b of list) {
    if (b.id === id) return b;
    const r = b.children?.length ? findSpec(b.children, id) : null;
    if (r) return r;
  }
  return null;
}

function labelOf(type) {
  const spec = BLOCK_SPECS[type];
  if (!spec) return type;
  return spec.parts
    .filter((p) => p.kind === 'text')
    .map((p) => p.text)
    .join('')
    .slice(0, 8);
}
