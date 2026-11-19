// An instance in the Modrinth layout: its picture, name, loader, version and
// time played, Play (or Stop) with the world/server picker, settings and
// more options, then tabs: Content, Worlds, Logs, Screenshots.
import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Spinner } from '../components/ui.jsx';
import { Popover, useMenu } from '../components/Menu.jsx';
import InstanceImage from '../components/InstanceImage.jsx';
import PlayDropdown from '../components/PlayDropdown.jsx';
import WorldsTab from '../pages/instance/WorldsTab.jsx';
import LogsTab from '../pages/instance/LogsTab.jsx';
import ScreenshotsTab from '../pages/instance/ScreenshotsTab.jsx';
import { InstanceKebab } from '../pages/Instance.jsx';
import MrContent from './MrContent.jsx';
import { loaderText } from './MrHome.jsx';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { timeAgo, formatPlaytime } from '../lib/format.js';
import * as actions from '../lib/actions.js';

export function MrTabs({ value, onChange, tabs }) {
  return (
    <div className="mr-tabs" role="tablist">
      {tabs.map((tb) => (
        <button key={tb.value} role="tab" aria-selected={value === tb.value} className={`mr-tab ${value === tb.value ? 'on' : ''}`} onClick={() => onChange(tb.value)}>
          {tb.icon ? <Icon name={tb.icon} size={18} /> : null}
          {tb.label}
          {tb.count !== undefined && tb.count !== null ? <span className="mr-tab-count">{tb.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export default function MrInstance() {
  const app = useApp();
  const { route, instances, instancesLoaded } = app;
  const instance = instances.find((i) => i.id === route.id);
  const tab = ['content', 'worlds', 'logs', 'screenshots'].includes(route.tab) ? route.tab : 'content';
  const [worlds, setWorlds] = useState(null);
  const [servers, setServers] = useState(null);
  const kebab = useMenu();
  const play = useMenu();
  const running = instance && app.running.has(instance.id);
  const launching = Boolean(instance && app.launching && app.launching.has(instance.id));

  const loadWorlds = useCallback(() => {
    if (!route.id) return;
    call('worlds.list', route.id).then(setWorlds).catch(() => setWorlds([]));
    call('servers.list', route.id).then(setServers).catch(() => setServers([]));
  }, [route.id]);
  useEffect(() => {
    setWorlds(null);
    loadWorlds();
  }, [route.id]);
  useEffect(() => {
    if (worlds) loadWorlds();
  }, [app.contentVersion, instance && instance.lastLaunch]);

  if (!instance) {
    return (
      <div className="mr-page">
        {instancesLoaded ? (
          <div className="mr-empty">
            <Icon name="alert" size={36} />
            <strong>{t('No se encontró el perfil')}</strong>
            <span>{route.id}</span>
            <button className="mr-btn" onClick={() => app.navigate({ page: 'library' })}>
              {t('Volver')}
            </button>
          </div>
        ) : (
          <div className="center-spinner">
            <Spinner />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mr-page mr-instance">
      <header className="mr-inst-head" onContextMenu={(e) => (e.preventDefault(), kebab.toggle())}>
        <button className="mr-inst-head-art" onClick={() => actions.editIcon(app, instance)} aria-label={t('Cambiar ícono…')} data-tip={t('Cambiar ícono…')}>
          <InstanceImage instance={instance} />
        </button>
        <div className="mr-inst-head-text">
          <h1 title={instance.name}>{instance.name}</h1>
          <div className="mr-inst-meta">
            <span>
              <Icon name="loader" size={16} />
              {loaderText(instance)} {instance.mcVersion}
            </span>
            <span className="mr-dot" />
            <span>
              <Icon name="clock" size={16} />
              {instance.lastLaunch ? t('Jugado {when}', { when: timeAgo(instance.lastLaunch).toLowerCase() }) : t('Nunca jugado')}
            </span>
            {instance.totalPlayed ? (
              <>
                <span className="mr-dot" />
                <span>
                  <Icon name="timer" size={16} />
                  {formatPlaytime(instance.totalPlayed)}
                </span>
              </>
            ) : null}
          </div>
        </div>
        <span className="spacer" />
        <div className="mr-play-group">
          <button className={`mr-btn lg ${running ? 'danger' : 'brand'}`} onClick={() => (running ? call('instances.stop', instance.id) : app.launch(instance.id))}>
            {launching ? <Spinner size={18} /> : <Icon name={running ? 'stop' : 'play'} size={20} />}
            {launching ? t('Iniciando…') : running ? t('Detener') : t('Jugar')}
          </button>
          <button ref={play.anchor} className={`mr-btn lg ${running ? 'danger' : 'brand'} mr-play-more`} onClick={play.toggle} aria-label={t('Elegir mundo o servidor')} data-tip={t('Elegir mundo o servidor')}>
            <Icon name={play.open ? 'chevronUp' : 'chevronDown'} size={18} />
          </button>
        </div>
        <button className="mr-icon-btn round lg" onClick={() => actions.profileOptions(app, instance)} aria-label={t('Opciones del perfil')} data-tip={t('Opciones del perfil')}>
          <Icon name="settings" size={22} />
        </button>
        <button ref={kebab.anchor} className="mr-icon-btn round lg quiet" onClick={kebab.toggle} aria-label={t('Más opciones')}>
          <Icon name="more" size={22} />
        </button>
        <InstanceKebab instance={instance} anchor={kebab.anchor} open={kebab.open} onClose={kebab.close} />
        <Popover anchor={play.anchor} open={play.open} onClose={play.close} align="right" className="menu play-pop mr-pop">
          <PlayDropdown instance={instance} worlds={worlds} servers={servers} onClose={play.close} />
        </Popover>
      </header>
      <MrTabs
        value={tab}
        onChange={(v) => app.patchRoute({ tab: v })}
        tabs={[
          { value: 'content', label: t('Contenido'), icon: 'puzzle' },
          { value: 'worlds', label: t('Mundos'), icon: 'globe', count: worlds ? worlds.length : undefined },
          { value: 'logs', label: t('Registros'), icon: 'terminal' },
          { value: 'screenshots', label: t('Capturas'), icon: 'image' },
        ]}
      />
      <div className="mr-inst-body">
        {tab === 'content' ? <MrContent instance={instance} /> : null}
        {tab === 'worlds' ? <WorldsTab instance={instance} worlds={worlds} reload={loadWorlds} /> : null}
        {tab === 'logs' ? <LogsTab instance={instance} file={route.logFile} /> : null}
        {tab === 'screenshots' ? <ScreenshotsTab instance={instance} /> : null}
      </div>
    </div>
  );
}
