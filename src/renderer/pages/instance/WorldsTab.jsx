// Worlds of an instance (saves/) with quick play, backup, duplicate, delete.
import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Button, IconButton, Empty, Spinner } from '../../components/ui.jsx';
import { Popover, MenuItem, MenuSeparator, useContextMenu } from '../../components/Menu.jsx';
import { useApp } from '../../lib/store.jsx';
import { call } from '../../lib/api.js';
import { t } from '../../lib/i18n.js';
import { formatDate, timeAgo } from '../../lib/format.js';

export const MODE_LABEL = () => ({ survival: t('Supervivencia'), creative: t('Creativo'), adventure: t('Aventura'), spectator: t('Espectador') });

export default function WorldsTab({ instance, worlds, reload }) {
  const app = useApp();
  const menu = useContextMenu();
  const [busy, setBusy] = useState('');

  const act = async (label, fn) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      app.showError(e);
    } finally {
      setBusy('');
      reload();
    }
  };

  if (!worlds)
    return (
      <div className="center-spinner">
        <Spinner />
      </div>
    );

  return (
    <div className="worlds-tab">
      <div className="content-toolbar">
        <Button variant="flat" icon="import" onClick={() => act('import', () => call('worlds.import', instance.id))}>
          {t('Importar mundo (.zip)')}
        </Button>
        <Button variant="flat" icon="compass" onClick={() => app.navigate({ page: 'browse', type: 'world', instanceId: instance.id })}>
          {t('Descargar mapas')}
        </Button>
        <span className="spacer" />
        <IconButton icon="folder" size={22} title={t('Abrir carpeta de mundos')} onClick={() => call('instances.openFolder', instance.id, 'saves')} />
        <IconButton icon="refresh" size={22} title={t('Recargar')} onClick={reload} />
      </div>
      {worlds.length === 0 ? (
        <Empty icon="globe" title={t('Sin mundos')} text={t('Los mundos que crees en el juego aparecerán aquí.')} />
      ) : (
        <div className="world-list">
          {worlds.map((w) => (
            <div key={w.folder} className="world-row" onContextMenu={(e) => menu.show(e, w)} onDoubleClick={() => app.launch(instance.id, { world: w.folder })}>
              {w.icon ? <img src={w.icon} alt="" className="world-icon" /> : <span className="world-icon placeholder"><Icon name="globe" size={28} /></span>}
              <div className="world-main">
                <strong>{w.levelName}</strong>
                <span className="muted">
                  {MODE_LABEL()[w.gameMode] || w.gameMode}
                  {w.hardcore ? ` · ${t('Extremo')}` : ''}
                  {w.cheats ? ` · ${t('Trucos')}` : ''}
                  {w.version ? ` · ${w.version}` : ''}
                </span>
              </div>
              <span className="world-folder muted" title={w.folder}>
                {w.folder}
              </span>
              <span className="world-date muted" title={formatDate(w.lastPlayed)}>
                {timeAgo(w.lastPlayed)}
              </span>
              {busy ? <Spinner size={20} /> : null}
              <Button variant="primary" size="sm" icon="play" onClick={() => app.launch(instance.id, { world: w.folder })}>
                {t('Jugar')}
              </Button>
              <IconButton icon="more" size={22} onClick={(e) => menu.show(e, w)} title={t('Más')} />
            </div>
          ))}
        </div>
      )}
      {menu.data ? (
        <Popover point={menu.point} open={menu.open} onClose={menu.close} className="menu">
          <MenuItem icon="play" label={t('Jugar este mundo')} onClick={() => (menu.close(), app.launch(instance.id, { world: menu.data.folder }))} />
          <MenuItem icon="folder" label={t('Abrir carpeta')} external onClick={() => (menu.close(), call('app.openPath', menu.data.path))} />
          <MenuItem icon="download" label={t('Crear respaldo (.zip)')} onClick={() => (menu.close(), act('backup', () => call('worlds.backup', instance.id, menu.data.folder)))} />
          <MenuItem icon="clone" label={t('Duplicar')} onClick={() => (menu.close(), act('dup', () => call('worlds.duplicate', instance.id, menu.data.folder)))} />
          <MenuSeparator />
          <MenuItem
            icon="trash"
            danger
            label={t('Eliminar mundo')}
            onClick={async () => {
              const w = menu.data;
              menu.close();
              const ok = await app.confirm({ title: t('Eliminar mundo'), message: t('¿Eliminar "{name}"? Se moverá a la papelera.', { name: w.levelName }), confirmLabel: t('Eliminar'), danger: true });
              if (ok) act('del', () => call('worlds.remove', instance.id, w.folder));
            }}
          />
        </Popover>
      ) : null}
    </div>
  );
}
