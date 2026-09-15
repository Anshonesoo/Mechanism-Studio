import { useEffect, useRef } from 'react';
import { useEditor, viewportApi } from '../store/editorStore.js';
import { Camera } from '../render/camera.js';
import { drawWorld } from '../render/renderer.js';
import { clamp, dist, projectOnLine } from '../engine/math.js';

const CURSORS = {
  select: 'default',
  pose: 'grab',
  node: 'crosshair',
  link: 'crosshair',
  bone: 'crosshair',
  gear: 'crosshair',
  guide: 'crosshair',
  slider: 'copy',
  rack: 'copy',
  motor: 'cell',
  force: 'crosshair',
  bind: 'copy',
  root: 'cell',
};

export default function Viewport() {
  const tool = useEditor((s) => s.tool);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const camRef = useRef(new Camera(0, 0, 48));
  const viewRef = useRef({ w: 1, h: 1, dpr: 1 });
  const cursorRef = useRef({ x: 0, y: 0, inside: false });
  const modeRef = useRef(null);
  const draftRef = useRef(null);
  const hudRef = useRef(null);
  const coordsRef = useRef(null);
  const zoomRef = useRef(null);
  const bindInputRef = useRef(null);
  const bindPendingRef = useRef(null);
  const swayRef = useRef(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      viewRef.current = { w: Math.max(1, rect.width), h: Math.max(1, rect.height), dpr };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    viewportApi.frameAll = () => {
      const w = useEditor.getState().world;
      camRef.current.frame(w.bounds(), viewRef.current.w, viewRef.current.h);
    };
    viewportApi.resetView = () => {
      camRef.current.x = 0;
      camRef.current.y = 0;
      camRef.current.scale = 48;
    };
    viewportApi.zoomBy = (f) => {
      const v = viewRef.current;
      camRef.current.zoomAt(v.w / 2, v.h / 2, f, v.w, v.h);
    };
    viewportApi.requestBind = (partId) => {
      bindPendingRef.current = partId;
      bindInputRef.current?.click();
    };
    const t = setTimeout(() => viewportApi.frameAll?.(), 60);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      viewportApi.frameAll = null;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      const st = useEditor.getState();
      const world = st.world;
      const cam = camRef.current;
      const view = viewRef.current;
      const advance = st.running;
      world.step(dt * (advance ? st.timeScale : 1), advance);
      if (world.diverged) {
        world.diverged = false;
        st.setStatus('机构数值发散，已自动复位到初始位形');
        st.bump();
      }

      if (st.scriptRunning && st.running) st.tickScript(dt * st.timeScale);

      if (st.mode === 'l2d' && st.rig.swayAmp > 0) {
        if (world.time < lastTimeRef.current) swayRef.current = 0;
        if (st.running) {
          const amp = (st.rig.swayAmp * Math.PI) / 180;
          const a = amp * Math.sin(2 * Math.PI * st.rig.swayFreq * world.time);
          st.rotateRig(a - swayRef.current);
          swayRef.current = a;
        }
      }
      lastTimeRef.current = world.time;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        drawWorld(ctx, world, cam, view, {
          mode: st.mode,
          pivot: st.mode === 'l2d' ? st.rigPivot() : null,
          selection: st.selection,
          hover: st.hover,
          showGrid: st.showGrid,
          showJoints: true,
          showTraces: true,
          showForces: true,
          visibilityMode: st.visibilityMode,
        });
        drawRubber(ctx, world, cam, view, st);
      }

      if (hudRef.current) hudRef.current.textContent = `t = ${world.time.toFixed(2)} s`;
      if (coordsRef.current && cursorRef.current.inside) {
        coordsRef.current.textContent = `x ${cursorRef.current.x.toFixed(2)}  y ${cursorRef.current.y.toFixed(2)}`;
      }
      if (zoomRef.current) zoomRef.current.textContent = `${(cam.scale / 48).toFixed(2)}×`;

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const st = useEditor.getState();
      if (e.code === 'Space') {
        e.preventDefault();
        st.toggleRun();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        st.deleteSelection();
      } else if (e.key === 'Escape') {
        st.select(null);
        st.setPending(null);
      } else if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
      } else if (e.key === 'f' || e.key === 'F') {
        viewportApi.frameAll?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const state = useEditor.getState;
  const tol = (px = 12) => px / camRef.current.scale;

  const toWorld = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const v = viewRef.current;
    return camRef.current.toWorld(e.clientX - rect.left, e.clientY - rect.top, v.w, v.h);
  };

  const snapPt = (p) => {
    const st = state();
    if (!st.snap) return p;
    const step = st.gridStep || 0.25;
    return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
  };

  const pickOrCreateNode = (p) => {
    const st = state();
    const w = st.world;
    const snapped = st.snap ? w.snapNode(p, tol(14)) : null;
    if (snapped) return snapped;
    const q = snapPt(p);
    let id = null;
    st.commit((ww) => {
      const n = ww.addNode(q.x, q.y);
      id = n.id;
    });
    return id;
  };

  const onPointerDown = (e) => {
    const st = state();
    const w = st.world;
    const canvas = canvasRef.current;
    canvas.setPointerCapture?.(e.pointerId);
    const p = toWorld(e);
    const panning = e.button === 1 || st.tool === 'pan' || (e.button === 0 && e.altKey);
    if (panning) {
      modeRef.current = { kind: 'pan', last: { x: e.clientX, y: e.clientY } };
      return;
    }
    if (e.button !== 0) return;

    const tool = st.tool;
    if (tool === 'select' || tool === 'pose') {
      const hit = w.hitTest(p, tol(12));
      if (hit?.type === 'node') {
        st.select(hit);
        w.drag = { targets: [{ id: hit.id, x: p.x, y: p.y }] };
        modeRef.current = { kind: 'drag' };
      } else if (hit?.type === 'part') {
        st.select(hit);
        const nodes = tool === 'select' ? w.targetNodes(`p:${hit.id}`).filter((n) => !n.fixed) : [];
        if (nodes.length) {
          w.drag = { targets: nodes.map((n) => ({ id: n.id, ox: n.x - p.x, oy: n.y - p.y })) };
          modeRef.current = { kind: 'drag-part' };
        } else {
          modeRef.current = { kind: 'click' };
        }
      } else {
        st.select(null);
        modeRef.current = { kind: 'click' };
      }
      return;
    }

    if (tool === 'root') {
      const hit = w.hitTest(p, tol(14));
      if (hit?.type === 'node') {
        st.select(hit);
        st.setPivotFromSelection();
      } else {
        st.setStatus('点一个关节作为根节点');
      }
      return;
    }

    if (tool === 'bind') {
      const hit = w.hitTest(p, tol(14));
      let partId = null;
      if (hit?.type === 'part' && w.parts.get(hit.id)?.type === 'link') partId = hit.id;
      else if (hit?.type === 'node') {
        for (const part of w.parts.values()) {
          if (part.type === 'link' && (part.a === hit.id || part.b === hit.id)) {
            partId = part.id;
            break;
          }
        }
      }
      if (!partId) {
        st.setStatus('点一根骨骼来绑图片');
        return;
      }
      st.select({ type: 'part', id: partId });
      viewportApi.requestBind?.(partId);
      return;
    }

    if (tool === 'node') {
      const snapped = w.snapNode(p, tol(14));
      if (snapped) st.updateNode(snapped, { fixed: !w.node(snapped).fixed });
      else {
        const q = snapPt(p);
        st.commit((ww) => ww.addNode(q.x, q.y));
      }
      return;
    }

    if (tool === 'link' || tool === 'guide' || tool === 'bone') {
      const id = pickOrCreateNode(p);
      const pending = st.pending;
      if (pending?.firstId) {
        if (pending.firstId !== id) {
          if (tool === 'guide') st.commit((ww) => ww.addGuide(pending.firstId, id));
          else st.commit((ww) => ww.addLink(pending.firstId, id, { width: 0.07, color: '#8fa5a1' }));
        }
        st.setPending(null);
      } else {
        st.setPending({ firstId: id, tool });
      }
      return;
    }

    if (tool === 'gear') {
      const snapped = w.snapNode(p, tol(14));
      let centerId = snapped;
      const q = snapped ? null : snapPt(p);
      let gearId = null;
      st.commit((ww) => {
        if (!centerId) {
          const n = ww.addNode(q.x, q.y);
          centerId = n.id;
        }
        const g = ww.addGear(centerId, { radius: st.gearRadius, teeth: Math.max(9, Math.round(st.gearRadius * 10)) });
        gearId = g.id;
      });
      st.select({ type: 'part', id: gearId });
      draftRef.current = { kind: 'gear-radius', gearId, centerId };
      modeRef.current = { kind: 'gear' };
      return;
    }

    if (tool === 'slider') {
      const hit = w.hitTest(p, tol(12));
      let guideId = hit?.part === 'guide' ? hit.id : null;
      if (!guideId && st.selection?.type === 'part') {
        const s = w.parts.get(st.selection.id);
        if (s?.type === 'guide') guideId = s.id;
      }
      if (!guideId) {
        st.setStatus('请点击一条导轨放置滑块');
        return;
      }
      const g = w.parts.get(guideId);
      const q = projectOnLine(p, w.node(g.a), w.node(g.b));
      st.addSliderOnGuide(guideId, q);
      return;
    }

    if (tool === 'rack') {
      let gearId = null;
      if (st.selection?.type === 'part') {
        const s = w.parts.get(st.selection.id);
        if (s?.type === 'gear') gearId = s.id;
      }
      if (!gearId) {
        let best = null;
        let bestD = Infinity;
        for (const part of w.parts.values()) {
          if (part.type !== 'gear') continue;
          const c = w.node(part.center);
          const d = dist(c, p);
          if (d < bestD) {
            bestD = d;
            best = part.id;
          }
        }
        if (best && bestD < 6) gearId = best;
      }
      if (!gearId) {
        st.setStatus('请先选中一个齿轮，再点击导轨放置齿条');
        return;
      }
      const hit = w.hitTest(p, tol(12));
      let guideId = hit?.part === 'guide' ? hit.id : null;
      if (!guideId && st.selection?.type === 'part') {
        const s = w.parts.get(st.selection.id);
        if (s?.type === 'guide') guideId = s.id;
      }
      if (!guideId) {
        st.setStatus('请点击一条导轨放置齿条');
        return;
      }
      const g = w.parts.get(guideId);
      const q = projectOnLine(p, w.node(g.a), w.node(g.b));
      st.addRackOnGuide(guideId, gearId, q);
      return;
    }

    if (tool === 'motor') {
      const id = pickOrCreateNode(p);
      const pending = st.pending;
      if (pending?.firstId) {
        if (pending.firstId !== id) st.addMotor(pending.firstId, id);
        st.setPending(null);
      } else {
        st.setPending({ firstId: id, tool });
        st.setStatus('再点击中心铰点（固定铰）');
      }
      return;
    }

    if (tool === 'force') {
      const hit = w.hitTest(p, tol(12));
      if (!hit) {
        st.setStatus('请点一个部件来施加外力');
        return;
      }
      if (hit.type === 'node') {
        st.commit((ww) => {
          const f = ww.addForce(`n:${hit.id}`, 5, 0);
          st.select({ type: 'part', id: f.id });
        });
      } else {
        st.addForceTo(hit.id);
      }
      return;
    }
  };

  const onPointerMove = (e) => {
    const st = state();
    const w = st.world;
    const p = toWorld(e);
    cursorRef.current = { x: p.x, y: p.y, inside: true };
    cursorRefGlobal.x = p.x;
    cursorRefGlobal.y = p.y;
    const m = modeRef.current;

    if (m?.kind === 'pan') {
      const dx = e.clientX - m.last.x;
      const dy = e.clientY - m.last.y;
      m.last = { x: e.clientX, y: e.clientY };
      camRef.current.panByScreen(dx, dy);
      return;
    }
    if (w.drag) {
      for (const t of w.drag.targets) {
        t.x = p.x + (t.ox ?? 0);
        t.y = p.y + (t.oy ?? 0);
      }
    }
    if (draftRef.current?.kind === 'gear-radius') {
      const c = w.node(draftRef.current.centerId);
      const r = Math.max(0.25, dist(c, p));
      const g = w.parts.get(draftRef.current.gearId);
      if (g) {
        g.radius = r;
        g.teeth = Math.max(9, Math.round(r * 10));
        g.inertia = r * r * 0.5;
        g.invInertia = g.fixedAngle ? 0 : 1 / g.inertia;
        w.build();
        st.bump();
      }
      return;
    }
    if (!m && !st.running) {
      const hit = w.hitTest(p, tol(12));
      st.setHover(hit ? { type: hit.type, id: hit.id } : null);
    }
  };

  const endPointer = (e) => {
    const st = state();
    const w = st.world;
    const draft = draftRef.current;
    if (w.drag) {
      for (const t of w.drag.targets) {
        const n = w.node(t.id);
        if (!n) continue;
        for (const p of w.parts.values()) {
          if (p.type !== 'motor' || p.node !== t.id) continue;
          const c = w.node(p.center);
          if (!c) continue;
          p.phi = Math.atan2(n.y - c.y, n.x - c.x);
          p.phi0 = p.phi;
          p.radius = Math.max(0.05, dist(n, c));
        }
      }
      w.drag = null;
      st.commit(() => {}, { history: false });
    }
    if (draft?.kind === 'gear-radius') {
      st.autoMeshGear(draft.gearId);
    }
    draftRef.current = null;
    modeRef.current = null;
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
  };

  const onWheel = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const v = viewRef.current;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    camRef.current.zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor, v.w, v.h);
  };

  return (
    <div className="viewport" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        style={{ cursor: CURSORS[tool] || 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={() => {
          cursorRef.current.inside = false;
          state().setHover(null);
        }}
        onWheel={onWheel}
        onContextMenu={(e) => {
          e.preventDefault();
          const st = useEditor.getState();
          if (st.mode !== 'l2d') return;
          const canvas = canvasRef.current;
          const rect = canvas.getBoundingClientRect();
          const v = viewRef.current;
          const p = camRef.current.toWorld(e.clientX - rect.left, e.clientY - rect.top, v.w, v.h);
          const w = st.world;
          const hit = w.hitTest(p, tol(16));
          let partId = null;
          if (hit?.type === 'part' && w.parts.get(hit.id)?.type === 'link') partId = hit.id;
          else if (hit?.type === 'node') {
            for (const part of w.parts.values()) {
              if (part.type === 'link' && (part.a === hit.id || part.b === hit.id)) {
                partId = part.id;
                break;
              }
            }
          }
          if (partId) {
            st.select({ type: 'part', id: partId });
            viewportApi.requestBind?.(partId);
          }
        }}
      />
      <input
        ref={bindInputRef}
        className="hidden-file"
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          const id = bindPendingRef.current;
          if (f && id) await useEditor.getState().bindSprite(f, id);
          bindPendingRef.current = null;
          e.target.value = '';
        }}
      />
      <div className="viewport-hud">
        <span ref={hudRef}>t = 0.00 s</span>
        <span ref={coordsRef} className="mono">
          x 0.00  y 0.00
        </span>
        <span ref={zoomRef}>1.00×</span>
      </div>
    </div>
  );
}

function drawRubber(ctx, world, cam, view, st) {
  const pending = st.pending;
  if (!pending?.firstId) return;
  const node = world.node(pending.firstId);
  if (!node) return;
  const v = view;
  const a = cam.toScreen(node, v.w, v.h);
  const c = cam.toScreen({ x: cursorRefGlobal.x, y: cursorRefGlobal.y }, v.w, v.h);
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = '#0e9f9f';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(c.x, c.y);
  ctx.stroke();
  ctx.restore();
}

const cursorRefGlobal = { x: 0, y: 0 };
