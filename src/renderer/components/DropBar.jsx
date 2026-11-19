// While a profile is being dragged: a bar at the bottom with every place it
// can go (out of its group, or into another group).
import Icon from './Icon.jsx';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { useInstanceDrag, useDropTarget } from '../lib/instanceDrag.js';

function Target({ label, icon, onDrop, hint }) {
  const [props, over] = useDropTarget(onDrop);
  return (
    <div className={`dropbar-target ${over ? 'over' : ''}`} {...props} title={hint}>
      <Icon name={icon} size={20} />
      <span>{label}</span>
    </div>
  );
}

// rootLabel: the place without a group ("Mis modpacks" in the CurseForge layout)
export default function DropBar({ rootLabel }) {
  const app = useApp();
  const drag = useInstanceDrag();
  if (!drag) return null;
  const move = async (id, group) => {
    try {
      await call('instances.setGroup', id, group);
      app.toast(group ? t('{name} ahora está en {group}', { name: drag.name, group }) : t('{name} salió del grupo {group}', { name: drag.name, group: drag.group }), { type: 'success' });
    } catch (e) {
      app.showError(e);
    }
  };
  const others = app.groups.filter((g) => g !== drag.group);
  return (
    <div className="dropbar" role="region" aria-label={t('Mover perfil')}>
      <span className="dropbar-label">{t('Suelta para mover')}</span>
      {drag.group ? <Target label={rootLabel || t('Mis modpacks (sin grupo)')} icon="home" hint={t('Sacarlo del grupo {group}', { group: drag.group })} onDrop={(id) => move(id, '')} /> : null}
      {others.map((g) => (
        <Target key={g} label={g} icon="groupGrid" onDrop={(id) => move(id, g)} />
      ))}
      {!drag.group && !others.length ? <span className="muted">{t('Crea un grupo para ordenar tus perfiles')}</span> : null}
    </div>
  );
}
