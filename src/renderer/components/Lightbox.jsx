// Full-screen screenshot viewer: arrows (or ← →) move through the list,
// Esc closes, Supr deletes. `head` adds things to the top bar (the gallery
// puts the instance there). The mouse wheel zooms in on the spot under the
// pointer; drag to look around.
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { IconButton } from './ui.jsx';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { formatDateTime, formatSize } from '../lib/format.js';

const ZOOM_MIN = 1;
const ZOOM_MAX = 6;

export default function Lightbox({ items, index, onIndex, onClose, onDelete, head }) {
  const app = useApp();
  const current = items[index];
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const stage = useRef(null);
  const drag = useRef(null);
  useEffect(() => setView({ s: 1, x: 0, y: 0 }), [index]);

  // zoom to `s`, keeping the point under (cx, cy) where it is
  const zoomAt = (s, cx, cy) =>
    setView((v) => {
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s));
      if (next === 1) return { s: 1, x: 0, y: 0 };
      const r = stage.current ? stage.current.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
      const px = cx === undefined ? 0 : cx - (r.left + r.width / 2);
      const py = cy === undefined ? 0 : cy - (r.top + r.height / 2);
      const k = next / v.s;
      return { s: next, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });

  useEffect(() => {
    const onKey = (e) => {
      // a dialog opened from here (deleting) gets the keys first
      if (document.querySelector('.modal-backdrop')) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onIndex(Math.min(items.length - 1, index + 1));
      else if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
      else if (e.key === 'Delete' && onDelete) onDelete(items[index]);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, index, onIndex, onClose, onDelete]);

  if (!current) return null;
  // on top of everything but the window's title bar (the page it comes from sits under the side bar)
  return createPortal(
    <div className="lightbox" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lightbox-top">
        {head ? head(current) : <span className="lightbox-name">{current.name}</span>}
        <span className="lightbox-meta">{formatDateTime(current.mtime)}</span>
        {current.width ? <span className="lightbox-meta extra">{`${current.width} × ${current.height}`}</span> : null}
        <span className="lightbox-meta extra">{formatSize(current.size)}</span>
        <span className="spacer" />
        <span className="lightbox-pos">{t('{i} de {n}', { i: index + 1, n: items.length })}</span>
        <div className="lightbox-actions">
          <button className="lb-btn" onClick={() => call('app.copyImage', current.path).then(() => app.toast(t('Imagen copiada al portapapeles'), { type: 'success' }))} data-tip={t('Copiar imagen')}>
            <Icon name="copy" size={18} />
            <span>{t('Copiar')}</span>
          </button>
          <button className="lb-btn" onClick={() => call('app.showItem', current.path)} data-tip={t('Mostrar en la carpeta')}>
            <Icon name="folder" size={18} />
            <span>{t('Carpeta')}</span>
          </button>
          <button className="lb-btn" onClick={() => call('app.openPath', current.path)} data-tip={t('Abrir con el visor del sistema')}>
            <Icon name="external" size={18} />
            <span>{t('Abrir')}</span>
          </button>
          {onDelete ? (
            <button className="lb-btn danger" onClick={() => onDelete(current)}>
              <Icon name="trash" size={18} />
              <span>{t('Eliminar')}</span>
            </button>
          ) : null}
        </div>
        <button className="lb-btn close" onClick={onClose} data-tip="Esc">
          <Icon name="x" size={18} />
          <span>{t('Cerrar')}</span>
        </button>
      </div>
      <div
        ref={stage}
        className="lightbox-stage"
        onMouseDown={(e) => e.target === e.currentTarget && view.s === 1 && onClose()}
        onWheel={(e) => zoomAt(view.s * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY)}
      >
        <img
          key={current.url}
          className={`lightbox-img ${view.s > 1 ? 'zoomed' : ''} ${drag.current && drag.current.moved ? 'dragging' : ''}`}
          src={current.url}
          alt={current.name}
          draggable={false}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || view.s === 1) return;
            if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
            d.moved = true;
            setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        />
      </div>
      <button className="lb-nav prev" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label={t('Anterior')}>
        <Icon name="chevronLeft" size={34} />
      </button>
      <button className="lb-nav next" disabled={index === items.length - 1} onClick={() => onIndex(index + 1)} aria-label={t('Siguiente')}>
        <Icon name="chevronRight" size={34} />
      </button>
    </div>,
    document.body,
  );
}
