// Whether Havikun's channels on the Home page load on their own. Asked in the
// first-start welcome, or in a dialog to whoever updated from a version that
// didn't ask (dialogs/SocialsDialog.jsx); the same choice lives in Ajustes →
// Privacidad. Turned off, they stay on the Home page and load only when one is
// opened, so nothing connects to them by itself.
import { t } from '../lib/i18n.js';

// The Home page's column of channels: filled in on its own (the latest videos,
// the live mark), or waiting with its rows closed until one is clicked.
function AutoPicture() {
  return (
    <svg viewBox="0 0 220 120" className="cb-pic" aria-hidden="true">
      <rect x="0" y="0" width="220" height="120" rx="3" fill="var(--bg)" />
      <rect x="12" y="14" width="96" height="10" rx="2" fill="var(--surface2)" />
      <rect x="12" y="32" width="96" height="40" rx="3" fill="var(--surface)" />
      <rect x="12" y="80" width="96" height="26" rx="3" fill="var(--surface)" />
      <rect x="120" y="10" width="90" height="100" rx="4" fill="var(--surface)" />
      <rect x="128" y="18" width="12" height="12" rx="3" fill="#ff0033" />
      <rect x="146" y="20" width="44" height="7" rx="2" fill="var(--surface2)" />
      <rect x="128" y="36" width="35" height="22" rx="2" fill="var(--surface2)" />
      <path d="M142 42.5v9l7-4.5z" fill="#fff" opacity="0.85" />
      <rect x="167" y="36" width="35" height="22" rx="2" fill="var(--surface2)" />
      <path d="M181 42.5v9l7-4.5z" fill="#fff" opacity="0.85" />
      <rect x="128" y="66" width="12" height="12" rx="3" fill="#9146ff" />
      <rect x="146" y="68" width="26" height="7" rx="2" fill="var(--surface2)" />
      <rect x="176" y="67" width="26" height="9" rx="4.5" fill="#e91916" />
      <rect x="180" y="70.5" width="18" height="2" rx="1" fill="#fff" />
      <rect x="128" y="88" width="12" height="12" rx="3" fill="#43e55e" />
      <rect x="146" y="90" width="40" height="7" rx="2" fill="var(--surface2)" />
    </svg>
  );
}

function OnOpenPicture() {
  return (
    <svg viewBox="0 0 220 120" className="cb-pic" aria-hidden="true">
      <rect x="0" y="0" width="220" height="120" rx="3" fill="var(--bg)" />
      <rect x="12" y="14" width="96" height="10" rx="2" fill="var(--surface2)" />
      <rect x="12" y="32" width="96" height="40" rx="3" fill="var(--surface)" />
      <rect x="12" y="80" width="96" height="26" rx="3" fill="var(--surface)" />
      <rect x="120" y="10" width="90" height="100" rx="4" fill="var(--surface)" />
      <rect x="128" y="20" width="12" height="12" rx="3" fill="#ff0033" opacity="0.55" />
      <rect x="146" y="22" width="44" height="7" rx="2" fill="var(--surface2)" />
      <rect x="128" y="46" width="12" height="12" rx="3" fill="#9146ff" opacity="0.55" />
      <rect x="146" y="48" width="30" height="7" rx="2" fill="var(--surface2)" />
      <rect x="128" y="72" width="12" height="12" rx="3" fill="#43e55e" opacity="0.55" />
      <rect x="146" y="74" width="40" height="7" rx="2" fill="var(--surface2)" />
      <circle cx="171" cy="52" r="9" fill="var(--accent)" opacity="0.25" />
      <path d="M168 47l0 15 4-3.6 2.6 5.6 2.3-1.1-2.6-5.5 5.3-.4z" fill="#fff" stroke="var(--bg)" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function SocialChoice({ value, onChange }) {
  const options = [
    { value: true, title: t('Cargarlas solas'), tag: t('Recomendado'), text: t('Se actualizan apenas abres Havi Hub, así ves lo nuevo sin hacer nada.'), Picture: AutoPicture },
    { value: false, title: t('Solo cuando abra una'), text: t('Siguen en Inicio, pero no se cargan hasta que abras una. Solo se desactiva la carga automática.'), Picture: OnOpenPicture },
  ];
  return (
    <div className="cb-options" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={value === o.value} className={`cb-option ${value === o.value ? 'on' : ''}`} onClick={() => onChange(o.value)}>
          <o.Picture />
          <strong>
            {o.title}
            {o.tag ? <em className="cb-tag">{o.tag}</em> : null}
          </strong>
          <span>{o.text}</span>
        </button>
      ))}
    </div>
  );
}
