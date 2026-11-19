// Instance page: header (image, name, play + dropdown, ⋮ menu), tabs
// Content / Logs / Screenshots and content sub-tabs.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Button, Tabs, SubTabs, Spinner, Empty } from '../components/ui.jsx';
import { Popover, MenuItem, MenuSeparator, MenuHeader, useMenu } from '../components/Menu.jsx';
import InstanceImage, { LoaderIcon } from '../components/InstanceImage.jsx';
import ContentTab, { DataPacksTab } from './instance/ContentTab.jsx';
import WorldsTab, { MODE_LABEL } from './instance/WorldsTab.jsx';
import LogsTab from './instance/LogsTab.jsx';
import ScreenshotsTab from './instance/ScreenshotsTab.jsx';
import PlayDropdown from '../components/PlayDropdown.jsx';
import { instanceSubtitle } from './Library.jsx';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { formatDate, formatPlaytime, maskIp } from '../lib/format.js';
import * as actions from '../lib/actions.js';

const SUB_TYPE = { mods: 'mod', datapacks: 'datapack', resourcepacks: 'resourcepack', shaderpacks: 'shader', worlds: 'world' };

export function InstanceKebab({ instance, anchor, open, onClose }) {
  const app = useApp();
  const go = (fn) => () => {
    onClose();
    fn();
  };
  return (
    <Popover anchor={anchor} open={open} onClose={onClose} align="right" className="menu kebab-menu">
      <MenuItem icon="puzzle" label={t('Agregar contenido')} onClick={go(() => app.navigate({ page: 'browse', type: 'mod', instanceId: instance.id }))} />
      <MenuItem icon="shareBox" label={t('Crear acceso directo')} onClick={go(() => actions.createShortcut(app, instance))} />
      <MenuSeparator />
      <MenuItem icon="folder" label={t('Abrir carpeta')} external onClick={go(() => call('instances.openFolder', instance.id))} />
      <MenuItem icon="folder" label={t('Crear logs.zip')} external onClick={go(() => actions.createLogsZip(app, instance))} />
      <MenuItem icon="image" label={t('Cambiar ícono…')} onClick={go(() => actions.editIcon(app, instance))} />
      <MenuItem icon="listOptions" label={t('Opciones del perfil')} onClick={go(() => actions.profileOptions(app, instance))} />
      <MenuItem icon="clone" label={t('Clonar como…')} onClick={go(() => actions.cloneInstance(app, instance))} />
      <MenuSeparator />
      <MenuItem icon="share" label={t('Compartir perfil')} onClick={go(() => actions.shareInstance(app, instance))} />
      <MenuItem icon="wrench" label={t('Reparar perfil')} onClick={go(() => actions.repairInstance(app, instance))} />
      <MenuItem icon="trash" label={t('Eliminar perfil')} onClick={go(() => actions.deleteInstance(app, instance))} />
    </Popover>
  );
}

export default function InstancePage() {
  const app = useApp();
  const { route, instances, instancesLoaded } = app;
  const instance = instances.find((i) => i.id === route.id);
  const tab = route.tab || 'content';
  const modded = Boolean(instance && instance.loader);
  const sub = route.sub || (modded ? 'mods' : 'resourcepacks');
  const [counts, setCounts] = useState(null);
  const [worlds, setWorlds] = useState(null);
  const [servers, setServers] = useState(null);
  const kebab = useMenu();
  const play = useMenu();
  const running = instance && app.running.has(instance.id);
  const launching = Boolean(app.launching && instance && app.launching.has(instance.id));

  const loadCounts = useCallback(() => {
    if (!route.id) return;
    call('instances.counts', route.id).then(setCounts).catch(() => {});
  }, [route.id]);

  const loadWorlds = useCallback(() => {
    if (!route.id) return;
    call('worlds.list', route.id).then(setWorlds).catch(() => setWorlds([]));
    call('servers.list', route.id).then(setServers).catch(() => setServers([]));
  }, [route.id]);

  useEffect(() => {
    setCounts(null);
    setWorlds(null);
    loadCounts();
    loadWorlds();
  }, [route.id]);

  useEffect(() => {
    loadCounts();
    if (worlds) loadWorlds();
  }, [app.contentVersion, instance && instance.lastLaunch]);

  const setCount = useCallback((key) => (n) => setCounts((c) => (c ? { ...c, [key]: n } : c)), []);
  const countHandlers = useMemo(() => ({ mods: setCount('mods'), resourcepacks: setCount('resourcepacks'), shaderpacks: setCount('shaderpacks'), datapacks: setCount('datapacks') }), [setCount]);

  if (!instance) {
    return (
      <div className="page">
        {instancesLoaded ? (
          <Empty icon="alert" title={t('No se encontró el perfil')} text={route.id}>
            <Button onClick={() => app.navigate({ page: 'library' })}>{t('Volver')}</Button>
          </Empty>
        ) : (
          <div className="center-spinner">
            <Spinner />
          </div>
        )}
      </div>
    );
  }

  const totalContent = counts ? counts.mods + counts.resourcepacks + counts.shaderpacks + counts.datapacks + counts.worlds : null;

  return (
    <div className="page instance-page">
      <div className="inst-header">
        <InstanceImage instance={instance} className="inst-header-img" />
        <div className="inst-header-main">
          <div className="inst-header-top">
            <div className="inst-header-titles">
              <h1 title={instance.name}>{instance.name}</h1>
              <span className="inst-header-sub">{instanceSubtitle(instance)}</span>
            </div>
            <button ref={kebab.anchor} className={`icon-btn kebab ${kebab.open ? 'active' : ''}`} onClick={kebab.toggle} data-tip={t('Más opciones')} aria-label={t('Más opciones')}>
              <Icon name="more" size={32} />
            </button>
            <div className="play-split">
              <button
                className={`play-btn ${running && !launching ? 'running' : ''} ${launching ? 'launching' : ''}`}
                title={launching ? t('Cancelar el inicio') : undefined}
                onClick={() => (running ? call('instances.stop', instance.id) : app.launch(instance.id))}
              >
                {launching ? (
                  <>
                    <Spinner size={18} />
                    {t('Iniciando…')}
                  </>
                ) : running ? (
                  t('Detener')
                ) : (
                  t('Jugar')
                )}
              </button>
              <button ref={play.anchor} className="play-drop" onClick={play.toggle} data-tip={t('Elegir mundo o servidor')} aria-label={t('Elegir mundo o servidor')}>
                <Icon name={play.open ? 'chevronUp' : 'chevronDown'} size={30} />
              </button>
            </div>
          </div>
          <div className="inst-header-meta">
            <span data-tip={t('Última vez jugado')}>
              <Icon name="play" size={30} className="meta-play" />
              {instance.lastLaunch ? formatDate(instance.lastLaunch) : t('Nunca')}
            </span>
            <span data-tip={t('Tiempo jugado')}>
              <Icon name="timer" size={23} />
              {formatPlaytime(instance.totalPlayed)}
            </span>
            <span className="meta-sep" />
            <span data-tip={t('Versión de Minecraft')}>
              <Icon name="gamepad" size={26} />
              {instance.mcVersion || '?'}
            </span>
            <span data-tip={t('Cargador')}>
              <Icon name="loader" size={25} />
              {instance.loader ? `${instance.loader.name} - ${instance.loader.version}` : 'Vanilla'}
            </span>
          </div>
        </div>
      </div>
      <InstanceKebab instance={instance} anchor={kebab.anchor} open={kebab.open} onClose={kebab.close} />
      <Popover anchor={play.anchor} open={play.open} onClose={play.close} align="right" className="menu play-pop">
        <PlayDropdown instance={instance} worlds={worlds} servers={servers} onClose={play.close} />
      </Popover>

      <div className="inst-tabs-row">
        <Tabs
          value={tab}
          onChange={(v) => app.patchRoute({ tab: v })}
          tabs={[
            { value: 'content', label: t('Contenido'), count: totalContent === null ? undefined : totalContent },
            { value: 'logs', label: t('Logs') },
            { value: 'screenshots', label: t('Capturas') },
          ]}
        />
        <Button variant="secondary" size="lg" icon="plus" iconSize={28} className="add-content" onClick={() => app.navigate({ page: 'browse', type: SUB_TYPE[sub] || 'mod', instanceId: instance.id })}>
          {t('Agregar contenido')}
        </Button>
      </div>

      {tab === 'content' ? (
        <>
          <SubTabs
            value={sub}
            onChange={(v) => app.patchRoute({ sub: v })}
            tabs={[
              // vanilla profiles can't load mods or shaders: those tabs only
              // show up if they already have files
              ...(modded || (counts && counts.mods) ? [{ value: 'mods', label: t('Mods'), count: counts ? counts.mods : undefined }] : []),
              { value: 'datapacks', label: t('Data Packs'), count: counts ? counts.datapacks : undefined },
              { value: 'resourcepacks', label: t('Resource Packs'), count: counts ? counts.resourcepacks : undefined },
              ...(modded || (counts && counts.shaderpacks) ? [{ value: 'shaderpacks', label: t('Shaders'), count: counts ? counts.shaderpacks : undefined }] : []),
              { value: 'worlds', label: t('Mundos'), count: counts ? counts.worlds : undefined },
            ]}
          />
          <div className="sub-content">
            {sub === 'worlds' ? (
              <WorldsTab instance={instance} worlds={worlds} reload={() => (loadWorlds(), loadCounts())} />
            ) : sub === 'datapacks' ? (
              worlds ? <DataPacksTab instance={instance} worlds={worlds} onCount={countHandlers.datapacks} /> : <Spinner />
            ) : (
              <ContentTab key={sub} instance={instance} kind={sub} onCount={countHandlers[sub]} />
            )}
          </div>
        </>
      ) : null}
      {tab === 'logs' ? <LogsTab instance={instance} file={route.logFile} /> : null}
      {tab === 'screenshots' ? <ScreenshotsTab instance={instance} /> : null}
    </div>
  );
}
