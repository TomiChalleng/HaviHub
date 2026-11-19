// Content table for mods / resource packs / shaders / data packs.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Button, IconButton, Toggle, Checkbox, Spinner, Empty, Select, EnvBadge, ExpandingSearch } from '../../components/ui.jsx';
import { Popover, MenuItem, MenuHeader, MenuSeparator, useMenu, useContextMenu } from '../../components/Menu.jsx';
import { useApp } from '../../lib/store.jsx';
import { call, pathForFile } from '../../lib/api.js';
import { t } from '../../lib/i18n.js';
import { formatSize, formatDate } from '../../lib/format.js';
import { showInstallResult } from '../../lib/actions.js';
import SwitchVersionDialog from '../../dialogs/SwitchVersionDialog.jsx';
import UpdateProjectsDialog from '../../dialogs/UpdateProjectsDialog.jsx';

const KIND_TYPE = { mods: 'mod', resourcepacks: 'resourcepack', shaderpacks: 'shader', datapacks: 'datapack' };

// The jar's own declaration wins when it is explicit (Fabric/Quilt); otherwise
// use what Modrinth/CurseForge say.
function envOf(item, ex) {
  if (item.env === 'client' || item.env === 'server') return item.env;
  return (ex && ex.env) || item.env || (ex && ex.serverSide === 'unsupported' ? 'client' : '');
}

// Column header: click to sort by it, click again to invert the order
function SortHeader({ label, k, sort, onSort, className = '' }) {
  const on = sort.key === k;
  return (
    <button className={`sortable ${on ? 'sorted' : ''} ${className}`} onClick={() => onSort(k)}>
      {label}
      {on ? <Icon name={sort.dir > 0 ? 'sortUp' : 'sortDown'} size={26} className="sort-arrow" /> : null}
    </button>
  );
}

function EnvIcon({ env }) {
  return <EnvBadge env={env} compact />;
}

function ItemIcon({ item, big }) {
  const [broken, setBroken] = useState(false);
  if (item.icon && !broken) return <img src={item.icon} alt="" className="item-icon" draggable={false} onError={() => setBroken(true)} />;
  return (
    <span className="item-icon placeholder">
      <Icon name={item.isDir ? 'folder' : 'box'} size={big ? 64 : 30} stroke={1.5} />
    </span>
  );
}

// How the list is shown (like CurseForge's): tiles, a table or a list of big rows
const VIEWS = [
  { id: 'tiles', icon: 'grid', label: () => t('Mosaico') },
  { id: 'table', icon: 'table', label: () => t('Tabla') },
  { id: 'list', icon: 'list', label: () => t('Lista') },
];
const KIND_LABEL = { mods: () => t('Mods'), resourcepacks: () => t('Resource packs'), shaderpacks: () => t('Shaders'), datapacks: () => t('Data packs') };
const RELEASE = { release: 'R', beta: 'B', alpha: 'A' };
// Modrinth gives categories as slugs ("game-mechanics"), CurseForge as names
const LOADER_SLUGS = new Set(['fabric', 'forge', 'neoforge', 'quilt', 'liteloader', 'minecraft', 'vanilla', 'iris', 'optifine', 'canvas']);
function categoryNames(list) {
  return (list || [])
    .filter((c) => !LOADER_SLUGS.has(String(c).toLowerCase()))
    .map((c) => (/^[a-z0-9-]+$/.test(c) ? c.replace(/-/g, ' ').replace(/^./, (x) => x.toUpperCase()) : c))
    .slice(0, 3);
}

export default function ContentTab({ instance, kind, world, onCount }) {
  const app = useApp();
  const [items, setItems] = useState(null);
  const [folder, setFolder] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [updates, setUpdates] = useState({});
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(new Set());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'name', dir: 1 });
  const [cols, setCols] = useState({ author: true, env: true, action: true });
  const [compact, setCompact] = useState(false);
  const [extra, setExtra] = useState({});
  const [dropping, setDropping] = useState(false);
  const [previous, setPrevious] = useState({});
  const [opening, setOpening] = useState('');
  const filterMenu = useMenu();
  const sortMenu = useMenu();
  const colMenu = useMenu();
  const viewMenu = useMenu();
  const view = VIEWS.some((v) => v.id === (app.config && app.config.contentView)) ? app.config.contentView : 'table';
  const rowMenu = useContextMenu();
  const opts = useMemo(() => (world ? { world } : {}), [world]);
  const loadId = useRef(0);

  const load = useCallback(async () => {
    const my = ++loadId.current;
    try {
      const r = await call('content.list', instance.id, kind, opts);
      if (my !== loadId.current) return;
      setItems(r.items);
      setFolder(r.folder);
      setError('');
      onCount && onCount(r.items.length);
      const missing = r.items.filter((i) => i.meta && (!i.authors.length || !i.icon));
      if (missing.length) call('content.enrich', missing).then((m) => my === loadId.current && setExtra((e) => ({ ...e, ...m }))).catch(() => {});
      call('content.previousVersions', instance.id)
        .then((p) => my === loadId.current && setPrevious(p || {}))
        .catch(() => {});
    } catch (e) {
      setError(e.message);
      setItems([]);
    }
  }, [instance.id, kind, opts, onCount]);

  const check = useCallback(
    async (force = false) => {
      if (kind === 'datapacks' && !world) return;
      setChecking(true);
      try {
        let r = force ? null : await call('content.cachedUpdates', instance.id, kind, opts);
        if (!r) r = await call('content.checkUpdates', instance.id, kind, opts);
        setUpdates(r ? r.updates : {});
      } catch (e) {
        if (force) app.showError(e);
      } finally {
        setChecking(false);
      }
    },
    [instance.id, kind, opts, world],
  );

  useEffect(() => {
    setItems(null);
    setSelected(new Set());
    setUpdates({});
    load();
    if (app.config && app.config.checkUpdatesOnOpen) check(false);
  }, [instance.id, kind, world]);

  useEffect(() => {
    if (items) load();
  }, [app.contentVersion]);

  useEffect(() => {
    if (view !== 'list' || !items) return undefined;
    const want = items.filter((i) => i.meta && !(extra[`${i.meta.provider}:${i.meta.projectId}`] || {}).categories);
    if (!want.length) return undefined;
    let alive = true;
    call('content.enrich', want)
      .then((m) => alive && setExtra((e) => ({ ...e, ...m })))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [view, items]);

  const visible = useMemo(() => {
    if (!items) return [];
    let l = items;
    if (search) {
      const q = search.toLowerCase();
      l = l.filter((i) => i.name.toLowerCase().includes(q) || i.fileName.toLowerCase().includes(q) || i.authors.join(' ').toLowerCase().includes(q));
    }
    if (filter === 'enabled') l = l.filter((i) => i.enabled);
    if (filter === 'disabled') l = l.filter((i) => !i.enabled);
    if (filter === 'updates') l = l.filter((i) => updates[i.fileName]);
    const exOf = (i) => (i.meta ? extra[`${i.meta.provider}:${i.meta.projectId}`] : null);
    if (filter === 'client') l = l.filter((i) => envOf(i, exOf(i)) === 'client');
    if (filter === 'server') l = l.filter((i) => envOf(i, exOf(i)) === 'server');
    const key = sort.key;
    const authorOf = (i) => (i.authors[0] || ((exOf(i) || {}).author) || '').toLowerCase();
    // Acción: up to date first, then unknown, then the ones with an update
    const actionRank = (i) => (updates[i.fileName] ? 2 : i.meta ? 0 : 1);
    const envRank = (i) => ({ client: 0, server: 1, both: 2 })[envOf(i, exOf(i))] ?? 3;
    const val = (i) =>
      key === 'author' ? authorOf(i) : key === 'enabled' ? (i.enabled ? 0 : 1) : key === 'action' ? actionRank(i) : key === 'env' ? envRank(i) : key === 'size' ? i.size : key === 'date' ? -i.mtime : i.name.toLowerCase();
    const byName = (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    // the ones with an update waiting always go first; each part keeps the order chosen
    const pending = (i) => (updates[i.fileName] ? 0 : 1);
    return [...l].sort((a, b) => {
      const p = pending(a) - pending(b);
      if (p) return p;
      const va = val(a);
      const vb = val(b);
      const c = va > vb ? 1 : va < vb ? -1 : 0;
      return c ? c * sort.dir : key === 'name' ? 0 : byName(a, b);
    });
  }, [items, search, filter, sort, updates, extra]);

  const updateCount = Object.keys(updates).filter((f) => items && items.some((i) => i.fileName === f)).length;

  const toggle = async (item, enabled) => {
    setItems((l) => l.map((i) => (i.fileName === item.fileName ? { ...i, enabled } : i)));
    try {
      await call('content.setEnabled', instance.id, kind, item.fileName, enabled, opts);
    } catch (e) {
      app.showError(e);
    }
    load();
  };

  const remove = async (list) => {
    const ok = await app.confirm({
      title: list.length === 1 ? t('Eliminar {name}', { name: list[0].name }) : t('Eliminar {n} elementos', { n: list.length }),
      message: t('Se moverán a la papelera.'),
      confirmLabel: t('Eliminar'),
      danger: true,
    });
    if (!ok) return;
    try {
      await call('content.remove', instance.id, kind, list.map((i) => i.fileName), opts);
      setSelected(new Set());
    } catch (e) {
      app.showError(e);
    }
    load();
  };

  const updateOne = async (item) => {
    const u = updates[item.fileName];
    if (!u) return;
    setUpdating((s) => new Set(s).add(item.fileName));
    try {
      const r = await call('content.update', instance.id, kind, item.fileName, u, opts);
      setUpdates((m) => {
        const n = { ...m };
        delete n[item.fileName];
        return n;
      });
      await showInstallResult(app, r, t('Actualización'));
    } catch (e) {
      app.showError(e);
    } finally {
      setUpdating((s) => {
        const n = new Set(s);
        n.delete(item.fileName);
        return n;
      });
      load();
    }
  };

  const iconOf = (item) => {
    const ex = item.meta ? extra[`${item.meta.provider}:${item.meta.projectId}`] : null;
    return item.icon || (ex && ex.icon) || null;
  };
  const previousOf = (item) => (item.meta ? previous[`${item.meta.provider}:${item.meta.projectId}`] : null);

  // "Update all": choose which ones (all checked) in a dialog
  const updateAll = async (only) => {
    const list = (only || items).filter((i) => updates[i.fileName]);
    if (!list.length) return;
    const entries = list.map((i) => ({ item: i, upd: { ...updates[i.fileName] }, icon: iconOf(i) }));
    const r = await app.openDialog(UpdateProjectsDialog, { instance, kind, world, entries });
    if (!r) return;
    setSelected(new Set());
    await showInstallResult(app, r, t('Actualización'));
    const cached = await call('content.cachedUpdates', instance.id, kind, opts).catch(() => null);
    setUpdates(cached ? cached.updates : {});
    load();
  };

  const switchVersion = async (item) => {
    const done = await app.openDialog(SwitchVersionDialog, { instance, kind, world, item, icon: iconOf(item) });
    if (done) {
      const cached = await call('content.cachedUpdates', instance.id, kind, opts).catch(() => null);
      setUpdates(cached ? cached.updates : {});
      load();
    }
  };

  // Clicking a mod, pack or shader opens its page (files added by hand are
  // looked up by their hash first)
  const openProject = async (item) => {
    let target = item.meta && item.meta.projectId ? { source: item.meta.provider, projectId: item.meta.projectId } : null;
    if (!target) {
      setOpening(item.fileName);
      target = await call('content.projectOf', instance.id, kind, item.fileName, opts).catch(() => null);
      setOpening('');
    }
    if (!target) {
      app.toast(t('{name} no está en CurseForge ni en Modrinth (se agregó a mano), así que no tiene página.', { name: item.name }), { type: 'info' });
      return;
    }
    app.navigate({ page: 'project', source: target.source, id: target.projectId, instanceId: instance.id, world });
  };

  const addFiles = async (paths) => {
    try {
      const added = await call('content.addFiles', instance.id, kind, { ...opts, ...(paths ? { paths } : {}) });
      if (added && added.length) app.toast(t('Agregado: {list}', { list: added.join(', ') }), { type: 'success' });
      load();
    } catch (e) {
      app.showError(e);
    }
  };

  const exOf = (item) => (item.meta ? extra[`${item.meta.provider}:${item.meta.projectId}`] : null);
  const authorOfItem = (item) => item.authors[0] || ((exOf(item) || {}).author) || '';
  const setOne = (fileName, v) =>
    setSelected((s) => {
      const n = new Set(s);
      if (v) n.add(fileName);
      else n.delete(fileName);
      return n;
    });
  const selectBox = (item) => <Checkbox checked={selected.has(item.fileName)} onChange={(v) => setOne(item.fileName, v)} />;
  // what the "Acción" column shows: update it, go back to the previous version, or that it is up to date
  const actionOf = (item) => {
    const upd = updates[item.fileName];
    if (updating.has(item.fileName)) return <Spinner size={22} />;
    if (upd)
      return (
        <Button variant="outline" size="md" onClick={() => updateOne(item)} title={t('Nueva versión: {v}', { v: upd.versionNumber || '' })}>
          {t('Actualizar')}
        </Button>
      );
    if (previousOf(item))
      return (
        <button className="prev-chip" onClick={() => switchVersion(item)} data-tip={t('Antes de actualizar usabas {v}. Clic para cambiar de versión.', { v: previousOf(item).versionNumber || '?' })}>
          <Icon name="undo" size={15} />
          {previousOf(item).versionNumber || t('Anterior')}
        </button>
      );
    if (item.meta || Object.keys(updates).length || checking) return <span className="up-to-date">{checking && !item.meta ? '' : item.meta ? t('Actualizado') : '—'}</span>;
    return <span className="up-to-date muted">{item.version || ''}</span>;
  };
  const emptyState =
    items === null ? (
      <div className="center-spinner">
        <Spinner />
      </div>
    ) : (
      <Empty icon={kind === 'mods' ? 'puzzle' : kind === 'shaderpacks' ? 'sun' : 'layers'} title={items.length ? t('Sin resultados') : t('No hay nada aquí todavía')} text={items.length ? '' : t('Agrega contenido desde el botón "Agregar contenido" o arrastra archivos a esta lista.')}>
        {!items.length ? (
          <div className="row">
            <Button variant="primary" icon="plus" onClick={() => app.navigate({ page: 'browse', type: KIND_TYPE[kind], instanceId: instance.id, world })}>
              {t('Agregar contenido')}
            </Button>
            <Button icon="folderOpen" onClick={() => addFiles()}>
              {t('Agregar archivos…')}
            </Button>
          </div>
        ) : null}
      </Empty>
    );

  const allSelected = visible.length > 0 && visible.every((i) => selected.has(i.fileName));
  const selItems = items ? items.filter((i) => selected.has(i.fileName)) : [];

  const sortBy = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));

  if (kind === 'datapacks' && !world && error) {
    return <Empty icon="layers" title={t('Data packs')} text={error} />;
  }

  return (
    <div
      className={`content-tab ${dropping ? 'dropping' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropping(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDropping(false);
        const paths = [...e.dataTransfer.files].map(pathForFile).filter(Boolean);
        if (paths.length) addFiles(paths);
      }}
    >
      <div className="content-toolbar">
        {selItems.length ? (
          <div className="bulk-bar">
            <span className="bulk-count">{t('{n} seleccionados', { n: selItems.length })}</span>
            <Button size="sm" variant="secondary" icon="check" onClick={() => Promise.all(selItems.map((i) => call('content.setEnabled', instance.id, kind, i.fileName, true, opts))).then(load)}>
              {t('Activar')}
            </Button>
            <Button size="sm" variant="secondary" icon="eyeOff" onClick={() => Promise.all(selItems.map((i) => call('content.setEnabled', instance.id, kind, i.fileName, false, opts))).then(load)}>
              {t('Desactivar')}
            </Button>
            {selItems.some((i) => updates[i.fileName]) ? (
              <Button size="sm" variant="secondary" icon="update" onClick={() => updateAll(selItems)}>
                {t('Actualizar')}
              </Button>
            ) : null}
            <Button size="sm" variant="danger" icon="trash" onClick={() => remove(selItems)}>
              {t('Eliminar')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              {t('Cancelar')}
            </Button>
          </div>
        ) : (
          <button className="update-all" disabled={!updateCount || checking} onClick={() => updateAll()}>
            {checking ? <Spinner size={20} /> : <Icon name="update" size={27} />}
            <span>{t('Actualizar todo')}</span>
            {updateCount ? <span className="badge-dot">{updateCount}</span> : null}
          </button>
        )}
        <span className="spacer" />
        <ExpandingSearch value={search} onChange={setSearch} placeholder={t('Buscar…')} />
        <button ref={filterMenu.anchor} className={`icon-btn tool-btn ${filter !== 'all' || filterMenu.open ? 'active' : ''}`} data-tip={t('Filtrar')} aria-label={t('Filtrar')} onClick={filterMenu.toggle}>
          <Icon name="filter" size={29} />
        </button>
        <button ref={viewMenu.anchor} className={`icon-btn tool-btn view-btn ${viewMenu.open ? 'active' : ''}`} data-tip={t('Vista')} aria-label={t('Vista')} onClick={viewMenu.toggle}>
          <Icon name={VIEWS.find((v) => v.id === view).icon} size={view === 'list' ? 28 : 26} />
        </button>
        <button ref={sortMenu.anchor} className={`icon-btn tool-btn ${sortMenu.open ? 'active' : ''}`} data-tip={t('Ordenar')} aria-label={t('Ordenar')} onClick={sortMenu.toggle}>
          <Icon name="sort" size={27} />
        </button>
        {view === 'table' ? (
          <button ref={colMenu.anchor} className={`icon-btn tool-btn ${colMenu.open ? 'active' : ''}`} data-tip={t('Columnas')} aria-label={t('Columnas')} onClick={colMenu.toggle}>
            <Icon name="columns" size={25} />
          </button>
        ) : null}
        <IconButton className="tool-btn" icon="refresh" size={30} title={t('Buscar actualizaciones')} onClick={() => (load(), check(true))} />
        <IconButton className="tool-btn" icon="folder" size={26} title={t('Abrir carpeta')} onClick={() => call('app.openPath', folder).catch(() => call('content.openFolder', instance.id, kind, opts))} />

        <Popover anchor={viewMenu.anchor} open={viewMenu.open} onClose={viewMenu.close} align="right" className="menu view-menu">
          {VIEWS.map((v) => (
            <MenuItem key={v.id} icon={v.icon} label={v.label()} checked={view === v.id} onClick={() => (viewMenu.close(), app.updateConfig({ contentView: v.id }))} />
          ))}
          {view === 'table' ? (
            <>
              <MenuSeparator />
              <MenuItem label={t('Filas compactas')} checked={compact} onClick={() => setCompact((c) => !c)} />
            </>
          ) : null}
        </Popover>
        <Popover anchor={filterMenu.anchor} open={filterMenu.open} onClose={filterMenu.close} align="right" className="menu">
          <MenuHeader>{t('Mostrar')}</MenuHeader>
          {[
            ['all', t('Todo')],
            ['enabled', t('Activados')],
            ['disabled', t('Desactivados')],
            ['updates', t('Con actualización')],
            ...(kind === 'mods' ? [['client', t('Solo cliente')], ['server', t('Solo servidor')]] : []),
          ].map(([v, l]) => (
            <MenuItem key={v} label={l} checked={filter === v} onClick={() => (filterMenu.close(), setFilter(v))} />
          ))}
        </Popover>
        <Popover anchor={sortMenu.anchor} open={sortMenu.open} onClose={sortMenu.close} align="right" className="menu">
          <MenuHeader>{t('Ordenar por')}</MenuHeader>
          {[
            ['name', t('Nombre')],
            ['action', t('Acción')],
            ['author', t('Autor')],
            ...(kind === 'mods' ? [['env', t('Entorno')]] : []),
            ['enabled', t('Estado')],
            ['size', t('Tamaño')],
            ['date', t('Fecha de modificación')],
          ].map(([v, l]) => (
            <MenuItem key={v} label={l} checked={sort.key === v} onClick={() => (sortMenu.close(), setSort((s) => ({ key: v, dir: s.key === v ? -s.dir : 1 })))} />
          ))}
        </Popover>
        <Popover anchor={colMenu.anchor} open={colMenu.open} onClose={colMenu.close} align="right" className="menu">
          <MenuHeader>{t('Columnas')}</MenuHeader>
          {[
            ['action', t('Acción')],
            ['author', t('Autor')],
            ['env', t('Entorno')],
          ].map(([k, l]) => (
            <MenuItem key={k} label={l} checked={cols[k]} onClick={() => setCols((c) => ({ ...c, [k]: !c[k] }))} />
          ))}
        </Popover>
      </div>

      {view === 'table' ? (
        <div className={`ctable ${compact ? 'compact' : ''}`} style={{ '--cols': `56px minmax(260px, 2.4fr) ${cols.action ? '170px ' : ''}${cols.author ? 'minmax(120px, 1fr) ' : ''}${cols.env ? '118px ' : ''}140px 64px` }}>
          <div className="ctable-head">
            <span className="cell-check">
              <Checkbox checked={allSelected} indeterminate={!allSelected && selected.size > 0} onChange={(v) => setSelected(v ? new Set(visible.map((i) => i.fileName)) : new Set())} />
            </span>
            <SortHeader className="cell-name" label={t('Nombre')} k="name" sort={sort} onSort={sortBy} />
            {cols.action ? <SortHeader label={t('Acción')} k="action" sort={sort} onSort={sortBy} /> : null}
            {cols.author ? <SortHeader label={t('Autor')} k="author" sort={sort} onSort={sortBy} /> : null}
            {cols.env ? <SortHeader label={t('Entorno')} k="env" sort={sort} onSort={sortBy} /> : null}
            <SortHeader label={t('Activo')} k="enabled" sort={sort} onSort={sortBy} />
            <span />
          </div>
          <div className="ctable-body">
            {items === null || visible.length === 0
              ? emptyState
              : visible.map((item) => {
                  const ex = exOf(item);
                  const icon = item.icon || (ex && ex.icon) || null;
                  return (
                    <div key={item.fileName} className={`ctable-row ${item.enabled ? '' : 'disabled'} ${selected.has(item.fileName) ? 'selected' : ''} ${updates[item.fileName] ? 'has-update' : ''}`} onContextMenu={(e) => rowMenu.show(e, item)}>
                      <span className="cell-check">{selectBox(item)}</span>
                      <span
                        className={`cell-name clickable ${opening === item.fileName ? 'opening' : ''}`}
                        role="link"
                        tabIndex={0}
                        onClick={() => openProject(item)}
                        onKeyDown={(e) => e.key === 'Enter' && openProject(item)}
                        data-tip={t('Abrir su página')}
                      >
                        <ItemIcon item={{ ...item, icon }} />
                        <span className="name-text">
                          <strong title={item.description || item.name}>{item.name}</strong>
                          <small title={item.fileName}>{item.baseName}</small>
                        </span>
                        {opening === item.fileName ? <Spinner size={18} /> : null}
                      </span>
                      {cols.action ? <span className="cell-action">{actionOf(item)}</span> : null}
                      {cols.author ? <span className="cell-author">{authorOfItem(item)}</span> : null}
                      {cols.env ? (
                        <span className="cell-env">
                          <EnvIcon env={envOf(item, ex)} />
                        </span>
                      ) : null}
                      <span className="cell-toggle">
                        {!item.isDir ? <IconButton className="swap-btn" icon="swap" size={22} title={t('Cambiar versión')} onClick={() => switchVersion(item)} /> : null}
                        <Toggle checked={item.enabled} onChange={(v) => toggle(item, v)} />
                      </span>
                      <span className="cell-trash">
                        <IconButton className="trash-btn" icon="trash" size={29} title={t('Eliminar')} onClick={() => remove([item])} />
                      </span>
                    </div>
                  );
                })}
          </div>
        </div>
      ) : items === null || visible.length === 0 ? (
        <div className="cview-empty">{emptyState}</div>
      ) : view === 'tiles' ? (
        <div className="ctiles">
          {visible.map((item) => {
            const upd = updates[item.fileName];
            const author = authorOfItem(item);
            const on = selected.has(item.fileName);
            return (
              <div
                key={item.fileName}
                className={`ctile ${item.enabled ? '' : 'disabled'} ${on ? 'selected' : ''} ${selected.size ? 'selecting' : ''} ${opening === item.fileName ? 'opening' : ''}`}
                role="link"
                tabIndex={0}
                onClick={() => (selected.size ? setOne(item.fileName, !on) : openProject(item))}
                onKeyDown={(e) => e.key === 'Enter' && openProject(item)}
                onContextMenu={(e) => rowMenu.show(e, item)}
                title={item.enabled ? item.description || item.name : t('Desactivado')}
              >
                <div className="ctile-img">
                  <ItemIcon item={{ ...item, icon: iconOf(item) }} big />
                  {!item.enabled ? (
                    <span className="ctile-off">
                      <Icon name="eyeOff" size={18} />
                    </span>
                  ) : null}
                  {updating.has(item.fileName) ? (
                    <span className="ctile-update busy">
                      <Spinner size={18} />
                    </span>
                  ) : upd ? (
                    <button
                      className="ctile-update"
                      data-tip={t('Actualizar a {v}', { v: upd.versionNumber || '' })}
                      aria-label={t('Actualizar')}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateOne(item);
                      }}
                    >
                      <Icon name="update" size={20} />
                    </button>
                  ) : null}
                </div>
                <button
                  className="inst-check ctile-check"
                  aria-pressed={on}
                  title={t('Seleccionar')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOne(item.fileName, !on);
                  }}
                >
                  {on ? <Icon name="check" size={16} /> : null}
                </button>
                <div className="ctile-body">
                  <strong className="ctile-name">{item.name}</strong>
                  {author ? <span className="ctile-by">{t('Por {author}', { author })}</span> : <span className="ctile-by muted">{item.baseName}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="clist">
          {visible.map((item) => {
            const ex = exOf(item);
            const author = authorOfItem(item);
            const cats = categoryNames(ex && ex.categories);
            const rel = item.meta && RELEASE[item.meta.releaseType];
            return (
              <div key={item.fileName} className={`clist-row ${item.enabled ? '' : 'disabled'} ${selected.has(item.fileName) ? 'selected' : ''} ${updates[item.fileName] ? 'has-update' : ''}`} onContextMenu={(e) => rowMenu.show(e, item)}>
                <span className="cell-check">{selectBox(item)}</span>
                <button className="clist-img" onClick={() => openProject(item)} aria-label={item.name} tabIndex={-1}>
                  <ItemIcon item={{ ...item, icon: iconOf(item) }} big />
                </button>
                <div className="clist-main">
                  <div className="clist-title">
                    <button className={`clist-name ${opening === item.fileName ? 'opening' : ''}`} onClick={() => openProject(item)} title={item.description || item.name}>
                      {item.name}
                    </button>
                    {author ? <span className="clist-by">{t('por {author}', { author })}</span> : null}
                    {opening === item.fileName ? <Spinner size={16} /> : null}
                  </div>
                  <div className="clist-file">
                    {rel ? (
                      <span className={`rel-badge rel-${item.meta.releaseType}`} title={item.meta.releaseType}>
                        {rel}
                      </span>
                    ) : null}
                    <span title={item.fileName}>{item.fileName}</span>
                  </div>
                  <div className="clist-foot">
                    <span className="clist-tags">
                      <span className="clist-kind">{KIND_LABEL[kind] ? KIND_LABEL[kind]() : kind}</span>
                      {cats.map((c) => (
                        <span key={c} className="clist-cat">
                          {c}
                        </span>
                      ))}
                    </span>
                    <span className="clist-meta">
                      <span>
                        <Icon name="clock" size={16} />
                        {formatDate(item.mtime)}
                      </span>
                      <span>
                        <Icon name="database" size={16} />
                        {formatSize(item.size)}
                      </span>
                      {item.version ? (
                        <span title={item.version}>
                          <Icon name="tag" size={16} />
                          {item.version}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>
                <div className="clist-actions">
                  <Toggle checked={item.enabled} onChange={(v) => toggle(item, v)} />
                  <span className="clist-action">{actionOf(item)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {rowMenu.data ? (
        <Popover point={rowMenu.point} open={rowMenu.open} onClose={rowMenu.close} className="menu">
          <MenuItem icon={rowMenu.data.enabled ? 'eyeOff' : 'check'} label={rowMenu.data.enabled ? t('Desactivar') : t('Activar')} onClick={() => (rowMenu.close(), toggle(rowMenu.data, !rowMenu.data.enabled))} />
          {updates[rowMenu.data.fileName] ? <MenuItem icon="download" label={t('Actualizar')} onClick={() => (rowMenu.close(), updateOne(rowMenu.data))} /> : null}
          {!rowMenu.data.isDir ? <MenuItem icon="swap" label={t('Cambiar versión…')} onClick={() => (rowMenu.close(), switchVersion(rowMenu.data))} /> : null}
          {rowMenu.data.meta ? (
            <MenuItem
              icon="external"
              label={t('Ver en {source}', { source: rowMenu.data.meta.provider === 'curseforge' ? 'CurseForge' : 'Modrinth' })}
              onClick={() => (rowMenu.close(), app.navigate({ page: 'project', source: rowMenu.data.meta.provider, id: rowMenu.data.meta.projectId, instanceId: instance.id }))}
            />
          ) : null}
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

export function DataPacksTab({ instance, worlds, onCount }) {
  const options = [...worlds.map((w) => ({ value: w.folder, label: w.levelName || w.folder })), { value: '__global', label: t('Carpeta global (todas las partidas)') }];
  const [loc, setLoc] = useState(worlds[0] ? worlds[0].folder : '__global');
  useEffect(() => {
    if (!options.some((o) => o.value === loc)) setLoc(worlds[0] ? worlds[0].folder : '__global');
  }, [worlds]);
  return (
    <div className="datapacks">
      <div className="row datapack-loc">
        <Icon name="globe" size={20} />
        <span className="label">{t('Data packs de:')}</span>
        <Select value={loc} options={options} onChange={setLoc} />
      </div>
      <ContentTab instance={instance} kind="datapacks" world={loc === '__global' ? undefined : loc} onCount={onCount} />
    </div>
  );
}
