// Project page (mod / modpack / pack): description, versions, gallery.
import { useEffect, useMemo, useState } from 'react';
import { renderBody } from '../lib/richText.js';
import Icon from '../components/Icon.jsx';
import { Button, Tabs, Spinner, Empty, SourceBadge, Select, EnvBadge } from '../components/ui.jsx';
import { compareVersions } from '../lib/format.js';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { formatCount, formatDate, timeAgo, formatSize } from '../lib/format.js';
import { useInstalled, isInstalled, useInstaller } from './browseShared.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import { typeAllowed, modLoadersFor, versionCompatible } from '../../shared/compat.js';

export default function Project() {
  const app = useApp();
  const { route } = app;
  const instance = route.instanceId ? app.instances.find((i) => i.id === route.instanceId) : null;
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('description');
  const [versions, setVersions] = useState(null);
  const [allVersions, setAllVersions] = useState(null);
  // Filters for the Versions tab (start with the instance's version/loader)
  const [fGame, setFGame] = useState(instance ? instance.mcVersion || '' : '');
  const [fLoader, setFLoader] = useState(instance && instance.loader ? instance.loader.id : '');
  const [fType, setFType] = useState('');
  const [lightbox, setLightbox] = useState(-1);
  const { installed } = useInstalled(instance ? instance.id : null, p ? p.type : null, route.world);
  const { install, busy } = useInstaller();

  useEffect(() => {
    setP(null);
    setError('');
    setTab('description');
    call('platforms.project', route.source, route.id)
      .then(setP)
      .catch((e) => setError(e.message));
  }, [route.source, route.id]);

  // Inside a profile: is there a version of this project that works there?
  const [compat, setCompat] = useState({ ok: true, reason: '' });
  useEffect(() => {
    if (!instance || !p || p.type === 'modpack') return setCompat({ ok: true, reason: '' });
    if (!typeAllowed(instance, p.type)) {
      return setCompat({
        ok: false,
        reason: p.type === 'mod' ? t('Este perfil es vanilla: para usar mods, cambia su versión a una con Fabric, Forge, NeoForge o Quilt.') : t('Este perfil es vanilla: los shaders necesitan Iris u OptiFine, que funcionan con un cargador de mods.'),
      });
    }
    if (p.type === 'resourcepack' || p.type === 'shader') return setCompat({ ok: true, reason: '' });
    let alive = true;
    setCompat({ ok: null, reason: '' });
    const filters = p.type === 'world' ? {} : { gameVersion: instance.mcVersion, loaders: p.type === 'mod' ? modLoadersFor(instance) : undefined };
    call('platforms.versions', p.source, p.id, filters)
      .then((list) => {
        if (!alive) return;
        const ok = list.some((v) => versionCompatible(v, instance, p.type));
        const loader = instance.loader ? { fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', quilt: 'Quilt' }[instance.loader.id] || instance.loader.id : '';
        setCompat({ ok, reason: ok ? '' : p.type === 'world' ? t('Este mapa es de una versión más nueva que {v}.', { v: instance.mcVersion }) : p.type === 'mod' ? t('No tiene una versión para {v} con {l}.', { v: instance.mcVersion, l: loader }) : t('No tiene una versión para {v}.', { v: instance.mcVersion }) });
      })
      .catch(() => alive && setCompat({ ok: true, reason: '' }));
    return () => {
      alive = false;
    };
  }, [p, instance && instance.id, instance && instance.mcVersion]);

  const isMod = p && (p.type === 'mod' || p.type === 'modpack');
  useEffect(() => {
    if (tab !== 'versions' || !p) return;
    setVersions(null);
    const filters = {};
    if (fGame) filters.gameVersion = fGame;
    if (fLoader && isMod) filters.loaders = fLoader === 'quilt' && p.type === 'mod' ? ['quilt', 'fabric'] : [fLoader];
    call('platforms.versions', p.source, p.id, filters)
      .then((list) => {
        setVersions(list);
        if (!fGame && !fLoader) setAllVersions(list);
      })
      .catch((e) => {
        app.showError(e);
        setVersions([]);
      });
  }, [tab, p, fGame, fLoader]);

  // Options: everything the project supports (plus what the loaded versions show)
  const gameOptions = useMemo(() => {
    const set = new Set([...((p && p.gameVersions) || []), ...((allVersions || []).flatMap((v) => v.gameVersions))]);
    if (fGame) set.add(fGame);
    return [...set].filter((v) => /^\d/.test(v)).sort((a, b) => compareVersions(b, a));
  }, [p, allVersions, fGame]);
  const loaderOptions = useMemo(() => {
    const set = new Set([...((p && p.loaders) || []), ...((allVersions || []).flatMap((v) => v.loaders))]);
    if (fLoader) set.add(fLoader);
    return [...set].filter((l) => l && !['minecraft', 'datapack'].includes(l)).sort();
  }, [p, allVersions, fLoader]);
  const shownVersions = useMemo(() => (versions || []).filter((v) => !fType || v.type === fType), [versions, fType]);
  const loaderLabel = (l) => ({ neoforge: 'NeoForge', fabric: 'Fabric', forge: 'Forge', quilt: 'Quilt', liteloader: 'LiteLoader', iris: 'Iris', optifine: 'OptiFine', canvas: 'Canvas', vanilla: 'Vanilla' })[l] || l.charAt(0).toUpperCase() + l.slice(1);

  const body = useMemo(() => (p ? renderBody(p.body, p.bodyFormat) : ''), [p]);

  if (error)
    return (
      <div className="page">
        <Empty icon="alert" title={t('No se pudo cargar el proyecto')} text={error}>
          <Button onClick={app.back}>{t('Volver')}</Button>
        </Empty>
      </div>
    );
  if (!p)
    return (
      <div className="page">
        <div className="center-spinner">
          <Spinner />
        </div>
      </div>
    );

  const inst = instance && isInstalled(installed, p);
  const key = `${p.source}:${p.id}`;

  return (
    <div className="page project-page">
      <button className="back-link" onClick={app.back}>
        <Icon name="arrowLeft" size={18} />
        {t('Volver')}
      </button>
      <div className="project-head">
        {p.icon ? <img className="project-icon" src={p.icon} alt="" /> : <span className="project-icon placeholder"><Icon name="box" size={48} /></span>}
        <div className="project-titles">
          <h1>{p.title}</h1>
          <div className="row wrap muted">
            {p.author ? <span>{t('por {a}', { a: p.author })}</span> : null}
            <span>
              <Icon name="download" size={16} /> {formatCount(p.downloads)}
            </span>
            <span>
              <Icon name="history" size={16} /> {t('Actualizado {when}', { when: timeAgo(p.updated).toLowerCase() })}
            </span>
            {p.license ? <span>{p.license}</span> : null}
          </div>
          <p className="project-summary">{p.description}</p>
          <div className="row wrap">
            <SourceBadge source={p.source} />
            {p.type === 'mod' ? <EnvBadge env={p.env} /> : null}
            {route.alsoOn ? (
              <button className="also-on link" onClick={() => app.navigate({ ...route, source: route.alsoOn.source, id: route.alsoOn.id, alsoOn: { source: p.source, id: p.id } })}>
                {t('Ver también en {s}', { s: route.alsoOn.source === 'curseforge' ? 'CurseForge' : 'Modrinth' })}
              </button>
            ) : null}
            {(p.categories || []).slice(0, 5).map((c) => (
              <span key={c} className="chip">
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="project-actions">
          {inst ? (
            <Button variant="secondary" size="lg" icon="check" disabled>
              {t('Instalado')}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              icon={compat.ok === false ? 'lock' : 'download'}
              loading={busy.has(key) || compat.ok === null}
              disabled={compat.ok === false}
              data-tip={compat.reason || undefined}
              onClick={() => install(p, { instanceId: instance ? instance.id : undefined, world: route.world })}
            >
              {p.type === 'modpack' ? t('Instalar modpack') : compat.ok === false ? t('No compatible') : instance ? t('Instalar en {name}', { name: instance.name }) : t('Instalar…')}
            </Button>
          )}
          <Button variant="ghost" className="with-logo" onClick={() => call('app.openExternal', p.url)}>
            <BrandLogo brand={p.source} size={18} title="" />
            {t('Abrir en {site}', { site: p.source === 'curseforge' ? 'CurseForge' : 'Modrinth' })}
          </Button>
          {p.links && p.links.source ? (
            <Button variant="ghost" icon="link" onClick={() => call('app.openExternal', p.links.source)}>
              {t('Código fuente')}
            </Button>
          ) : null}
          {p.links && p.links.issues ? (
            <Button variant="ghost" icon="alert" onClick={() => call('app.openExternal', p.links.issues)}>
              {t('Reportar problemas')}
            </Button>
          ) : null}
        </div>
        {compat.ok === false && !inst ? (
          <p className="compat-note">
            <Icon name="lock" size={16} />
            {compat.reason}
          </p>
        ) : null}
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'description', label: t('Descripción') },
          { value: 'versions', label: t('Versiones') },
          { value: 'gallery', label: t('Galería'), count: p.gallery ? p.gallery.length : 0 },
        ]}
      />
      <div className="project-body">
        {tab === 'description' ? (
          <div
            className="markdown selectable"
            dangerouslySetInnerHTML={{ __html: body }}
            onClick={(e) => {
              const a = e.target.closest('a');
              if (a && a.href) {
                e.preventDefault();
                call('app.openExternal', a.href);
              }
            }}
          />
        ) : null}
        {tab === 'versions' ? (
          <div className="versions">
            <div className="version-filters">
              <Select
                value={fGame}
                onChange={setFGame}
                maxHeight={360}
                options={[{ value: '', label: t('Todas las versiones') }, ...gameOptions.map((v) => ({ value: v, label: v }))]}
              />
              {isMod && loaderOptions.length ? (
                <Select value={fLoader} onChange={setFLoader} options={[{ value: '', label: t('Todos los cargadores') }, ...loaderOptions.map((l) => ({ value: l, label: loaderLabel(l) }))]} />
              ) : null}
              <Select
                value={fType}
                onChange={setFType}
                options={[
                  { value: '', label: t('Todos los tipos') },
                  { value: 'release', label: t('Estable') },
                  { value: 'beta', label: 'Beta' },
                  { value: 'alpha', label: 'Alpha' },
                ]}
              />
              {fGame || fLoader || fType ? (
                <Button variant="ghost" size="sm" icon="x" onClick={() => (setFGame(''), setFLoader(''), setFType(''))}>
                  {t('Quitar filtros')}
                </Button>
              ) : null}
              {instance ? (
                <Button
                  variant="ghost"
                  size="sm"
                  icon="cube"
                  onClick={() => {
                    setFGame(instance.mcVersion || '');
                    setFLoader(instance.loader ? instance.loader.id : '');
                  }}
                >
                  {t('Compatibles con {name}', { name: instance.name })}
                </Button>
              ) : null}
            </div>
            {versions === null ? (
              <div className="center-spinner">
                <Spinner />
              </div>
            ) : shownVersions.length === 0 ? (
              <Empty icon="box" title={t('No hay versiones con esos filtros')} />
            ) : (
              <div className="version-table">
                {shownVersions.slice(0, 150).map((v) => {
                  const f = v.files.find((x) => x.primary) || v.files[0];
                  return (
                    <div key={v.id} className="version-item">
                      <span className={`vtype vt-${v.type}`}>{v.type === 'release' ? 'R' : v.type === 'beta' ? 'B' : 'A'}</span>
                      <div className="version-main">
                        <strong>{v.name}</strong>
                        <small className="muted">
                          {v.gameVersions.slice(0, 6).join(', ')}
                          {v.gameVersions.length > 6 ? '…' : ''} · {v.loaders.map(loaderLabel).join(', ')}
                        </small>
                      </div>
                      {p.type === 'mod' ? <EnvBadge env={v.env || p.env} compact className="version-env" /> : null}
                      <span className="muted">{formatDate(Date.parse(v.date))}</span>
                      <span className="muted">{f ? formatSize(f.size) : ''}</span>
                      <Button size="sm" variant="secondary" icon="download" disabled={!f || !f.url || (instance && p.type !== 'modpack' && !versionCompatible(v, instance, p.type))} title={f && !f.url ? t('El autor no permite descargas desde otras apps') : instance && p.type !== 'modpack' && !versionCompatible(v, instance, p.type) ? t('No funciona en {name}', { name: instance.name }) : ''} onClick={() => install(p, { instanceId: instance ? instance.id : undefined, versionId: v.id, version: v, world: route.world })}>
                        {t('Instalar')}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
        {tab === 'gallery' ? (
          p.gallery && p.gallery.length ? (
            <div className="gallery">
              {p.gallery.map((g, i) => (
                <button key={i} className="gallery-item" onClick={() => setLightbox(i)}>
                  <img src={g.thumb || g.url} alt={g.title} loading="lazy" />
                  {g.title ? <span>{g.title}</span> : null}
                </button>
              ))}
            </div>
          ) : (
            <Empty icon="image" title={t('Sin imágenes')} />
          )
        ) : null}
      </div>
      {lightbox >= 0 && p.gallery[lightbox] ? (
        <div className="lightbox" onMouseDown={(e) => e.target === e.currentTarget && setLightbox(-1)}>
          <div className="lightbox-top">
            <span className="lightbox-name">{p.gallery[lightbox].title}</span>
            <span className="spacer" />
            <button className="icon-btn" onClick={() => setLightbox(-1)}>
              <Icon name="x" size={22} />
            </button>
          </div>
          <img className="lightbox-img" src={p.gallery[lightbox].url} alt="" />
          <button className="lb-nav prev" disabled={lightbox === 0} onClick={() => setLightbox((v) => v - 1)}>
            <Icon name="chevronLeft" size={34} />
          </button>
          <button className="lb-nav next" disabled={lightbox === p.gallery.length - 1} onClick={() => setLightbox((v) => v + 1)}>
            <Icon name="chevronRight" size={34} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
