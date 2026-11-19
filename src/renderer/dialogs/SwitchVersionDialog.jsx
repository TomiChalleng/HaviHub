// "Switch version" of an installed mod/pack: the project's versions on the
// left (the installed one marked "Current", the one used before the last
// update marked "Previous"), the selected version's changelog on the right.
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal.jsx';
import { Button, Spinner, Toggle } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { formatDate } from '../lib/format.js';
import { renderBody } from '../lib/richText.js';
import { showInstallResult } from '../lib/actions.js';

const TYPE_LABEL = () => ({ release: t('Estable'), beta: t('Beta'), alpha: t('Alfa') });
const TYPE_LETTER = { release: 'R', beta: 'B', alpha: 'A' };

export function VersionTypeBadge({ type, letter }) {
  const ty = type || 'release';
  return <span className={`vbadge vbadge-${ty} ${letter ? 'letter' : ''}`}>{letter ? TYPE_LETTER[ty] : TYPE_LABEL()[ty]}</span>;
}

const LOADER_NAMES = { fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', quilt: 'Quilt', iris: 'Iris', optifine: 'OptiFine', canvas: 'Canvas', datapack: 'Data pack', minecraft: 'Minecraft' };

export function useChangelog(source, projectId, version) {
  const [log, setLog] = useState(null);
  useEffect(() => {
    if (!version) return undefined;
    let alive = true;
    // Modrinth versions already carry their changelog
    if (version.changelog) {
      setLog({ format: 'markdown', text: version.changelog });
      return undefined;
    }
    setLog(null);
    call('platforms.changelog', source, projectId, version.id)
      .then((r) => alive && setLog(r))
      .catch(() => alive && setLog({ format: 'markdown', text: '' }));
    return () => {
      alive = false;
    };
  }, [source, projectId, version && version.id]);
  return log;
}

export function Changelog({ log }) {
  if (!log) return <div className="center-spinner"><Spinner /></div>;
  if (!log.text || !log.text.trim()) return <p className="muted">{t('Esta versión no trae notas de cambios.')}</p>;
  return <div className="markdown changelog-body" dangerouslySetInnerHTML={{ __html: renderBody(log.text, log.format) }} />;
}

export default function SwitchVersionDialog({ instance, kind, world, item, icon, onResolve }) {
  const app = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [all, setAll] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const opts = world ? { world } : {};

  useEffect(() => {
    let alive = true;
    setData(null);
    call('content.versions', instance.id, kind, item.fileName, { ...opts, all })
      .then((r) => {
        if (!alive) return;
        setData(r);
        setSelected((cur) => (cur && r.versions.some((v) => v.id === cur) ? cur : (r.versions.find((v) => String(v.id) === String(r.current)) || r.versions[0] || {}).id || null));
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [all]);

  const list = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return q ? data.versions.filter((v) => `${v.versionNumber} ${v.name}`.toLowerCase().includes(q)) : data.versions;
  }, [data, query]);
  const version = data ? data.versions.find((v) => v.id === selected) : null;
  const log = useChangelog(data && data.source, data && data.projectId, version);
  const isCurrent = (v) => data && String(v.id) === String(data.current);
  const isPrevious = (v) => data && data.previous && String(v.id) === String(data.previous.versionId);

  const apply = async () => {
    if (!version || isCurrent(version)) return;
    setBusy(true);
    try {
      const r = await call('content.switchVersion', instance.id, kind, item.fileName, { source: data.source, projectId: data.projectId, versionId: version.id }, opts);
      await showInstallResult(app, r, t('Cambio de versión'));
      app.bumpContent();
      onResolve(true);
    } catch (e) {
      app.showError(e);
      setBusy(false);
    }
  };

  return (
    <Modal
      className="switch-version"
      width={1000}
      onClose={() => onResolve(false)}
      title={
        <span className="sv-title">
          {icon ? <img src={icon} alt="" className="sv-title-icon" /> : <Icon name="box" size={22} />}
          {t('Cambiar versión')}
          <span className="muted sv-title-name">{item.name}</span>
        </span>
      }
      footer={
        error ? (
          <Button variant="secondary" onClick={() => onResolve(false)}>
            {t('Cerrar')}
          </Button>
        ) : (
          <>
            <span className="sv-warning">
              <Icon name="alert" size={18} />
              {t('Cambiar de versión puede romper el perfil. Revisa las notas de cambios y haz una copia antes.')}
            </span>
            <Button variant="ghost" icon="x" onClick={() => onResolve(false)}>
              {t('Cancelar')}
            </Button>
            <Button variant="primary" icon="download" loading={busy} disabled={!version || isCurrent(version)} onClick={apply}>
              {version && !isCurrent(version) ? t('Cambiar a {v}', { v: version.versionNumber }) : t('Versión actual')}
            </Button>
          </>
        )
      }
    >
      {error ? (
        <div className="sv-error">
          <Icon name="info" size={20} />
          <span>{error}</span>
        </div>
      ) : (
        <div className="sv-grid">
          <div className="sv-list">
            <div className="sv-search">
              <Icon name="search" size={17} />
              <input value={query} maxLength={60} placeholder={t('Buscar versión…')} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="sv-items">
              {!data ? (
                <div className="center-spinner">
                  <Spinner />
                </div>
              ) : list.length === 0 ? (
                <p className="muted sv-empty">{all ? t('Sin versiones con ese nombre.') : t('No hay otras versiones para {v}. Activa "Mostrar incompatibles" para verlas todas.', { v: instance.mcVersion })}</p>
              ) : (
                list.map((v) => (
                  <button key={v.id} className={`sv-item ${v.id === selected ? 'on' : ''} ${v.compatible ? '' : 'incompatible'}`} onClick={() => setSelected(v.id)}>
                    <VersionTypeBadge type={v.type} letter />
                    <span className="sv-item-name" title={v.name}>
                      {v.versionNumber}
                    </span>
                    {isCurrent(v) ? <span className="sv-chip current">{t('Actual')}</span> : isPrevious(v) ? <span className="sv-chip previous" data-tip={t('La que usabas antes de actualizar')}>{t('Anterior')}</span> : null}
                  </button>
                ))
              )}
            </div>
            <label className="sv-incompatible">
              <Icon name={all ? 'eye' : 'eyeOff'} size={18} />
              <span>{t('Mostrar incompatibles')}</span>
              <Toggle checked={all} onChange={setAll} />
            </label>
          </div>
          <div className="sv-detail">
            {version ? (
              <>
                <div className="sv-detail-head">
                  <h3>{version.versionNumber}</h3>
                  <VersionTypeBadge type={version.type} />
                  {!version.compatible ? <span className="sv-chip warn">{t('No compatible con {v}', { v: instance.mcVersion })}</span> : null}
                  <span className="spacer" />
                  <span className="muted">{formatDate(Date.parse(version.date))}</span>
                </div>
                <div className="sv-meta">
                  <span className="sv-meta-item">
                    <Icon name="file" size={16} />
                    {t('Notas de cambios')}
                  </span>
                  {(version.loaders || []).filter((l) => l !== 'minecraft').length ? (
                    <span className="sv-meta-item">{version.loaders.filter((l) => l !== 'minecraft').map((l) => LOADER_NAMES[l] || l).join(', ')}</span>
                  ) : null}
                  {(version.gameVersions || []).length ? (
                    <span className="sv-meta-item" title={version.gameVersions.join(', ')}>
                      {version.gameVersions.length > 3 ? `${version.gameVersions[0]} … ${version.gameVersions[version.gameVersions.length - 1]}` : version.gameVersions.join(', ')}
                    </span>
                  ) : null}
                  {isPrevious(version) ? (
                    <span className="sv-meta-item previous">
                      <Icon name="history" size={16} />
                      {t('Usabas esta antes de actualizar')}
                    </span>
                  ) : null}
                </div>
                <div className="sv-log">
                  <Changelog log={log} />
                </div>
              </>
            ) : data ? (
              <p className="muted">{t('Elige una versión.')}</p>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
