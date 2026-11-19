// Create a new Prism instance: name, image, group, Minecraft version and loader.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../components/Modal.jsx';
import { Button, Input, Select, Pills, Spinner, SearchInput } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { GeneratedIcon, LoaderIcon } from '../components/InstanceImage.jsx';
import ImageDialog from './ImageDialog.jsx';
import IconEditorDialog from './IconEditorDialog.jsx';
import { randomRecipe, recipeKey, iconPng } from '../lib/instance-icons.js';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { useApp } from '../lib/store.jsx';
import { LIMITS } from '../../shared/limits.js';

const LOADERS = [
  { id: 'vanilla', label: 'Vanilla' },
  { id: 'fabric', label: 'Fabric' },
  { id: 'quilt', label: 'Quilt' },
  { id: 'forge', label: 'Forge' },
  { id: 'neoforge', label: 'NeoForge' },
];

// preset: { mc, loader } to start with (e.g. a profile that can use a mod)
export default function CreateInstanceDialog({ onResolve, defaultGroup = '', preset = null }) {
  const app = useApp();
  const [name, setName] = useState('');
  const [group, setGroup] = useState(defaultGroup);
  const [newGroup, setNewGroup] = useState('');
  const [recipe, setRecipe] = useState(() => randomRecipe()); // generated icon
  const [image, setImage] = useState(null); // { png, url }: a picture of the user's, used instead
  const [versions, setVersions] = useState(null);
  const [verErr, setVerErr] = useState('');
  const [vfilter, setVfilter] = useState('release');
  const [vsearch, setVsearch] = useState('');
  const [mc, setMc] = useState('');
  const [loader, setLoader] = useState('vanilla');
  const [available, setAvailable] = useState(['vanilla']);
  const [loaderVersions, setLoaderVersions] = useState([]);
  const [loaderVersion, setLoaderVersion] = useState('');
  const [loadingLoader, setLoadingLoader] = useState(false);
  const [busy, setBusy] = useState(false);
  const wantedLoader = useRef(preset && preset.loader && preset.loader !== 'vanilla' ? preset.loader : null);

  useEffect(() => {
    call('meta.minecraft')
      .then((v) => {
        setVersions(v);
        const firstRelease = v.find((x) => x.type === 'release');
        if (preset && preset.mc && v.some((x) => x.version === preset.mc)) setMc(preset.mc);
        else if (firstRelease) setMc(firstRelease.version);
      })
      .catch((e) => setVerErr(e.message));
  }, []);

  useEffect(() => {
    if (!mc) return;
    let alive = true;
    call('meta.loadersFor', mc)
      .then((l) => alive && setAvailable(['vanilla', ...l]))
      .catch(() => alive && setAvailable(['vanilla']));
    return () => {
      alive = false;
    };
  }, [mc]);

  useEffect(() => {
    if (!mc || loader === 'vanilla') {
      setLoaderVersions([]);
      setLoaderVersion('');
      return;
    }
    let alive = true;
    setLoadingLoader(true);
    call('meta.loaderVersions', loader, mc)
      .then((list) => {
        if (!alive) return;
        setLoaderVersions(list);
        const rec = list.find((x) => x.recommended) || list.find((x) => x.type === 'release') || list[0];
        setLoaderVersion(rec ? rec.version : '');
      })
      .catch(() => alive && setLoaderVersions([]))
      .finally(() => alive && setLoadingLoader(false));
    return () => {
      alive = false;
    };
  }, [mc, loader]);

  useEffect(() => {
    // the loader asked for, once the version's loaders are known
    if (wantedLoader.current && available.includes(wantedLoader.current)) {
      setLoader(wantedLoader.current);
      wantedLoader.current = null;
      return;
    }
    if (!available.includes(loader)) setLoader('vanilla');
  }, [available, loader]);

  const shownVersions = useMemo(() => {
    if (!versions) return [];
    return versions.filter((v) => (vfilter === 'all' ? true : vfilter === 'release' ? v.type === 'release' : v.type !== 'release')).filter((v) => !vsearch || v.version.includes(vsearch));
  }, [versions, vfilter, vsearch]);

  const finalName = name.trim() || (mc ? `${loader === 'vanilla' ? '' : LOADERS.find((l) => l.id === loader).label + ' '}${mc}` : '');
  const groupOptions = [{ value: '', label: t('Sin grupo') }, ...app.groups.map((g) => ({ value: g, label: g })), { value: '__new', label: t('+ Nuevo grupo…') }];

  const create = async () => {
    setBusy(true);
    try {
      const g = group === '__new' ? newGroup.trim() : group;
      const imagePng = image ? image.png : await iconPng(recipe);
      const id = await call('instances.create', { name: finalName, group: g, mcVersion: mc, loader, loaderVersion: loader === 'vanilla' ? undefined : loaderVersion, imagePng, iconRecipe: image ? undefined : recipeKey(recipe) });
      app.toast(t('Instancia creada: {name}', { name: finalName }), { type: 'success' });
      onResolve(id);
    } catch (e) {
      app.showError(e);
      setBusy(false);
    }
  };

  const editIcon = async () => {
    const r = await app.openDialog(IconEditorDialog, { current: recipe, allowUpload: true });
    if (r && r.upload) return uploadImage();
    if (r && r.recipe) {
      setRecipe(r.recipe);
      setImage(null);
    }
  };
  const uploadImage = async () => {
    const r = await app.openDialog(ImageDialog, { current: image ? image.url : null, allowReset: false });
    if (r && r.png) setImage({ png: r.png, url: URL.createObjectURL(new Blob([r.png])) });
  };

  return (
    <Modal
      title={t('Crear instancia')}
      icon="plus"
      onClose={() => onResolve(null)}
      width={860}
      footer={
        <>
          <Button variant="ghost" onClick={() => onResolve(null)}>
            {t('Cancelar')}
          </Button>
          <Button variant="primary" loading={busy} disabled={!mc || (loader !== 'vanilla' && !loaderVersion) || (group === '__new' && !newGroup.trim())} onClick={create}>
            {t('Crear')}
          </Button>
        </>
      }
    >
      <div className="create-grid">
        <div className="create-left">
          <span className="label">{t('Ícono')}</span>
          <div className="create-icon">
            <button className="create-icon-preview" onClick={editIcon} aria-label={t('Cambiar ícono')}>
              {image ? <img src={image.url} alt="" /> : <GeneratedIcon recipe={recipe} />}
            </button>
            <div className="create-icon-actions">
              <Button size="sm" icon="image" onClick={editIcon}>
                {t('Cambiar ícono')}
              </Button>
              {image ? (
                <button className="link-btn create-icon-reset" onClick={() => setImage(null)}>
                  {t('Quitar imagen')}
                </button>
              ) : (
                <span className="create-icon-note">{t('Puedes subir tu propia imagen en su resolución original.')}</span>
              )}
            </div>
          </div>
          <label className="label">{t('Nombre')}</label>
          <Input value={name} maxLength={LIMITS.instanceName} counter placeholder={finalName || t('Mi instancia')} onChange={(e) => setName(e.target.value)} />
          <label className="label">{t('Grupo')}</label>
          <Select value={group} options={groupOptions} onChange={setGroup} />
          {group === '__new' ? <Input value={newGroup} autoFocus placeholder={t('Nombre del grupo')} onChange={(e) => setNewGroup(e.target.value)} /> : null}
        </div>
        <div className="create-right">
          <div className="row">
            <span className="label">{t('Versión de Minecraft')}</span>
            <span className="spacer" />
            <Pills
              value={vfilter}
              onChange={setVfilter}
              options={[
                { value: 'release', label: t('Estables') },
                { value: 'snapshot', label: t('Snapshots') },
                { value: 'all', label: t('Todas') },
              ]}
            />
          </div>
          <SearchInput value={vsearch} onChange={setVsearch} placeholder={t('Buscar versión…')} />
          <div className="version-list">
            {!versions && !verErr ? (
              <div className="center-spinner">
                <Spinner />
              </div>
            ) : null}
            {verErr ? <div className="form-error">{t('No se pudo cargar la lista de versiones: {e}', { e: verErr })}</div> : null}
            {shownVersions.map((v) => (
              <button key={v.version} className={`version-row ${v.version === mc ? 'active' : ''}`} onClick={() => setMc(v.version)}>
                <span className="version-name">{v.version}</span>
                <span className="version-type">{v.type === 'release' ? t('Estable') : v.type}</span>
                <span className="version-date">{v.releaseTime ? new Date(v.releaseTime).toLocaleDateString() : ''}</span>
              </button>
            ))}
          </div>
          <span className="label">{t('Cargador de mods')}</span>
          <div className="loader-picker">
            {LOADERS.map((l) => (
              <button key={l.id} className={`loader-opt ${loader === l.id ? 'active' : ''}`} disabled={!available.includes(l.id)} onClick={() => setLoader(l.id)} title={!available.includes(l.id) ? t('No disponible para {v}', { v: mc }) : ''}>
                <LoaderIcon loader={l.id} size={22} />
                {l.label}
              </button>
            ))}
          </div>
          {loader !== 'vanilla' ? (
            <div className="row">
              <span className="label">{t('Versión del cargador')}</span>
              <span className="spacer" />
              {loadingLoader ? <Spinner size={18} /> : null}
              <Select
                value={loaderVersion}
                className="loader-version-select"
                onChange={setLoaderVersion}
                options={loaderVersions.slice(0, 200).map((v) => ({ value: v.version, label: v.version, hint: v.recommended ? t('Recomendada') : v.type !== 'release' ? v.type : undefined }))}
              />
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
