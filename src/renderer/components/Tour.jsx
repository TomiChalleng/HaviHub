// The guided tour after the first-start welcome: a few steps over the real
// interface, each one lighting up a part of it ([data-tour="…"]) with a card
// beside it. Skip it at any time; it isn't shown again.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { useApp } from '../lib/store.jsx';
import { t } from '../lib/i18n.js';

const STEPS = () => [
  {
    target: 'create',
    page: 'library',
    icon: 'plus',
    title: t('Tus perfiles, en un solo lugar'),
    text: t('Crea un perfil nuevo o importa los que ya tienes en CurseForge, Modrinth o Prism Launcher, con sus mundos, mods y horas de juego.'),
  },
  {
    target: 'browse',
    icon: 'search',
    title: t('CurseForge y Modrinth juntos'),
    text: t('Busca mods, modpacks, shaders y resource packs de los dos sitios en una sola búsqueda, e instálalos en el perfil que elijas.'),
  },
  {
    target: 'settings',
    icon: 'palette',
    title: t('Elige tu diseño'),
    text: t('En Ajustes → Temas puedes cambiar entre el diseño de CurseForge y el de Modrinth cuando quieras. Los dos tienen las mismas funciones.'),
  },
  {
    target: 'account',
    icon: 'users',
    title: t('Cuentas y skins'),
    text: t('Aquí agregas tu cuenta de Microsoft o cuentas offline para LAN. En Skins puedes ver y cambiar tu skin en 3D.'),
  },
];

const GAP = 12;
const PAD = 6;

function useTargetRect(target, step) {
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    let frame = 0;
    let tries = 0;
    const measure = () => {
      const el = document.querySelector(`[data-tour="${target}"]`);
      const r = el ? el.getBoundingClientRect() : null;
      setRect(r && r.width && r.height ? { x: r.left, y: r.top, w: r.width, h: r.height } : null);
    };
    // the page may still be changing under it (navigation, layout): measure a few frames
    const settle = () => {
      measure();
      if (++tries < 20) frame = requestAnimationFrame(settle);
    };
    settle();
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [target, step]);
  return rect;
}

export default function Tour() {
  const app = useApp();
  const pending = Boolean(app.config && app.config.tourPending);
  const [i, setI] = useState(0);
  const steps = STEPS();
  const step = steps[i] || steps[0];
  const card = useRef(null);
  const [size, setSize] = useState({ w: 360, h: 200 });
  const rect = useTargetRect(step.target, i);

  const finish = useCallback(() => app.updateConfig({ tourPending: false, tourDone: true }), [app]);
  const go = useCallback(
    (n) => {
      if (n >= steps.length) return finish();
      const next = steps[Math.max(0, n)];
      if (next.page && app.route.page !== next.page) app.navigate({ page: next.page });
      setI(Math.max(0, n));
    },
    [steps, app, finish],
  );

  useEffect(() => {
    if (!pending) return;
    if (step.page && app.route.page !== step.page) app.navigate({ page: step.page });
    // run once when the tour starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  useEffect(() => {
    if (!pending) return undefined;
    const onKey = (e) => {
      if (document.querySelector('.modal-backdrop')) return;
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') go(i + 1);
      else if (e.key === 'ArrowLeft' && i > 0) go(i - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, i, go, finish]);

  useLayoutEffect(() => {
    if (card.current) setSize({ w: card.current.offsetWidth, h: card.current.offsetHeight });
  }, [i, pending]);

  if (!pending) return null;

  // the card goes beside the lit part: below, above, to its right or left
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let pos = { left: (vw - size.w) / 2, top: (vh - size.h) / 2 };
  if (rect) {
    const below = rect.y + rect.h + PAD + GAP;
    const above = rect.y - PAD - GAP - size.h;
    const right = rect.x + rect.w + PAD + GAP;
    const left = rect.x - PAD - GAP - size.w;
    if (below + size.h <= vh - 16) pos = { left: rect.x + rect.w / 2 - size.w / 2, top: below };
    else if (above >= 16) pos = { left: rect.x + rect.w / 2 - size.w / 2, top: above };
    else if (right + size.w <= vw - 16) pos = { left: right, top: rect.y + rect.h / 2 - size.h / 2 };
    else if (left >= 16) pos = { left, top: rect.y + rect.h / 2 - size.h / 2 };
    pos.left = Math.min(Math.max(16, pos.left), vw - size.w - 16);
    pos.top = Math.min(Math.max(16, pos.top), vh - size.h - 16);
  }
  const last = i === steps.length - 1;

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div className="tour-spot" style={{ left: rect.x - PAD, top: rect.y - PAD, width: rect.w + PAD * 2, height: rect.h + PAD * 2 }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div ref={card} className="tour-card" style={{ left: pos.left, top: pos.top }} key={i}>
        <div className="tour-head">
          <span className="tour-icon">
            <Icon name={step.icon} size={18} />
          </span>
          <span className="tour-count">{t('{i} de {n}', { i: i + 1, n: steps.length })}</span>
          <button type="button" className="tour-skip" onClick={finish}>
            {t('Saltar tutorial')}
          </button>
        </div>
        <h3 id="tour-title">{step.title}</h3>
        <p>{step.text}</p>
        <div className="tour-foot">
          <span className="tour-dots" aria-hidden="true">
            {steps.map((s, n) => (
              <i key={s.target} className={n === i ? 'on' : n < i ? 'done' : ''} />
            ))}
          </span>
          {i > 0 ? (
            <button type="button" className="tour-btn" onClick={() => go(i - 1)}>
              {t('Anterior')}
            </button>
          ) : null}
          <button type="button" className="tour-btn primary" onClick={() => go(i + 1)} autoFocus>
            {last ? t('Empezar') : t('Siguiente')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
