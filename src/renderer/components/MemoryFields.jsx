// The game's memory: the maximum and the minimum, each with a slider and a box
// to type the exact amount in MB. The minimum never ends up above the maximum.
import { useEffect, useState } from 'react';
import { Field, Slider } from './ui.jsx';
import { t } from '../lib/i18n.js';

const MIN_MAX = 512; // the least the maximum can be
const MIN_MIN = 256; // the least the minimum can be

function MbInput({ value, low, high, label, disabled, onCommit }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number(text);
    if (!text || !Number.isFinite(n) || n <= 0) return setText(String(value));
    const v = Math.min(high, Math.max(low, Math.round(n)));
    setText(String(v));
    if (v !== value) onCommit(v);
    return undefined;
  };
  return (
    <label className={`mb-input ${disabled ? 'disabled' : ''}`}>
      <input
        inputMode="numeric"
        value={text}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 7))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'Escape') {
            setText(String(value));
            e.currentTarget.blur();
          }
        }}
      />
      <span>MB</span>
    </label>
  );
}

// max / min: the values now; limit: the most that can be given (the PC's RAM).
// onChange({ max, min }) follows a slider while it is dragged; onCommit({ max,
// min }) when a value is settled (slider released or a number typed).
export default function MemoryFields({ max, min, limit, step = 256, disabled, onChange, onCommit }) {
  const top = Math.max(limit, max, min);
  const withMax = (v) => ({ max: v, min: Math.min(min, v) });
  const withMin = (v) => ({ max, min: Math.min(v, max) });
  const live = (next) => (onChange ? onChange(next) : onCommit(next));
  return (
    <>
      <Field label={t('Memoria máxima')}>
        <div className="mem-pair">
          <Slider value={max} min={MIN_MAX} max={top} step={step} showValue={false} disabled={disabled} onChange={(v) => live(withMax(v))} onCommit={(v) => onCommit(withMax(v))} />
          <MbInput value={max} low={MIN_MAX} high={top} label={t('Memoria máxima')} disabled={disabled} onCommit={(v) => onCommit(withMax(v))} />
        </div>
      </Field>
      <Field label={t('Memoria mínima')}>
        <div className="mem-pair">
          <Slider value={Math.min(min, max)} min={MIN_MIN} max={top} step={step} showValue={false} disabled={disabled} onChange={(v) => live(withMin(v))} onCommit={(v) => onCommit(withMin(v))} />
          <MbInput value={min} low={MIN_MIN} high={max} label={t('Memoria mínima')} disabled={disabled} onCommit={(v) => onCommit(withMin(v))} />
        </div>
      </Field>
    </>
  );
}
