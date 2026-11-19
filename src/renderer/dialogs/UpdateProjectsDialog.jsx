// "Update all": every project with a newer version, all checked. Uncheck the
// ones to keep, pick another target version if you want, read the changes.
import { useState } from 'react';
import { Modal } from '../components/Modal.jsx';
import { Button, Checkbox, Select } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { Changelog, useChangelog, VersionTypeBadge } from './SwitchVersionDialog.jsx';

function RowChangelog({ upd }) {
  const log = useChangelog(upd.source, upd.projectId, { id: upd.versionId, changelog: upd.changelog });
  return (
    <div className="up-log">
      <Changelog log={log} />
    </div>
  );
}

function UpdateRow({ entry, checked, onCheck, target, onTarget, instance, kind, world, open, onToggleLog }) {
  const { item, upd, icon } = entry;
  const [versions, setVersions] = useState(null);
  const load = () => {
    if (versions) return;
    call('content.versions', instance.id, kind, item.fileName, world ? { world } : {})
      .then((r) => {
        const cur = r.versions.find((v) => String(v.id) === String(r.current));
        const newer = cur ? r.versions.filter((v) => Date.parse(v.date) > Date.parse(cur.date)) : r.versions;
        setVersions(newer.length ? newer : r.versions);
      })
      .catch(() => setVersions([]));
  };
  const options = (versions || [{ id: upd.versionId, versionNumber: upd.versionNumber, type: upd.type }]).map((v) => ({ value: String(v.id), label: v.versionNumber, type: v.type }));
  const chosen = target || { ...upd };
  return (
    <>
      <div className={`up-row ${checked ? '' : 'off'}`}>
        <Checkbox checked={checked} onChange={onCheck} label="" />
        <span className="up-name">
          {icon ? <img loading="lazy" decoding="async" src={icon} alt="" /> : <span className="up-icon-ph"><Icon name="box" size={20} /></span>}
          <strong title={item.name}>{item.name}</strong>
        </span>
        <span className="up-from" title={item.fileName}>
          {item.version || (item.meta && item.meta.versionNumber) || item.baseName}
        </span>
        <Icon name="arrowRight" size={18} className="up-arrow" />
        <span className="up-to" onMouseDown={load} onFocus={load}>
          <VersionTypeBadge type={(options.find((o) => o.value === String(chosen.versionId)) || {}).type || chosen.type} letter />
          <Select
            value={String(chosen.versionId)}
            options={options}
            onChange={(v) => {
              const ver = (versions || []).find((x) => String(x.id) === v);
              if (ver) onTarget({ ...upd, versionId: ver.id, versionNumber: ver.versionNumber, type: ver.type, changelog: ver.changelog });
            }}
            maxHeight={300}
          />
        </span>
        <Button size="sm" variant="ghost" icon={open ? 'chevronUp' : 'file'} onClick={onToggleLog}>
          {t('Ver')}
        </Button>
      </div>
      {open ? <RowChangelog upd={chosen} /> : null}
    </>
  );
}

export default function UpdateProjectsDialog({ instance, kind, world, entries, onResolve }) {
  const app = useApp();
  const [backup, setBackup] = useState(() => Boolean(app.config && app.config.backupWorldsBeforeUpdate));
  const [checked, setChecked] = useState(() => new Set(entries.map((e) => e.item.fileName)));
  const [targets, setTargets] = useState({});
  const [openLog, setOpenLog] = useState(entries.length === 1 ? entries[0].item.fileName : '');
  const [progress, setProgress] = useState(null);
  const all = checked.size === entries.length;
  const list = entries.filter((e) => checked.has(e.item.fileName));
  const toggle = (f, v) =>
    setChecked((s) => {
      const n = new Set(s);
      if (v) n.add(f);
      else n.delete(f);
      return n;
    });

  const run = async () => {
    const out = { installed: [], skipped: [], blocked: [], failed: [] };
    if (Boolean(app.config && app.config.backupWorldsBeforeUpdate) !== backup) app.updateConfig({ backupWorldsBeforeUpdate: backup });
    if (backup) {
      setProgress({ done: -1, total: list.length, name: '' });
      try {
        await call('worlds.backupAll', instance.id);
      } catch (err) {
        setProgress(null);
        app.showError(err);
        return;
      }
    }
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      setProgress({ done: i, total: list.length, name: e.item.name });
      const target = targets[e.item.fileName] || e.upd;
      try {
        const r = await call('content.update', instance.id, kind, e.item.fileName, { source: target.source, projectId: target.projectId, versionId: target.versionId, versionNumber: target.versionNumber }, world ? { world } : {});
        for (const k of Object.keys(out)) out[k].push(...(r[k] || []));
      } catch (err) {
        if (err && err.code === 'CANCELLED') break;
        out.failed.push({ title: e.item.name, reason: err.message });
      }
    }
    onResolve(out);
  };

  return (
    <Modal
      className="update-projects"
      width={880}
      title={t('Actualizar proyectos')}
      onClose={() => !progress && onResolve(null)}
      footer={
        <>
          <span className="up-backup" data-tip={t('Comprime saves/ antes de actualizar. Se guardan las 3 últimas en la carpeta backups del perfil.')}>
            <Checkbox checked={backup} disabled={Boolean(progress)} onChange={setBackup} label={t('Copia de los mundos (.zip)')} />
          </span>
          <span className="sv-warning">
            <Icon name="alert" size={18} />
            {t('No podemos garantizar que las actualizaciones sean seguras para tus mundos. Revisa los cambios y considera hacer una copia.')}
          </span>
          <Button variant="ghost" icon="x" disabled={Boolean(progress)} onClick={() => onResolve(null)}>
            {t('Cancelar')}
          </Button>
          <Button variant="primary" icon="download" loading={Boolean(progress)} disabled={!list.length} onClick={run}>
            {progress ? (progress.done < 0 ? t('Copiando mundos…') : t('Actualizando {i} de {n}…', { i: progress.done + 1, n: progress.total })) : list.length === 1 ? t('Actualizar 1 proyecto') : t('Actualizar {n} proyectos', { n: list.length })}
          </Button>
        </>
      }
    >
      <div className="up-table">
        <div className="up-head">
          <Checkbox checked={all} indeterminate={!all && checked.size > 0} onChange={(v) => setChecked(new Set(v ? entries.map((e) => e.item.fileName) : []))} label="" />
          <span>{t('Proyecto')}</span>
          <span className="up-head-ver">{t('Versión actual → nueva')}</span>
          <span className="up-head-log">{t('Cambios')}</span>
        </div>
        <div className="up-body">
          {entries.map((e) => (
            <UpdateRow
              key={e.item.fileName}
              entry={e}
              instance={instance}
              kind={kind}
              world={world}
              checked={checked.has(e.item.fileName)}
              onCheck={(v) => toggle(e.item.fileName, v)}
              target={targets[e.item.fileName]}
              onTarget={(tg) => setTargets((m) => ({ ...m, [e.item.fileName]: tg }))}
              open={openLog === e.item.fileName}
              onToggleLog={() => setOpenLog((o) => (o === e.item.fileName ? '' : e.item.fileName))}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
