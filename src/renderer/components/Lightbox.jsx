// Full-screen screenshot viewer: arrows (or ← →) move through the list,
// Esc closes, Supr deletes. `head` adds things to the top bar (the gallery
// puts the instance there).
import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import Icon from './Icon.jsx';
import { IconButton } from './ui.jsx';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { formatDateTime, formatSize } from '../lib/format.js';

export default function Lightbox({ items, index, onIndex, onClose, onDelete, head }) {
  const app = useApp();
  const current = items[index];

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
      <img key={current.url} className="lightbox-img" src={current.url} alt={current.name} draggable={false} />
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
