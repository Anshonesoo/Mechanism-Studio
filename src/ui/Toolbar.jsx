import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../store/editorStore.js';

function TimeReadout() {
  const world = useEditor((s) => s.world);
  const running = useEditor((s) => s.running);
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(world.time), running ? 60 : 240);
    return () => clearInterval(id);
  }, [world, running]);
  return (
    <span className="tick-readout">
      <span className={`run-dot${running ? ' running' : ''}`} />
      <strong>{t.toFixed(2)}</strong> s
    </span>
  );
}

export default function Toolbar({ onToggleLeft, onToggleRight }) {
  const s = useEditor();
  const fileRef = useRef(null);
  const l2d = s.mode === 'l2d';
  return (
    <header className="topbar">
      <div className="segmented mode-switch">
        <button
          className={`segment${!l2d ? ' active' : ''}`}
          onClick={() => s.setMode('mechanism')}
          title="机构模式：搭机械、看运动"
        >
          机构
        </button>
        <button
          className={`segment${l2d ? ' active' : ''}`}
          onClick={() => s.setMode('l2d')}
          title="L2D 模式：骨骼绑图、做角色动画"
        >
          L2D
        </button>
      </div>

      <div className="run-controls">
        <button className="run-toggle" onClick={s.toggleRun}>
          {s.running ? '⏸ 暂停' : '▶ 播放'}
        </button>
        <button onClick={l2d ? s.resetPose : s.resetSim}>{l2d ? '⟲ 复位姿势' : '⟲ 复位'}</button>
        <label className="speed">
          速度
          <input
            type="range"
            min="0.1"
            max="4"
            step="0.1"
            value={s.timeScale}
            onChange={(e) => s.setTimeScale(Number(e.target.value))}
          />
          <span className="mono">{s.timeScale.toFixed(1)}×</span>
        </label>
        <TimeReadout />
      </div>

      <div className="undo-redo">
        <button onClick={s.undo} disabled={!s.history.length} title="撤销">
          ↶
        </button>
        <button onClick={s.redo} disabled={!s.future.length} title="重做">
          ↷
        </button>
      </div>

      <div className="segmented">
        {[
          ['all', '全部'],
          ['parts', l2d ? '仅骨架' : '仅构件'],
          ['sprites', '仅图像'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`segment${s.visibilityMode === id ? ' active' : ''}`}
            onClick={() => s.setVisibilityMode(id)}
            title={id === 'parts' ? '隐藏图像' : id === 'sprites' ? '隐藏' + (l2d ? '骨架' : '构件') : '都显示'}
          >
            {label}
          </button>
        ))}
      </div>

      <button className="panel-toggle" onClick={s.openTour} title="新手引导">
        ?
      </button>
      <button
        className={`panel-toggle script-toggle${s.showScript ? ' on' : ''}`}
        onClick={s.toggleScript}
        title="积木编排"
      >
        🧩 积木
      </button>
      <button className="panel-toggle" onClick={s.toggleGrid} title="网格">
        {s.showGrid ? '▦' : '▢'}
      </button>

      <button className="panel-toggle" onClick={s.exportJSON} title="导出 JSON">
        导出
      </button>
      <button className="panel-toggle" onClick={() => fileRef.current?.click()} title="导入 JSON">
        导入
      </button>
      <input
        ref={fileRef}
        className="hidden-file"
        type="file"
        accept="application/json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) s.importJSON(f);
          e.target.value = '';
        }}
      />

      <button className="panel-toggle" onClick={onToggleLeft} title="折叠左栏">
        ⇤
      </button>
      <button className="panel-toggle" onClick={onToggleRight} title="折叠右栏">
        ⇥
      </button>
    </header>
  );
}
