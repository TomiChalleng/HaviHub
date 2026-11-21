// "Discover content" in the Modrinth layout: project types as tabs, a big
// search, sort and source, results as cards, and the filters in the right
// sidebar. Inside an instance ("Add content") it only offers what works there
// (see shared/compat.js).
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Spinner, Toggle, Pills, useDebounced } from '../components/ui.jsx';
import { Popover, MenuItem, useMenu } from '../components/Menu.jsx';
import InstanceImage, { LoaderIcon } from '../components/InstanceImage.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { formatCount, timeAgo } from '../lib/format.js';
import { TYPE_TABS, SOURCE_OPTIONS, useInstalled, isInstalled, useInstaller, useProjectSearch, cfKeyMissingBanner } from '../pages/browseShared.jsx';
import { typesFor, searchFiltersFor, versionCompatible, compatIssue } from '../../shared/compat.js';
import { compatText } from '../lib/compatText.js';
import { SidebarPortal } from './MrShell.jsx';
import { MrTabs } from './MrInstance.jsx';
import { loaderText } from './MrHome.jsx';
import { IC } from './mrsize.js';

const SORTS = () => [
  { value: 'relevance', label: t('Relevancia') },
  { value: 'downloads', label: t('Descargas') },
  { value: 'follows', label: t('Seguidores') },
  { value: 'newest', label: t('Más nuevos') },
  { value: 'updated', label: t('Actualizados') },
];
const LOADERS = ['fabric', 'forge', 'neoforge', 'quilt'];
const LOADER_NAME = { fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', quilt: 'Quilt' };
// Modrinth's project type icons
const TYPE_ICON = { modpack: 'packageOpen', mod: 'box', resourcepack: 'paintbrush', shader: 'glasses', datapack: 'braces', world: 'map' };

// a filter group in the sidebar (search/SearchSidebarFilter.vue): a header
// that folds it, showing what is chosen while folded
function FilterSection({ title, children, summary = [], open: initial = true }) {
  const [open, setOpen] = useState(initial);
  return (
    <section className={`mr-filter ${open ? 'open' : ''}`}>
      <button className="mr-filter-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="mr-filter-title">
          <h3>{title}</h3>
          <Icon name="dropdown" size={IC.s5} className="mr-chevron" />
        </span>
        {!open && summary.length ? (
          <span className="mr-filter-summary">
            {summary.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </span>
        ) : null}
      </button>
      <div className="mr-collapse" inert={open ? undefined : ''}>
        <div>
          <div className="mr-filter-body">{children}</div>
        </div>
      </div>
    </section>
  );
}

// one option (search/SearchFilterOption.vue): a row that lights up when
// chosen, with a check showing on hover
function FilterOption({ on, onClick, children }) {
  return (
    <button className={`mr-filter-opt ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      <span className="mr-filter-opt-label">{children}</span>
      <Icon name="check" size={IC.s4} className="mr-filter-opt-check" />
    </button>
  );
}

// a search result (project/card/ProjectCard.vue, list layout)
function ResultCard({ p, instance, installed, busy, onInstall, onOpen, issue }) {
  const updated = p.updated ? Date.parse(p.updated) : 0;
  return (
    <div className="mr-result" role="link" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      {p.icon ? <img className="mr-result-icon" src={p.icon} alt="" loading="lazy" draggable={false} /> : <span className="mr-result-icon ph"><Icon name={TYPE_ICON[p.type] || 'box'} size={IC.s6 * 1.5} /></span>}
      <div className="mr-result-info">
        <div className="mr-result-title">
          <strong>{p.title}</strong>
          {p.author ? <span>{t('por {a}', { a: p.author })}</span> : null}
        </div>
        <p>{p.description}</p>
      </div>
      <div className="mr-result-actions" onClick={(e) => e.stopPropagation()}>
        {installed ? (
          <button className="mr-btn" disabled>
            <Icon name="check" size={IC.s5} />
            {t('Instalado')}
          </button>
        ) : issue ? (
          // can't go into this profile (its filters were removed): say why
          <span className="mr-incompat" data-tip={compatText(issue)} data-tip-pos="left">
            <button className="mr-btn" disabled>
              <Icon name="xCircle" size={IC.s5} />
              {t('No compatible')}
            </button>
          </span>
        ) : (
          <button className="mr-btn brand" disabled={busy} onClick={onInstall}>
            {busy ? <Spinner size={IC.s5} /> : <Icon name="download" size={IC.s5} />}
            {instance || p.type !== 'modpack' ? t('Instalar') : t('Instalar modpack')}
          </button>
        )}
      </div>
      <div className="mr-result-stats">
        <span className="mr-result-numbers">
          <span data-tip={t('Descargas')}>
            <Icon name="download" size={IC.s5} />
            {formatCount(p.downloads)}
          </span>
          {p.follows !== undefined ? (
            <span data-tip={t('Seguidores')}>
              <Icon name="heart" size={IC.s5} />
              {formatCount(p.follows)}
            </span>
          ) : null}
        </span>
        {updated ? (
          <span className="mr-result-date">
            <Icon name="history" size={IC.s5} />
            {t('Actualizado {when}', { when: timeAgo(updated).toLowerCase() })}
          </span>
        ) : null}
      </div>
      <div className="mr-result-tags">
        <BrandLogo brand={p.source} size={IC.s4} />
        {(p.loaders || [])
          .filter((l) => LOADER_NAME[l])
          .slice(0, 3)
          .map((l) => (
            <span key={l} className={`mr-chip loader loader-${l}`}>
              <LoaderIcon loader={l} size={IC.s4} />
              {LOADER_NAME[l]}
            </span>
          ))}
        {(p.categories || []).slice(0, 4).map((c) => (
          <span key={c} className="mr-chip">
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

// a filter option that matches the profile ("1.20.1  la del perfil")
function ProfileMark({ text, hint }) {
  return (
    <>
      {text}
      <span className="mr-profile-mark">{hint}</span>
    </>
  );
}

// Under the search: which filters come from the profile, with a way to see
// everything, or to go back to them after changing them.
function ProfileFilterNote({ instance, type, version, loader, defVersion, defLoader, olderMaps, changed, onClear, onReset }) {
  let text = '';
  if (type === 'mod' && version === defVersion && loader === defLoader && defVersion) text = t('Solo los que tienen una versión para {v} con {l}', { v: defVersion, l: loaderText(instance) });
  else if (type === 'datapack' && version === defVersion && defVersion) text = t('Solo los que tienen una versión para {v}', { v: defVersion });
  else if (type === 'world' && olderMaps && instance.mcVersion) text = t('Mapas de {v} o anteriores (el juego actualiza los mundos antiguos)', { v: instance.mcVersion });
  const info = type === 'shader' ? t('Los shaders necesitan Iris, Oculus u OptiFine en el perfil') : '';
  if (!text && !info && !changed) return null;
  return (
    <div className="mr-locked">
      <Icon name={text || changed ? 'filter' : 'info'} size={IC.s5} />
      <span>{text || (changed ? t('Filtros cambiados: también se muestra lo que no es compatible con este perfil') : info)}</span>
      {text ? (
        <button className="mr-link" onClick={onClear}>
          {t('Ver todos')}
        </button>
      ) : changed ? (
        <button className="mr-link" onClick={onReset}>
          {t('Restablecer filtros')}
        </button>
      ) : null}
    </div>
  );
}

export default function MrBrowse() {
  const app = useApp();
  const { route, config } = app;
  const instance = route.instanceId ? app.instances.find((i) => i.id === route.instanceId) : null;
  const allowed = instance ? typesFor(instance) : ['modpack', 'mod', 'resourcepack', 'shader', 'datapack', 'world'];
  const type = route.type && allowed.includes(route.type) ? route.type : allowed[0];
  // inside a profile each content type starts with the filters that fit it;
  // every one of them can be removed
  const rules = instance ? searchFiltersFor(instance, type) : {};
  const profileLoader = instance && instance.loader ? instance.loader.id : '';
  const source = type === 'world' ? 'curseforge' : route.source || (config && config.discoverSource) || 'both';
  const [query, setQuery] = useState(route.query || '');
  const dq = useDebounced(query, 400);
  const [sort, setSort] = useState('relevance');
  const [picks, setPicks] = useState({}); // per content type: { version, loader } chosen by the person
  const pick = picks[type] || {};
  const setPick = (patch) => setPicks((all) => ({ ...all, [type]: { ...(all[type] || {}), ...patch } }));
  const setVersion = (v) => setPick({ version: v });
  const setLoader = (l) => setPick({ loader: l });
  const [olderMaps, setOlderMaps] = useState(true);
  const [categories, setCategories] = useState([]);
  const [catList, setCatList] = useState([]);
  const [gameVersions, setGameVersions] = useState([]);
  const [hideInstalled, setHideInstalled] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);
  const sortMenu = useMenu();
  const sentinel = useRef(null);
  const usesLoader = type === 'mod' || type === 'modpack';
  const defVersion = rules.gameVersion || '';
  const defLoader = instance && type === 'mod' ? profileLoader : '';
  const version = pick.version !== undefined ? pick.version : defVersion;
  const loader = usesLoader ? (pick.loader !== undefined ? pick.loader : defLoader) : '';
  const changed = Boolean(instance) && (version !== defVersion || loader !== defLoader || (type === 'world' && !olderMaps));
  const resetFilters = () => {
    setPicks((all) => ({ ...all, [type]: {} }));
    setOlderMaps(true);
  };
  const clearProfileFilters = () => {
    setPick({ version: '', loader: '' });
    if (type === 'world') setOlderMaps(false);
  };
  const { installed } = useInstalled(instance ? instance.id : null, type, route.world);
  const { install, busy } = useInstaller();
  const search = useProjectSearch({ type, source, query: dq, sort, version, loader, categories });
  const results = useMemo(() => {
    let l = search.results;
    if (!l) return l;
    if (instance && type === 'world' && olderMaps) l = l.filter((p) => versionCompatible(p, instance, 'world'));
    if (instance && hideInstalled) l = l.filter((p) => !isInstalled(installed, p));
    return l;
  }, [search.results, type, instance, hideInstalled, installed, olderMaps]);

  useEffect(() => {
    if (route.type !== type) app.patchRoute({ type });
  }, [route.type, type]);
  useEffect(() => {
    setQuery(route.query || '');
  }, [route.query]);
  useEffect(() => {
    call('platforms.gameVersions')
      .then((v) => setGameVersions(v.filter((x) => x.type === 'release').map((x) => x.version)))
      .catch(() => setGameVersions([]));
  }, []);
  useEffect(() => {
    setCategories([]);
    call('platforms.categories', source === 'curseforge' ? 'curseforge' : 'modrinth', type)
      .then(setCatList)
      .catch(() => setCatList([]));
  }, [type, source]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !search.hasMore || search.loading) return undefined;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && search.loadMore());
    io.observe(el);
    return () => io.disconnect();
  }, [search.hasMore, search.loading, results]);

  const setType = (v) => app.patchRoute({ type: v });
  const setSource = (v) => {
    app.patchRoute({ source: v });
    app.updateConfig({ discoverSource: v });
  };
  const toggleCat = (id, v) => setCategories((l) => (v ? [...l, id] : l.filter((x) => x !== id)));
  const cfBanner = search.errors.curseforge && (search.errors.curseforge.code === 'CF_NO_KEY' || search.errors.curseforge.code === 'CF_BAD_KEY') ? cfKeyMissingBanner(app) : null;
  const typeTabs = TYPE_TABS().filter((x) => allowed.includes(x.value));
  const typeLabel = (typeTabs.find((x) => x.value === type) || typeTabs[0] || { label: '' }).label;
  const versionsShown = showAllVersions ? gameVersions : gameVersions.slice(0, 12);
  const catGroups = useMemo(() => {
    const m = new Map();
    for (const c of catList) {
      const h = c.header || '';
      if (!m.has(h)) m.set(h, []);
      m.get(h).push(c);
    }
    return [...m.entries()];
  }, [catList]);

  return (
    <div className="mr-page mr-browse">
      {instance ? (
        <div className="mr-install-head">
          <button className="mr-icon-btn xl" onClick={() => app.navigate({ page: 'instance', id: instance.id })} aria-label={t('Volver al perfil')} data-tip={t('Volver al perfil')}>
            <Icon name="arrowLeft" size={IC.s6} />
          </button>
          <span className="mr-install-art">
            <InstanceImage instance={instance} res={128} />
          </span>
          <span className="mr-install-text">
            <strong title={instance.name}>{instance.name}</strong>
            <span className="mr-inst-meta">
              <span className="mr-meta-item">
                <LoaderIcon loader={instance.loader} size={IC.s5} />
                {loaderText(instance)} {instance.mcVersion}
              </span>
            </span>
          </span>
        </div>
      ) : null}
      <MrTabs value={type} onChange={setType} tabs={typeTabs.map((x) => ({ value: x.value, label: x.label, icon: TYPE_ICON[x.value] }))} />
      <div className="mr-search lg">
        <Icon name="search" size={IC.s5} />
        <input autoFocus value={query} maxLength={120} placeholder={t('Buscar {type}…', { type: typeLabel.toLowerCase() })} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setQuery('')} />
        {query ? (
          <button className="mr-input-clear" aria-label={t('Borrar')} onClick={() => setQuery('')}>
            <Icon name="x" size={IC.s4} />
          </button>
        ) : null}
      </div>
      <div className="mr-browse-bar">
        <button ref={sortMenu.anchor} className={`mr-combo w16 ${sortMenu.open ? 'open' : ''}`} onClick={sortMenu.toggle}>
          <span className="mr-combo-prefix">{t('Ordenar por:')}</span>
          <span className="mr-combo-value">{(SORTS().find((s) => s.value === sort) || SORTS()[0]).label}</span>
          <Icon name="chevronLeft" size={IC.s5} className="mr-combo-chevron" />
        </button>
        <Popover anchor={sortMenu.anchor} open={sortMenu.open} onClose={sortMenu.close} matchWidth className="menu mr-pop mr-combo-pop">
          {SORTS().map((s) => (
            <MenuItem key={s.value} label={s.label} checked={sort === s.value} onClick={() => (sortMenu.close(), setSort(s.value))} />
          ))}
        </Popover>
        {type !== 'world' ? <Pills value={source} onChange={setSource} options={SOURCE_OPTIONS()} /> : <span className="mr-chip">{t('Los mundos solo están en CurseForge')}</span>}
        <span className="spacer" />
        <span className="muted">{results === null ? '' : search.total === 1 ? t('1 proyecto') : t('{n} proyectos', { n: formatCount(search.total) })}</span>
      </div>
      {instance ? <ProfileFilterNote instance={instance} type={type} version={version} loader={loader} defVersion={defVersion} defLoader={defLoader} olderMaps={olderMaps} changed={changed} onClear={clearProfileFilters} onReset={resetFilters} /> : null}
      {cfBanner && source !== 'modrinth' ? (
        <div className="mr-notice warn">
          <Icon name="alert" size={IC.s5} />
          <span>{cfBanner.text}</span>
          <button className="mr-btn" onClick={cfBanner.action}>
            {t('Configurar')}
          </button>
        </div>
      ) : null}
      {search.errors.modrinth ? (
        <div className="mr-notice err">
          <Icon name="xCircle" size={IC.s5} />
          <span>Modrinth: {search.errors.modrinth.message}</span>
        </div>
      ) : null}
      {results === null ? (
        <div className="center-spinner">
          <Spinner />
        </div>
      ) : !results.length ? (
        <div className="mr-empty">
          <Icon name="search" size={IC.s6 * 1.5} />
          <strong>{t('Sin resultados')}</strong>
          <span>{t('Prueba con otras palabras o quita algunos filtros.')}</span>
        </div>
      ) : (
        <div className="mr-results">
          {results.map((p) => {
            const key = `${p.source}:${p.id}`;
            return (
              <ResultCard
                key={key}
                p={p}
                instance={instance}
                installed={instance ? isInstalled(installed, p) : false}
                busy={busy.has(key)}
                issue={instance ? compatIssue(p, instance, type) : null}
                onInstall={() => install(p, { instanceId: instance ? instance.id : undefined, world: route.world })}
                onOpen={() => app.navigate({ page: 'project', source: p.source, id: p.id, instanceId: instance ? instance.id : undefined, alsoOn: p.alsoOn, world: route.world })}
              />
            );
          })}
          <div ref={sentinel} className="ac-sentinel">
            {search.hasMore && search.loading ? <Spinner size={IC.s6} /> : null}
          </div>
        </div>
      )}

      <SidebarPortal>
        {instance ? (
          <section className="mr-side-section mr-filter-switch">
            <label className="mr-side-switch">
              <span>{t('Ocultar lo instalado')}</span>
              <span className="mr-toggle-sm">
                <Toggle checked={hideInstalled} onChange={setHideInstalled} />
              </span>
            </label>
          </section>
        ) : null}
        {type !== 'world' ? (
          <FilterSection title={t('Versión del juego')} summary={version ? [version] : []}>
            {(version && !versionsShown.includes(version) ? [version, ...versionsShown] : versionsShown).map((v) => (
              <FilterOption key={v} on={version === v} onClick={() => setVersion(version === v ? '' : v)}>
                {instance && v === instance.mcVersion ? <ProfileMark text={v} hint={t('la del perfil')} /> : v}
              </FilterOption>
            ))}
            {gameVersions.length > 12 ? (
              <button className="mr-filter-more" onClick={() => setShowAllVersions((x) => !x)}>
                {showAllVersions ? t('Ver menos') : t('Ver todas')}
              </button>
            ) : null}
          </FilterSection>
        ) : null}
        {usesLoader ? (
          <FilterSection title={t('Cargador')} summary={loader ? [LOADER_NAME[loader]] : []}>
            {LOADERS.map((l) => (
              <FilterOption key={l} on={loader === l} onClick={() => setLoader(loader === l ? '' : l)}>
                <LoaderIcon loader={l} size={IC.s4} />
                {instance && l === profileLoader ? <ProfileMark text={LOADER_NAME[l]} hint={t('el del perfil')} /> : LOADER_NAME[l]}
              </FilterOption>
            ))}
          </FilterSection>
        ) : null}
        {catGroups.map(([header, cats]) => (
          <FilterSection key={header || 'cats'} title={{ categories: t('Categorías'), features: t('Características'), resolutions: t('Resoluciones'), 'performance impact': t('Impacto en el rendimiento') }[header] || (header ? header.charAt(0).toUpperCase() + header.slice(1) : t('Categorías'))} summary={cats.filter((c) => categories.includes(c.id)).map((c) => c.name)}>
            {cats.map((c) => (
              <FilterOption key={c.id} on={categories.includes(c.id)} onClick={() => toggleCat(c.id, !categories.includes(c.id))}>
                {c.name}
              </FilterOption>
            ))}
          </FilterSection>
        ))}
      </SidebarPortal>
    </div>
  );
}
