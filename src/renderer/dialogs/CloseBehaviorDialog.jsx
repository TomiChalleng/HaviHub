// What the window's X does. Asked in the first-start welcome, or with this
// dialog to whoever updated from a version that didn't ask yet; the same
// choice lives in Ajustes → Launcher → Comportamiento.
import { useState } from 'react';
import { Modal } from '../components/Modal.jsx';
import { Button } from '../components/ui.jsx';
import { t } from '../lib/i18n.js';

// Small pictures of each outcome: the taskbar corner with Havi Hub's icon kept
// next to the clock, or a window whose X closes everything.
function TrayPicture() {
  return (
    <svg viewBox="0 0 220 120" className="cb-pic" aria-hidden="true">
      <rect x="0" y="0" width="220" height="120" rx="3" fill="var(--bg)" />
      <rect x="18" y="16" width="120" height="62" rx="3" fill="var(--surface2)" opacity="0.35" strokeDasharray="4 4" stroke="var(--text-muted)" />
      <path d="M78 78 L150 96" stroke="var(--accent)" strokeWidth="2" strokeDasharray="3 4" fill="none" />
      <rect x="0" y="92" width="220" height="28" fill="var(--titlebar)" />
      <rect x="146" y="97" width="18" height="18" rx="4" fill="var(--accent)" />
      <path d="M151 101h3v10h-3zM156 101h3v10h-3zM154 104.5h2v3h-2z" fill="#fff" />
      <rect x="146" y="97" width="18" height="18" rx="4" fill="none" stroke="#fff" strokeOpacity="0.55" />
      <rect x="172" y="101" width="8" height="10" rx="1" fill="var(--text-muted)" />
      <text x="208" y="110" textAnchor="end" fontSize="9" fill="var(--text2)" fontFamily="inherit">
        12:30
      </text>
    </svg>
  );
}

function ClosePicture() {
  return (
    <svg viewBox="0 0 220 120" className="cb-pic" aria-hidden="true">
      <rect x="0" y="0" width="220" height="120" rx="3" fill="var(--bg)" />
      <rect x="30" y="18" width="160" height="86" rx="3" fill="var(--surface)" />
      <rect x="30" y="18" width="160" height="16" rx="3" fill="var(--titlebar)" />
      <rect x="170" y="18" width="20" height="16" fill="var(--danger)" />
      <path d="M176 22l8 8M184 22l-8 8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="42" y="46" width="64" height="8" rx="2" fill="var(--surface2)" />
      <rect x="42" y="60" width="104" height="8" rx="2" fill="var(--surface2)" />
      <rect x="42" y="74" width="84" height="8" rx="2" fill="var(--surface2)" />
    </svg>
  );
}

// The two answers, side by side (also in the first-start welcome)
export function CloseChoice({ value, onChange }) {
  const options = [
    { value: true, title: t('Dejarlo en la bandeja'), text: t('La X esconde Havi Hub junto al reloj de Windows. Sigue abierto y vuelve con un clic en su ícono.'), Picture: TrayPicture },
    { value: false, title: t('Cerrarlo del todo'), text: t('La X cierra Havi Hub, como cualquier programa.'), Picture: ClosePicture },
  ];
  return (
    <div className="cb-options" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={value === o.value} className={`cb-option ${value === o.value ? 'on' : ''}`} onClick={() => onChange(o.value)}>
          <o.Picture />
          <strong>{o.title}</strong>
          <span>{o.text}</span>
        </button>
      ))}
    </div>
  );
}

export default function CloseBehaviorDialog({ onResolve }) {
  const [choice, setChoice] = useState(null);
  return (
    <Modal
      title={t('¿Qué hace la X de la ventana?')}
      icon="settings"
      width={640}
      closeOnBackdrop={false}
      onClose={null}
      className="close-behavior"
      footer={
        <>
          <span className="muted small cb-note">{t('Puedes cambiarlo cuando quieras en Ajustes → Launcher → Comportamiento.')}</span>
          <Button variant="primary" disabled={choice === null} onClick={() => onResolve(choice)}>
            {t('Guardar')}
          </Button>
        </>
      }
    >
      <CloseChoice value={choice} onChange={setChoice} />
    </Modal>
  );
}
