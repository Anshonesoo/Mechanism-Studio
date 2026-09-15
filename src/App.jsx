import { useState } from 'react';
import Toolbar from './ui/Toolbar.jsx';
import LeftPanel from './ui/LeftPanel.jsx';
import Viewport from './ui/Viewport.jsx';
import RightPanel from './ui/RightPanel.jsx';
import LogBar from './ui/LogBar.jsx';
import TourGuide, { MECH_STEPS, L2D_STEPS } from './ui/TourGuide.jsx';
import ScriptDock from './ui/ScriptDock.jsx';
import { useEditor } from './store/editorStore.js';

export default function App() {
  const [left, setLeft] = useState(true);
  const [right, setRight] = useState(true);
  const mode = useEditor((s) => s.mode);
  const tourOpen = useEditor((s) => s.tourOpen);
  const closeTour = useEditor((s) => s.closeTour);
  const disableTour = useEditor((s) => s.disableTour);
  const showScript = useEditor((s) => s.showScript);

  const cls = ['app-shell', !left ? 'left-closed' : '', !right ? 'right-closed' : ''].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <Toolbar onToggleLeft={() => setLeft((v) => !v)} onToggleRight={() => setRight((v) => !v)} />
      <LeftPanel />
      <div className="center">
        <Viewport />
        {showScript && <ScriptDock />}
      </div>
      <RightPanel />
      {!left && (
        <button className="fold-toggle fold-left" onClick={() => setLeft(true)} title="展开左栏">
          ⇥
        </button>
      )}
      {!right && (
        <button className="fold-toggle fold-right" onClick={() => setRight(true)} title="展开右栏">
          ⇤
        </button>
      )}
      <LogBar />
      {tourOpen && (
        <TourGuide key={mode} steps={mode === 'l2d' ? L2D_STEPS : MECH_STEPS} onFinish={closeTour} onDontShow={disableTour} />
      )}
    </div>
  );
}
