// Servers: discover servers to play (Modrinth's server directory, laid out
// like the Explore page, with the best-known public servers in the same list)
// and the servers saved in your instances.
import { KNOWN_SERVERS } from '../../shared/knownServers.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Button, IconButton, Empty, Spinner, Input, Select, Tabs, Checkbox, SearchInput, useDebounced } from '../components/ui.jsx';
import { Modal } from '../components/Modal.jsx';
import InstanceImage, { LoaderIcon, loaderLabel } from '../components/InstanceImage.jsx';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { maskIp, formatCount } from '../lib/format.js';
import { CATEGORY_GROUPS, categoriesOf, categoryLabel, REGION_IDS, regionLabel, LANGUAGES } from '../lib/server-tags.js';
import { getLanguage } from '../lib/i18n.js';
import { Popover, MenuItem, useMenu } from '../components/Menu.jsx';
import { SidebarPortal } from '../modrinth/MrShell.jsx';
import { FilterSection, FilterOption, FilterSwitch } from '../modrinth/MrFilters.jsx';
import { LIMITS } from '../../shared/limits.js';

function ServerDialog({ server, instances, onResolve }) {
  const [name, setName] = useState(server ? server.name : '');
  const [ip, setIp] = useState(server ? server.ip : '');
  const [inst, setInst] = useState(server ? server.instanceId : instances[0] ? instances[0].id : '');
  return (
    <Modal
      title={server ? t('Editar servidor') : t('Agregar servidor')}
      icon="server"
      onClose={() => onResolve(null)}
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={() => onResolve(null)}>
            {t('Cancelar')}
          </Button>
          <Button variant="primary" disabled={!ip.trim() || !inst} onClick={() => onResolve({ name: name.trim() || ip.trim(), ip: ip.trim(), instanceId: inst })}>
            {t('Guardar')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <label className="label">{t('Nombre')}</label>
        <Input value={name} autoFocus maxLength={LIMITS.serverName} counter placeholder="Minecraft Server" onChange={(e) => setName(e.target.value)} />
        <label className="label">{t('Dirección')}</label>
        <Input value={ip} maxLength={LIMITS.serverAddress} placeholder="play.ejemplo.net" onChange={(e) => setIp(e.target.value)} />
        {!server ? (
          <>
            <label className="label">{t('Perfil')}</label>
            <Select value={inst} onChange={setInst} options={instances.map((i) => ({ value: i.id, label: `${i.name} (${i.mcVersion})` }))} />
          </>
        ) : null}
      </div>
    </Modal>
  );
}

export default function Servers() {
  const app = useApp();
  const tab = app.route.tab === 'saved' ? 'saved' : 'discover';
  return (
    <div className="page servers">
      <div className="browse-top">
        <Tabs
          value={tab}
          onChange={(v) => app.patchRoute({ tab: v })}
          tabs={[
            { value: 'discover', label: t('Descubrir') },
            { value: 'saved', label: t('Mis servidores') },
          ]}
        />
      </div>
      {tab === 'discover' ? <DiscoverServers /> : <SavedServers />}
    </div>
  );
}

// ------------------------------------------------------------------ discover
const PAGE = 20;
const normAddress = (a) => String(a || '').trim().toLowerCase().replace(/\.$/, '').replace(/:25565$/, '');
const sameAddress = (a, b) => normAddress(a) === normAddress(b);
// the domain a server lives on: mc.hypixel.net and hypixel.net are the same place
function domainOf(address) {
  const host = normAddress(address).replace(/:\d+$/, '');
  if (/^\d+(\.\d+){3}$/.test(host)) return host;
  const parts = host.split('.');
  const two = parts.slice(-2).join('.');
  return /^(com|net|org|co|gob|edu)\.[a-z]{2}$/.test(two) && parts.length > 2 ? parts.slice(-3).join('.') : two;
}
const looseName = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// one server listed twice (in the directory and among the known ones, or twice
// in the directory): the same address, or the same domain under the same name
function sameServer(a, b) {
  if (!a.address || !b.address) return false;
  if (sameAddress(a.address, b.address)) return true;
  if (domainOf(a.address) !== domainOf(b.address)) return false;
  const x = looseName(a.name);
  const y = looseName(b.name);
  return Boolean(x && y) && (x === y || x.startsWith(y) || y.startsWith(x));
}
function withoutRepeats(list) {
  const out = [];
  for (const s of list) if (!out.some((o) => sameServer(o, s))) out.push(s);
  return out;
}

// The well-known servers as rows of the list. They say nothing about their
// versions or categories, so filters on those leave them out.
// In Spanish the Spanish-speaking ones come first; in English, the international ones.
function knownRows(lang) {
  const rows = KNOWN_SERVERS.map((k) => ({ id: k.id, known: true, name: k.name, address: k.address, summary: k[lang], lang: k.lang, kind: 'vanilla', versions: null, categories: [] }));
  return lang === 'en' ? [...rows.filter((k) => k.lang !== 'es'), ...rows.filter((k) => k.lang === 'es')] : rows;
}
function knownMatch(k, f) {
  if (f.version || f.region || f.categories.length || (f.kinds.length && !f.kinds.includes('vanilla'))) return false;
  if (!['relevance', 'plays', 'online'].includes(f.sort)) return false;
  if (f.language && !((f.language === 'es' && k.lang === 'es') || (f.language === 'en' && k.lang === 'int'))) return false;
  const q = f.query.trim().toLowerCase();
  return !q || `${k.name} ${k.address} ${k.summary}`.toLowerCase().includes(q);
}

// instances a vanilla server accepts: its versions (any, when it does not say), without content mods
function compatibleWith(s, instances) {
  return instances.filter((i) => !i.broken && (!s.versions || !s.versions.length || s.versions.includes(i.mcVersion)) && (!i.loader || i.loader.id === 'fabric' || i.loader.id === 'quilt'));
}

function PingChip({ ping }) {
  if (!ping) return <span className="ping-chip wait">{t('Midiendo…')}</span>;
  if (ping.error) return <span className="ping-chip off">{t('Sin respuesta')}</span>;
  const level = ping.latency < 80 ? 'good' : ping.latency < 160 ? 'ok' : 'bad';
  return (
    <span className={`ping-chip ${level}`} title={t('Latencia desde tu computador')}>
      {ping.latency} ms
    </span>
  );
}

function ServerRow({ s, ping, busy, onPlay, onAdd, onCopy }) {
  const players = ping && !ping.error ? ping.online : s.online;
  const cats = s.categories || [];
  const icon = s.icon || (ping && ping.favicon);
  return (
    <div className={`proj-row srv-row ${s.known ? 'known' : ''}`}>
      {icon ? <img className="proj-icon" src={icon} alt="" loading="lazy" /> : <span className="proj-icon placeholder"><Icon name="server" size={30} /></span>}
      <div className="proj-main">
        <div className="proj-title-row">
          {s.url ? (
            <button className="proj-title srv-title" title={t('Ver en Modrinth')} onClick={() => call('app.openExternal', s.url)}>
              {s.name}
            </button>
          ) : (
            <span className="proj-title srv-title">{s.name}</span>
          )}
          {s.known && s.lang === 'es' ? <span className="known-tag">{t('Español')}</span> : null}
        </div>
        <p className="proj-desc">{s.summary}</p>
        <div className="proj-meta srv-meta">
          {players !== null && players !== undefined ? (
            <span className="srv-players" title={t('Jugadores conectados ahora')}>
              <span className="srv-dot" />
              {formatCount(players)}
            </span>
          ) : null}
          {s.plays ? (
            <span title={t('Veces que se jugó en las últimas 2 semanas')}>
              <Icon name="play" size={15} />
              {formatCount(s.plays)}
            </span>
          ) : null}
          <PingChip ping={ping} />
          {s.known ? (
            <button className="known-ip" onClick={onCopy} data-tip={t('Copiar la IP')}>
              {s.address} <Icon name="copy" size={13} />
            </button>
          ) : null}
          {s.region ? <span className="chip">{regionLabel(s.region)}</span> : null}
          {cats.slice(0, 3).map((c) => (
            <span key={c} className="chip">
              {categoryLabel(c)}
            </span>
          ))}
          {cats.length > 3 ? <span className="chip">+{cats.length - 3}</span> : null}
          {s.modpack ? (
            <span className="srv-pack" title={t('Se juega con este modpack')}>
              {s.modpack.icon ? <img src={s.modpack.icon} alt="" /> : <Icon name="package" size={16} />}
              {s.modpack.name}
            </span>
          ) : null}
        </div>
      </div>
      <div className="proj-side srv-side">
        <div className="srv-actions">
          <IconButton icon="plus" title={t('Agregar a una instancia')} onClick={onAdd} />
          <Button variant="primary" icon="play" loading={busy} onClick={onPlay}>
            {t('Jugar')}
          </Button>
        </div>
        <span className="srv-version">{s.kind === 'modpack' ? t('Con su modpack') : s.recommended ? `Minecraft ${s.recommended}` : ''}</span>
      </div>
    </div>
  );
}

// Which instance plays a server (or gets it in its list)
function ServerInstanceDialog({ server, mode, newVersion, onResolve }) {
  const version = server.recommended || newVersion;
  const app = useApp();
  const fits = useMemo(() => (server.kind === 'modpack' ? app.instances.filter((i) => i.managed && server.modpack && i.managed.id === server.modpack.projectId) : compatibleWith(server, app.instances)), [server, app.instances]);
  const others = mode === 'add' ? app.instances.filter((i) => !i.broken && !fits.includes(i)) : [];
  const [pick, setPick] = useState(fits[0] ? fits[0].id : mode === 'play' ? '__new' : others[0] ? others[0].id : '');
  const row = (i, warn) => (
    <button key={i.id} className={`sid-row ${pick === i.id ? 'on' : ''}`} onClick={() => setPick(i.id)} role="radio" aria-checked={pick === i.id}>
      <span className="radio-dot" />
      <InstanceImage instance={i} size={40} />
      <span className="sid-text">
        <strong>{i.name}</strong>
        <span className="muted sid-meta">
          <LoaderIcon loader={i.loader} size={15} />
          {loaderLabel(i.loader)} {i.mcVersion}
          {warn ? <span className="sid-warn">{t('Otra versión')}</span> : null}
        </span>
      </span>
    </button>
  );
  return (
    <Modal
      title={mode === 'play' ? t('¿Con qué instancia entras a {name}?', { name: server.name }) : t('Agregar {name} a una instancia', { name: server.name })}
      icon="server"
      onClose={() => onResolve(null)}
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={() => onResolve(null)}>
            {t('Cancelar')}
          </Button>
          <Button variant="primary" icon={mode === 'play' ? 'play' : 'plus'} disabled={!pick} onClick={() => onResolve(pick)}>
            {mode === 'play' ? t('Jugar') : t('Agregar')}
          </Button>
        </>
      }
    >
      {mode === 'play' ? <p className="sid-note">{t('Minecraft se abrirá con la instancia que elijas y entrará directo a {name}.', { name: server.name })}</p> : null}
      <div className="sid-list" role="radiogroup">
        {fits.map((i) => row(i, false))}
        {mode === 'play' && server.kind !== 'modpack' && version ? (
          <button className={`sid-row ${pick === '__new' ? 'on' : ''}`} onClick={() => setPick('__new')} role="radio" aria-checked={pick === '__new'}>
            <span className="radio-dot" />
            <span className="sid-new">
              <Icon name="plus" size={22} />
            </span>
            <span className="sid-text">
              <strong>{t('Crear una instancia nueva')}</strong>
              <span className="muted">{server.recommended ? t('Vanilla {v}, la versión que recomienda el servidor', { v: version }) : `Vanilla ${version}`}</span>
            </span>
          </button>
        ) : null}
        {others.length ? <div className="sid-sep">{t('Otras instancias (puede que no sean compatibles)')}</div> : null}
        {others.map((i) => row(i, true))}
      </div>
    </Modal>
  );
}

function DiscoverServers() {
  const app = useApp();
  const [query, setQuery] = useState('');
  const dq = useDebounced(query, 400);
  const [sort, setSort] = useState('relevance');
  const [online, setOnline] = useState(true);
  const [kind, setKind] = useState('');
  const [version, setVersion] = useState('');
  const [region, setRegion] = useState('');
  const [language, setLanguage] = useState('');
  const [cats, setCats] = useState([]);
  const [list, setList] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pings, setPings] = useState({});
  const [busy, setBusy] = useState(new Set());
  const [gameVersions, setGameVersions] = useState([]);
  const [knownVersion, setKnownVersion] = useState(null);
  const [fetched, setFetched] = useState(0); // directory hits received, repeats included
  const req = useRef(0);
  const asked = useRef(new Set());

  useEffect(() => {
    call('platforms.gameVersions')
      .then((v) => {
        const releases = v.filter((x) => x.type === 'release');
        setGameVersions(releases.map((x) => x.version));
        // the well-known servers say nothing about their version; the big networks
        // take a few weeks to accept a new one, so a new profile gets the newest
        // release that is at least a month old
        const settled = releases.find((x) => !x.date || Date.now() - Date.parse(x.date) > 30 * 86400000);
        setKnownVersion((settled || releases[0] || {}).version || null);
      })
      .catch(() => setGameVersions([]));
  }, []);

  const filters = useMemo(() => ({ query: dq, sort, online, kinds: kind ? [kind] : [], version, region, language, categories: cats }), [dq, sort, online, kind, version, region, language, cats]);

  const load = useCallback(
    async (offset) => {
      const id = ++req.current;
      setLoading(true);
      setError(null);
      if (!offset) setList(null);
      try {
        const r = await call('servers.discover', { ...filters, offset, limit: PAGE });
        if (id !== req.current) return;
        setTotal(r.total);
        setFetched(offset + r.hits.length);
        setList((l) => withoutRepeats(offset && l ? [...l, ...r.hits] : r.hits));
      } catch (e) {
        if (id !== req.current) return;
        setError(e);
        setList([]);
      } finally {
        if (id === req.current) setLoading(false);
      }
    },
    [filters],
  );
  useEffect(() => {
    load(0);
  }, [load]);

  const setBusyFor = (id, on) =>
    setBusy((b) => {
      const n = new Set(b);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const ensureListed = async (instanceId, s) => {
    const saved = await call('servers.list', instanceId).catch(() => []);
    if (!saved.some((x) => sameAddress(x.ip, s.address))) await call('servers.add', instanceId, { name: s.name, ip: s.address });
  };

  const play = async (s) => {
    // say what is about to happen: the game opens and joins the server
    const linked = app.instances.find((i) => i.linkedServer === s.id) || (s.kind === 'modpack' && s.modpack ? app.instances.find((i) => i.managed && i.managed.id === s.modpack.projectId) : null);
    const install = !linked && s.kind === 'modpack' && s.modpack;
    if (linked || install) {
      const ok = await app.confirm({
        title: t('Entrar a {name}', { name: s.name }),
        message: install
          ? t('Se instalará el modpack {pack} y después Minecraft se abrirá y entrará directo a {name}.', { pack: s.modpack.name || s.name, name: s.name })
          : t('Minecraft se abrirá con el perfil {inst} y entrará directo a {name}.', { inst: linked.name, name: s.name }),
        confirmLabel: t('Jugar'),
        icon: 'play',
      });
      if (!ok) return;
    }
    setBusyFor(s.id, true);
    try {
      let target = (app.instances.find((i) => i.linkedServer === s.id) || {}).id;
      if (!target && s.kind === 'modpack' && s.modpack) {
        const have = app.instances.find((i) => i.managed && i.managed.id === s.modpack.projectId);
        if (have) target = have.id;
        else {
          app.toast(t('Instalando {name}… puedes seguir usando la app.', { name: s.modpack.name || s.name }));
          const r = await call('platforms.installModpack', { source: 'modrinth', projectId: s.modpack.projectId, versionId: s.modpack.versionId || undefined, name: s.name, icon: s.icon && s.icon.startsWith('https') ? s.icon : s.modpack.icon && s.modpack.icon.startsWith('https') ? s.modpack.icon : null });
          target = r.id;
        }
      }
      if (!target) {
        const fits = compatibleWith(s, app.instances);
        const version = s.recommended || (s.known ? knownVersion : null);
        const choice = fits.length ? await app.openDialog(ServerInstanceDialog, { server: s, mode: 'play', newVersion: version }) : '__new';
        if (!choice) return;
        target = choice;
        if (choice === '__new') {
          if (!version) throw new Error(t('Este servidor no dice qué versión de Minecraft usa.'));
          target = await call('instances.create', { name: s.name, mcVersion: version, loader: 'vanilla', iconUrl: s.icon && s.icon.startsWith('https') ? s.icon : undefined });
          app.toast(t('Instancia creada: {name}', { name: s.name }), { type: 'success' });
        }
      }
      await call('servers.link', target, s.id);
      await ensureListed(target, s);
      await app.refreshInstances();
      app.launch(target, { server: s.address });
    } catch (e) {
      app.showError(e);
    } finally {
      setBusyFor(s.id, false);
    }
  };

  const add = async (s) => {
    const target = await app.openDialog(ServerInstanceDialog, { server: s, mode: 'add' });
    if (!target) return;
    try {
      await ensureListed(target, s);
      const inst = app.instances.find((i) => i.id === target);
      app.toast(t('{name} quedó en la lista de multijugador de {inst}', { name: s.name, inst: inst ? inst.name : target }), { type: 'success' });
    } catch (e) {
      app.showError(e);
    }
  };

  const lang = getLanguage() === 'en' ? 'en' : 'es';
  // the well-known servers that fit the search, not already in the directory's list
  const known = useMemo(() => {
    if (!list) return [];
    return knownRows(lang).filter((k) => knownMatch(k, filters) && !list.some((s) => sameServer(s, k)) && !(online && pings[k.address] && pings[k.address].error));
  }, [list, lang, filters, online, pings]);
  const rows = useMemo(() => (list ? [...known, ...list] : null), [list, known]);
  // latency and players, measured from this computer, top of the list first
  useEffect(() => {
    for (const s of rows || []) {
      const a = s.address;
      if (!a || asked.current.has(a)) continue;
      asked.current.add(a);
      call('servers.ping', a)
        .then((r) => setPings((p) => ({ ...p, [a]: r })))
        .catch(() => setPings((p) => ({ ...p, [a]: { error: true } })));
    }
  }, [rows]);
  const copy = (s) => call('app.copyText', s.address).then(() => app.toast(t('IP copiada: {ip}', { ip: s.address }), { type: 'success' }));
  const toggleCat = (id, on) => setCats((l) => (on ? [...l, id] : l.filter((x) => x !== id)));
  const filtersOn = kind || version || region || language || cats.length || !online;
  const clearFilters = () => {
    setKind('');
    setVersion('');
    setRegion('');
    setLanguage('');
    setCats([]);
    setOnline(true);
  };
  const SORTS = [
    { value: 'relevance', label: t('Relevancia') },
    { value: 'plays', label: t('Más jugados') },
    { value: 'online', label: t('Más jugadores ahora') },
    { value: 'follows', label: t('Más seguidos') },
    { value: 'newest', label: t('Más nuevos') },
    { value: 'updated', label: t('Actualizados recientemente') },
  ];
  const KINDS = [
    { value: 'vanilla', label: t('Vanilla') },
    { value: 'modpack', label: t('Con modpack') },
  ];
  const countText = list ? (total + known.length === 1 ? t('1 servidor') : t('{n} servidores', { n: formatCount(total + known.length) })) : '';
  const body = (
    <>
      {error ? (
        <div className="banner err">
          <Icon name="xCircle" size={20} />
          <span>{t('No se pudo cargar la lista de servidores: {e}', { e: error.message })}</span>
          <Button size="sm" variant="secondary" onClick={() => load(0)}>
            {t('Reintentar')}
          </Button>
        </div>
      ) : null}
      {rows === null ? (
        <div className="center-spinner">
          <Spinner />
        </div>
      ) : rows.length === 0 && !error ? (
        <Empty icon="server" title={t('Ningún servidor coincide')} text={t('Prueba con otras palabras o quita algunos filtros.')} />
      ) : (
        <div className="proj-list">
          {rows.map((s) => (
            <ServerRow key={s.id} s={s} ping={s.address ? pings[s.address] : { error: true }} busy={busy.has(s.id)} onPlay={() => play(s)} onAdd={() => add(s)} onCopy={() => copy(s)} />
          ))}
        </div>
      )}
      {list && fetched && fetched < total ? (
        <div className="load-more">
          <Button loading={loading} onClick={() => load(fetched)}>
            {t('Cargar más')}
          </Button>
        </div>
      ) : null}
    </>
  );
  // the Modrinth layout: search and sort on top, the filters in the right
  // sidebar, as Modrinth's browse page does
  if (app.config && app.config.layout === 'modrinth') {
    return (
      <MrServerBrowse
        query={query}
        setQuery={setQuery}
        sort={sort}
        setSort={setSort}
        sorts={SORTS}
        countText={countText}
        filtersOn={filtersOn}
        clearFilters={clearFilters}
        body={body}
        filters={
          <>
            <FilterSwitch label={t('Solo servidores en línea')} checked={online} onChange={setOnline} />
            <FilterSection title={t('Tipo')} summary={kind ? [KINDS.find((k) => k.value === kind).label] : []}>
              {KINDS.map((k) => (
                <FilterOption key={k.value} on={kind === k.value} onClick={() => setKind(kind === k.value ? '' : k.value)}>
                  {k.label}
                </FilterOption>
              ))}
            </FilterSection>
            <FilterSection title={t('Versión del juego')} summary={version ? [version] : []}>
              <MrVersionOptions versions={gameVersions} value={version} onChange={setVersion} />
            </FilterSection>
            <FilterSection title={t('Región')} summary={region ? [regionLabel(region)] : []} open={false}>
              {REGION_IDS.map((r) => (
                <FilterOption key={r} on={region === r} onClick={() => setRegion(region === r ? '' : r)}>
                  {regionLabel(r)}
                </FilterOption>
              ))}
            </FilterSection>
            <FilterSection title={t('Idioma')} summary={language ? [(LANGUAGES.find(([v]) => v === language) || [, language])[1]] : []} open={false}>
              {LANGUAGES.map(([v, l]) => (
                <FilterOption key={v} on={language === v} onClick={() => setLanguage(language === v ? '' : v)}>
                  {l}
                </FilterOption>
              ))}
            </FilterSection>
            {CATEGORY_GROUPS.map((g) => (
              <FilterSection key={g.id} title={g[lang]} summary={categoriesOf(g.id).filter((c) => cats.includes(c.id)).map((c) => c.label)}>
                {categoriesOf(g.id).map((c) => (
                  <FilterOption key={c.id} on={cats.includes(c.id)} onClick={() => toggleCat(c.id, !cats.includes(c.id))}>
                    {c.label}
                  </FilterOption>
                ))}
              </FilterSection>
            ))}
          </>
        }
      />
    );
  }

  return (
    <div className="browse-layout">
      <aside className="browse-filters srv-filters">
        <SearchInput value={query} onChange={setQuery} placeholder={t('Buscar servidores…')} />
        <Checkbox checked={online} onChange={setOnline} label={t('Solo servidores en línea')} />
        <label className="label">{t('Ordenar por')}</label>
        <Select
          value={sort}
          onChange={setSort}
          options={[
            { value: 'relevance', label: t('Relevancia') },
            { value: 'plays', label: t('Más jugados') },
            { value: 'online', label: t('Más jugadores ahora') },
            { value: 'follows', label: t('Más seguidos') },
            { value: 'newest', label: t('Más nuevos') },
            { value: 'updated', label: t('Actualizados recientemente') },
          ]}
        />
        <label className="label">{t('Tipo')}</label>
        <Select
          value={kind}
          onChange={setKind}
          options={[
            { value: '', label: t('Todos') },
            { value: 'vanilla', label: t('Vanilla') },
            { value: 'modpack', label: t('Con modpack') },
          ]}
        />
        <label className="label">{t('Versión del juego')}</label>
        <Select value={version} onChange={setVersion} options={[{ value: '', label: t('Todas las versiones') }, ...gameVersions.map((v) => ({ value: v, label: v }))]} maxHeight={360} />
        <label className="label">{t('Región')}</label>
        <Select value={region} onChange={setRegion} options={[{ value: '', label: t('Cualquier región') }, ...REGION_IDS.map((r) => ({ value: r, label: regionLabel(r) }))]} />
        <label className="label">{t('Idioma')}</label>
        <Select value={language} onChange={setLanguage} options={[{ value: '', label: t('Cualquier idioma') }, ...LANGUAGES.map(([v, l]) => ({ value: v, label: l }))]} />
        {CATEGORY_GROUPS.map((g) => (
          <div key={g.id} className="srv-cat-group">
            <label className="label">{g[lang]}</label>
            <div className="cat-list">
              {categoriesOf(g.id).map((c) => (
                <Checkbox key={c.id} checked={cats.includes(c.id)} onChange={(v) => toggleCat(c.id, v)} label={c.label} />
              ))}
            </div>
          </div>
        ))}
      </aside>
      <section className="browse-results">
        <div className="srv-head">
          <span className="muted">{countText}</span>
          {filtersOn ? (
            <button className="link-btn" onClick={clearFilters}>
              {t('Quitar filtros')}
            </button>
          ) : null}
          <span className="spacer" />
          <span className="muted small">{t('Lista de servidores de Modrinth')}</span>
        </div>
        {body}
      </section>
    </div>
  );
}

// Discover servers in the Modrinth layout (layouts/shared/browse-tab)
function MrServerBrowse({ query, setQuery, sort, setSort, sorts, countText, filtersOn, clearFilters, body, filters }) {
  const menu = useMenu();
  return (
    <div className="mr-srv">
      <div className="mr-search lg">
        <Icon name="search" size={25} />
        <input value={query} maxLength={120} placeholder={t('Buscar servidores…')} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setQuery('')} />
        {query ? (
          <button className="mr-input-clear" aria-label={t('Borrar')} onClick={() => setQuery('')}>
            <Icon name="x" size={20} />
          </button>
        ) : null}
      </div>
      <div className="mr-browse-bar">
        <button ref={menu.anchor} className={`mr-combo w16 ${menu.open ? 'open' : ''}`} onClick={menu.toggle}>
          <span className="mr-combo-prefix">{t('Ordenar por:')}</span>
          <span className="mr-combo-value">{(sorts.find((x) => x.value === sort) || sorts[0]).label}</span>
          <Icon name="chevronLeft" size={25} className="mr-combo-chevron" />
        </button>
        <Popover anchor={menu.anchor} open={menu.open} onClose={menu.close} matchWidth className="menu mr-pop mr-combo-pop">
          {sorts.map((x) => (
            <MenuItem key={x.value} label={x.label} checked={sort === x.value} onClick={() => (menu.close(), setSort(x.value))} />
          ))}
        </Popover>
        {filtersOn ? (
          <button className="mr-btn quiet" onClick={clearFilters}>
            <Icon name="x" size={25} />
            {t('Quitar filtros')}
          </button>
        ) : null}
        <span className="spacer" />
        <span className="muted">{countText}</span>
      </div>
      {body}
      <p className="mr-srv-source muted">{t('Lista de servidores de Modrinth')}</p>
      <SidebarPortal>{filters}</SidebarPortal>
    </div>
  );
}

// the game versions as options, the newest twelve until asked for all
function MrVersionOptions({ versions, value, onChange }) {
  const [all, setAll] = useState(false);
  const shown = all ? versions : versions.slice(0, 12);
  const list = value && !shown.includes(value) ? [value, ...shown] : shown;
  return (
    <>
      {list.map((v) => (
        <FilterOption key={v} on={value === v} onClick={() => onChange(value === v ? '' : v)}>
          {v}
        </FilterOption>
      ))}
      {versions.length > 12 ? (
        <button className="mr-filter-more" onClick={() => setAll((x) => !x)}>
          {all ? t('Ver menos') : t('Ver todas')}
        </button>
      ) : null}
    </>
  );
}

// ------------------------------------------------------------------ saved
function SavedServers() {
  const app = useApp();
  const [rows, setRows] = useState(null);
  const mask = !app.config || app.config.privacy.maskServerIps !== false;
  const [reveal, setReveal] = useState(new Set());

  const load = useCallback(async () => {
    const out = [];
    for (const inst of app.instances) {
      try {
        const list = await call('servers.list', inst.id);
        for (const s of list) out.push({ ...s, instanceId: inst.id, instance: inst });
      } catch {
        /* skip */
      }
    }
    setRows(out);
  }, [app.instances]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const r = await app.openDialog(ServerDialog, { instances: app.instances });
    if (!r) return;
    await call('servers.add', r.instanceId, { name: r.name, ip: r.ip }).catch(app.showError);
    load();
  };

  return (
    <div className="saved-servers">
      <div className="toolbar">
        <Button variant="flat" icon="plus" onClick={add}>
          {t('Agregar servidor')}
        </Button>
        <span className="spacer" />
        <span className="muted small">{t('Servidores guardados en la lista multijugador de tus perfiles')}</span>
        <IconButton icon="refresh" title={t('Recargar')} onClick={load} />
      </div>
      {rows === null ? (
        <div className="center-spinner">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <Empty icon="server" title={t('No tienes servidores guardados')} text={t('Agrega uno aquí o desde el menú Multijugador del juego.')} />
      ) : (
        <div className="server-list">
          {rows.map((s) => (
            <div key={`${s.instanceId}:${s.index}`} className="server-row">
              {s.icon ? <img src={s.icon} alt="" className="server-icon" /> : <span className="server-icon placeholder"><Icon name="server" size={28} /></span>}
              <div className="server-main">
                <strong>{s.name}</strong>
                <button className="server-ip" onClick={() => setReveal((r) => new Set(r).add(`${s.instanceId}:${s.index}`))} title={mask ? t('Clic para mostrar') : ''}>
                  {mask && !reveal.has(`${s.instanceId}:${s.index}`) ? maskIp(s.ip) : s.ip}
                </button>
              </div>
              <div className="server-inst" title={s.instance.name}>
                <InstanceImage instance={s.instance} size={32} />
                <span>{s.instance.name}</span>
              </div>
              <Button
                variant="primary"
                icon="play"
                onClick={async () => {
                  const ok = await app.confirm({ title: t('Entrar a {name}', { name: s.name }), message: t('Minecraft se abrirá con el perfil {inst} y entrará directo a {name}.', { inst: s.instance.name, name: s.name }), confirmLabel: t('Jugar'), icon: 'play' });
                  if (ok) app.launch(s.instanceId, { server: s.ip });
                }}
              >
                {t('Entrar')}
              </Button>
              <IconButton
                icon="edit"
                title={t('Editar')}
                onClick={async () => {
                  const r = await app.openDialog(ServerDialog, { server: s, instances: app.instances });
                  if (r) {
                    await call('servers.edit', s.instanceId, s.index, { name: r.name, ip: r.ip }).catch(app.showError);
                    load();
                  }
                }}
              />
              <IconButton
                icon="trash"
                title={t('Quitar')}
                onClick={async () => {
                  const ok = await app.confirm({ title: t('Quitar servidor'), message: t('¿Quitar "{name}" de la lista de {inst}?', { name: s.name, inst: s.instance.name }), confirmLabel: t('Quitar'), danger: true });
                  if (ok) {
                    await call('servers.remove', s.instanceId, s.index).catch(app.showError);
                    load();
                  }
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
