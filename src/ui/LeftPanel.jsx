import { useEditor } from '../store/editorStore.js';
import { modeTemplates } from '../engine/templates.js';

const MECH_TOOLS = [
  { id: 'select', icon: '➤', name: '选择' },
  { id: 'node', icon: '⬤', name: '铰点' },
  { id: 'link', icon: '▱', name: '连杆' },
  { id: 'gear', icon: '⚙', name: '齿轮' },
  { id: 'guide', icon: '═', name: '导轨' },
  { id: 'slider', icon: '▭', name: '滑块' },
  { id: 'rack', icon: '≡', name: '齿条' },
  { id: 'motor', icon: '⟳', name: '驱动' },
  { id: 'force', icon: '➜', name: '外力' },
];

const L2D_TOOLS = [
  { id: 'pose', icon: '✋', name: '摆姿势' },
  { id: 'bone', icon: '▱', name: '画骨骼' },
  { id: 'bind', icon: '🖼', name: '绑图片' },
  { id: 'root', icon: '⊕', name: '设根节点' },
];

export default function LeftPanel() {
  const mode = useEditor((s) => s.mode);
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const loadTemplate = useEditor((s) => s.loadTemplate);
  const l2d = mode === 'l2d';
  const tools = l2d ? L2D_TOOLS : MECH_TOOLS;

  return (
    <aside className="panel left-panel">
      <h2>工具</h2>
      <div className={`tool-grid${l2d ? ' two' : ''}`}>
        {tools.map((t) => (
          <button key={t.id} className={`tool${tool === t.id ? ' active' : ''}`} onClick={() => setTool(t.id)}>
            <span>{t.icon}</span>
            {t.name}
          </button>
        ))}
      </div>
      <p className="muted">{hint(tool)}</p>

      <h2>{l2d ? '骨架模板' : '机构模板'}</h2>
      <div className="template-list">
        {modeTemplates(mode).map((t) => (
          <button key={t.id} className="template-card" onClick={() => loadTemplate(t.id)}>
            <span className="template-icon">{t.icon}</span>
            <strong>{t.name}</strong>
            <span>{t.desc}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function hint(tool) {
  switch (tool) {
    case 'select':
      return '拖铰点或部件就能动。';
    case 'node':
      return '点空白放铰点；点已有铰点切换固定/自由。';
    case 'link':
      return '依次点两个铰点连线。';
    case 'gear':
      return '按住拖出大小；靠近别的齿轮会自动啮合。';
    case 'guide':
      return '依次点两点生成导轨。';
    case 'slider':
      return '点导轨放滑块。';
    case 'rack':
      return '先选中齿轮，再点导轨放齿条。';
    case 'motor':
      return '先点动铰点，再点中心铰点。';
    case 'force':
      return '点一个部件施加外力。';
    case 'pose':
      return '拖动关节摆姿势，后面的骨骼会跟着动。';
    case 'bone':
      return '依次点两个关节，连成一根骨头。';
    case 'bind':
      return '点一根骨骼，选图片绑上去。';
    case 'root':
      return '点一个关节，把它设成整机的旋转中心。';
    default:
      return '';
  }
}
