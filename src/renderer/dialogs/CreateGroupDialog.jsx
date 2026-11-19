// Create a group of "My modpacks" with its name and, optionally, its picture
// (an icon made in the editor or a picture of the user's). The picture can
// still be changed later from the group's menu.
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal.jsx';
import { Button, Input } from '../components/ui.jsx';
import { GeneratedIcon } from '../components/InstanceImage.jsx';
import Icon from '../components/Icon.jsx';
import ImageDialog from './ImageDialog.jsx';
import IconEditorDialog from './IconEditorDialog.jsx';
import { defaultRecipe, recipeKey, iconPng } from '../lib/instance-icons.js';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { useApp } from '../lib/store.jsx';
import { LIMITS } from '../../shared/limits.js';

export default function CreateGroupDialog({ onResolve, groups = [] }) {
  const app = useApp();
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [recipe, setRecipe] = useState(null); // icon made in the editor
  const [image, setImage] = useState(null); // { png, url }: a picture of the user's
  const shown = useMemo(() => recipe || defaultRecipe(name.trim() || 'group'), [recipe, name]);
  useEffect(() => () => image && URL.revokeObjectURL(image.url), [image]);

  const pickImage = async () => {
    const r = await app.openDialog(IconEditorDialog, { current: shown, allowUpload: true });
    if (r && r.upload) {
      const p = await app.openDialog(ImageDialog, { current: image ? image.url : null, allowReset: false });
      if (p && p.png) setImage({ png: p.png, url: URL.createObjectURL(new Blob([p.png])) });
    } else if (r && r.recipe) {
      setRecipe(r.recipe);
      setImage(null);
    }
  };

  const create = async () => {
    const n = name.trim();
    if (!n) return;
    if (groups.includes(n)) return setErr(t('Ya existe un grupo con ese nombre'));
    setBusy(true);
    try {
      await call('instances.createGroup', n);
      if (image) await call('instances.setGroupImage', n, image.png);
      else if (recipe) await call('instances.setGroupImage', n, await iconPng(recipe), { recipe: recipeKey(recipe) });
      await app.refreshInstances();
      onResolve(n);
    } catch (e) {
      setBusy(false);
      app.showError(e);
    }
  };

  return (
    <Modal
      title={t('Crear grupo')}
      icon="groupAdd"
      onClose={() => onResolve(null)}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={() => onResolve(null)}>
            {t('Cancelar')}
          </Button>
          <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={create}>
            {t('Crear')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="group-pic">
          <span className="label">{t('Imagen')}</span>
          <button className="group-pic-preview" onClick={pickImage} aria-label={t('Cambiar imagen')} title={t('Cambiar imagen')}>
            {image ? <img src={image.url} alt="" /> : <GeneratedIcon recipe={shown} />}
            <span className="group-pic-overlay" aria-hidden="true">
              <Icon name="edit" size={22} />
            </span>
            <span className="group-pic-badge" aria-hidden="true">
              <Icon name="image" size={14} />
            </span>
          </button>
          {image || recipe ? (
            <button
              className="link-btn group-pic-reset"
              onClick={() => {
                setImage(null);
                setRecipe(null);
              }}
            >
              {t('Restablecer')}
            </button>
          ) : null}
        </div>
        <label className="label">{t('Nombre del grupo')}</label>
        <Input
          value={name}
          maxLength={LIMITS.groupName}
          counter
          autoFocus
          placeholder="Vanilla, Horror, Técnicos…"
          onChange={(e) => {
            setName(e.target.value);
            setErr('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && !busy && create()}
        />
        {err ? <div className="form-error">{err}</div> : null}
      </div>
    </Modal>
  );
}
