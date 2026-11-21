// An instance in the Modrinth layout: its picture, name, loader, version and
// time played, Play (or Stop) with the world/server picker, settings and
// more options, then tabs: Content, Worlds, Logs, Screenshots.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Spinner } from '../components/ui.jsx';
import { Popover, useMenu } from '../components/Menu.jsx';
import InstanceImage, { LoaderIcon } from '../components/InstanceImage.jsx';
import { IC } from './mrsize.js';
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

// Modrinth's NavTabs (packages/ui/src/components/base/NavTabs.vue): a pill
// holding the tabs, with the highlight sliding to the chosen one
export function MrTabs({ value, onChange, tabs }) {
  const wrap = useRef(null);
  const [box, setBox] = useState(null);
  const [animate, setAnimate] = useState(false);
  useLayoutEffect(() => {
    const el = wrap.current && wrap.current.querySelector('.mr-tab.on');
    if (!el) return setBox(null);
    const measure = () => setBox({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [value, tabs.map((x) => x.label).join('|')]);
  useEffect(() => {
    // no slide on the first paint, only when the tab changes
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div ref={wrap} className="mr-tabs" role="tablist">
      {tabs.map((tb) => (
        <button key={tb.value} role="tab" aria-selected={value === tb.value} className={`mr-tab ${value === tb.value ? 'on' : ''}`} onClick={() => onChange(tb.value)}>
          {tb.icon ? <Icon name={tb.icon} size={IC.s5} /> : null}
          <span>{tb.label}</span>
          {tb.count !== undefined && tb.count !== null ? <span className="mr-tab-count">{tb.count}</span> : null}
        </button>
      ))}
      {box ? <span className={`mr-tab-slider ${animate ? 'animate' : ''}`} style={{ left: box.left, top: box.top, width: box.width, height: box.height }} aria-hidden="true" /> : null}
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
            <Icon name="alert" size={IC.s6 * 1.5} />
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
    <div className="mr-instance">
      <header className="mr-inst-head" onContextMenu={(e) => (e.preventDefault(), kebab.toggle())}>
        <button className="mr-inst-head-art" onClick={() => actions.editIcon(app, instance)} aria-label={t('Cambiar ícono…')} data-tip={t('Cambiar ícono…')}>
          <InstanceImage instance={instance} />
        </button>
        <div className="mr-inst-head-text">
          <h1 title={instance.name}>{instance.name}</h1>
          <div className="mr-inst-meta">
            <span className="mr-meta-item" data-tip={t('Cargador y versión de Minecraft')}>
              <LoaderIcon loader={instance.loader} size={IC.s5} />
              {loaderText(instance)} {instance.mcVersion}
            </span>
            {instance.totalPlayed ? (
              <span className="mr-meta-item" data-tip={t('Tiempo jugado')}>
                <Icon name="timer" size={IC.s5} />
                {formatPlaytime(instance.totalPlayed)}
              </span>
            ) : null}
            <span className="mr-meta-item" data-tip={t('Última vez jugado')}>
              <Icon name="clock" size={IC.s5} />
              {instance.lastLaunch ? t('Jugado {when}', { when: timeAgo(instance.lastLaunch).toLowerCase() }) : t('Nunca jugado')}
            </span>
          </div>
        </div>
        <div className="mr-inst-actions">
          <div className="mr-split">
            <button className={`mr-btn xl ${running ? 'danger' : 'brand'}`} onClick={() => (running ? call('instances.stop', instance.id) : app.launch(instance.id))}>
              {launching ? <Spinner size={IC.s6} /> : <Icon name={running ? 'stop' : 'play'} size={IC.s6} />}
              {launching ? t('Iniciando…') : running ? t('Detener') : t('Jugar')}
            </button>
            <button ref={play.anchor} className={`mr-btn xl ${running ? 'danger' : 'brand'} mr-split-more`} onClick={play.toggle} aria-label={t('Elegir mundo o servidor')} data-tip={t('Elegir mundo o servidor')}>
              <Icon name="dropdown" size={IC.s6} className={play.open ? 'flip' : ''} />
            </button>
          </div>
          <button className="mr-icon-btn xl" onClick={() => actions.profileOptions(app, instance)} aria-label={t('Opciones del perfil')} data-tip={t('Opciones del perfil')}>
            <Icon name="settings" size={IC.s6} />
          </button>
          <button ref={kebab.anchor} className="mr-icon-btn xl quiet" onClick={kebab.toggle} aria-label={t('Más opciones')} data-tip={t('Más opciones')}>
            <Icon name="more" size={IC.s6} />
          </button>
        </div>
        <InstanceKebab instance={instance} anchor={kebab.anchor} open={kebab.open} onClose={kebab.close} />
        <Popover anchor={play.anchor} open={play.open} onClose={play.close} align="right" className="menu play-pop mr-pop">
          <PlayDropdown instance={instance} worlds={worlds} servers={servers} onClose={play.close} />
        </Popover>
      </header>
      <div className="mr-inst-tabs">
        <MrTabs
          value={tab}
          onChange={(v) => app.patchRoute({ tab: v })}
          tabs={[
            { value: 'content', label: t('Contenido'), icon: 'boxes' },
            { value: 'screenshots', label: t('Capturas'), icon: 'image' },
            { value: 'worlds', label: t('Mundos'), icon: 'globe' },
            { value: 'logs', label: t('Registros'), icon: 'terminal' },
          ]}
        />
      </div>
      <div className="mr-inst-body">
        {tab === 'content' ? <MrContent instance={instance} /> : null}
        {tab === 'worlds' ? <WorldsTab instance={instance} worlds={worlds} reload={loadWorlds} /> : null}
        {tab === 'logs' ? <LogsTab instance={instance} file={route.logFile} /> : null}
        {tab === 'screenshots' ? <ScreenshotsTab instance={instance} /> : null}
      </div>
    </div>
  );
}
