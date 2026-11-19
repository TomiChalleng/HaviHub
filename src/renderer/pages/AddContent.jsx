// "Agregar contenido" to a profile, laid out like CurseForge's add-content
// screen: the profile on top, a full-width search, the active filters as chips
// (the profile's version and loader first), the content type, sort and filter
// controls, then one wide row per project with its stats and an Install button.
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Button, Select, Checkbox, Pills, Spinner, Empty, SourceBadge, useDebounced, envInfo } from '../components/ui.jsx';
import InstanceImage from '../components/InstanceImage.jsx';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { formatCount, formatDate, compareVersions } from '../lib/format.js';
import { TYPE_TABS, SOURCE_OPTIONS, useInstalled, isInstalled, useInstaller, useProjectSearch, cfKeyMissingBanner } from './browseShared.jsx';
import { typesFor, searchFiltersFor, versionCompatible, compatIssue } from '../../shared/compat.js';
import { compatText } from '../lib/compatText.js';

const SUB_OF = { mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks', datapack: 'datapacks', world: 'worlds' };
const LOADER_NAMES = { fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', quilt: 'Quilt', liteloader: 'LiteLoader', iris: 'Iris', optifine: 'OptiFine', canvas: 'Canvas', vanilla: 'Vanilla' };
const loaderName = (l) => LOADER_NAMES[l] || (l ? l.charAt(0).toUpperCase() + l.slice(1) : '');
// which "loaders" make sense for each kind of content
const KIND_LOADERS = { mod: new Set(['fabric', 'forge', 'neoforge', 'quilt', 'liteloader', 'modloader', 'rift']), shader: new Set(['iris', 'optifine', 'canvas', 'vanilla']) };
const isRelease = (v) => /^\d+(\.\d+)+$/.test(v);

// "26.2 + 4": the profile's version when the project has it, otherwise its newest
function versionLabel(list, preferred) {
  const all = [...new Set((list || []).filter(Boolean))];
  if (!all.length) return '';
  const releases = all.filter(isRelease).sort((a, b) => compareVersions(b, a));
  const main = preferred && all.includes(preferred) ? preferred : releases[0] || all[0];
  const rest = (releases.length ? releases : all).filter((v) => v !== main).length;
  return rest ? `${main} + ${rest}` : main;
}

function loaderLabel(list, preferred) {
  const all = [...new Set((list || []).filter((l) => l && l !== 'minecraft' && l !== 'datapack'))];
  if (!all.length) return '';
  const main = preferred && all.includes(preferred) ? preferred : all[0];
  return all.length > 1 ? `${loaderName(main)} + ${all.length - 1}` : loaderName(main);
}

function Chip({ label, help, onRemove, locked }) {
  return (
    <span className={`ac-chip ${locked ? 'locked' : ''}`}>
      {locked ? <Icon name="lock" size={15} /> : null}
      {label}
      {help ? (
        <span className="ac-chip-help" data-tip={help}>
          <Icon name="helpOutline" size={17} />
        </span>
      ) : null}
      {onRemove ? (
        <button className="ac-chip-x" aria-label={t('Quitar filtro')} data-tip={t('Quitar filtro')} onClick={onRemove}>
          <Icon name="x" size={16} />
        </button>
      ) : null}
    </span>
  );
}

function AddRow({ p, instance, installed, busy, onInstall, onOpen, issue }) {
  const env = p.type === 'mod' ? envInfo(p.env) : null;
  // resource packs and maps from other versions still work: say which one they were made for
  const madeFor = (p.type === 'resourcepack' || p.type === 'world') && instance.mcVersion && (p.gameVersions || []).length && !p.gameVersions.includes(instance.mcVersion) ? versionLabel(p.gameVersions, null).split(' ')[0] : '';
  const instLoader = instance.loader ? instance.loader.id : '';
  const versions = versionLabel(p.gameVersions, instance.mcVersion);
  const kindLoaders = KIND_LOADERS[p.type];
  const loaders = kindLoaders ? loaderLabel((p.loaders || []).filter((l) => kindLoaders.has(l)), instLoader) : '';
  const updated = p.updated ? Date.parse(p.updated) : 0;
  return (
    <div className="ac-row" onClick={onOpen}>
      {p.icon ? (
        <img className="ac-thumb" src={p.icon} alt="" loading="lazy" draggable={false} />
      ) : (
        <span className="ac-thumb placeholder">
          <Icon name="box" size={44} />
        </span>
      )}
      <div className="ac-main">
        <div className="ac-title">
          <strong>{p.title}</strong>
          {p.author ? <span className="ac-by">| {t('por {a}', { a: p.author })}</span> : null}
        </div>
        <p className="ac-desc">{p.description}</p>
        {p.categories && p.categories.length ? (
          <div className="ac-cats">
            {p.categories.slice(0, 4).map((c) => (
              <span key={c} className="ac-cat">
                {c}
              </span>
            ))}
            {p.categories.length > 4 ? <span className="ac-cat more">+{p.categories.length - 4}</span> : null}
          </div>
        ) : null}
        <div className="ac-stats">
          <span data-tip={t('Descargas')}>
            <Icon name="download" size={19} />
            {formatCount(p.downloads)}
          </span>
          {updated ? (
            <span data-tip={t('Última actualización')}>
              <Icon name="clock" size={19} />
              {formatDate(updated)}
            </span>
          ) : null}
          {versions ? (
            <span data-tip={t('Versiones del juego')}>
              <Icon name="gamepad" size={21} />
              {versions}
            </span>
          ) : null}
          {env ? (
            <span data-tip={env.tip}>
              <Icon name={env.icon} size={19} />
              {env.short}
            </span>
          ) : null}
          {loaders ? (
            <span data-tip={t('Cargador')}>
              <Icon name="loader" size={19} />
              {loaders}
            </span>
          ) : null}
          {madeFor ? (
            <span className="ac-madefor" data-tip={t('Hecho para {v}; suele funcionar en {mine} igual', { v: madeFor, mine: instance.mcVersion })}>
              {t('Para {v}', { v: madeFor })}
            </span>
          ) : null}
          <SourceBadge source={p.source} small />
          {p.alsoOn ? <span className="ac-also">{t('+ en {s}', { s: p.alsoOn.source === 'curseforge' ? 'CurseForge' : 'Modrinth' })}</span> : null}
        </div>
      </div>
      <div className="ac-action" onClick={(e) => e.stopPropagation()}>
        {installed ? (
          <span className="ac-installed">
            <Icon name="check" size={20} />
            {t('Instalado')}
          </span>
        ) : issue ? (
          // can't go into this profile (filters removed): say why instead of installing something useless
          <span className="ac-incompat" data-tip={compatText(issue)} data-tip-pos="left">
            <Button variant="secondary" className="ac-install" disabled>
              {t('No compatible')}
            </Button>
          </span>
        ) : (
          <Button variant="primary" className="ac-install" loading={busy} onClick={onInstall}>
            {t('Instalar')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AddContent({ instance }) {
  const app = useApp();
  const { route, config } = app;
  // only what can go into this profile: no mods or shaders on vanilla
  const allowed = typesFor(instance);
  const type = route.type && route.type !== 'modpack' && allowed.includes(route.type) ? route.type : allowed[0];
  // each content type starts with the filters that fit this profile (its
  // version and loader for mods, its version for data packs, this version or
  // older for maps); every one of them can be removed
  const rules = searchFiltersFor(instance, type);
  const savedSource = route.source || (config && config.discoverSource) || 'both';
  const source = type === 'world' ? 'curseforge' : savedSource;
  const profileLoader = instance.loader ? instance.loader.id : '';
  const [query, setQuery] = useState(route.query || '');
  const dq = useDebounced(query, 400);
  const [sort, setSort] = useState('relevance');
  const [picks, setPicks] = useState({}); // per content type: { version, loader } chosen by the person
  const pick = picks[type] || {};
  const setPick = (patch) => setPicks((all) => ({ ...all, [type]: { ...(all[type] || {}), ...patch } }));
  const setVersion = (v) => setPick({ version: v });
  const setLoader = (l) => setPick({ loader: l });
  const [olderMaps, setOlderMaps] = useState(true);
  const version = pick.version !== undefined ? pick.version : rules.gameVersion || '';
  const [categories, setCategories] = useState([]);
  const [catList, setCatList] = useState([]);
  const [gameVersions, setGameVersions] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [worlds, setWorlds] = useState([]);
  const [world, setWorld] = useState(route.world || '');
  const sentinel = useRef(null);
  const usesLoader = type === 'mod';
  const effLoader = usesLoader ? (pick.loader !== undefined ? pick.loader : profileLoader) : '';
  const { installed } = useInstalled(instance.id, type, type === 'datapack' ? world || undefined : undefined);
  const { install, busy } = useInstaller();
  const search = useProjectSearch({ type, source, query: dq, sort, version, loader: effLoader, categories });
  const { total, hasMore, loading, errors, loadMore } = search;
  // maps: hide the ones made for a newer version than this profile's (unless that filter was removed)
  const results = useMemo(() => (search.results && type === 'world' && olderMaps ? search.results.filter((p) => versionCompatible(p, instance, 'world')) : search.results), [search.results, type, instance.mcVersion, olderMaps]);
  useEffect(() => {
    if (route.type && route.type !== type) app.patchRoute({ type });
  }, [route.type, type]);

  useEffect(() => {
    call('platforms.gameVersions')
      .then((v) => setGameVersions(v.filter((x) => x.type === 'release').map((x) => x.version)))
      .catch(() =>
        call('meta.minecraft')
          .then((v) => setGameVersions(v.filter((x) => x.type === 'release').map((x) => x.version)))
          .catch(() => {}),
      );
  }, []);

  useEffect(() => {
    setCategories([]);
    call('platforms.categories', source === 'curseforge' ? 'curseforge' : 'modrinth', type)
      .then(setCatList)
      .catch(() => setCatList([]));
  }, [type, source]);

  // data packs go into one world (or the global folder)
  useEffect(() => {
    if (type !== 'datapack') return;
    call('worlds.list', instance.id)
      .then((list) => {
        setWorlds(list);
        setWorld((w) => (w && list.some((x) => x.folder === w) ? w : list[0] ? list[0].folder : ''));
      })
      .catch(() => setWorlds([]));
  }, [type, instance.id]);

  // more results when the end of the list comes into view
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, results]);

  const types = TYPE_TABS().filter((x) => x.value !== 'modpack' && allowed.includes(x.value));
  const typeLabel = (types.find((x) => x.value === type) || types[0]).label;
  const setType = (v) => app.patchRoute({ type: v });
  const setSource = (v) => {
    app.patchRoute({ source: v });
    app.updateConfig({ discoverSource: v });
  };
  const close = () => app.navigate({ page: 'instance', id: instance.id, tab: 'content', sub: SUB_OF[type] || 'mods' });
  const catName = useMemo(() => new Map(catList.map((c) => [String(c.id), c.name])), [catList]);
  const cfBanner = errors.curseforge && (errors.curseforge.code === 'CF_NO_KEY' || errors.curseforge.code === 'CF_BAD_KEY') ? cfKeyMissingBanner(app) : null;
  const filterCount = (version ? 1 : 0) + (effLoader ? 1 : 0) + categories.length + (type !== 'world' && source !== 'both' ? 1 : 0);
  const changed = version !== (rules.gameVersion || '') || (usesLoader && effLoader !== profileLoader) || categories.length > 0 || (type === 'world' && !olderMaps);
  const reset = () => {
    setPicks((all) => ({ ...all, [type]: {} }));
    setOlderMaps(true);
    setCategories([]);
  };
  const isDefault = (what) => (what === 'version' ? version && version === rules.gameVersion : effLoader && effLoader === profileLoader);
  const lockTip = type === 'mod' ? t('Solo se muestran los mods que tienen una versión para {v} con {l}', { v: instance.mcVersion, l: loaderName(profileLoader) }) : t('Solo se muestran los que tienen una versión para {v}', { v: instance.mcVersion });
  const toggleCat = (id, v) => setCategories((l) => (v ? [...l, id] : l.filter((x) => x !== id)));

  const worldOptions = [...worlds.map((w) => ({ value: w.folder, label: w.levelName || w.folder })), { value: '', label: t('Carpeta global (todas las partidas)') }];

  return (
    <div className="page add-content">
      <div className="ac-head">
        <InstanceImage instance={instance} size={52} />
        <div className="ac-head-name">
          <span className="muted">{t('Agregar contenido a')}</span>
          <strong>{instance.name}</strong>
        </div>
        <span className="spacer" />
        <button className="icon-btn ac-close" aria-label={t('Cerrar')} data-tip={t('Volver al perfil')} data-tip-pos="left" onClick={close}>
          <Icon name="x" size={30} />
        </button>
      </div>

      <div className="ac-search">
        <Icon name="search" size={24} />
        <input autoFocus maxLength={120} value={query} placeholder={t('Buscar {type}', { type: typeLabel.toLowerCase() })} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setQuery('')} spellCheck={false} />
        {query ? (
          <button className="icon-btn" aria-label={t('Borrar')} onClick={() => setQuery('')}>
            <Icon name="x" size={20} />
          </button>
        ) : null}
      </div>

      <div className="ac-chips">
        {usesLoader && effLoader ? <Chip label={loaderName(effLoader)} help={isDefault('loader') ? lockTip : undefined} onRemove={() => setLoader('')} /> : null}
        {version ? <Chip label={version} help={isDefault('version') ? lockTip : undefined} onRemove={() => setVersion('')} /> : null}
        {type === 'world' && instance.mcVersion && olderMaps ? <Chip label={t('{v} o anterior', { v: instance.mcVersion })} help={t('Los mapas abren en su versión o en una más nueva: el juego los actualiza al entrar')} onRemove={() => setOlderMaps(false)} /> : null}
        {type === 'shader' ? <Chip label={t('Iris u OptiFine')} help={t('Los shaders necesitan Iris (Fabric, Quilt, NeoForge), Oculus u OptiFine (Forge) en el perfil')} /> : null}
        {type !== 'world' && source !== 'both' ? <Chip label={source === 'curseforge' ? 'CurseForge' : 'Modrinth'} onRemove={() => setSource('both')} /> : null}
        {categories.map((c) => (
          <Chip key={c} label={catName.get(String(c)) || c} onRemove={() => toggleCat(c, false)} />
        ))}
        {changed ? (
          <button className="link-btn ac-reset" onClick={reset}>
            {t('Restablecer filtros')}
          </button>
        ) : null}
      </div>

      <div className="ac-toolbar">
        <Select className="ac-type" value={type} onChange={setType} options={types} />
        <span className="ac-count">{results === null ? '' : total === 1 ? t('1 proyecto encontrado') : t('{n} proyectos encontrados', { n: formatCount(total) })}</span>
        {type === 'datapack' ? (
          <span className="ac-dest">
            <span className="muted">{t('Instalar en:')}</span>
            <Select value={world} onChange={setWorld} options={worldOptions} />
          </span>
        ) : null}
        <span className="spacer" />
        <Select
          className="ac-sort"
          icon="sort"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'relevance', label: t('Relevancia') },
            { value: 'downloads', label: t('Descargas') },
            { value: 'follows', label: t('Popularidad') },
            { value: 'updated', label: t('Actualizado recientemente') },
            { value: 'newest', label: t('Más nuevos') },
          ]}
        />
        <button className={`ac-filters-btn ${showFilters ? 'open' : ''}`} onClick={() => setShowFilters((v) => !v)}>
          <Icon name="filter" size={22} />
          {t('Filtros')}
          {filterCount ? <span className="ac-filter-count">{filterCount}</span> : null}
        </button>
      </div>

      {showFilters ? (
        <div className="ac-filter-panel">
          {type !== 'world' ? (
            <div className="ac-filter-group">
              <span className="label">{t('Origen')}</span>
              <Pills value={source} onChange={setSource} options={SOURCE_OPTIONS()} />
            </div>
          ) : (
            <div className="ac-filter-group">
              <span className="label">{t('Origen')}</span>
              <span className="muted">{t('Los mundos solo están en CurseForge')}</span>
            </div>
          )}
          <div className="ac-filter-group">
            <span className="label">{t('Versión del juego')}</span>
            <Select value={version} disabled={type === 'world'} onChange={setVersion} maxHeight={360} options={[{ value: '', label: t('Todas las versiones') }, ...(instance.mcVersion && !gameVersions.includes(instance.mcVersion) ? [{ value: instance.mcVersion, label: instance.mcVersion }] : []), ...gameVersions.map((v) => ({ value: v, label: v, hint: v === instance.mcVersion ? t('la del perfil') : undefined }))]} />
          </div>
          {usesLoader ? (
            <div className="ac-filter-group">
              <span className="label">{t('Cargador')}</span>
              <Select
                value={effLoader}
                onChange={setLoader}
                options={[
                  { value: '', label: t('Cualquiera') },
                  ...['fabric', 'quilt', 'forge', 'neoforge'].map((l) => ({ value: l, label: loaderName(l), hint: l === profileLoader ? t('el del perfil') : undefined })),
                ]}
              />
            </div>
          ) : null}
          {catList.length ? (
            <div className="ac-filter-group wide">
              <span className="label">{t('Categorías')}</span>
              <div className="ac-cat-grid">
                {catList.map((c) => (
                  <Checkbox key={c.id} checked={categories.includes(c.id)} onChange={(v) => toggleCat(c.id, v)} label={c.name} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {cfBanner && source !== 'modrinth' ? (
        <div className="banner warn">
          <Icon name="alert" size={20} />
          <span>{cfBanner.text}</span>
          <Button size="sm" variant="secondary" onClick={cfBanner.action}>
            {t('Configurar')}
          </Button>
        </div>
      ) : null}
      {errors.modrinth ? (
        <div className="banner err">
          <Icon name="xCircle" size={20} />
          <span>Modrinth: {errors.modrinth.message}</span>
        </div>
      ) : null}

      {results === null ? (
        <div className="center-spinner">
          <Spinner />
        </div>
      ) : results.length === 0 ? (
        <Empty icon="search" title={t('Sin resultados')} text={t('Prueba con otras palabras o quita algunos filtros.')} />
      ) : (
        <div className="ac-list">
          {results.map((p) => (
            <AddRow
              key={`${p.source}:${p.id}`}
              p={p}
              instance={instance}
              installed={isInstalled(installed, p)}
              issue={compatIssue(p, instance, type)}
              busy={busy.has(`${p.source}:${p.id}`)}
              onInstall={() => install(p, { instanceId: instance.id, world: type === 'datapack' ? world || undefined : undefined })}
              onOpen={() => app.navigate({ page: 'project', source: p.source, id: p.id, instanceId: instance.id, alsoOn: p.alsoOn, world: type === 'datapack' ? world || undefined : undefined })}
            />
          ))}
          <div ref={sentinel} className="ac-sentinel">
            {hasMore && loading ? <Spinner size={24} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}
