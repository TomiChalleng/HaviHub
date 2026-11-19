// Environment variables for the game: a list of NAME = value rows. The value
// given and returned is the engine's own text (a JSON object, see shared/envvars.js).
import { useEffect, useRef, useState } from 'react';
import { Button, Input } from './ui.jsx';
import Icon from './Icon.jsx';
import { t } from '../lib/i18n.js';
import { parseEnv, serializeEnv, validEnvName, MAX_VARS, MAX_NAME, MAX_VALUE } from '../../shared/envvars.js';

// `lazy`: tell about a change when the field is left (settings saved as they are typed would save half-written names)
export default function EnvVarsEditor({ value, onChange, disabled = false, lazy = false }) {
  // rows keep what is being typed (an unfinished row has no name yet); `value` only sets them when it changes from outside
  const [rows, setRows] = useState(() => parseEnv(value));
  const sent = useRef(serializeEnv(rows));
  useEffect(() => {
    if (serializeEnv(parseEnv(value)) !== sent.current) {
      const next = parseEnv(value);
      sent.current = serializeEnv(next);
      setRows(next);
    }
  }, [value]);
  const emit = (list) => {
    const text = serializeEnv(list);
    if (text !== sent.current) {
      sent.current = text;
      onChange(text);
    }
  };
  const update = (next, now = !lazy) => {
    setRows(next);
    if (now) emit(next);
  };
  const names = rows.map((r) => r.name.trim());
  const problem = (r, i) => {
    const n = r.name.trim();
    if (!n) return r.value ? t('Falta el nombre') : '';
    if (!validEnvName(n)) return t('El nombre no puede llevar espacios ni "="');
    if (names.indexOf(n) !== i) return t('Nombre repetido: vale la última');
    return '';
  };
  return (
    <div className={`env-vars ${disabled ? 'disabled' : ''}`}>
      {rows.length === 0 ? <p className="muted small env-empty">{t('Sin variables. Ejemplo: __NV_PRIME_RENDER_OFFLOAD = 1 para usar la gráfica NVIDIA en un portátil con Linux.')}</p> : null}
      {rows.map((r, i) => {
        const bad = problem(r, i);
        return (
          <div className="env-row" key={i}>
            <Input
              className={`mono env-name ${bad ? 'invalid' : ''}`}
              value={r.name}
              maxLength={MAX_NAME}
              placeholder={t('NOMBRE')}
              aria-label={t('Nombre de la variable')}
              spellCheck={false}
              disabled={disabled}
              onBlur={() => emit(rows)}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
              onChange={(e) => update(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <span className="env-eq" aria-hidden="true">
              =
            </span>
            <Input
              className="mono env-value"
              value={r.value}
              maxLength={MAX_VALUE}
              placeholder={t('valor')}
              aria-label={t('Valor de la variable')}
              spellCheck={false}
              disabled={disabled}
              onBlur={() => emit(rows)}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
              onChange={(e) => update(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
            />
            <button type="button" className="icon-btn env-remove" disabled={disabled} aria-label={t('Quitar la variable')} data-tip={t('Quitar')} onClick={() => update(rows.filter((_, j) => j !== i), true)}>
              <Icon name="trash" size={16} />
            </button>
            {bad ? <span className="env-problem small">{bad}</span> : null}
          </div>
        );
      })}
      <div>
        <Button variant="secondary" size="sm" icon="plus" disabled={disabled || rows.length >= MAX_VARS} onClick={() => setRows([...rows, { name: '', value: '' }])}>
          {t('Añadir variable')}
        </Button>
      </div>
    </div>
  );
}
