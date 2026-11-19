// Shared helpers for Discover / Browse / Project pages.
import { useCallback, useEffect, useRef, useState } from 'react';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import Icon from '../components/Icon.jsx';
import { useApp } from '../lib/store.jsx';
import { InstallTargetDialog } from '../dialogs/InstanceDialogs.jsx';
import { showInstallResult } from '../lib/actions.js';

export const TYPE_TABS = () => [
  { value: 'modpack', label: t('Modpacks') },
  { value: 'mod', label: t('Mods') },
  { value: 'resourcepack', label: t('Resource Packs') },
  { value: 'shader', label: t('Shaders') },
  { value: 'datapack', label: t('Data Packs') },
  { value: 'world', label: t('Mundos') },
];

export const KIND_OF = { mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks', datapack: 'datapacks' };

export const SOURCE_OPTIONS = () => [
  { value: 'both', label: t('Ambos'), title: t('Busca en CurseForge y Modrinth; si un proyecto está en los dos, muestra el más actualizado') },
  { value: 'modrinth', label: 'Modrinth', logo: 'modrinth' },
  { value: 'curseforge', label: 'CurseForge', logo: 'curseforge' },
];

// Which projects are already installed in an instance (by provider:projectId)
export function useInstalled(instanceId, type, world) {
  const app = useApp();
  const [installed, setInstalled] = useState(new Set());
  const kind = KIND_OF[type];
  const reload = useCallback(() => {
    if (!instanceId || !kind) return setInstalled(new Set());
    call('content.list', instanceId, kind, world ? { world } : {})
      .then((r) => setInstalled(new Set(r.items.filter((i) => i.meta).map((i) => `${i.meta.provider}:${i.meta.projectId}`))))
      .catch(() => setInstalled(new Set()));
  }, [instanceId, kind, world]);
  useEffect(reload, [reload, app.contentVersion]);
  return { installed, reload };
}

export function isInstalled(installed, p) {
  if (!p) return false;
  if (installed.has(`${p.source}:${p.id}`)) return true;
  if (p.alsoOn && installed.has(`${p.alsoOn.source}:${p.alsoOn.id}`)) return true;
  return false;
}

// Install a project: modpacks create a new instance, everything else goes into
// an instance (the one we are browsing for, or one the user picks).
export function useInstaller() {
  const app = useApp();
  const [busy, setBusy] = useState(new Set());
  const install = useCallback(
    async (project, { instanceId, versionId, world, version } = {}) => {
      const key = `${project.source}:${project.id}`;
      if (project.type === 'modpack') {
        setBusy((s) => new Set(s).add(key));
        try {
          app.toast(t('Instalando {name}… puedes seguir usando la app.', { name: project.title }));
          const r = await call('platforms.installModpack', { source: project.source, projectId: project.id, versionId, name: project.title, icon: project.icon && project.icon.startsWith('https') ? project.icon : null });
          await app.refreshInstances();
          if (r.blocked.length || r.failed.length) await showInstallResult(app, { installed: [], skipped: [], blocked: r.blocked, failed: r.failed }, t('Modpack instalado con avisos'));
          else app.toast(t('Modpack instalado: {name}', { name: project.title }), { type: 'success', action: { label: t('Abrir'), onClick: () => app.navigate({ page: 'instance', id: r.id, tab: 'content', sub: 'mods' }) } });
        } catch (e) {
          app.showError(e);
        } finally {
          setBusy((s) => {
            const n = new Set(s);
            n.delete(key);
            return n;
          });
        }
        return;
      }
      let target = instanceId;
      if (!target) {
        target = await app.openDialog(InstallTargetDialog, { project, version });
        if (!target) return;
      }
      setBusy((s) => new Set(s).add(key));
      try {
        const r = await call('platforms.install', { source: project.source, projectId: project.id, versionId, instanceId: target, type: project.type, title: project.title, world });
        await showInstallResult(app, r);
        app.bumpContent();
      } catch (e) {
        app.showError(e);
      } finally {
        setBusy((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        });
      }
    },
    [app],
  );
  return { install, busy };
}

export function cfKeyMissingBanner(app) {
  return {
    text: t('Para ver resultados de CurseForge necesitas tu propia API key gratuita de CurseForge.'),
    action: () => app.navigate({ page: 'settings', section: 'addons' }),
  };
}

// Search with paging ("load more" continues where each source left off)
export function useProjectSearch({ type, source, query, sort, version, loader, categories, limit = 24 }) {
  const app = useApp();
  const [results, setResults] = useState(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState({ modrinth: 0, curseforge: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const reqId = useRef(0);
  const cats = categories || [];

  const run = async (more) => {
    const my = ++reqId.current;
    setLoading(true);
    try {
      const r = await call('platforms.search', {
        source: type === 'world' ? 'curseforge' : source,
        type,
        query,
        sort,
        gameVersion: version || undefined,
        loaders: loader && (type === 'mod' || type === 'modpack') ? (loader === 'quilt' && type === 'mod' ? ['quilt', 'fabric'] : [loader]) : undefined,
        categories: source === 'curseforge' || type === 'world' ? [] : cats,
        cfCategoryIds: source === 'curseforge' || type === 'world' ? cats : undefined,
        offset: more ? offset : { modrinth: 0, curseforge: 0 },
        limit,
      });
      if (my !== reqId.current) return;
      setResults((prev) => {
        if (!more || !prev) return r.hits;
        const seen = new Set(prev.map((p) => `${p.source}:${p.id}`));
        return [...prev, ...r.hits.filter((h) => !seen.has(`${h.source}:${h.id}`))];
      });
      setTotal(r.total || 0);
      setOffset(r.nextOffset);
      setHasMore(r.hasMore);
      setErrors(r.errors || {});
    } catch (e) {
      if (my === reqId.current) {
        app.showError(e);
        setResults([]);
        setTotal(0);
      }
    } finally {
      if (my === reqId.current) setLoading(false);
    }
  };

  useEffect(() => {
    setResults(null);
    run(false);
  }, [query, sort, version, loader, type, source, cats.join(',')]);

  return { results, total, hasMore, loading, errors, loadMore: () => run(true) };
}

// A service that failed or took too long: the results of the other one are
// shown and this says, quietly, which one is missing. Key problems have
// their own banner (cfKeyMissingBanner).
const KEY_CODES = ['CF_NO_KEY', 'CF_BAD_KEY'];
export function downServices(errors) {
  return Object.entries(errors || {})
    .filter(([, e]) => e && !KEY_CODES.includes(e.code))
    .map(([k]) => (k === 'curseforge' ? 'CurseForge' : 'Modrinth'));
}
export function ServiceDownNote({ errors, className = '' }) {
  const down = downServices(errors);
  if (!down.length) return null;
  return (
    <p className={`service-note ${className}`} role="status">
      <Icon name="alert" size={16} />
      <span>{down.length > 1 ? t('CurseForge y Modrinth no responden ahora mismo. Inténtalo de nuevo en unos minutos.') : t('{s} no responde ahora mismo: se muestran los resultados disponibles.', { s: down[0] })}</span>
    </p>
  );
}
