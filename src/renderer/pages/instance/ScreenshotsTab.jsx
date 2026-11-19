// Screenshots grid with a lightbox viewer.
import { useCallback, useEffect, useState } from 'react';
import { Button, IconButton, Empty, Spinner } from '../../components/ui.jsx';
import { useApp } from '../../lib/store.jsx';
import { call } from '../../lib/api.js';
import { t } from '../../lib/i18n.js';
import Lightbox from '../../components/Lightbox.jsx';

export default function ScreenshotsTab({ instance }) {
  const app = useApp();
  const [shots, setShots] = useState(null);
  const [view, setView] = useState(-1);

  const load = useCallback(() => {
    call('screenshots.list', instance.id)
      .then(setShots)
      .catch(() => setShots([]));
  }, [instance.id]);

  useEffect(load, [load]);

  const remove = async (s) => {
    const ok = await app.confirm({ title: t('Eliminar captura'), message: s.name, confirmLabel: t('Eliminar'), danger: true });
    if (!ok) return;
    await call('screenshots.remove', instance.id, s.name).catch(app.showError);
    setView((v) => (shots.length <= 1 ? -1 : Math.min(v, shots.length - 2)));
    load();
  };

  const current = shots && view >= 0 ? shots[view] : null;

  return (
    <div className="shots-tab">
      <div className="content-toolbar">
        <Button variant="flat" icon="folder" onClick={() => call('instances.openFolder', instance.id, 'screenshots')}>
          {t('Abrir carpeta')}
        </Button>
        <span className="spacer" />
        {shots ? <span className="muted">{t('{n} capturas', { n: shots.length })}</span> : null}
        <IconButton icon="refresh" size={22} title={t('Recargar')} onClick={load} />
      </div>
      {!shots ? (
        <div className="center-spinner">
          <Spinner />
        </div>
      ) : shots.length === 0 ? (
        <Empty icon="camera" title={t('Sin capturas')} text={t('Presiona F2 en el juego para sacar una captura de pantalla.')} />
      ) : (
        <div className="shots-grid">
          {shots.map((s, i) => (
            <button key={s.name} className="shot" onClick={() => setView(i)} title={s.name}>
              <img src={s.thumb || s.url} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
      {current ? <Lightbox items={shots} index={view} onIndex={setView} onClose={() => setView(-1)} onDelete={remove} /> : null}
    </div>
  );
}
