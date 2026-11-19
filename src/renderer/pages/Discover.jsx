// Discover: featured carousel + rows, from CurseForge, Modrinth or both.
import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Button, Pills, Spinner, Empty, SourceBadge, Tabs } from '../components/ui.jsx';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { formatCount, timeAgo } from '../lib/format.js';
import { SOURCE_OPTIONS, useInstaller, cfKeyMissingBanner } from './browseShared.jsx';

function Carousel({ items, onOpen, onInstall, busy }) {
  const [i, setI] = useState(0);
  const timer = useRef(null);
  useEffect(() => {
    clearInterval(timer.current);
    timer.current = setInterval(() => setI((x) => (x + 1) % Math.max(1, items.length)), 8000);
    return () => clearInterval(timer.current);
  }, [items.length]);
  if (!items.length) return null;
  const p = items[i % items.length];
  const prev = items[(i - 1 + items.length) % items.length];
  const next = items[(i + 1) % items.length];
  const bg = (x) => (x.featuredImage ? `url("${x.featuredImage}")` : undefined);
  return (
    <div className="carousel">
      <div className="carousel-stage">
        <div className="carousel-peek left" style={{ backgroundImage: bg(prev) }} onClick={() => setI((x) => (x - 1 + items.length) % items.length)} />
        <div className="carousel-card" style={{ backgroundImage: bg(p) }} onClick={() => onOpen(p)}>
          <div className="carousel-shade" />
          <div className="carousel-head">
            {p.icon ? <img src={p.icon} alt="" /> : null}
            <div>
              <h2>{p.title}</h2>
              <span>{p.author}</span>
            </div>
            <SourceBadge source={p.source} />
          </div>
          <div className="carousel-foot">
            <div className="carousel-text">
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <div className="carousel-meta">
                <span>
                  <Icon name="download" size={16} /> {formatCount(p.downloads)}
                </span>
                <span>
                  <Icon name="history" size={16} /> {timeAgo(p.updated)}
                </span>
              </div>
            </div>
            <Button
              variant="primary"
              size="lg"
              icon="download"
              loading={busy.has(`${p.source}:${p.id}`)}
              onClick={(e) => {
                e.stopPropagation();
                onInstall(p);
              }}
            >
              {t('Instalar')}
            </Button>
          </div>
        </div>
        <div className="carousel-peek right" style={{ backgroundImage: bg(next) }} onClick={() => setI((x) => (x + 1) % items.length)} />
        <button className="carousel-arrow left" onClick={() => setI((x) => (x - 1 + items.length) % items.length)}>
          <Icon name="chevronLeft" size={22} />
        </button>
        <button className="carousel-arrow right" onClick={() => setI((x) => (x + 1) % items.length)}>
          <Icon name="chevronRight" size={22} />
        </button>
      </div>
      <div className="carousel-dots">
        {items.map((x, n) => (
          <button key={n} className={n === i % items.length ? 'active' : ''} onClick={() => setI(n)} />
        ))}
      </div>
    </div>
  );
}

// A row of cards. On hover a card's picture gets shorter and "Install" appears
// under the name, the way the CurseForge app does it.
function Row({ title, items, onOpen, onInstall, busy }) {
  const ref = useRef(null);
  if (!items || !items.length) return null;
  const scroll = (d) => ref.current && ref.current.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <div className="disc-row">
      <div className="disc-row-head">
        <h3>{title}</h3>
        <span className="spacer" />
        <button className="round-btn" onClick={() => scroll(-1)}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <button className="round-btn" onClick={() => scroll(1)}>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
      <div className="disc-row-items" ref={ref}>
        {items.map((p) => {
          const key = `${p.source}:${p.id}`;
          const installing = busy && busy.has(key);
          return (
            <div key={key} className={`disc-card ${installing ? 'installing' : ''}`} role="link" tabIndex={0} onClick={() => onOpen(p)} onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onOpen(p)}>
              <div className="disc-card-img" style={{ backgroundImage: p.featuredImage ? `url("${p.featuredImage}")` : undefined }}>
                {p.icon ? <img src={p.icon} alt="" loading="lazy" draggable={false} /> : <Icon name="box" size={40} />}
              </div>
              <div className="disc-card-body">
                <strong>{p.title}</strong>
                <span className="muted small">{p.author}</span>
                <div className="disc-card-meta">
                  <SourceBadge source={p.source} small />
                  <span className="muted small">
                    <Icon name="download" size={14} /> {formatCount(p.downloads)}
                  </span>
                </div>
              </div>
              <Button
                variant="primary"
                className="disc-card-install"
                tabIndex={-1}
                loading={installing}
                onClick={(e) => {
                  e.stopPropagation();
                  onInstall(p);
                }}
              >
                {t('Instalar')}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Discover() {
  const app = useApp();
  const source = (app.config && app.config.discoverSource) || 'both';
  const [type, setType] = useState('modpack');
  const [data, setData] = useState(null);
  const { install, busy } = useInstaller();

  useEffect(() => {
    let alive = true;
    setData(null);
    call('platforms.discover', { source, type })
      .then((d) => alive && setData(d))
      .catch((e) => {
        if (alive) {
          app.showError(e);
          setData({ featured: [], popular: [], updated: [], newest: [], errors: {} });
        }
      });
    return () => {
      alive = false;
    };
  }, [source, type]);

  const open = (p) => app.navigate({ page: 'project', source: p.source, id: p.id, alsoOn: p.alsoOn });
  const cfBanner = data && data.errors && data.errors.curseforge && ['CF_NO_KEY', 'CF_BAD_KEY'].includes(data.errors.curseforge.code) ? cfKeyMissingBanner(app) : null;

  return (
    <div className="page discover">
      <div className="discover-top">
        <Tabs
          value={type}
          onChange={setType}
          tabs={[
            { value: 'modpack', label: t('Modpacks') },
            { value: 'mod', label: t('Mods') },
            { value: 'shader', label: t('Shaders') },
            { value: 'resourcepack', label: t('Resource Packs') },
          ]}
        />
        <span className="spacer" />
        <span className="muted">{t('Buscar en:')}</span>
        <Pills value={source} onChange={(v) => app.updateConfig({ discoverSource: v })} options={SOURCE_OPTIONS()} />
      </div>
      {source === 'both' ? <p className="muted small discover-note">{t('Si un proyecto está en CurseForge y en Modrinth, se muestra una sola vez: la versión actualizada más recientemente.')}</p> : null}
      {cfBanner && source !== 'modrinth' ? (
        <div className="banner warn">
          <Icon name="alert" size={20} />
          <span>{cfBanner.text}</span>
          <Button size="sm" variant="secondary" onClick={cfBanner.action}>
            {t('Configurar')}
          </Button>
        </div>
      ) : null}
      {!data ? (
        <div className="center-spinner">
          <Spinner />
        </div>
      ) : !data.featured.length && !data.popular.length ? (
        <Empty icon="compass" title={t('No se pudo cargar contenido')} text={data.errors && Object.values(data.errors).map((e) => e.message).join(' · ')} />
      ) : (
        <>
          <Carousel items={data.featured} onOpen={open} onInstall={(p) => install(p)} busy={busy} />
          <Row title={t('Más descargados')} items={data.popular} onOpen={open} onInstall={(p) => install(p)} busy={busy} />
          <Row title={t('Actualizados recientemente')} items={data.updated} onOpen={open} onInstall={(p) => install(p)} busy={busy} />
          <Row title={t('Nuevos')} items={data.newest} onOpen={open} onInstall={(p) => install(p)} busy={busy} />
          <div className="load-more">
            <Button icon="search" onClick={() => app.navigate({ page: 'browse', type })}>
              {t('Ver todo en Explorar')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
