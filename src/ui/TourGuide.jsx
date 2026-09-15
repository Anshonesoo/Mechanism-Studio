import { useEffect, useState } from 'react';

export const MECH_STEPS = [
  { target: '.mode-switch', title: '两个模式', body: '“机构”用来搭机械看运动；“L2D”用骨骼绑图片做角色动画。随时可切换，互不影响。' },
  { target: '.tool-grid', title: '工具', body: '选一个工具，在画布上点或拖就能造零件。齿轮按住拖出大小，靠近别的齿轮会自动啮合。' },
  { target: '.template-list', title: '模板', body: '不想从零搭就点一个模板，四杆、齿轮、行星轮系都能一键载入。' },
  { target: '.viewport', title: '让它动起来', body: '用“选择”工具直接拖铰点，机构就跟着动。按空格播放，驱动会自己转。滚轮缩放，中键拖动画面。' },
  { target: '.right-panel', title: '右边调参数', body: '选中任何东西，右边会出现它的属性。滑条拖动即可，没有复杂的数字。' },
  { target: '.script-toggle', title: '积木编排', body: '点这个按钮打开积木面板。像 Scratch 一样把“等待 / 显示切换 / 转动”拼成流程，点运行就会自动演一遍。' },
  { target: '.sprite-section', title: '图像绑定', body: '把图片绑到某个部件上，再切成“仅图像”，就只剩图片在动——这是做演示和 L2D 的关键一步。' },
];

export const L2D_STEPS = [
  { target: '.mode-switch', title: 'L2D 模式', body: '这个模式专门做角色动画：图片绑到骨骼上，拖骨骼摆姿势，再加整体摇摆。' },
  { target: '.tool-grid', title: '只有四个工具', body: '摆姿势、画骨骼、绑图片、设根节点。先摆姿势，缺骨头就用画骨骼补。' },
  { target: '.template-list', title: '骨架模板', body: '“人形骨架”自带 13 个关节，适合给立绘切片；链条模板适合尾巴、飘带。' },
  { target: '.viewport', title: '摆姿势', body: '拖任意关节，后面的骨骼会跟着动。想绑图片就直接在骨头上右键。' },
  { target: '.rig-panel', title: '动作参数', body: '整体旋转、大小、位移都是滑条；调“自动摇摆”再点播放，就有呼吸般的动态。' },
  { target: '.script-toggle', title: '积木编排', body: '点这里打开积木面板，可以拼出循环动作，例如“一直重复：左倾 → 等待 → 右倾”，让角色自己动起来。' },
  { target: '.sprite-section', title: '绑图', body: '给每根骨骼绑一张切片图，切到“仅图像”就是完整角色。图层顺序在下面调。' },
];

const measure = (selector) => {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
};

export default function TourGuide({ steps, onFinish, onDontShow }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const safeIndex = Math.min(index, steps.length - 1);
  const current = steps[safeIndex];
  const isLast = safeIndex >= steps.length - 1;

  useEffect(() => {
    setIndex(0);
  }, [steps]);

  useEffect(() => {
    const update = () => setRect(measure(current.target));
    update();
    const t = setTimeout(update, 120);
    window.addEventListener('resize', update);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', update);
    };
  }, [current.target, index]);

  const next = () => (isLast ? onFinish() : setIndex((i) => i + 1));

  const W = 288;
  const H = 168;
  let bx = 16;
  let by = 16;
  if (rect) {
    bx = rect.x + rect.width + 14;
    if (bx + W > window.innerWidth - 12) bx = Math.max(12, rect.x - W - 14);
    by = rect.y + rect.height + 14;
    if (by + H > window.innerHeight - 12) by = Math.max(12, rect.y - H - 14);
  }

  return (
    <div className="tour-backdrop" onClick={next}>
      {rect && (
        <div
          className="tour-spotlight"
          style={{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` }}
        />
      )}
      <section className="tour-bubble" style={{ left: `${bx}px`, top: `${by}px` }} onClick={(e) => e.stopPropagation()}>
        <span className="tour-step">
          {safeIndex + 1} / {steps.length}
        </span>
        <h3>{current.title}</h3>
        <p>{current.body}</p>
        <div className="tour-actions">
          <button className="tour-skip" onClick={onFinish}>
            跳过
          </button>
          <button className="tour-skip" onClick={onDontShow}>
            不再提示
          </button>
          <span className="tour-spacer" />
          {safeIndex > 0 && (
            <button className="tour-nav" onClick={() => setIndex((i) => i - 1)}>
              上一步
            </button>
          )}
          <button className="tour-primary" onClick={next}>
            {isLast ? '开始使用' : '下一步'}
          </button>
        </div>
      </section>
    </div>
  );
}
