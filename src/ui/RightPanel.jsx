import Inspector from './Inspector.jsx';
import RigPanel from './RigPanel.jsx';
import LayerPanel from './LayerPanel.jsx';
import SpritePanel from './SpritePanel.jsx';
import { useEditor } from '../store/editorStore.js';

export default function RightPanel() {
  const l2d = useEditor((s) => s.mode === 'l2d');
  return (
    <aside className="panel right-panel">
      {l2d && <RigPanel />}
      <Inspector />
      <SpritePanel />
      <LayerPanel />
    </aside>
  );
}
