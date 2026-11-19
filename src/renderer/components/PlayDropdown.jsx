// Worlds and servers to start straight into (the arrow next to "Play").
import Icon from './Icon.jsx';
import { MenuHeader } from './Menu.jsx';
import { useApp } from '../lib/store.jsx';
import { t } from '../lib/i18n.js';
import { formatDate, maskIp } from '../lib/format.js';
import { MODE_LABEL } from '../pages/instance/WorldsTab.jsx';

export default function PlayDropdown({ instance, worlds, servers, onClose }) {
  const app = useApp();
  const mask = !app.config || !app.config.privacy || app.config.privacy.maskServerIps !== false;
  return (
    <div className="play-menu">
      <MenuHeader>{t('Un jugador')}</MenuHeader>
      {worlds && worlds.length ? (
        worlds.slice(0, 8).map((w) => (
          <button key={w.folder} className="play-row" onClick={() => (onClose(), app.launch(instance.id, { world: w.folder }))}>
            {w.icon ? <img loading="lazy" decoding="async" className="world-thumb" src={w.icon} alt="" /> : <span className="play-row-icon world-thumb"><Icon name="globe" size={22} /></span>}
            <span className="play-row-main">
              <strong>{w.levelName}</strong>
              <small>{w.hardcore ? t('Extremo') : MODE_LABEL()[w.gameMode] || w.gameMode}</small>
            </span>
            <span className="play-row-date">{formatDate(w.lastPlayed)}</span>
          </button>
        ))
      ) : (
        <div className="play-empty">{t('Sin mundos todavía')}</div>
      )}
      <MenuHeader>{t('Multijugador')}</MenuHeader>
      {servers && servers.length ? (
        servers.slice(0, 8).map((s) => (
          <button key={s.index} className="play-row" onClick={() => (onClose(), app.launch(instance.id, { server: s.ip }))}>
            {s.icon ? <img loading="lazy" decoding="async" src={s.icon} alt="" /> : <span className="play-row-icon"><Icon name="server" size={24} /></span>}
            <span className="play-row-main">
              <strong>{s.name}</strong>
              <small>{mask ? maskIp(s.ip) : s.ip}</small>
            </span>
          </button>
        ))
      ) : (
        <div className="play-empty">{t('Sin servidores guardados')}</div>
      )}
    </div>
  );
}
