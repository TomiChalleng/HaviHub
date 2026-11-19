// Browse: search CurseForge / Modrinth / both with filters, install into an instance.
import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Button, Tabs, Pills, Select, Spinner, Empty, SourceBadge, Checkbox, useDebounced, SearchInput, EnvBadge } from '../components/ui.jsx';
import InstanceImage, { LoaderIcon } from '../components/InstanceImage.jsx';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { formatCount, timeAgo } from '../lib/format.js';
import { TYPE_TABS, SOURCE_OPTIONS, useInstaller, useProjectSearch, cfKeyMissingBanner, ServiceDownNote } from './browseShared.jsx';
import AddContent from './AddContent.jsx';

export function ProjectRow({ p, installed, busy, onInstall, onOpen, actionLabel }) {
  return (
    <div className="proj-row" onClick={onOpen}>
      {p.icon ? <img className="proj-icon" src={p.icon} alt="" loading="lazy" /> : <span className="proj-icon placeholder"><Icon name="box" size={30} /></span>}
      <div className="proj-main">
        <div className="proj-title-row">
          <strong className="proj-title">{p.title}</strong>
          {p.author ? <span className="muted">{t('por {a}', { a: p.author })}</span> : null}
        </div>
        <p className="proj-desc">{p.description}</p>
        <div className="proj-meta">
          {p.type === 'mod' && p.env ? <EnvBadge env={p.env} compact /> : null}
          <span>
            <Icon name="download" size={16} />
            {formatCount(p.downloads)}
          </span>
          <span>
            <Icon name="history" size={16} />
            {timeAgo(p.updated)}
          </span>
          {(p.categories || []).slice(0, 3).map((c) => (
            <span key={c} className="chip">
              {c}
            </span>
          ))}
        </div>
      </div>
      <div className="proj-side">
        <SourceBadge source={p.source} alsoOn={p.alsoOn && p.alsoOn.source} title={p.alsoOn ? t('Está en CurseForge y en Modrinth') : undefined} />
        {installed ? (
          <Button variant="secondary" icon="check" disabled onClick={(e) => e.stopPropagation()}>
            {t('Instalado')}
          </Button>
        ) : (
          <Button
            variant="primary"
            icon="download"
            loading={busy}
            onClick={(e) => {
              e.stopPropagation();
              onInstall();
            }}
          >
            {actionLabel || t('Instalar')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Browse() {
  const app = useApp();
  const instance = app.route.instanceId ? app.instances.find((i) => i.id === app.route.instanceId) : null;
  // adding content to a profile: CurseForge-style view
  if (instance) return <AddContent key={instance.id} instance={instance} />;
  return <Explore />;
}

function Explore() {
  const app = useApp();
  const { route, config } = app;
  const type = route.type || 'mod';
  const source = route.source || (config && config.discoverSource) || 'both';
  const [query, setQuery] = useState(route.query || '');
  const dq = useDebounced(query, 400);
  const [sort, setSort] = useState('relevance');
  const [version, setVersion] = useState('');
  const [loader, setLoader] = useState('');
  const [categories, setCategories] = useState([]);
  const [catList, setCatList] = useState([]);
  const [gameVersions, setGameVersions] = useState([]);
  const { install, busy } = useInstaller();
  const { results, hasMore, loading, errors, loadMore } = useProjectSearch({ type, source, query: dq, sort, version, loader, categories });

  useEffect(() => setQuery(route.query || ''), [route.query]);

  useEffect(() => {
    call('platforms.gameVersions')
      .then((v) => setGameVersions(v.filter((x) => x.type === 'release').map((x) => x.version)))
      .catch(() => {
        call('meta.minecraft')
          .then((v) => setGameVersions(v.filter((x) => x.type === 'release').map((x) => x.version)))
          .catch(() => {});
      });
  }, []);

  useEffect(() => {
    setCategories([]);
    call('platforms.categories', source === 'curseforge' || type === 'world' ? 'curseforge' : 'modrinth', type)
      .then(setCatList)
      .catch(() => setCatList([]));
  }, [type, source]);

  const setType = (v) => app.patchRoute({ type: v });
  const setSource = (v) => {
    app.patchRoute({ source: v });
    app.updateConfig({ discoverSource: v });
  };

  const types = TYPE_TABS();
  const cfBanner = errors.curseforge && (errors.curseforge.code === 'CF_NO_KEY' || errors.curseforge.code === 'CF_BAD_KEY') ? cfKeyMissingBanner(app) : null;

  const catOptions = useMemo(() => catList.map((c) => ({ value: c.id, label: c.name })), [catList]);

  return (
    <div className="page browse">
      <div className="browse-top">
        <Tabs value={type} onChange={setType} tabs={types} />
        <span className="spacer" />
        {type !== 'world' ? <Pills value={source} onChange={setSource} options={SOURCE_OPTIONS()} /> : <span className="muted small">{t('Los mundos solo están en CurseForge')}</span>}
      </div>
      <div className="browse-layout">
        <aside className="browse-filters">
          <SearchInput value={query} onChange={setQuery} placeholder={t('Buscar {type}…', { type: types.find((x) => x.value === type) ? types.find((x) => x.value === type).label.toLowerCase() : '' })} />
          <label className="label">{t('Versión del juego')}</label>
          <Select value={version} onChange={setVersion} options={[{ value: '', label: t('Todas las versiones') }, ...gameVersions.map((v) => ({ value: v, label: v }))]} maxHeight={360} />
          {type === 'mod' || type === 'modpack' ? (
            <>
              <label className="label">{t('Cargador')}</label>
              <Select
                value={loader}
                onChange={setLoader}
                options={[
                  { value: '', label: t('Cualquiera') },
                  { value: 'fabric', label: 'Fabric' },
                  { value: 'quilt', label: 'Quilt' },
                  { value: 'forge', label: 'Forge' },
                  { value: 'neoforge', label: 'NeoForge' },
                ]}
              />
            </>
          ) : null}
          <label className="label">{t('Ordenar por')}</label>
          <Select
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
          {catOptions.length ? (
            <>
              <label className="label">{t('Categorías')}</label>
              <div className="cat-list">
                {catOptions.map((c) => (
                  <Checkbox key={c.value} checked={categories.includes(c.value)} onChange={(v) => setCategories((l) => (v ? [...l, c.value] : l.filter((x) => x !== c.value)))} label={c.label} />
                ))}
              </div>
            </>
          ) : null}
        </aside>
        <section className="browse-results">
          {cfBanner && source !== 'modrinth' ? (
            <div className="banner warn">
              <Icon name="alert" size={20} />
              <span>{cfBanner.text}</span>
              <Button size="sm" variant="secondary" onClick={cfBanner.action}>
                {t('Configurar')}
              </Button>
            </div>
          ) : null}
          <ServiceDownNote errors={errors} />
          {results === null ? (
            <div className="center-spinner">
              <Spinner />
            </div>
          ) : results.length === 0 ? (
            <Empty icon="search" title={t('Sin resultados')} text={t('Prueba con otras palabras o quita algunos filtros.')} />
          ) : (
            <div className="proj-list">
              {results.map((p) => (
                <ProjectRow
                  key={`${p.source}:${p.id}`}
                  p={p}
                  installed={false}
                  busy={busy.has(`${p.source}:${p.id}`)}
                  actionLabel={p.type === 'modpack' ? t('Instalar') : t('Instalar…')}
                  onInstall={() => install(p, {})}
                  onOpen={() => app.navigate({ page: 'project', source: p.source, id: p.id, alsoOn: p.alsoOn })}
                />
              ))}
            </div>
          )}
          {results && results.length && hasMore ? (
            <div className="load-more">
              <Button loading={loading} onClick={loadMore}>
                {t('Cargar más')}
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
