// The layouts Havi Hub can take: both have every feature; they arrange the app
// like CurseForge (top tabs, game sidebar) or like the Modrinth app (icon bar,
// rounded panel, side column). Chosen in the first-start welcome
// (Welcome.jsx) and changed later in Settings → Themes.
import { t } from '../lib/i18n.js';

// miniature of each layout, in its original colors
export function LayoutPreview({ layout }) {
  if (layout === 'modrinth') {
    return (
      <div className="lp-mini lp-mr" aria-hidden="true">
        <div className="lp-mr-top">
          <span className="lp-dot" />
          <span className="lp-bar w30" />
        </div>
        <div className="lp-mr-body">
          <div className="lp-mr-nav">
            <span className="lp-navbtn on" />
            <span className="lp-navbtn" />
            <span className="lp-navbtn" />
            <span className="lp-navsep" />
            <span className="lp-navbtn sq" />
            <span className="lp-navbtn sq" />
          </div>
          <div className="lp-mr-panel">
            <span className="lp-bar w40 strong" />
            <div className="lp-mr-cards">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="lp-mr-card">
                  <span className="lp-mr-art" />
                  <span className="lp-bar w70" />
                </span>
              ))}
            </div>
          </div>
          <div className="lp-mr-side">
            <span className="lp-bar w60" />
            <span className="lp-mr-news" />
            <span className="lp-bar w80" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="lp-mini lp-cf" aria-hidden="true">
      <div className="lp-cf-top">
        <span className="lp-dot" />
        <span className="lp-bar w20" />
      </div>
      <div className="lp-cf-body">
        <div className="lp-cf-side">
          <span className="lp-tile" />
          <span className="lp-tile on" />
          <span className="lp-tile" />
        </div>
        <div className="lp-cf-main">
          <div className="lp-cf-head">
            <span className="lp-bar w30 strong" />
            <span className="lp-cf-search" />
          </div>
          <div className="lp-cf-tabs">
            <span className="on" />
            <span />
            <span />
            <span />
          </div>
          <div className="lp-cf-cards">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="lp-cf-card" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const LAYOUTS = () => [
  {
    id: 'curseforge',
    name: t('Estilo CurseForge'),
    text: t('Pestañas arriba (Mis modpacks, Descubrir, Explorar…) y la barra de juegos a la izquierda, como en la app de CurseForge.'),
  },
  {
    id: 'modrinth',
    name: t('Estilo Modrinth'),
    text: t('Una barra de íconos a la izquierda con tus perfiles recientes, la página en un panel redondeado y una columna a la derecha con tu cuenta y novedades.'),
  },
];

export function LayoutChoice({ value, onChange }) {
  return (
    <div className="lp-choices" role="radiogroup" aria-label={t('Diseño')}>
      {LAYOUTS().map((l) => (
        <button key={l.id} role="radio" aria-checked={value === l.id} className={`lp-choice ${value === l.id ? 'on' : ''}`} onClick={() => onChange(l.id)}>
          <LayoutPreview layout={l.id} />
          <span className="lp-choice-text">
            <strong>
              <span className="lp-radio" />
              {l.name}
            </strong>
            <span>{l.text}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
