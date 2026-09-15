import { syncIdCounter } from '../engine/world.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

export function serialize(world) {
  return {
    format: 'mechanism-studio',
    version: 1,
    settings: clone(world.settings),
    time: world.time,
    nodes: [...world.nodes.values()].map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      fixed: n.fixed,
      mass: n.mass || 1,
      label: n.label || '',
      visible: n.visible !== false,
      zIndex: n.zIndex ?? 40,
    })),
    parts: [...world.parts.values()].map((p) => clone(stripRuntime(p))),
    sprites: [...world.sprites.values()].map((s) => clone(s)),
    initial: world.initial ? clone(world.initial) : null,
  };
}

function stripRuntime(part) {
  const copy = { ...part };
  delete copy.driven;
  if (copy.profile) {
    copy.profile = { ...copy.profile };
    delete copy.profile.__fn;
    delete copy.profile.__src;
  }
  return copy;
}

export function restore(world, data) {
  if (!data) return world;
  world.clear();
  for (const n of data.nodes || []) {
    world.addNode(n.x, n.y, {
      id: n.id,
      fixed: n.fixed,
      mass: n.mass,
      label: n.label,
      visible: n.visible,
      zIndex: n.zIndex,
    });
  }
  for (const p of data.parts || []) {
    const copy = clone(p);
    world.parts.set(copy.id, copy);
  }
  for (const s of data.sprites || []) {
    world.sprites.set(s.id, { ...s });
  }
  if (data.settings) {
    world.settings = {
      ...world.settings,
      ...clone(data.settings),
    };
  }
  world.time = data.time || 0;
  world.initial = data.initial ? clone(data.initial) : null;
  syncIdCounter(world);
  world.build();
  if (!world.initial) world.captureInitial();
  return world;
}

export function toFile(world, name = 'mechanism.json') {
  const blob = new Blob([JSON.stringify(serialize(world), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function fromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export { clone };
