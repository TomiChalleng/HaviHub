// The instance's content in the Modrinth layout: one table for mods,
// resource packs and shaders (data packs per world), with a search, type
// filters, update all (choose which), switch version, enable/disable and
// remove. Same operations as the CurseForge layout's content tab.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Checkbox, Spinner, Toggle, Select } from '../components/ui.jsx';
import { Popover, MenuItem, MenuHeader, MenuSeparator, useMenu, useContextMenu } from '../components/Menu.jsx';
import SwitchVersionDialog from '../dialogs/SwitchVersionDialog.jsx';
import UpdateProjectsDialog from '../dialogs/UpdateProjectsDialog.jsx';
import { useApp } from '../lib/store.jsx';
import { call, pathForFile } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { formatSize } from '../lib/format.js';
import { showInstallResult } from '../lib/actions.js';
import { downServices } from '../pages/browseShared.jsx';

const KINDS = ['mods', 'resourcepacks', 'shaderpacks'];
const KIND_LABEL = () => ({ mods: t('Mods'), resourcepacks: t('Resource Packs'), shaderpacks: t('Shaders'), datapacks: t('Data Packs') });
const KIND_ICON = { mods: 'puzzle', resourcepacks: 'layers', shaderpacks: 'sun', datapacks: 'globe' };
const TYPE_OF = { mods: 'mod', resourcepacks: 'resourcepack', shaderpacks: 'shader', datapacks: 'datapack' };
const keyOf = (i) => `${i.kind}|${i.fileName}`;

const SORTS = () => [
  { value: 'name', label: t('Nombre (A-Z)') },
  { value: 'nameDesc', label: t('Nombre (Z-A)') },
  { value: 'date', label: t('Agregados recientemente') },
  { value: 'size', label: t('Tamaño') },
];

function ItemIcon({ src, kind }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) return <img className="mr-ct-icon" src={src} alt="" loading="lazy" onError={() => setBroken(true)} />;
  return (
    <span className="mr-ct-icon ph">
      <Icon name={KIND_ICON[kind] || 'box'} size={22} />
    </span>
  );
}

export default function MrContent({ instance }) {
  const app = useApp();
  const modded = Boolean(instance.loader);
  const [lists, setLists] = useState(null); // kind -> items
  const [extra, setExtra] = useState({});
  const [updates, setUpdates] = useState({}); // key -> update
  const [checking, setChecking] = useState(false);
  const [filter, setFilter] = useState('all'); // all | kind
  const [state, setState] = useState('any'); // any | enabled | disabled | updates
  const [sort, setSort] = useState('name');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(new Set());
  const [opening, setOpening] = useState('');
  const [worlds, setWorlds] = useState([]);
  const [world, setWorld] = useState('');
  const [dpItems, setDpItems] = useState(null);
  const [dropping, setDropping] = useState(false);
  const filterMenu = useMenu();
  const rowMenu = useContextMenu();
  const loadId = useRef(0);
  const kinds = useMemo(() => KINDS.filter((k) => modded || k === 'resourcepacks' || (lists && lists[k] && lists[k].length)), [modded, lists]);

  const load = useCallback(async () => {
    const my = ++loadId.current;
    const out = {};
    await Promise.all(
      KINDS.map(async (k) => {
        try {
          out[k] = (await call('content.list', instance.id, k)).items.map((i) => ({ ...i, kind: k }));
        } catch {
          out[k] = [];
        }
      }),
    );
    if (my !== loadId.current) return;
    setLists(out);
    const all = Object.values(out).flat();
    const missing = all.filter((i) => i.meta && (!i.authors.length || !i.icon));
    if (missing.length) call('content.enrich', missing).then((m) => my === loadId.current && setExtra(m)).catch(() => {});
  }, [instance.id]);

  const loadDatapacks = useCallback(async () => {
    try {
      const r = await call('content.list', instance.id, 'datapacks', world ? { world } : {});
      setDpItems(r.items.map((i) => ({ ...i, kind: 'datapacks', world })));
    } catch {
      setDpItems([]);
    }
  }, [instance.id, world]);

  const check = useCallback(
    async (force) => {
      setChecking(true);
      const out = {};
      const down = new Set();
      for (const k of KINDS) {
        try {
          let r = force ? null : await call('content.cachedUpdates', instance.id, k, {});
          if (!r && (force || (app.config && app.config.checkUpdatesOnOpen))) r = await call('content.checkUpdates', instance.id, k, {});
          for (const [f, u] of Object.entries((r && r.updates) || {})) out[`${k}|${f}`] = u;
          for (const s of downServices(r && r.errors)) down.add(s);
        } catch (e) {
          if (force) app.showError(e);
        }
      }
      setUpdates(out);
      if (down.size) app.toast(t('No se pudo consultar {s}: se muestran las actualizaciones disponibles.', { s: [...down].join(' / ') }), { type: 'warning' });
      setChecking(false);
    },
    [instance.id],
  );

  useEffect(() => {
    setLists(null);
    setSelected(new Set());
    load();
    check(false);
    call('worlds.list', instance.id)
      .then((l) => {
        setWorlds(l);
        setWorld((w) => w || (l[0] ? l[0].folder : ''));
      })
      .catch(() => setWorlds([]));
  }, [instance.id]);
  useEffect(() => {
    if (lists) load();
    if (filter === 'datapacks') loadDatapacks();
  }, [app.contentVersion]);
  useEffect(() => {
    if (filter === 'datapacks') loadDatapacks();
  }, [filter, world]);

  const all = useMemo(() => (filter === 'datapacks' ? dpItems || [] : lists ? kinds.flatMap((k) => (filter === 'all' || filter === k ? lists[k] || [] : [])) : []), [lists, kinds, filter, dpItems]);
  const exOf = (i) => (i.meta ? extra[`${i.meta.provider}:${i.meta.projectId}`] : null);
  const iconOf = (i) => i.icon || (exOf(i) || {}).icon || null;
  const authorOf = (i) => i.authors[0] || (exOf(i) || {}).author || '';

  const visible = useMemo(() => {
    let l = all;
    const q = query.trim().toLowerCase();
    if (q) l = l.filter((i) => i.name.toLowerCase().includes(q) || i.fileName.toLowerCase().includes(q) || authorOf(i).toLowerCase().includes(q));
    if (state === 'enabled') l = l.filter((i) => i.enabled);
    if (state === 'disabled') l = l.filter((i) => !i.enabled);
    if (state === 'updates') l = l.filter((i) => updates[keyOf(i)]);
    const byName = (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    // the ones with an update waiting always go first; each part keeps the order chosen
    const pending = (i) => (updates[keyOf(i)] ? 0 : 1);
    const order = sort === 'nameDesc' ? (a, b) => -byName(a, b) : sort === 'date' ? (a, b) => b.mtime - a.mtime : sort === 'size' ? (a, b) => b.size - a.size : byName;
    return [...l].sort((a, b) => pending(a) - pending(b) || order(a, b));
  }, [all, query, state, sort, updates, extra]);

  const updatable = all.filter((i) => updates[keyOf(i)]);
  const total = lists ? kinds.reduce((n, k) => n + (lists[k] || []).length, 0) : 0;
  const reload = () => {
    load();
    if (filter === 'datapacks') loadDatapacks();
  };
  const opts = (i) => (i.kind === 'datapacks' && i.world ? { world: i.world } : {});
  const mark = (k, on) =>
    setBusy((s) => {
      const n = new Set(s);
      if (on) n.add(k);
      else n.delete(k);
      return n;
    });

  const toggle = async (i, v) => {
    try {
      await call('content.setEnabled', instance.id, i.kind, i.fileName, v, opts(i));
    } catch (e) {
      app.showError(e);
    }
    reload();
  };
  const remove = async (list) => {
    const ok = await app.confirm({
      title: list.length === 1 ? t('Eliminar {name}', { name: list[0].name }) : t('Eliminar {n} elementos', { n: list.length }),
      message: t('Se moverán a la papelera.'),
      confirmLabel: t('Eliminar'),
      danger: true,
    });
    if (!ok) return;
    for (const i of list) {
      try {
        await call('content.remove', instance.id, i.kind, [i.fileName], opts(i));
      } catch (e) {
        app.showError(e);
      }
    }
    setSelected(new Set());
    reload();
  };
  const refreshUpdates = async () => {
    const out = {};
    for (const k of KINDS) {
      const r = await call('content.cachedUpdates', instance.id, k, {}).catch(() => null);
      for (const [f, u] of Object.entries((r && r.updates) || {})) out[`${k}|${f}`] = u;
    }
    setUpdates(out);
  };
  // one update: the same dialog, with its changelog open before confirming
  const updateOne = async (i) => {
    const u = updates[keyOf(i)];
    if (!u) return;
    return updateAll([i]);
  };
  // Update all: pick which, per kind (the dialog updates one folder at a time)
  const updateAll = async (only) => {
    const list = (only || all).filter((i) => updates[keyOf(i)]);
    if (!list.length) return;
    const out = { installed: [], skipped: [], blocked: [], failed: [] };
    for (const k of [...new Set(list.map((i) => i.kind))]) {
      const entries = list.filter((i) => i.kind === k).map((i) => ({ item: i, upd: { ...updates[keyOf(i)] }, icon: iconOf(i) }));
      const r = await app.openDialog(UpdateProjectsDialog, { instance, kind: k, entries });
      if (!r) break;
      for (const key of Object.keys(out)) out[key].push(...(r[key] || []));
    }
    setSelected(new Set());
    if (out.installed.length || out.failed.length || out.blocked.length) await showInstallResult(app, out, t('Actualización'));
    await refreshUpdates();
    reload();
  };
  const switchVersion = async (i) => {
    const done = await app.openDialog(SwitchVersionDialog, { instance, kind: i.kind, world: i.world, item: i, icon: iconOf(i) });
    if (done) {
      await refreshUpdates();
      reload();
    }
  };
  const openProject = async (i) => {
    let target = i.meta && i.meta.projectId ? { source: i.meta.provider, projectId: i.meta.projectId } : null;
    if (!target) {
      setOpening(keyOf(i));
      target = await call('content.projectOf', instance.id, i.kind, i.fileName, opts(i)).catch(() => null);
      setOpening('');
    }
    if (!target) {
      app.toast(t('{name} no está en CurseForge ni en Modrinth (se agregó a mano), así que no tiene página.', { name: i.name }), { type: 'info' });
      return;
    }
    app.navigate({ page: 'project', source: target.source, id: target.projectId, instanceId: instance.id, world: i.world });
  };
  const addFiles = async (paths) => {
    const kind = filter === 'all' ? (modded ? 'mods' : 'resourcepacks') : filter;
    try {
      const added = await call('content.addFiles', instance.id, kind, { ...(kind === 'datapacks' && world ? { world } : {}), ...(paths ? { paths } : {}) });
      if (added && added.length) app.toast(t('Agregado: {list}', { list: added.join(', ') }), { type: 'success' });
      reload();
    } catch (e) {
      app.showError(e);
    }
  };
  const browse = () => app.navigate({ page: 'browse', type: filter === 'all' ? (modded ? 'mod' : 'resourcepack') : TYPE_OF[filter], instanceId: instance.id, world: filter === 'datapacks' ? world : undefined });

  const sel = visible.filter((i) => selected.has(keyOf(i)));
  const allSel = visible.length > 0 && sel.length === visible.length;
  const setOne = (i, v) =>
    setSelected((s) => {
      const n = new Set(s);
      if (v) n.add(keyOf(i));
      else n.delete(keyOf(i));
      return n;
    });
  const counts = lists ? Object.fromEntries(kinds.map((k) => [k, (lists[k] || []).length])) : {};

  return (
    <div
      className={`mr-content ${dropping ? 'dropping' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDropping(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDropping(false);
        const paths = [...e.dataTransfer.files].map(pathForFile).filter(Boolean);
        if (paths.length) addFiles(paths);
      }}
    >
      <div className="mr-ct-top">
        <div className="mr-search grow">
          <Icon name="search" size={18} />
          <input value={query} maxLength={120} placeholder={t('Buscar {n} proyectos…', { n: total })} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button className="mr-btn" onClick={() => addFiles()}>
          <Icon name="folderOpen" size={18} />
          {t('Subir archivos')}
        </button>
        <button className="mr-btn brand" onClick={browse}>
          <Icon name="compass" size={18} />
          {t('Explorar contenido')}
        </button>
      </div>
      <div className="mr-ct-bar">
        <span className="mr-select-wrap">
          <Icon name="sort" size={16} />
          <Select value={sort} onChange={setSort} options={SORTS()} className="mr-select" />
        </span>
        <Icon name="filter" size={18} className="mr-ct-filter-ico" />
        <button className={`mr-pill ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
          {t('Todo')}
        </button>
        {kinds.map((k) => (
          <button key={k} className={`mr-pill ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>
            {KIND_LABEL()[k]}
            {counts[k] ? <span className="mr-pill-count">{counts[k]}</span> : null}
          </button>
        ))}
        <button className={`mr-pill ${filter === 'datapacks' ? 'on' : ''}`} onClick={() => setFilter('datapacks')}>
          {KIND_LABEL().datapacks}
        </button>
        <span className="mr-ct-sep" />
        <button ref={filterMenu.anchor} className={`mr-pill ghost ${state !== 'any' ? 'on' : ''}`} onClick={filterMenu.toggle}>
          <Icon name="plus" size={15} />
          {state === 'any' ? t('Filtro') : { enabled: t('Activados'), disabled: t('Desactivados'), updates: t('Con actualización') }[state]}
        </button>
        <Popover anchor={filterMenu.anchor} open={filterMenu.open} onClose={filterMenu.close} className="menu mr-pop">
          <MenuHeader>{t('Mostrar')}</MenuHeader>
          {[
            ['any', t('Todo')],
            ['enabled', t('Activados')],
            ['disabled', t('Desactivados')],
            ['updates', t('Con actualización')],
          ].map(([v, l]) => (
            <MenuItem key={v} label={l} checked={state === v} onClick={() => (filterMenu.close(), setState(v))} />
          ))}
        </Popover>
        <span className="spacer" />
        <button className="mr-textbtn brand" disabled={!updatable.length || checking} onClick={() => updateAll()}>
          {checking ? <Spinner size={16} /> : <Icon name="download" size={17} />}
          {updatable.length ? t('Actualizar todo ({n})', { n: updatable.length }) : t('Actualizar todo')}
        </button>
        <button className="mr-textbtn" onClick={() => (reload(), check(true))}>
          <Icon name="refresh" size={17} />
          {t('Recargar')}
        </button>
      </div>
      {filter === 'datapacks' ? (
        <div className="mr-ct-world">
          <Icon name="globe" size={18} />
          <span>{t('Data packs del mundo:')}</span>
          {worlds.length ? <Select value={world} onChange={setWorld} options={worlds.map((w) => ({ value: w.folder, label: w.levelName || w.folder }))} className="mr-select" /> : <span className="muted">{t('Este perfil todavía no tiene mundos.')}</span>}
        </div>
      ) : null}
      {sel.length ? (
        <div className="mr-bulk">
          <strong>{t('{n} seleccionados', { n: sel.length })}</strong>
          <button className="mr-btn" onClick={() => Promise.all(sel.map((i) => call('content.setEnabled', instance.id, i.kind, i.fileName, true, opts(i)))).then(reload)}>
            <Icon name="check" size={16} />
            {t('Activar')}
          </button>
          <button className="mr-btn" onClick={() => Promise.all(sel.map((i) => call('content.setEnabled', instance.id, i.kind, i.fileName, false, opts(i)))).then(reload)}>
            <Icon name="eyeOff" size={16} />
            {t('Desactivar')}
          </button>
          {sel.some((i) => updates[keyOf(i)]) ? (
            <button className="mr-btn" onClick={() => updateAll(sel)}>
              <Icon name="download" size={16} />
              {t('Actualizar')}
            </button>
          ) : null}
          <button className="mr-btn danger" onClick={() => remove(sel)}>
            <Icon name="trash" size={16} />
            {t('Eliminar')}
          </button>
          <button className="mr-textbtn" onClick={() => setSelected(new Set())}>
            {t('Cancelar')}
          </button>
        </div>
      ) : null}
      <div className="mr-table">
        <div className="mr-tr mr-th">
          <span className="mr-td-check">
            <Checkbox checked={allSel} indeterminate={!allSel && sel.length > 0} onChange={(v) => setSelected(new Set(v ? visible.map(keyOf) : []))} label="" />
          </span>
          <span>{t('Proyecto')}</span>
          <span>{t('Versión')}</span>
          <span className="mr-td-actions">{t('Acciones')}</span>
        </div>
        {lists === null || (filter === 'datapacks' && dpItems === null) ? (
          <div className="center-spinner">
            <Spinner />
          </div>
        ) : !visible.length ? (
          <div className="mr-empty small">
            <Icon name={KIND_ICON[filter] || 'puzzle'} size={34} />
            <strong>{all.length ? t('Sin resultados') : t('No hay nada aquí todavía')}</strong>
            {!all.length ? (
              <>
                <span>{t('Explora contenido o arrastra archivos a esta lista.')}</span>
                <button className="mr-btn brand" onClick={browse}>
                  <Icon name="compass" size={18} />
                  {t('Explorar contenido')}
                </button>
              </>
            ) : null}
          </div>
        ) : (
          visible.map((i) => {
            const k = keyOf(i);
            const u = updates[k];
            return (
              <div key={k} className={`mr-tr ${i.enabled ? '' : 'disabled'} ${selected.has(k) ? 'selected' : ''}`} onContextMenu={(e) => rowMenu.show(e, i)}>
                <span className="mr-td-check">
                  <Checkbox checked={selected.has(k)} onChange={(v) => setOne(i, v)} label="" />
                </span>
                <span className="mr-td-project" role="link" tabIndex={0} onClick={() => openProject(i)} onKeyDown={(e) => e.key === 'Enter' && openProject(i)} data-tip={t('Abrir su página')}>
                  <ItemIcon src={iconOf(i)} kind={i.kind} />
                  <span className="mr-td-text">
                    <strong>
                      <Icon name={KIND_ICON[i.kind]} size={14} className="mr-kind" />
                      {i.name}
                    </strong>
                    <small>{authorOf(i) || i.baseName}</small>
                  </span>
                  {opening === k ? <Spinner size={16} /> : null}
                </span>
                <span className="mr-td-version">
                  <strong title={i.version || ''}>{i.version || (i.meta && i.meta.versionNumber) || '—'}</strong>
                  <small title={i.fileName}>{i.fileName}</small>
                </span>
                <span className="mr-td-actions">
                  {busy.has(k) ? (
                    <Spinner size={18} />
                  ) : u ? (
                    <button className="mr-icon-btn brand" onClick={() => updateOne(i)} aria-label={t('Actualizar')} data-tip={t('Actualizar a {v}', { v: u.versionNumber || '' })}>
                      <Icon name="download" size={18} />
                    </button>
                  ) : null}
                  {!i.isDir ? (
                    <button className="mr-icon-btn quiet" onClick={() => switchVersion(i)} aria-label={t('Cambiar versión')} data-tip={t('Cambiar versión')}>
                      <Icon name="swap" size={18} />
                    </button>
                  ) : null}
                  <Toggle checked={i.enabled} onChange={(v) => toggle(i, v)} />
                  <button className="mr-icon-btn quiet" onClick={() => remove([i])} aria-label={t('Eliminar')} data-tip={t('Eliminar')}>
                    <Icon name="trash" size={18} />
                  </button>
                  <button className="mr-icon-btn quiet" onClick={(e) => rowMenu.show(e, i)} aria-label={t('Más opciones')}>
                    <Icon name="more" size={18} />
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>
      {rowMenu.data ? (
        <Popover point={rowMenu.point} open={rowMenu.open} onClose={rowMenu.close} className="menu mr-pop">
          <MenuItem icon="external" label={t('Abrir su página')} onClick={() => (rowMenu.close(), openProject(rowMenu.data))} />
          {!rowMenu.data.isDir ? <MenuItem icon="swap" label={t('Cambiar versión…')} onClick={() => (rowMenu.close(), switchVersion(rowMenu.data))} /> : null}
          <MenuItem icon={rowMenu.data.enabled ? 'eyeOff' : 'check'} label={rowMenu.data.enabled ? t('Desactivar') : t('Activar')} onClick={() => (rowMenu.close(), toggle(rowMenu.data, !rowMenu.data.enabled))} />
          <MenuItem icon="folder" label={t('Mostrar en la carpeta')} onClick={() => (rowMenu.close(), call('app.showItem', rowMenu.data.path))} />
          <MenuItem icon="copy" label={t('Copiar nombre del archivo')} onClick={() => (rowMenu.close(), call('app.copyText', rowMenu.data.fileName))} />
          <MenuSeparator />
          <MenuItem icon="trash" label={t('Eliminar')} danger onClick={() => (rowMenu.close(), remove([rowMenu.data]))} />
          <div className="menu-foot muted small">{formatSize(rowMenu.data.size)}</div>
        </Popover>
      ) : null}
      {dropping ? (
        <div className="drop-overlay">
          <Icon name="import" size={44} />
          {t('Suelta los archivos para agregarlos')}
        </div>
      ) : null}
    </div>
  );
}
