// The Modrinth layout: a title bar with back/forward, breadcrumbs and what is
// running, a narrow icon bar on the left (pages, recent instances, create,
// settings, account), the page in a rounded panel, and a sidebar on the right
// with first steps, the account and Havikun's channels. Same features as the
// CurseForge layout, arranged and drawn the way the Modrinth app does
// (apps/app-frontend/src/App.vue and app/shell/* in github.com/modrinth/code).
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../components/Icon.jsx';
import { Progress, Spinner } from '../components/ui.jsx';
import { Popover, MenuItem, MenuSeparator, useMenu, useContextMenu } from '../components/Menu.jsx';
import { Logo, AccountAvatar, AccountMenuContent, DownloadsPanel, OfflineAccountButton } from '../components/Shell.jsx';
import InstanceImage from '../components/InstanceImage.jsx';
import ImportLaunchersDialog from '../dialogs/ImportLaunchersDialog.jsx';
import AddAccountDialog from '../dialogs/AddAccountDialog.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import MrSocials from './MrSocials.jsx';
import { useDropTarget } from '../lib/instanceDrag.js';
import { capturingInput } from '../lib/inputCapture.js';
import { MrNavDecor, MrTitleDecor } from './MrSeasonal.jsx';
import { SeasonBackdrop } from '../components/Seasonal.jsx';
import { IC, AV } from './mrsize.js';

// ---------------------------------------------------------------- sidebar slot
// Pages put their own sidebar content (browse filters) in the right sidebar.
const SlotCtx = createContext(null);

export function SidebarPortal({ children }) {
  const node = useContext(SlotCtx);
  if (!node) return null;
  return createPortal(children, node);
}

// ---------------------------------------------------------------- title bar
function crumbsFor(route, app) {
  const inst = route.instanceId || route.id ? app.instances.find((i) => i.id === (route.instanceId || route.id)) : null;
  const TYPE = { modpack: t('Modpacks'), mod: t('Mods'), resourcepack: t('Resource Packs'), shader: t('Shaders'), datapack: t('Data Packs'), world: t('Mundos') };
  const TAB = { worlds: t('Mundos'), logs: t('Registros'), screenshots: t('Capturas') };
  const instCrumb = (i, to) => ({ label: i ? i.name : route.id, inst: i, to });
  switch (route.page) {
    case 'instance':
      return [{ label: t('Biblioteca'), to: { page: 'library' } }, instCrumb(inst, { page: 'instance', id: route.id }), ...(route.tab && TAB[route.tab] ? [{ label: TAB[route.tab] }] : [])];
    case 'browse':
    case 'discover':
      if (inst) return [{ label: t('Biblioteca'), to: { page: 'library' } }, instCrumb(inst, { page: 'instance', id: inst.id }), { label: t('Agregar contenido') }];
      return [{ label: t('Descubrir contenido') }, { label: TYPE[route.type || 'modpack'] || '' }];
    case 'project':
      return inst ? [instCrumb(inst, { page: 'instance', id: inst.id }), { label: t('Proyecto') }] : [{ label: t('Descubrir contenido'), to: { page: 'browse', type: 'modpack' } }, { label: t('Proyecto') }];
    case 'servers':
      return [{ label: t('Servidores') }];
    case 'skins':
      return [{ label: t('Skins') }];
    case 'screenshots':
      return [{ label: t('Capturas') }];
    case 'help':
      return [{ label: t('Ayuda') }];
    case 'settings':
      return [{ label: t('Ajustes') }];
    default:
      return [{ label: t('Inicio') }];
  }
}

// Breadcrumbs: when they don't fit, they fade at the edges and scroll into
// view while hovered (app/shell/title-bar/breadcrumbs.vue)
function Crumbs({ crumbs }) {
  const app = useApp();
  const outer = useRef(null);
  const inner = useRef(null);
  const [overflow, setOverflow] = useState(0);
  useLayoutEffect(() => {
    const check = () => {
      if (!outer.current || !inner.current) return;
      const cs = getComputedStyle(outer.current);
      const room = outer.current.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setOverflow(Math.max(0, Math.ceil(inner.current.scrollWidth - room)));
    };
    check();
    const ro = new ResizeObserver(check);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [crumbs]);
  return (
    <nav ref={outer} className={`mr-crumbs ${overflow ? 'overflowing' : ''}`} aria-label={t('Ubicación')} style={overflow ? { '--scroll': `-${overflow}px` } : undefined}>
      <div ref={inner} className="mr-crumbs-inner">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          const body = (
            <>
              {c.inst ? (
                <span className="mr-crumb-avatar">
                  <InstanceImage instance={c.inst} res={128} />
                </span>
              ) : null}
              <span>{c.label}</span>
            </>
          );
          return (
            <span key={i} className="mr-crumb-wrap">
              {c.to && !last ? (
                <button className="mr-crumb" onClick={() => app.navigate(c.to)}>
                  {body}
                </button>
              ) : (
                <span className="mr-crumb current" aria-current={last ? 'page' : undefined}>
                  {body}
                </span>
              )}
              {!last ? <Icon name="chevronRight" size={IC.s5} className="mr-crumb-sep" /> : null}
            </span>
          );
        })}
      </div>
    </nav>
  );
}

// What is running: always there, like Modrinth's action bar
function RunningStatus() {
  const app = useApp();
  const playing = app.instances.filter((i) => app.running.has(i.id));
  const [pick, setPick] = useState(null);
  const more = useMenu();
  const current = playing.find((i) => i.id === pick) || playing[0];
  if (!current) {
    return (
      <div className="mr-status">
        <span className="mr-status-dot" />
        <span className="mr-status-idle">{t('No hay instancias en ejecución')}</span>
      </div>
    );
  }
  return (
    <div className="mr-status">
      <span className="mr-online" aria-hidden="true" />
      <button className="mr-status-name" onClick={() => app.navigate({ page: 'instance', id: current.id })} data-tip={t('Ver instancia')}>
        {current.name}
      </button>
      {playing.length > 1 ? (
        <>
          <button ref={more.anchor} className="mr-status-more" onClick={more.toggle} aria-label={t('Más instancias en ejecución')} data-tip={t('Más instancias en ejecución')}>
            <Icon name="dropdown" size={IC.s4} className={more.open ? 'flip' : ''} />
          </button>
          <Popover anchor={more.anchor} open={more.open} onClose={more.close} align="right" className="menu mr-pop">
            {playing.map((i) => (
              <MenuItem key={i.id} label={i.name} checked={i.id === current.id} onClick={() => (more.close(), setPick(i.id))} />
            ))}
          </Popover>
        </>
      ) : null}
      <button className="mr-status-ico stop" onClick={() => call('instances.stop', current.id)} aria-label={t('Detener instancia')} data-tip={t('Detener instancia')}>
        <Icon name="stop" size={IC.s5} />
      </button>
      <button className="mr-status-ico" onClick={() => app.navigate({ page: 'instance', id: current.id, tab: 'logs' })} aria-label={t('Ver registros')} data-tip={t('Ver registros')}>
        <Icon name="terminal" size={IC.s5} />
      </button>
    </div>
  );
}

function TitleBar() {
  const app = useApp();
  const { back, forward, history, maximized, route, tasks } = app;
  const crumbs = useMemo(() => crumbsFor(route, app), [route, app.instances, app.langVersion]);
  const dl = useMenu();
  const more = useMenu();
  const running = tasks.filter((x) => x.status === 'running');
  const progress = running.length ? running.reduce((a, x) => a + (x.progress || 0), 0) / running.length : 0;
  const canBack = history.index > 0;
  const canForward = history.index < history.stack.length - 1;
  return (
    <header className="mr-titlebar">
      <MrTitleDecor />
      <div className="mr-tb-left">
        <span className="mr-wordmark">
          <Logo size={35} />
          <span>Havi Hub</span>
        </span>
        <div className="mr-nav-arrows">
          <button className="mr-nav-arrow" disabled={!canBack} onClick={back} aria-label={t('Atrás')} data-tip={t('Atrás')}>
            <Icon name="chevronLeft" size={IC.s4} />
          </button>
          <button className="mr-nav-arrow" disabled={!canForward} onClick={forward} aria-label={t('Adelante')} data-tip={t('Adelante')}>
            <Icon name="chevronRight" size={IC.s4} />
          </button>
        </div>
        <Crumbs crumbs={crumbs} />
      </div>
      <div className="mr-tb-drag" />
      <div className="mr-tb-actions">
        {/* like Modrinth: the downloads button is there while there are downloads */}
        {tasks.length || dl.open ? (
          <button ref={dl.anchor} className={`mr-icon-btn quiet ${running.length ? 'brand-text' : ''} ${dl.open ? 'on' : ''}`} onClick={dl.toggle} aria-label={t('Descargas')} data-tip={t('Descargas')}>
            {running.length ? <span className="mr-ring" style={{ '--p': `${Math.round(progress * 100)}%` }} /> : null}
            <Icon name="download" size={IC.s5} />
          </button>
        ) : null}
        <button ref={more.anchor} className={`mr-icon-btn quiet ${more.open ? 'on' : ''}`} onClick={more.toggle} aria-label={t('Más opciones')} data-tip={t('Más opciones')}>
          <Icon name="moreH" size={IC.s5} />
        </button>
        <RunningStatus />
        <Popover anchor={dl.anchor} open={dl.open} onClose={dl.close} align="right" className="downloads-pop mr-pop">
          <DownloadsPanel />
        </Popover>
        <Popover anchor={more.anchor} open={more.open} onClose={more.close} align="right" className="menu mr-pop">
          <MenuItem icon="folder" label={t('Abrir carpeta de Havi Hub')} onClick={() => (more.close(), call('app.openDataDir'))} />
          <MenuItem icon="import" label={t('Importar desde otro launcher…')} onClick={() => (more.close(), app.openDialog(ImportLaunchersDialog, {}))} />
          <MenuItem icon="settings" label={t('Ajustes del juego')} onClick={() => (more.close(), app.navigate({ page: 'settings', section: 'minecraft' }))} />
          <MenuSeparator />
          <MenuItem icon="help" label={t('Ayuda')} onClick={() => (more.close(), app.navigate({ page: 'help' }))} />
        </Popover>
      </div>
      <div className="mr-window">
        <button className="mr-win-btn" onClick={() => call('app.window', 'minimize')} aria-label={t('Minimizar')}>
          <Icon name="minimize" size={IC.s5} />
        </button>
        <button className="mr-win-btn" onClick={() => call('app.window', 'maximize')} aria-label={maximized ? t('Restaurar') : t('Maximizar')}>
          <Icon name={maximized ? 'restore' : 'maximize'} size={IC.s5} />
        </button>
        <button className="mr-win-btn close" onClick={() => call('app.window', 'close')} aria-label={t('Cerrar')}>
          <Icon name="x" size={IC.s5} />
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- left bar
function NavButton({ icon, label, active, sub, onClick, children, anchorRef, className = '', iconClass }) {
  return (
    <button ref={anchorRef} className={`mr-navbtn ${active ? 'active' : ''} ${sub ? 'sub' : ''} ${className}`} onClick={onClick} aria-label={label} data-tip={label} data-tip-pos="right">
      {children || <Icon name={icon} size={IC.s6} className={iconClass} />}
    </button>
  );
}

// a recent instance in the bar (QuickInstanceSwitcher.vue): its picture at
// 28 px in a round button; right click to play, stop, open its folder
function QuickInstance({ inst, active, onContext }) {
  const app = useApp();
  return (
    <button
      className={`mr-navbtn mr-quick ${active ? 'active' : ''}`}
      onClick={() => app.navigate({ page: 'instance', id: inst.id })}
      onContextMenu={(e) => onContext(e, inst)}
      aria-label={inst.name}
      data-tip={inst.name}
      data-tip-pos="right"
    >
      <span className="mr-quick-art">
        <InstanceImage instance={inst} res={128} />
      </span>
    </button>
  );
}

const QUICK_MAX = 20; // use-quick-instance-limit.ts

function NavBar() {
  const app = useApp();
  const { route, navigate, instances, activeAccount } = app;
  const acc = useMenu();
  const ctx = useContextMenu();
  const quick = useRef(null);
  const foot = useRef(null);
  const [room, setRoom] = useState(0);
  // newest first: played or created, whichever came last
  const sorted = useMemo(() => {
    const when = (i) => Math.max(i.lastLaunch || 0, i.created || 0);
    return [...instances].sort((a, b) => when(b) - when(a) || a.name.localeCompare(b.name));
  }, [instances]);
  // as many as fit between the pages and Settings
  useLayoutEffect(() => {
    const el = quick.current;
    if (!el) return undefined;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 20;
      const divider = 0.85 * rem + 1; // the line and its room above and below
      const gap = rem / 4;
      const footer = (foot.current ? foot.current.offsetHeight : 0) + gap;
      setRoom(Math.max(0, Math.floor((el.clientHeight - footer - 2 * divider - gap) / (3 * rem + gap))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const recent = sorted.slice(0, Math.min(room, QUICK_MAX));
  const page = route.page;
  const inInstance = route.page === 'instance' || ((route.page === 'browse' || route.page === 'project') && route.instanceId);
  const browsing = (page === 'browse' || page === 'discover' || page === 'project') && !route.instanceId;
  // dropping a profile on Inicio takes it out of its group
  const [libProps, libOver] = useDropTarget(async (id) => {
    const inst = instances.find((i) => i.id === id);
    if (!inst || !inst.group) return;
    try {
      await call('instances.setGroup', id, '');
      app.toast(t('{name} salió del grupo {group}', { name: inst.name, group: inst.group }), { type: 'success' });
    } catch (e) {
      app.showError(e);
    }
  });
  const ctxInst = ctx.data;
  const ctxRunning = ctxInst && app.running.has(ctxInst.id);
  return (
    <nav className="mr-navbar">
      <MrNavDecor />
      <div className={`mr-navbtn-wrap ${libOver ? 'drop' : ''}`} {...libProps}>
        <NavButton icon="play" iconClass="mr-play-nudge" label={t('Inicio')} active={page === 'home' || page === 'library'} sub={inInstance && page !== 'instance'} onClick={() => navigate({ page: 'library' })} />
      </div>
      <NavButton icon="compass" label={t('Descubrir contenido')} active={browsing && page !== 'project'} sub={page === 'project' && !route.instanceId} onClick={() => navigate({ page: 'browse', type: route.type && browsing ? route.type : 'modpack' })} />
      <NavButton icon="shirt" label={t('Skins')} active={page === 'skins'} onClick={() => navigate({ page: 'skins' })} />
      <NavButton icon="image" label={t('Capturas')} active={page === 'screenshots'} onClick={() => navigate({ page: 'screenshots' })} />
      <NavButton icon="serverStack" label={t('Servidores')} active={page === 'servers'} onClick={() => navigate({ page: 'servers' })} />
      <div ref={quick} className="mr-quick-zone">
        {recent.length ? (
          <div className="mr-nav-divider top">
            <span />
          </div>
        ) : null}
        <div className="mr-quick-list" aria-label={t('Instancias recientes')}>
          {recent.map((i) => (
            <QuickInstance key={i.id} inst={i} active={route.page === 'instance' && route.id === i.id} onContext={ctx.show} />
          ))}
        </div>
        <div className="mr-nav-divider">
          <span />
        </div>
        <div ref={foot} className="mr-quick-foot">
          <NavButton
            icon="plus"
            label={t('Crear instancia')}
            onClick={() => {
              if (page !== 'library' && page !== 'home') navigate({ page: 'library' });
              setTimeout(() => window.dispatchEvent(new CustomEvent('havihub:create-instance')), page === 'library' || page === 'home' ? 0 : 80);
            }}
          />
        </div>
      </div>
      <NavButton icon="settings" label={t('Ajustes')} active={page === 'settings'} onClick={() => navigate({ page: 'settings', section: 'launcher' })} />
      <NavButton label={activeAccount ? activeAccount.name : t('Iniciar sesión')} anchorRef={acc.anchor} active={false} onClick={acc.toggle} className={`mr-account ${acc.open ? 'open' : ''}`}>
        {activeAccount ? <AccountAvatar account={activeAccount} size={AV.a32} /> : <Icon name="logIn" size={IC.s6} className="mr-login" />}
      </NavButton>
      <Popover anchor={acc.anchor} open={acc.open} onClose={acc.close} side="right" className="menu account-menu mr-pop">
        <AccountMenuContent onClose={acc.close} />
      </Popover>
      {ctxInst ? (
        <Popover point={ctx.point} open={ctx.open} onClose={ctx.close} className="menu mr-pop">
          {ctxRunning ? (
            <MenuItem icon="stop" label={t('Detener')} danger onClick={() => (ctx.close(), call('instances.stop', ctxInst.id))} />
          ) : (
            <MenuItem icon="play" label={t('Jugar')} onClick={() => (ctx.close(), app.launch(ctxInst.id))} />
          )}
          <MenuSeparator />
          <MenuItem icon="eye" label={t('Ver instancia')} onClick={() => (ctx.close(), navigate({ page: 'instance', id: ctxInst.id }))} />
          <MenuItem icon="folderOpen" label={t('Abrir carpeta')} onClick={() => (ctx.close(), call('instances.openFolder', ctxInst.id))} />
        </Popover>
      ) : null}
    </nav>
  );
}

// ---------------------------------------------------------------- right sidebar
// "Playing as": the account, opening in place to switch, add or remove
// (features/minecraft-accounts/accounts-card.vue)
function PlayingAs() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const a = app.activeAccount;
  const streamer = app.config && app.config.privacy && app.config.privacy.streamerMode;
  const hide = (name) => (streamer ? '••••••' : name);
  const setActive = async (id) => {
    try {
      await call('accounts.setActive', id);
      await app.refreshAccounts();
    } catch (e) {
      app.showError(e);
    }
  };
  const remove = async (acc) => {
    const ok = await app.confirm({ title: t('Cerrar sesión'), message: t('¿Quitar la cuenta {name} de Havi Hub? Tendrás que volver a iniciar sesión para jugar online.', { name: acc.name }), confirmLabel: t('Cerrar sesión'), danger: true });
    if (!ok) return;
    try {
      await call('accounts.remove', acc.id);
      await app.refreshAccounts();
    } catch (e) {
      app.showError(e);
    }
  };
  return (
    <section className="mr-side-section">
      <h3 className="mr-side-title">{t('Jugando como')}</h3>
      {!app.accounts.length ? (
        <div className="mr-account-empty">
          <span>{t('No has iniciado sesión.')}</span>
          <button className="mr-btn brand" onClick={() => app.openDialog(AddAccountDialog, {})}>
            <Icon name="logIn" size={IC.s5} />
            {t('Iniciar sesión en Minecraft')}
          </button>
        </div>
      ) : (
        <div className={`mr-account-box ${open ? 'open' : ''}`}>
          <button className="mr-account-card" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <span className="mr-account-face">
              <AccountAvatar account={a} size={AV.a36} />
            </span>
            <span className="mr-account-text">
              <span className="mr-account-name">{a ? hide(a.name) : t('Elige una cuenta')}</span>
              <small>{a && a.type === 'Offline' ? t('Cuenta offline') : t('Cuenta de Minecraft')}</small>
            </span>
            <Icon name="dropdown" size={IC.s5} className="mr-chevron" />
          </button>
          <div className="mr-collapse" inert={open ? undefined : ''}>
            <div>
              <div className="mr-account-list">
                {app.accounts.map((acc) => (
                  <div key={acc.id} className="mr-account-row">
                    <button className={`mr-account-pick ${acc.active ? 'on' : ''}`} onClick={() => setActive(acc.id)}>
                      <Icon name={acc.active ? 'radioChecked' : 'radio'} size={IC.s5} className="mr-radio" />
                      <AccountAvatar account={acc} size={AV.a24} />
                      <span>{hide(acc.name)}</span>
                    </button>
                    <button className="mr-icon-btn danger-hover" onClick={() => remove(acc)} aria-label={t('Quitar cuenta')} data-tip={t('Quitar cuenta')}>
                      <Icon name="trash" size={IC.s5} />
                    </button>
                  </div>
                ))}
                <div className="mr-account-add">
                  <button className="mr-btn" onClick={() => app.openDialog(AddAccountDialog, {})}>
                    <Icon name="plus" size={IC.s5} />
                    {t('Agregar cuenta')}
                  </button>
                  <OfflineAccountButton className="mr-account-offline" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// first steps (features/onboarding/checklist.vue)
function FirstSteps() {
  const app = useApp();
  const [open, setOpen] = useState(true);
  const steps = [
    { done: app.instances.length > 0, label: t('Crear tu primera instancia'), go: () => window.dispatchEvent(new CustomEvent('havihub:create-instance')) },
    { done: app.accounts.some((a) => a.type !== 'Offline'), label: t('Iniciar sesión en Minecraft'), go: () => app.navigate({ page: 'settings', section: 'accounts' }) },
    { done: app.instances.some((i) => i.lastLaunch), label: t('Jugar por primera vez'), go: () => app.navigate({ page: 'library' }) },
  ];
  if (steps.every((s) => s.done) || (app.config && app.config.firstStepsHidden)) return null;
  return (
    <section className="mr-side-section mr-checklist-section">
      <div className={`mr-checklist ${open ? 'open' : ''}`}>
        <button className="mr-checklist-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span>{t('Primeros pasos')}</span>
          <Icon name="dropdown" size={IC.s5} className="mr-chevron" />
        </button>
        <div className="mr-collapse" inert={open ? undefined : ''}>
          <div>
            <div className="mr-checklist-body">
              {steps.map((s, i) => (
                <button key={i} className={`mr-step ${s.done ? 'done' : ''}`} onClick={s.done ? undefined : s.go} disabled={s.done}>
                  {s.done ? (
                    <span className="mr-step-check">
                      <Icon name="check" size={IC.s3} />
                    </span>
                  ) : (
                    <Icon name="radio" size={IC.s5} />
                  )}
                  <span className="mr-step-label">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RunningTasks() {
  const { tasks } = useApp();
  const running = tasks.filter((x) => x.status === 'running').slice(0, 4);
  if (!running.length) return null;
  return (
    <section className="mr-side-section">
      <h3 className="mr-side-title">{t('Descargando')}</h3>
      <div className="mr-side-tasks">
        {running.map((x) => (
          <div key={x.id} className="mr-side-task">
            <span className="mr-side-task-title">{x.title}</span>
            <Progress value={x.progress} indeterminate={!x.progress} />
            <small className="muted">{x.detail}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

// the fades at the top and bottom of the sidebar while there is more to scroll
function useScrollFades(ref) {
  const [fades, setFades] = useState({ top: false, bottom: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const check = () => setFades({ top: el.scrollTop > 1, bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1 });
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    for (const c of el.children) ro.observe(c);
    const mo = new MutationObserver(check);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);
  return fades;
}

function RightSidebar({ setSlot }) {
  const scroll = useRef(null);
  const fades = useScrollFades(scroll);
  return (
    <aside className="mr-sidebar">
      <div ref={scroll} className="mr-sidebar-scroll">
        <FirstSteps />
        <div className="mr-sidebar-slot" ref={setSlot} />
        <div className="mr-sidebar-default">
          <PlayingAs />
          <RunningTasks />
          <MrSocials />
        </div>
      </div>
      <div className={`mr-sidebar-fade top ${fades.top ? 'on' : ''}`} aria-hidden="true" />
      <div className={`mr-sidebar-fade bottom ${fades.bottom ? 'on' : ''}`} aria-hidden="true" />
    </aside>
  );
}

// ---------------------------------------------------------------- shell
export default function MrShell({ pages }) {
  const app = useApp();
  const { route, appState, langVersion, history } = app;
  const [slot, setSlot] = useState(null);
  const viewport = useRef(null);
  const settingsOpen = route.page === 'settings';
  // Settings open as a window over the page you were on
  const under = settingsOpen ? [...history.stack.slice(0, history.index)].reverse().find((r) => r.page !== 'settings') || { page: 'library' } : route;
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0;
  }, [under.page, under.id, under.type]);
  // Escape closes the settings window, unless a dialog, a menu or a field
  // being edited takes it first
  const back = app.back;
  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || capturingInput()) return;
      if (document.querySelector('.modal-backdrop, .popover, .lightbox')) return;
      const el = e.target;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) && el.value) return;
      back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen, back]);
  const Page = pages.pick(under);
  return (
    <SlotCtx.Provider value={slot}>
      <div className="mr-app">
        <TitleBar />
        <NavBar />
        {/* the sidebar is there on every page, as in the Modrinth app */}
        <div className="mr-contents with-sidebar">
          <SeasonBackdrop />
          <main className="mr-viewport" ref={viewport} key={langVersion}>
            {!appState ? (
              <div className="center-spinner full">
                <Spinner size={36} />
              </div>
            ) : (
              <ErrorBoundary resetKey={JSON.stringify(under)}>
                <Page route={under} />
              </ErrorBoundary>
            )}
          </main>
          <RightSidebar setSlot={setSlot} />
          <div className="mr-contents-frame" aria-hidden="true" />
        </div>
        {settingsOpen && appState ? (
          <div className="mr-settings-backdrop" onMouseDown={(e) => e.target === e.currentTarget && app.back()}>
            <div className="mr-settings-window" role="dialog" aria-modal="true" aria-label={t('Ajustes')}>
              <div className="mr-settings-head">
                <h2>{t('Ajustes')}</h2>
                <button className="mr-icon-btn mr-settings-close" onClick={app.back} aria-label={t('Cerrar')} data-tip={t('Cerrar')}>
                  <Icon name="x" size={IC.s5} />
                </button>
              </div>
              <div className="mr-settings-body">
                <ErrorBoundary resetKey={JSON.stringify(route)}>
                  <pages.Settings key={langVersion} />
                </ErrorBoundary>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </SlotCtx.Provider>
  );
}
