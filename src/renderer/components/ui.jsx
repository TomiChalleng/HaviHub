// Basic UI building blocks.
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { Popover, MenuItem } from './Menu.jsx';
import { t } from '../lib/i18n.js';
import { LIMITS } from '../../shared/limits.js';
import BrandLogo from './BrandLogo.jsx';

// Bold icons whose glyph is small for its box get a bigger box in buttons
const BUTTON_ICON = { plus: 1.25, x: 1.2, check: 1.1, play: 1.2, import: 1.15 };

export function Button({ variant = 'secondary', size = 'md', icon, iconRight, iconSize, children, className = '', loading, ...rest }) {
  const base = size === 'sm' ? 16 : 20;
  return (
    <button className={`btn btn-${variant} btn-${size} ${className}`} {...rest} disabled={rest.disabled || loading}>
      {loading ? <Spinner size={16} /> : icon ? <Icon name={icon} size={iconSize || Math.round(base * (BUTTON_ICON[icon] || 1))} /> : null}
      {children !== undefined && children !== null && children !== false ? <span>{children}</span> : null}
      {iconRight ? <Icon name={iconRight} size={18} /> : null}
    </button>
  );
}

export function IconButton({ icon, title, size = 20, className = '', active, badge, tipPos, ...rest }) {
  return (
    <button className={`icon-btn ${active ? 'active' : ''} ${className}`} data-tip={title} data-tip-pos={tipPos} aria-label={title} {...rest}>
      <Icon name={icon} size={size} />
      {badge ? <span className="badge-dot">{badge}</span> : null}
    </button>
  );
}

// A toolbar's magnifier: a click slides the search box out of it, towards the
// left. Esc or the X close it again and clear the search.
export function ExpandingSearch({ value, onChange, placeholder, size = 25, width = 260 }) {
  const [open, setOpen] = useState(Boolean(value));
  const input = useRef(null);
  const close = () => {
    onChange('');
    setOpen(false);
  };
  useEffect(() => {
    if (!open) return undefined;
    const id = requestAnimationFrame(() => input.current && input.current.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, [open]);
  return (
    <div className={`xsearch ${open ? 'open' : ''}`} style={{ '--xsearch-w': `${width}px` }}>
      <div className="xsearch-field" aria-hidden={!open}>
        <input
          ref={input}
          tabIndex={open ? 0 : -1}
          maxLength={120}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && close()}
          onBlur={() => !value && setOpen(false)}
        />
        <IconButton icon="x" size={16} tabIndex={open ? 0 : -1} onMouseDown={(e) => e.preventDefault()} onClick={close} title={t('Cerrar búsqueda')} />
      </div>
      <IconButton
        className="tool-btn xsearch-btn"
        icon="search"
        size={size}
        title={t('Buscar')}
        onMouseDown={(e) => open && e.preventDefault()}
        onClick={() => {
          setOpen(true);
          // at once, so what is typed right after the click lands in it
          if (input.current) input.current.focus({ preventScroll: true });
        }}
      />
    </div>
  );
}

export function Toggle({ checked, onChange, disabled, title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      title={title}
      className={`toggle ${checked ? 'on' : ''}`}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange && onChange(!checked);
      }}
    >
      <span className="toggle-knob" />
    </button>
  );
}

export function Checkbox({ checked, onChange, indeterminate, label, disabled }) {
  return (
    <label className={`checkbox ${disabled ? 'disabled' : ''}`} onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={(e) => onChange && onChange(e.target.checked)} />
      <span className={`checkbox-box ${checked ? 'checked' : ''} ${indeterminate ? 'indeterminate' : ''}`}>{checked ? <Icon name="check" size={14} stroke={3} /> : indeterminate ? <Icon name="minus" size={14} stroke={3} /> : null}</span>
      {label ? <span className="checkbox-label">{label}</span> : null}
    </label>
  );
}

// Slider with the current value shown above the thumb (like the reference UI)
export function Slider({ value, min = 0, max = 100, step = 1, onChange, onCommit, format, disabled, showValue = true }) {
  const pct = ((Number(value) - min) / (max - min || 1)) * 100;
  return (
    <div className={`slider ${disabled ? 'disabled' : ''}`}>
      {showValue ? (
        <span className="slider-value" style={{ left: `${pct}%` }}>
          {format ? format(value) : value}
        </span>
      ) : null}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ '--pct': `${pct}%` }}
        onChange={(e) => onChange && onChange(Number(e.target.value))}
        onPointerDown={(e) => {
          if (!onCommit) return;
          // the release can happen outside the slider: listen on the window
          const input = e.currentTarget;
          const up = () => {
            window.removeEventListener('pointerup', up, true);
            window.removeEventListener('pointercancel', up, true);
            onCommit(Number(input.value));
          };
          window.addEventListener('pointerup', up, true);
          window.addEventListener('pointercancel', up, true);
        }}
        onKeyUp={(e) => onCommit && e.key !== 'Tab' && onCommit(Number(e.target.value))}
      />
    </div>
  );
}

// Every field has a maximum length (see shared/limits.js); `counter` shows
// "52/64" once the text gets close to it.
export function Input({ className = '', icon, right, counter, maxLength, ...rest }) {
  const max = maxLength || (rest.type === 'number' ? undefined : LIMITS.generic);
  const len = typeof rest.value === 'string' ? rest.value.length : 0;
  const near = counter && max && len >= Math.floor(max * 0.75);
  return (
    <div className={`input ${className} ${rest.disabled ? 'disabled' : ''}`}>
      {icon ? <Icon name={icon} size={18} className="input-icon" /> : null}
      <input spellCheck={false} maxLength={max} {...rest} />
      {near ? <span className={`input-count ${len >= max ? 'full' : ''}`}>{`${len}/${max}`}</span> : null}
      {right}
    </div>
  );
}

export function TextArea({ className = '', maxLength, ...rest }) {
  return <textarea className={`textarea ${className}`} spellCheck={false} maxLength={maxLength || LIMITS.textarea} {...rest} />;
}

export function SearchInput({ value, onChange, placeholder, autoFocus, onEnter, className = '' }) {
  return (
    <Input
      className={`search ${className}`}
      icon="search"
      value={value}
      placeholder={placeholder || t('Buscar…')}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onEnter) onEnter(e.target.value);
        if (e.key === 'Escape') onChange('');
      }}
      right={value ? <IconButton icon="x" size={16} className="input-clear" title={t('Limpiar')} onClick={() => onChange('')} /> : null}
    />
  );
}

// Custom select (native select popups look out of place in a dark UI)
export function Select({ value, options, onChange, placeholder, className = '', disabled, icon, maxHeight = 320, renderOption }) {
  const anchor = useRef(null);
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <button ref={anchor} type="button" className={`select ${className} ${open ? 'open' : ''}`} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        {icon ? <Icon name={icon} size={18} /> : null}
        <span className="select-label">{current ? current.label : placeholder || t('Elegir…')}</span>
        <Icon name="chevronDown" size={18} className="select-chevron" />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} matchWidth className="menu select-menu" maxHeight={maxHeight}>
        {options.map((o) =>
          o.header ? (
            <div key={`h-${o.label}`} className="menu-header">
              {o.label}
            </div>
          ) : (
            <MenuItem
              key={String(o.value)}
              label={renderOption ? renderOption(o) : o.label}
              hint={o.hint}
              checked={o.value === value}
              disabled={o.disabled}
              onClick={() => {
                setOpen(false);
                onChange(o.value);
              }}
            />
          ),
        )}
      </Popover>
    </>
  );
}

export function Tabs({ tabs, value, onChange, className = '', size = 'md' }) {
  return (
    <div className={`tabs tabs-${size} ${className}`} role="tablist">
      {tabs.map((tab) => (
        <button key={tab.value} role="tab" aria-selected={tab.value === value} className={`tab ${tab.value === value ? 'active' : ''}`} onClick={() => onChange(tab.value)}>
          {tab.icon ? <Icon name={tab.icon} size={18} /> : null}
          {tab.label}
          {tab.count !== undefined ? <span className="tab-count">({tab.count})</span> : null}
        </button>
      ))}
    </div>
  );
}

// Sub tabs separated with vertical bars (Mods | Data Packs | ...)
export function SubTabs({ tabs, value, onChange }) {
  return (
    <div className="subtabs">
      {tabs.map((tab, i) => (
        <span key={tab.value} className="subtab-wrap">
          {i > 0 ? <span className="subtab-sep" /> : null}
          <button className={`subtab ${tab.value === value ? 'active' : ''}`} onClick={() => onChange(tab.value)}>
            {tab.label}
            {tab.count !== undefined ? ` (${tab.count})` : ''}
          </button>
        </span>
      ))}
    </div>
  );
}

export function Pills({ options, value, onChange, className = '' }) {
  return (
    <div className={`pills ${className}`}>
      {options.map((o) => (
        <button key={o.value} className={`pill ${o.value === value ? 'active' : ''}`} onClick={() => onChange(o.value)} title={o.title}>
          {o.logo ? <BrandLogo brand={o.logo} size={16} title="" /> : o.dot ? <span className="pill-dot" style={{ background: o.dot }} /> : null}
          {o.icon ? <Icon name={o.icon} size={16} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ size = 22 }) {
  return <span className="spinner" style={{ width: size, height: size }} />;
}

export function Empty({ icon = 'box', title, text, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={44} stroke={1.4} />
      {title ? <h3>{title}</h3> : null}
      {text ? <p>{text}</p> : null}
      {children}
    </div>
  );
}

export function Progress({ value, indeterminate }) {
  return (
    <div className={`progress ${indeterminate ? 'indeterminate' : ''}`}>
      <div className="progress-bar" style={{ width: indeterminate ? undefined : `${Math.round((value || 0) * 100)}%` }} />
    </div>
  );
}

export function Field({ label, hint, children, row = true, className = '' }) {
  return (
    <div className={`field ${row ? 'field-row' : ''} ${className}`}>
      <div className="field-label">
        <span>{label}</span>
        {hint ? (
          <span className="field-hint" data-tip={hint}>
            <Icon name="help" size={16} />
          </span>
        ) : null}
      </div>
      <div className="field-control">{children}</div>
    </div>
  );
}

const SOURCE_NAME = (s) => (s === 'curseforge' ? 'CurseForge' : s === 'modrinth' ? 'Modrinth' : s);

// alsoOn: the same project on the other site too, shown as one paired capsule
export function SourceBadge({ source, small, alsoOn, title }) {
  if (!source) return null;
  const label = SOURCE_NAME(source);
  if (alsoOn && alsoOn !== source) {
    return (
      <span className={`source-badge dual ${small ? 'small' : ''}`} data-tip={title}>
        <span className={`dual-side src-${source}`}>
          <BrandLogo brand={source} size={small ? 14 : 16} title="" />
          {label}
        </span>
        <span className={`dual-side src-${alsoOn}`}>
          <BrandLogo brand={alsoOn} size={small ? 14 : 16} title="" />
          {SOURCE_NAME(alsoOn)}
        </span>
      </span>
    );
  }
  return (
    <span className={`source-badge src-${source} ${small ? 'small' : ''}`}>
      <BrandLogo brand={source} size={small ? 14 : 16} title="" />
      {label}
    </span>
  );
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function ColorInput({ value, onChange }) {
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  return (
    <div className="color-input">
      <label className="color-swatch" style={{ background: value }}>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
      </label>
      <input
        className="color-hex"
        value={text}
        spellCheck={false}
        maxLength={7}
        onChange={(e) => {
          setText(e.target.value);
          if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value);
        }}
      />
    </div>
  );
}

// Where a mod runs: only in the game (client), only on servers, or both.
export function envInfo(env) {
  if (env === 'client') return { icon: 'monitor', short: t('Cliente'), label: t('Solo cliente'), tip: t('Solo se instala en el juego; el servidor no lo necesita') };
  if (env === 'server') return { icon: 'server', short: t('Servidor'), label: t('Solo servidor'), tip: t('Solo se instala en el servidor; el juego no lo necesita') };
  if (env === 'both') return { icon: 'envBoth', short: t('Cliente y servidor'), label: t('Cliente y servidor'), tip: t('Se instala en el juego y también en el servidor') };
  return null;
}

export function EnvBadge({ env, compact = false, className = '' }) {
  const info = envInfo(env);
  if (!info) return null;
  return (
    <span className={`env-badge env-${env} ${compact ? 'compact' : ''} ${className}`} data-tip={info.tip}>
      <Icon name={info.icon} size={compact ? 15 : 16} />
      {compact ? info.short : info.label}
    </span>
  );
}
