import { useEffect, useState } from 'react';
import { useEditor } from '../store/editorStore.js';

export default function LogBar() {
  const status = useEditor((s) => s.status);
  const tool = useEditor((s) => s.tool);
  const world = useEditor((s) => s.world);
  const running = useEditor((s) => s.running);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      setFps(Math.round((frames * 1000) / Math.max(1, now - last)));
      frames = 0;
      last = now;
    }, 500);
    const tick = () => {
      frames++;
      requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => {
      clearInterval(id);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <footer className="log-panel">
      <span className="log-status">{status}</span>
      <span className="log-spacer" />
      <span>
        工具 <strong>{tool}</strong>
      </span>
      <span>{running ? '▶ 播放' : '⏸ 暂停'}</span>
      <span>
        自由度 <strong>{world.stats.dof}</strong>
      </span>
      <span>
        FPS <strong>{fps}</strong>
      </span>
      <span className="mono">滚轮缩放 · 中键/Alt 拖动画面 · 空格播放 · F 适应视图</span>
    </footer>
  );
}
