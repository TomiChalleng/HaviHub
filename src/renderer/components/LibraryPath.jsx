// The path to a system library (GLFW or OpenAL) the game should use instead
// of its own. Empty: the engine finds it on its own.
import { useEffect, useState } from 'react';
import { Button } from './ui.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { LIMITS } from '../../shared/limits.js';

export default function LibraryPath({ label, value, disabled, onChange }) {
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  const commit = (v) => {
    const next = String(v || '').trim();
    setText(next);
    if (next !== (value || '')) onChange(next);
  };
  return (
    <div className={`lib-path ${disabled ? 'disabled' : ''}`}>
      <span className="label">{label}</span>
      <div className="row">
        <div className={`input grow ${disabled ? 'disabled' : ''}`}>
          <input
            className="mono"
            spellCheck={false}
            maxLength={LIMITS.path}
            value={text}
            disabled={disabled}
            placeholder={t('Automática')}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </div>
        <Button
          variant="outline"
          icon="folderOpen"
          disabled={disabled}
          data-tip={t('Elegir archivo')}
          aria-label={t('Elegir archivo')}
          onClick={async () => {
            const f = await call('app.pickFiles', {});
            if (f && f[0]) commit(f[0]);
          }}
        />
      </div>
    </div>
  );
}
