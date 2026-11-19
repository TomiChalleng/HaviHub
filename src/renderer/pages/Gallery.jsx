// Screenshots of every instance in one place, grouped by day, with filters
// for instance, group, Minecraft version and date, and the same viewer as
// the instance page.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, IconButton, Empty, Spinner, Select } from '../components/ui.jsx';
import InstanceImage from '../components/InstanceImage.jsx';
import Lightbox from '../components/Lightbox.jsx';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t, getLanguage } from '../lib/i18n.js';

const PAGE = 120;
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const monthKey = (ms) => dayKey(ms).slice(0, 7);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const shotsLabel = (n) => (n === 1 ? t('1 captura') : t('{n} capturas', { n }));

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabel(ms, locale) {
  const today = startOfToday();
  const key = dayKey(ms);
  if (key === dayKey(today)) return t('Hoy');
  if (key === dayKey(today - 86400000)) return t('Ayer');
  const sameYear = new Date(ms).getFullYear() === new Date().getFullYear();
  return cap(new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }).format(new Date(ms)));
}

function inRange(ms, range) {
  if (range === 'all') return true;
  const today = startOfToday();
  if (range === 'today') return ms >= today;
  if (range === 'week') return ms >= today - 6 * 86400000;
  if (range === 'month') return ms >= today - 29 * 86400000;
  if (range === 'year') return new Date(ms).getFullYear() === new Date().getFullYear();
  if (range.startsWith('m:')) return monthKey(ms) === range.slice(2);
  return true;
}

export default function Gallery() {
  const app = useApp();
  const locale = getLanguage() === 'en' ? 'en' : 'es';
  const [all, setAll] = useState(null);
  const [inst, setInst] = useState(app.route.instanceId || '');
  const [group, setGroup] = useState('');
  const [version, setVersion] = useState('');
  const [range, setRange] = useState('all');
  const [order, setOrder] = useState('new');
  const [limit, setLimit] = useState(PAGE);
  const [view, setView] = useState(-1);
  const sentinel = useRef(null);

  const load = useCallback(() => {
    call('screenshots.all')
      .then(setAll)
      .catch(() => setAll([]));
  }, []);
  useEffect(load, [load]);

  const byId = useMemo(() => new Map(app.instances.map((i) => [i.id, i])), [app.instances]);
  const shots = useMemo(() => (all || []).filter((s) => byId.has(s.instanceId)), [all, byId]);

  // what the filters can offer: only what has screenshots
  const options = useMemo(() => {
    const count = new Map();
    const versions = new Set();
    const groups = new Set();
    const months = new Set();
    for (const s of shots) {
      count.set(s.instanceId, (count.get(s.instanceId) || 0) + 1);
      const i = byId.get(s.instanceId);
      if (i.mcVersion) versions.add(i.mcVersion);
      if (i.group) groups.add(i.group);
      months.add(monthKey(s.mtime));
    }
    const insts = [...count.keys()].map((id) => byId.get(id)).sort((a, b) => a.name.localeCompare(b.name));
    return {
      insts: [{ value: '', label: t('Todas las instancias') }, ...insts.map((i) => ({ value: i.id, label: i.name, hint: String(count.get(i.id)) }))],
      versions: [{ value: '', label: t('Todas las versiones') }, ...[...versions].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).map((v) => ({ value: v, label: `Minecraft ${v}` }))],
      groups: groups.size ? [{ value: '', label: t('Todos los grupos') }, ...[...groups].sort().map((g) => ({ value: g, label: g }))] : null,
      dates: [
        { value: 'all', label: t('Cualquier fecha') },
        { value: 'today', label: t('Hoy') },
        { value: 'week', label: t('Últimos 7 días') },
        { value: 'month', label: t('Últimos 30 días') },
        { value: 'year', label: t('Este año') },
        ...(months.size ? [{ header: true, label: t('Por mes') }] : []),
        ...[...months]
          .sort()
          .reverse()
          .map((m) => ({ value: `m:${m}`, label: cap(new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(`${m}-15T12:00:00`))) })),
      ],
    };
  }, [shots, byId, locale]);

  const filtered = useMemo(() => {
    const list = shots.filter((s) => {
      const i = byId.get(s.instanceId);
      return (!inst || s.instanceId === inst) && (!group || i.group === group) && (!version || i.mcVersion === version) && inRange(s.mtime, range);
    });
    return order === 'old' ? list.reverse() : list;
  }, [shots, byId, inst, group, version, range, order]);

  useEffect(() => setLimit(PAGE), [inst, group, version, range, order]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setLimit((l) => l + PAGE), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered, limit]);

  // days, in the list's order
  const days = useMemo(() => {
    const out = [];
    filtered.slice(0, limit).forEach((s, i) => {
      const key = dayKey(s.mtime);
      if (!out.length || out[out.length - 1].key !== key) out.push({ key, label: dayLabel(s.mtime, locale), items: [] });
      out[out.length - 1].items.push({ s, i });
    });
    return out;
  }, [filtered, limit, locale]);
  const dayCount = useMemo(() => {
    const m = new Map();
    for (const s of filtered) m.set(dayKey(s.mtime), (m.get(dayKey(s.mtime)) || 0) + 1);
    return m;
  }, [filtered]);

  const filtersOn = inst || group || version || range !== 'all';
  const clear = () => {
    setInst('');
    setGroup('');
    setVersion('');
    setRange('all');
  };

  const remove = async (s) => {
    const ok = await app.confirm({ title: t('Eliminar captura'), message: t('Se moverá a la papelera: {name}', { name: s.name }), confirmLabel: t('Eliminar'), danger: true });
    if (!ok) return;
    try {
      await call('screenshots.remove', s.instanceId, s.name);
      setAll((list) => list.filter((x) => x.key !== s.key));
      setView((v) => (filtered.length <= 1 ? -1 : Math.min(v, filtered.length - 2)));
    } catch (e) {
      app.showError(e);
    }
  };

  const time = (ms) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

  return (
    <div className="page shots-page">
      <div className="toolbar gallery-filters">
        <Select className="gf-inst" icon="layers" value={inst} options={options.insts} onChange={setInst} />
        {options.groups ? <Select className="gf-group" icon="groupGrid" value={group} options={options.groups} onChange={setGroup} /> : null}
        <Select className="gf-version" icon="tag" value={version} options={options.versions} onChange={setVersion} />
        <Select className="gf-date" icon="calendar" value={range} options={options.dates} onChange={setRange} maxHeight={420} />
        <Select
          className="gf-order"
          icon="sort"
          value={order}
          onChange={setOrder}
          options={[
            { value: 'new', label: t('Más recientes primero') },
            { value: 'old', label: t('Más antiguas primero') },
          ]}
        />
        <span className="spacer" />
        {all ? <span className="muted gallery-count">{filtersOn ? t('{n} de {total} capturas', { n: filtered.length, total: shots.length }) : shotsLabel(shots.length)}</span> : null}
        {inst ? <IconButton icon="folder" title={t('Abrir carpeta de capturas')} onClick={() => call('instances.openFolder', inst, 'screenshots')} /> : null}
        <IconButton icon="refresh" title={t('Recargar')} onClick={load} />
      </div>
      {all === null ? (
        <div className="center-spinner">
          <Spinner />
        </div>
      ) : shots.length === 0 ? (
        <Empty icon="camera" title={t('Todavía no tienes capturas')} text={t('Presiona F2 dentro del juego para sacar una. Aquí verás las de todas tus instancias.')} />
      ) : filtered.length === 0 ? (
        <Empty icon="filter" title={t('Ninguna captura coincide con estos filtros')} text={t('Prueba con otra fecha o instancia.')}>
          <Button onClick={clear}>{t('Quitar filtros')}</Button>
        </Empty>
      ) : (
        <div className="gallery-days">
          {days.map((d) => (
            <section key={d.key} className="gallery-day">
              <h3 className="gallery-day-head">
                <span>{d.label}</span>
                <span className="gallery-day-count">{shotsLabel(dayCount.get(d.key))}</span>
              </h3>
              <div className="gallery-grid">
                {d.items.map(({ s, i }) => {
                  const instance = byId.get(s.instanceId);
                  return (
                    <button key={s.key} className="gallery-shot" onClick={() => setView(i)} aria-label={`${instance.name}, ${time(s.mtime)}`}>
                      <img src={s.thumb} alt="" loading="lazy" decoding="async" draggable={false} />
                      <span className="gallery-shot-meta">
                        <InstanceImage instance={instance} size={22} className="gallery-shot-inst" />
                        <span className="gallery-shot-name">{instance.name}</span>
                        <span className="gallery-shot-time">{time(s.mtime)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {limit < filtered.length ? <div ref={sentinel} className="gallery-more" /> : null}
        </div>
      )}
      {view >= 0 && filtered[view] ? (
        <Lightbox
          items={filtered}
          index={view}
          onIndex={setView}
          onClose={() => setView(-1)}
          onDelete={remove}
          head={(s) => {
            const instance = byId.get(s.instanceId);
            return (
              <button
                className="lightbox-inst"
                title={t('Abrir instancia')}
                onClick={() => {
                  setView(-1);
                  app.navigate({ page: 'instance', id: s.instanceId, tab: 'screenshots' });
                }}
              >
                <InstanceImage instance={instance} size={28} />
                <span className="lightbox-name">{instance.name}</span>
              </button>
            );
          }}
        />
      ) : null}
    </div>
  );
}
