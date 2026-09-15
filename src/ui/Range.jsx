export default function Range({ label, value, min, max, step = 0.01, onChange, format }) {
  const v = Number.isFinite(value) ? value : 0;
  return (
    <label className="range-field">
      <span className="range-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, v))}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <em>{format ? format(v) : v.toFixed(2)}</em>
    </label>
  );
}
