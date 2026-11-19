// Skins: animated 3D preview (cape / elytra, day / night / no background,
// pause, classic / slim arms) + skin library shared with Prism Launcher.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as skinview3d from 'skinview3d';
import { isQuiet } from '../lib/quiet.js';
import { mcIdle, mcWalk, mcSprint } from '../lib/mc-animations.js';
import Icon from '../components/Icon.jsx';
import { Button, IconButton, Spinner, ExpandingSearch } from '../components/ui.jsx';
import { Popover, MenuItem, MenuSeparator, MenuHeader, useMenu, useContextMenu } from '../components/Menu.jsx';
import { useApp } from '../lib/store.jsx';
import { call } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { defaultSkinUrl, defaultCapeUrl, detectSlim, readFileAsDataUrl, dataUrlToBytes } from '../lib/skin.js';
import { SkyScene } from '../lib/skyscene.js';
import AddAccountDialog from '../dialogs/AddAccountDialog.jsx';

// 2D front render of a skin texture (for the library cards)
const frontCache = new Map();
function renderFront(src, slim) {
  const key = `${src}|${slim}`;
  if (frontCache.has(key)) return Promise.resolve(frontCache.get(key));
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const legacy = img.height === 32;
      const aw = slim ? 3 : 4;
      const S = 10;
      const cv = document.createElement('canvas');
      cv.width = 16 * S;
      cv.height = 32 * S;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      const part = (sx, sy, w, h, dx, dy, flip = false) => {
        ctx.save();
        if (flip) {
          ctx.translate((dx + w) * S, dy * S);
          ctx.scale(-1, 1);
          ctx.drawImage(img, sx, sy, w, h, 0, 0, w * S, h * S);
        } else ctx.drawImage(img, sx, sy, w, h, dx * S, dy * S, w * S, h * S);
        ctx.restore();
      };
      const ax = 4 - aw;
      // base layer
      part(8, 8, 8, 8, 4, 0); // head
      part(20, 20, 8, 12, 4, 8); // body
      part(44, 20, aw, 12, ax, 8); // right arm (viewer's left)
      if (legacy) part(44, 20, aw, 12, 12, 8, true);
      else part(36, 52, aw, 12, 12, 8); // left arm
      part(4, 20, 4, 12, 4, 20); // right leg
      if (legacy) part(4, 20, 4, 12, 8, 20, true);
      else part(20, 52, 4, 12, 8, 20); // left leg
      // overlay layer
      part(40, 8, 8, 8, 4, 0);
      if (!legacy) {
        part(20, 36, 8, 12, 4, 8);
        part(44, 36, aw, 12, ax, 8);
        part(52, 52, aw, 12, 12, 8);
        part(4, 36, 4, 12, 4, 20);
        part(4, 52, 4, 12, 8, 20);
      }
      const url = cv.toDataURL('image/png');
      frontCache.set(key, url);
      resolve(url);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function SkinCard({ skin, selected, inUse, onSelect, onContext, label }) {
  const [front, setFront] = useState(null);
  useEffect(() => {
    let alive = true;
    renderFront(skin.url, skin.model === 'SLIM').then((f) => alive && setFront(f));
    return () => {
      alive = false;
    };
  }, [skin.url, skin.model]);
  return (
    <button className={`skin-card ${selected ? 'selected' : ''} ${inUse ? 'in-use' : ''}`} onClick={onSelect} onContextMenu={onContext} title={skin.name}>
      <div className="skin-card-img">
        {front ? <img src={front} alt="" /> : <Spinner size={18} />}
        {inUse ? <span className="skin-in-use">{t('En uso')}</span> : null}
      </div>
      <div className="skin-card-label">
        {selected ? <Icon name="check" size={16} /> : null}
        <span>{label || skin.name}</span>
      </div>
    </button>
  );
}

// Minecraft's default skins, from the game files on this computer (Havi Hub
// ships none of Mojang's pictures). Each comes with wide and slim arms.
const DEFAULT_SKINS = [
  ['steve', 'Steve', 'CLASSIC'],
  ['alex', 'Alex', 'SLIM'],
  ['ari', 'Ari', 'CLASSIC'],
  ['efe', 'Efe', 'CLASSIC'],
  ['kai', 'Kai', 'CLASSIC'],
  ['makena', 'Makena', 'CLASSIC'],
  ['noor', 'Noor', 'CLASSIC'],
  ['sunny', 'Sunny', 'CLASSIC'],
  ['zuri', 'Zuri', 'CLASSIC'],
];
const LEGACY_DEFAULTS = { steve: 'entity/steve', alex: 'entity/alex' }; // games before 1.19.3

async function loadDefaultSkins() {
  const names = DEFAULT_SKINS.flatMap(([id]) => [`entity/player/wide/${id}`, `entity/player/slim/${id}`]).concat(Object.values(LEGACY_DEFAULTS));
  const r = await call('mc.textures', names).catch(() => ({ textures: {} }));
  const tex = (r && r.textures) || {};
  return DEFAULT_SKINS.map(([id, name, model]) => {
    let wide = tex[`entity/player/wide/${id}`] || null;
    let slim = tex[`entity/player/slim/${id}`] || null;
    if (!wide && !slim && LEGACY_DEFAULTS[id]) (id === 'alex' ? (slim = tex[LEGACY_DEFAULTS[id]] || null) : (wide = tex[LEGACY_DEFAULTS[id]] || null));
    return { key: `default:${id}`, name, model, wide, slim, url: (model === 'SLIM' ? slim : wide) || wide || slim };
  }).filter((d) => d.url);
}

// the pixels of a picture, to tell whether two skins are the same
function pixelsOf(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = img.width;
      cv.height = img.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      resolve({ w: img.width, h: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
async function sameSkin(a, b) {
  const [x, y] = await Promise.all([pixelsOf(a), pixelsOf(b)]);
  if (!x || !y || x.w !== y.w || x.h !== y.h) return false;
  for (let i = 0; i < x.data.length; i += 4) {
    // fully transparent pixels count as equal whatever colour they keep
    if (x.data[i + 3] === 0 && y.data[i + 3] === 0) continue;
    if (x.data[i] !== y.data[i] || x.data[i + 1] !== y.data[i + 1] || x.data[i + 2] !== y.data[i + 2] || x.data[i + 3] !== y.data[i + 3]) return false;
  }
  return true;
}

function CapePreview({ src }) {
  // the cape front is at (1,1) 10x16 on the 64x32 texture
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!src) return setUrl(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = img.width / 64;
      const cv = document.createElement('canvas');
      cv.width = 20;
      cv.height = 32;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 1 * scale, 1 * scale, 10 * scale, 16 * scale, 0, 0, 20, 32);
      setUrl(cv.toDataURL());
    };
    img.src = src;
  }, [src]);
  return <span className="cape-thumb">{url ? <img src={url} alt="" /> : null}</span>;
}

export default function Skins() {
  const app = useApp();
  const { activeAccount, accounts } = app;
  const cfg = (app.config && app.config.skins) || {};
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const viewerRef = useRef(null);
  const skyRef = useRef(null);
  const [skins, setSkins] = useState(null);
  const [defaults, setDefaults] = useState(null);
  // the skin the account wears (a library skin's name or "default:<id>") and the one being looked at
  const [inUse, setInUse] = useState(null);
  const [selected, setSelected] = useState(null);
  const picked = useRef(false); // the user chose one: what the account wears no longer takes over
  const [model, setModel] = useState('CLASSIC');
  const [capeId, setCapeId] = useState('');
  const [elytra, setElytra] = useState(false);
  const [bg, setBg] = useState(cfg.background || 'night');
  const [paused, setPaused] = useState(Boolean(cfg.paused));
  const [anim, setAnim] = useState(cfg.animation || 'walk');
  const [capeTextures, setCapeTextures] = useState({});
  const [applying, setApplying] = useState(false);
  const [search, setSearch] = useState('');
  const [webglError, setWebglError] = useState('');
  const [fallbackFront, setFallbackFront] = useState(null);
  const capeMenu = useMenu();
  const bgMenu = useMenu();
  const animMenu = useMenu();
  const cardMenu = useContextMenu();
  const fileRef = useRef(null);

  const loadSkins = useCallback(() => {
    call('skins.list')
      .then(setSkins)
      .catch(() => setSkins([]));
  }, []);
  useEffect(loadSkins, [loadSkins, app.skinsVersion]);
  useEffect(() => {
    let alive = true;
    loadDefaultSkins().then((d) => alive && setDefaults(d));
    return () => {
      alive = false;
    };
  }, []);
  const choose = (key) => {
    picked.current = true;
    setSelected(key);
  };

  // account state -> what is shown at first
  useEffect(() => {
    if (!activeAccount) return;
    setCapeId(activeAccount.currentCape || '');
    setModel(activeAccount.skin.variant === 'SLIM' ? 'SLIM' : 'CLASSIC');
    picked.current = false;
  }, [activeAccount && activeAccount.id, activeAccount && activeAccount.skin.url]);

  // Which skin of the list the account wears. One of the game's own, or one
  // put on somewhere else (not in the list yet: then it is saved into it, so
  // every skin is kept in the one list).
  useEffect(() => {
    if (!activeAccount || !activeAccount.skin.data || skins === null || defaults === null) {
      if (!activeAccount) setInUse(null);
      return undefined;
    }
    let alive = true;
    (async () => {
      let key = await call('skins.current', activeAccount.id).catch(() => null);
      if (!key) {
        for (const d of defaults) {
          if ((d.wide && (await sameSkin(activeAccount.skin.data, d.wide))) || (d.slim && (await sameSkin(activeAccount.skin.data, d.slim)))) {
            key = d.key;
            break;
          }
        }
      }
      if (!key) key = await call('skins.current', activeAccount.id, { keep: true }).catch(() => null);
      if (!alive) return;
      setInUse(key);
      if (!picked.current) setSelected(key);
    })();
    return () => {
      alive = false;
    };
  }, [activeAccount && activeAccount.id, activeAccount && activeAccount.skin.url, skins === null, defaults === null]);

  // cape textures (from accounts.json data, or fetched through the main process)
  useEffect(() => {
    if (!activeAccount) return;
    let alive = true;
    (async () => {
      const out = {};
      for (const c of activeAccount.capes) {
        if (c.data) out[c.id] = c.data;
        else if (c.url) {
          try {
            out[c.id] = await call('app.fetchImage', c.url.replace('http://', 'https://'));
          } catch {
            /* offline */
          }
        }
      }
      if (alive) setCapeTextures(out);
    })();
    return () => {
      alive = false;
    };
  }, [activeAccount && activeAccount.id]);

  const shownKey = selected || inUse;
  const currentSkin = useMemo(() => {
    if (shownKey && shownKey.startsWith('default:')) {
      const d = (defaults || []).find((x) => x.key === shownKey);
      // a default skin is drawn with the arms chosen: each has a picture for both
      if (d) return { name: d.name, url: (model === 'SLIM' ? d.slim : d.wide) || d.url, model, isDefault: true };
    }
    const own = shownKey && (skins || []).find((x) => x.name === shownKey);
    if (own) return own;
    if (activeAccount && activeAccount.skin.data) return { name: activeAccount.name, url: activeAccount.skin.data, model: activeAccount.skin.variant, isAccount: true };
    const steve = (defaults || [])[0];
    if (steve) return { name: steve.name, url: steve.url, model: steve.model, isDefault: true };
    return { name: t('Skin por defecto'), url: defaultSkinUrl(), model: 'CLASSIC' };
  }, [shownKey, skins, defaults, model, activeAccount]);

  // create viewer once (WebGL can be unavailable on very old drivers)
  useEffect(() => {
    let viewer;
    try {
      viewer = new skinview3d.SkinViewer({ canvas: canvasRef.current, width: 400, height: 600, zoom: 0.66, fov: 50 });
    } catch (e) {
      setWebglError(String((e && e.message) || e));
      return undefined;
    }
    viewer.controls.enablePan = false;
    viewer.playerWrapper.rotation.y = 0.45;
    viewerRef.current = viewer;
    skyRef.current = new SkyScene(viewer);
    // no drawing while nobody is looking (window hidden, or Havi Hub not the window in use)
    const onQuiet = () => {
      viewer.renderPaused = isQuiet();
    };
    window.addEventListener('havihub:quiet', onQuiet);
    document.addEventListener('visibilitychange', onQuiet);
    onQuiet();
    const ro = new ResizeObserver(() => {
      const el = wrapRef.current;
      if (el) viewer.setSize(el.clientWidth, el.clientHeight);
    });
    ro.observe(wrapRef.current);
    return () => {
      ro.disconnect();
      skyRef.current.dispose();
      window.removeEventListener('havihub:quiet', onQuiet);
      document.removeEventListener('visibilitychange', onQuiet);
      viewer.dispose();
      // the graphics memory of the 3D view goes back now, not whenever the page gets tidied up
      viewer.renderer.forceContextLoss();
    };
  }, []);

  // skin + model
  useEffect(() => {
    const v = viewerRef.current;
    if (!currentSkin) return;
    if (!v) {
      renderFront(currentSkin.url, model === 'SLIM').then(setFallbackFront);
      return;
    }
    v.loadSkin(currentSkin.url, { model: model === 'SLIM' ? 'slim' : 'default' });
  }, [currentSkin && currentSkin.url, model, webglError]);

  // when choosing a skin: the arms and cape it was saved with (the ones worn, for the skin in use)
  useEffect(() => {
    if (!selected) return;
    if (selected === inUse && activeAccount) {
      setModel(activeAccount.skin.variant === 'SLIM' ? 'SLIM' : 'CLASSIC');
      setCapeId(activeAccount.currentCape || '');
      return;
    }
    if (selected.startsWith('default:')) {
      const d = (defaults || []).find((x) => x.key === selected);
      if (d) setModel(d.model);
      return;
    }
    const own = (skins || []).find((x) => x.name === selected);
    if (!own) return;
    setModel(own.model === 'SLIM' ? 'SLIM' : 'CLASSIC');
    if (own.capeId !== undefined && own.capeId !== null && activeAccount && activeAccount.capes.some((c) => c.id === own.capeId)) setCapeId(own.capeId);
  }, [selected]);

  // cape / elytra
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    const tex = capeId ? capeTextures[capeId] : null;
    if (tex) v.loadCape(tex, { backEquipment: elytra ? 'elytra' : 'cape' });
    else if (elytra) v.loadCape(defaultCapeUrl(), { backEquipment: 'elytra' });
    else v.loadCape(null);
  }, [capeId, elytra, capeTextures]);

  // background
  useEffect(() => {
    const surface = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#101010';
    if (skyRef.current) skyRef.current.setMode(bg, surface);
  }, [bg, app.config && app.config.themePreset, app.config && JSON.stringify(app.config.palette)]);

  // animation
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    // idle, walking and sprinting move as in the game; the rest come with the viewer
    const A = { walk: mcWalk, run: mcSprint, idle: mcIdle, fly: () => new skinview3d.FlyingAnimation(), wave: () => new skinview3d.WaveAnimation(), crouch: () => new skinview3d.CrouchAnimation() }[anim] || mcWalk;
    const a = A();
    a.paused = paused;
    if (skyRef.current) skyRef.current.setMotion(anim);
    v.animation = a;
  }, [anim]);

  useEffect(() => {
    const v = viewerRef.current;
    if (v && v.animation) v.animation.paused = paused;
    if (skyRef.current) skyRef.current.paused = paused;
  }, [paused]);

  // remember viewer preferences
  useEffect(() => {
    if (!app.config) return;
    const s = app.config.skins || {};
    if (s.background !== bg || s.paused !== paused || s.animation !== anim) app.updateConfig({ skins: { background: bg, paused, animation: anim } }).catch(() => {});
  }, [bg, paused, anim]);

  const original = useMemo(() => {
    if (!activeAccount) return null;
    return { model: activeAccount.skin.variant === 'SLIM' ? 'SLIM' : 'CLASSIC', capeId: activeAccount.currentCape || '' };
  }, [activeAccount]);
  const dirty = Boolean(original) && ((selected && selected !== inUse) || model !== original.model || capeId !== original.capeId);

  const reset = () => {
    picked.current = false;
    setSelected(inUse);
    if (original) {
      setModel(original.model);
      setCapeId(original.capeId);
    }
    setElytra(false);
    if (viewerRef.current) viewerRef.current.resetCameraPose();
  };

  const apply = async () => {
    if (!activeAccount) return;
    setApplying(true);
    try {
      if ((!selected || selected === inUse) && original && model === original.model) {
        await call('accounts.setCape', activeAccount.id, capeId || null);
      } else {
        const opts = { model: model === 'SLIM' ? 'slim' : 'classic', capeId };
        if (currentSkin.isDefault || currentSkin.isAccount) opts.png = dataUrlToBytes(currentSkin.url);
        else opts.name = currentSkin.name;
        await call('skins.apply', activeAccount.id, opts);
      }
      picked.current = false;
      await app.refreshAccounts();
      app.toast(t('¡Skin aplicada! Se verá en el juego la próxima vez que entres.'), { type: 'success' });
    } catch (e) {
      if (e.code === 'TOKEN_EXPIRED') {
        app.toast(e.message, { type: 'warning', duration: 9000, action: { label: t('Renovar sesión'), onClick: () => app.openDialog(AddAccountDialog, {}) } });
      } else app.showError(e);
    } finally {
      setApplying(false);
    }
  };

  const upload = async (file) => {
    if (!file) return;
    try {
      const url = await readFileAsDataUrl(file);
      const slim = await detectSlim(url);
      const name = await call('skins.add', dataUrlToBytes(url), { name: file.name.replace(/\.png$/i, ''), model: slim ? 'SLIM' : 'CLASSIC' });
      loadSkins();
      choose(name);
    } catch (e) {
      app.showError(e);
    }
  };

  const importPlayer = async () => {
    const name = await app.prompt({ title: t('Copiar skin de un jugador'), label: t('Nombre de usuario de Minecraft'), maxLength: 16, placeholder: 'Notch', confirmLabel: t('Copiar skin') });
    if (!name) return;
    try {
      const n = await call('skins.importPlayer', name);
      loadSkins();
      choose(n);
    } catch (e) {
      app.showError(e);
    }
  };

  const capes = activeAccount ? activeAccount.capes : [];
  const capeName = capeId ? (capes.find((c) => c.id === capeId) || {}).alias || t('Capa') : t('Sin capa');
  const matches = (name) => !search || name.toLowerCase().includes(search.toLowerCase());
  const visibleSkins = (skins || []).filter((s) => matches(s.name));
  const visibleDefaults = (defaults || []).filter((d) => matches(d.name));
  const ANIMS = [
    ['walk', t('Caminar')],
    ['run', t('Correr')],
    ['idle', t('Quieto')],
    ['wave', t('Saludar')],
    ['crouch', t('Agacharse')],
    ['fly', t('Volar')],
  ];

  return (
    <div className="page skins-page">
      <div className="skin-viewer-panel">
        <div className="skin-hint">
          <Icon name="drag" size={16} /> {t('Arrastra para rotar')}
          <span className="hint-sep" />
          <Icon name="sort" size={16} /> {t('Rueda para hacer zoom')}
        </div>
        <div className="skin-canvas-wrap" ref={wrapRef}>
          <canvas ref={canvasRef} style={webglError ? { display: 'none' } : undefined} />
          {webglError ? (
            <div className="skin-fallback">
              {fallbackFront ? <img src={fallbackFront} alt="" /> : null}
              <p className="muted small">{t('Tu tarjeta gráfica no permitió abrir la vista 3D (WebGL). Se muestra una vista 2D; actualizar los drivers de video suele arreglarlo.')}</p>
            </div>
          ) : null}
        </div>
        <div className="skin-toolbar">
          <button ref={capeMenu.anchor} className={`skin-tool wide ${capeMenu.open ? 'active' : ''}`} onClick={capeMenu.toggle} title={t('Capas')} disabled={!activeAccount}>
            <Icon name="cape" size={20} />
            <span>{t('Capas')}</span>
          </button>
          <button className={`skin-tool ${elytra ? 'active' : ''}`} onClick={() => setElytra((e) => !e)} title={elytra ? t('Mostrar capa') : t('Mostrar con élitros')}>
            <Icon name="wings" size={20} />
          </button>
          <button ref={bgMenu.anchor} className={`skin-tool ${bgMenu.open ? 'active' : ''}`} onClick={bgMenu.toggle} title={t('Fondo')}>
            <Icon name={bg === 'day' ? 'sun' : bg === 'night' ? 'sparkle' : 'noBg'} size={20} />
          </button>
          <button className={`skin-tool ${paused ? 'active' : ''}`} onClick={() => setPaused((p) => !p)} title={paused ? t('Reanudar animación') : t('Pausar animación')}>
            <Icon name={paused ? 'play' : 'pause'} size={paused ? 18 : 20} />
          </button>
          <button className={`skin-tool ${model === 'SLIM' ? 'active' : ''}`} onClick={() => setModel((m) => (m === 'SLIM' ? 'CLASSIC' : 'SLIM'))} title={model === 'SLIM' ? t('Brazos delgados (Slim) — cambiar a clásicos') : t('Brazos clásicos — cambiar a delgados (Slim)')}>
            <Icon name="arms" size={20} />
          </button>
          <button ref={animMenu.anchor} className={`skin-tool ${animMenu.open ? 'active' : ''}`} onClick={animMenu.toggle} title={t('Animación')}>
            <Icon name="user" size={20} />
          </button>
          <span className="skin-model-label">{model === 'SLIM' ? 'Slim' : t('Clásico')}</span>
        </div>
        <div className="skin-bottom">
          <span className="skin-current-name" title={currentSkin ? currentSkin.name : ''}>
            {currentSkin ? currentSkin.name : ''}
          </span>
          <IconButton icon="refresh" title={t('Restablecer')} onClick={reset} />
          <Button variant="primary" disabled={!dirty || !activeAccount} loading={applying} onClick={apply}>
            {t('Aplicar')}
          </Button>
        </div>
        <Popover anchor={capeMenu.anchor} open={capeMenu.open} onClose={capeMenu.close} className="menu cape-menu" maxHeight={380}>
          <MenuItem icon="minus" label={t('Sin capa')} checked={!capeId} onClick={() => (capeMenu.close(), setCapeId(''))} />
          {capes.map((c) => (
            <MenuItem key={c.id} icon={null} label={<span className="cape-row"><CapePreview src={capeTextures[c.id]} />{c.alias}</span>} checked={capeId === c.id} onClick={() => (capeMenu.close(), setCapeId(c.id))} />
          ))}
          {!capes.length ? <div className="menu-header">{t('Esta cuenta no tiene capas')}</div> : null}
        </Popover>
        <Popover anchor={bgMenu.anchor} open={bgMenu.open} onClose={bgMenu.close} className="menu">
          <MenuItem icon="noBg" label={t('Sin fondo')} checked={bg === 'none'} onClick={() => (bgMenu.close(), setBg('none'))} />
          <MenuItem icon="sun" label={t('Cielo de día')} checked={bg === 'day'} onClick={() => (bgMenu.close(), setBg('day'))} />
          <MenuItem icon="sparkle" label={t('Cielo de noche')} checked={bg === 'night'} onClick={() => (bgMenu.close(), setBg('night'))} />
        </Popover>
        <Popover anchor={animMenu.anchor} open={animMenu.open} onClose={animMenu.close} className="menu">
          <MenuHeader>{t('Animación')}</MenuHeader>
          {ANIMS.map(([id, label]) => (
            <MenuItem key={id} label={label} checked={anim === id} onClick={() => (animMenu.close(), setAnim(id))} />
          ))}
        </Popover>
      </div>

      <div className="skin-library">
        <div className="skin-lib-head">
          <h2>{t('Mis skins')}</h2>
          <span className="spacer" />
          <ExpandingSearch value={search} onChange={setSearch} placeholder={t('Buscar skins…')} size={22} />
        </div>
        {!activeAccount ? (
          <div className="banner warn">
            <Icon name="user" size={20} />
            <span>{t('No hay una cuenta de Microsoft en Havi Hub. Puedes ver y guardar skins, pero para aplicarlas necesitas iniciar sesión.')}</span>
            <Button size="sm" variant="secondary" onClick={() => app.openDialog(AddAccountDialog, {})}>
              {t('Iniciar sesión')}
            </Button>
          </div>
        ) : activeAccount && !activeAccount.tokenValid ? (
          <div className="banner info">
            <Icon name="info" size={20} />
            <span>{t('La sesión de {name} expiró. Para aplicar cambios juega una vez o renueva la sesión.', { name: activeAccount.name })}</span>
            <Button size="sm" variant="secondary" onClick={() => app.openDialog(AddAccountDialog, {})}>
              {t('Renovar sesión')}
            </Button>
          </div>
        ) : null}
        <div className="skin-grid">
          <button className="skin-card upload" onClick={() => fileRef.current.click()}>
            <span className="upload-circle">
              <Icon name="upload" size={26} />
            </span>
            <span>{t('Subir skin')}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/png" className="hidden-input" onChange={(e) => (upload(e.target.files[0]), (e.target.value = ''))} />
          <button className="skin-card upload" onClick={importPlayer}>
            <span className="upload-circle">
              <Icon name="users" size={26} />
            </span>
            <span>{t('Copiar de un jugador')}</span>
          </button>
          {skins === null ? <Spinner /> : null}
          {visibleSkins.map((s) => (
            <SkinCard key={s.name} skin={s} selected={shownKey === s.name} inUse={inUse === s.name} onSelect={() => choose(s.name)} onContext={(e) => cardMenu.show(e, s)} />
          ))}
          {visibleDefaults.length ? <h3 className="skin-grid-head">{t('Skins por defecto')}</h3> : null}
          {visibleDefaults.map((d) => (
            <SkinCard key={d.key} skin={d} selected={shownKey === d.key} inUse={inUse === d.key} onSelect={() => choose(d.key)} />
          ))}
        </div>
        <p className="muted small skins-note">{t('Las skins se guardan en la carpeta de skins de Havi Hub.')}</p>
      </div>
      {cardMenu.data ? (
        <Popover point={cardMenu.point} open={cardMenu.open} onClose={cardMenu.close} className="menu">
          <MenuItem
            icon="edit"
            label={t('Renombrar')}
            onClick={async () => {
              const s = cardMenu.data;
              cardMenu.close();
              const n = await app.prompt({ title: t('Renombrar skin'), value: s.name, maxLength: 48, confirmLabel: t('Renombrar') });
              if (n && n !== s.name) {
                await call('skins.update', s.name, { newName: n }).catch(app.showError);
                loadSkins();
                if (selected === s.name) setSelected(n);
                if (inUse === s.name) setInUse(n);
              }
            }}
          />
          <MenuItem
            icon="arms"
            label={cardMenu.data.model === 'SLIM' ? t('Usar brazos clásicos') : t('Usar brazos delgados (Slim)')}
            onClick={async () => {
              const s = cardMenu.data;
              cardMenu.close();
              await call('skins.update', s.name, { model: s.model === 'SLIM' ? 'CLASSIC' : 'SLIM' }).catch(app.showError);
              loadSkins();
            }}
          />
          <MenuItem icon="folder" label={t('Mostrar en la carpeta')} onClick={() => (cardMenu.close(), call('app.showItem', cardMenu.data.file))} />
          {cardMenu.data.name !== inUse ? <MenuSeparator /> : null}
          {cardMenu.data.name !== inUse ? (
          <MenuItem
            icon="trash"
            danger
            label={t('Eliminar')}
            onClick={async () => {
              const s = cardMenu.data;
              cardMenu.close();
              const ok = await app.confirm({ title: t('Eliminar skin'), message: s.name, confirmLabel: t('Eliminar'), danger: true });
              if (ok) {
                await call('skins.remove', s.name).catch(app.showError);
                if (selected === s.name) setSelected(null);
                loadSkins();
              }
            }}
          />
          ) : null}
        </Popover>
      ) : null}
    </div>
  );
}
