export const PROFILE_PRESETS = [
  { id: 'constant', label: '匀速' },
  { id: 'sine', label: '正弦变速' },
  { id: 'ramp', label: '匀加速' },
  { id: 'square', label: '方波变速' },
  { id: 'expression', label: '自定义 ω(t)' },
];

const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export function defaultProfile(preset = 'constant') {
  const base = { preset, omega: 2, amplitude: 2, frequency: 0.5, phase: 0, accel: 0.5, expr: '2*sin(2*pi*t)' };
  return base;
}

function compile(expr) {
  const src = String(expr ?? '0');
  try {
    const fn = new Function(
      't',
      'sin',
      'cos',
      'tan',
      'abs',
      'min',
      'max',
      'sqrt',
      'exp',
      'pow',
      'pi',
      `"use strict"; return (${src});`,
    );
    return (t) => {
      try {
        const v = fn(t, Math.sin, Math.cos, Math.tan, Math.abs, Math.min, Math.max, Math.sqrt, Math.exp, Math.pow, Math.PI);
        return Number.isFinite(v) ? v : 0;
      } catch {
        return 0;
      }
    };
  } catch {
    return () => 0;
  }
}

const exprCache = new Map();

export function evalExpression(expr, t) {
  const src = String(expr ?? '0');
  let fn = exprCache.get(src);
  if (!fn) {
    fn = compile(src);
    exprCache.set(src, fn);
  }
  return fn(t);
}

export function omegaAt(profile, t) {
  const p = profile || {};
  switch (p.preset) {
    case 'constant':
      return num(p.omega, 0);
    case 'sine':
      return num(p.omega, 0) + num(p.amplitude, 0) * Math.sin(2 * Math.PI * num(p.frequency, 0.5) * t + num(p.phase, 0));
    case 'ramp':
      return num(p.omega, 0) + num(p.accel, 0) * t;
    case 'square':
      return num(p.omega, 0) + (Math.sin(2 * Math.PI * num(p.frequency, 0.5) * t) >= 0 ? 1 : -1) * num(p.amplitude, 0);
    case 'expression':
      return evalExpression(p.expr, t);
    default:
      return 0;
  }
}

export function describeProfile(profile) {
  if (!profile) return '—';
  const preset = PROFILE_PRESETS.find((p) => p.id === profile.preset);
  const name = preset ? preset.label : profile.preset;
  if (profile.preset === 'constant') return `${name} ω=${profile.omega}`;
  if (profile.preset === 'sine') return `${name} ${profile.omega}±${profile.amplitude} @${profile.frequency}Hz`;
  if (profile.preset === 'ramp') return `${name} ω₀=${profile.omega} a=${profile.accel}`;
  if (profile.preset === 'square') return `${name} ${profile.omega}±${profile.amplitude} @${profile.frequency}Hz`;
  return `${name} ${profile.expr}`;
}

export const MAX_NODE_SPEED = 80;
export const DIVERGE_LIMIT = 1e5;
