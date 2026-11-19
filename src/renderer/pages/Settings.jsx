// Settings, laid out like the reference: General (Launcher, Addons, Languages,
// Themes, Privacy, Advanced) and Game Specific (Minecraft, Java, Accounts),
// plus the Prism Launcher options that the reference app doesn't have.
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Button, Toggle, Slider, Select, Input, TextArea, Field, ColorInput, Pills, Spinner, Progress } from '../components/ui.jsx';
import ImportLaunchersDialog from '../dialogs/ImportLaunchersDialog.jsx';
import SyncProfilesDialog from '../dialogs/SyncProfilesDialog.jsx';
import AddAccountDialog from '../dialogs/AddAccountDialog.jsx';
import { Modal } from '../components/Modal.jsx';
import { timeAgo } from '../lib/format.js';
import { useApp } from '../lib/store.jsx';
import { call, platform } from '../lib/api.js';
import { t, LANGUAGES, getLanguage } from '../lib/i18n.js';
import EnvVarsEditor from '../components/EnvVarsEditor.jsx';
import MemoryFields from '../components/MemoryFields.jsx';
import LibraryPath from '../components/LibraryPath.jsx';
import { BINDS, CATEGORIES } from '../lib/mckeys.js';
import { keyFromEvent, keyFromMouse, keyLabel, UNBOUND } from '../lib/keys.js';
import { PRESETS, PRESET_ORDER, TOKENS, resolvePalette } from '../lib/theme.js';
import { AccountAvatar, OfflineAccountButton } from '../components/Shell.jsx';
import { Pixels, SEASON_ART, playFireworks, triggerScare, SeasonIcon } from '../components/Seasonal.jsx';
import { beginCapture, endCapture } from '../lib/inputCapture.js';
import { LayoutChoice } from '../components/LayoutPicker.jsx';

const truthy = (v) => v === true || v === 'true';

const NAV = [
  { group: () => t('General') },
  { id: 'launcher', icon: 'settings', label: () => t('Launcher') },
  { id: 'addons', icon: 'puzzle', label: () => t('Addons') },
  { id: 'languages', icon: 'language', label: () => t('Idiomas') },
  { id: 'themes', icon: 'palette', label: () => t('Temas') },
  { id: 'privacy', icon: 'shield', label: () => t('Privacidad') },
  { id: 'advanced', icon: 'sliders', label: () => t('Avanzado') },
  { group: () => t('Específico del juego') },
  { id: 'minecraft', icon: 'cube', label: () => 'Minecraft' },
  { id: 'java', icon: 'java', label: () => t('Java y memoria') },
  { id: 'accounts', icon: 'users', label: () => t('Cuentas') },
];

const TOKEN_LABEL = () => ({
  accent: t('Color de acento'),
  accentText: t('Texto sobre el acento'),
  bg: t('Fondo principal'),
  titlebar: t('Barra de título'),
  sidebar: t('Barra lateral'),
  sidebarActive: t('Juego seleccionado (barra lateral)'),
  surface: t('Tarjetas y paneles'),
  surface2: t('Menús, campos y encabezados'),
  surface3: t('Hover / elementos activos'),
  border: t('Bordes y separadores'),
  text: t('Texto principal'),
  text2: t('Texto secundario'),
  textMuted: t('Texto apagado'),
  success: t('Éxito'),
  warning: t('Advertencia'),
  danger: t('Peligro'),
  info: t('Información'),
  logTime: t('Log: hora e hilo'),
  logWarn: t('Log: advertencias'),
  logError: t('Log: errores'),
});

const GROUP_LABEL = () => ({ accent: t('Acento'), surfaces: t('Fondos y superficies'), text: t('Texto'), status: t('Estados'), logs: t('Logs') });

// The Microsoft app for the sign-in: Havi Hub's, or the person's own ID.
// Microsoft's page names the registered app that asks for permission.
function MicrosoftAppSection() {
  const app = useApp();
  const saved = (app.config && app.config.msaClientId) || '';
  const [value, setValue] = useState(saved);
  useEffect(() => setValue(saved), [saved]);
  const clean = value.trim().toLowerCase();
  const valid = clean === '' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(clean);
  return (
    <Section
      title={t('Inicio de sesión de Microsoft')}
      desc={t('Havi Hub inicia sesión con su propia aplicación de Microsoft, aprobada por Mojang. Si registraste una tuya y Mojang la aprobó, pega aquí su ID (la guía explica los pasos). Vacío: se usa la de Havi Hub.')}
    >
      <div className="row">
        <Input className="grow" value={value} onChange={setValue} maxLength={36} placeholder="00000000-0000-0000-0000-000000000000" />
        <Button
          variant="primary"
          disabled={!valid || clean === saved}
          onClick={async () => {
            await app.updateConfig({ msaClientId: clean });
            app.toast(clean ? t('ID guardado. Vuelve a agregar tus cuentas de Microsoft para usarlo.') : t('Se usará la aplicación de Havi Hub. Vuelve a agregar tus cuentas de Microsoft.'), { type: 'success' });
            app.refreshAccounts();
          }}
        >
          {t('Guardar')}
        </Button>
      </div>
      {!valid ? <p className="field-error">{t('El ID tiene este formato: 8-4-4-4-12 letras (a-f) y números.')}</p> : null}
    </Section>
  );
}

// Open-source notices: the programs Havi Hub is built with, and their licenses
function LicensesDialog({ onResolve }) {
  // what is bundled inside the app, with its license (written by the build: scripts/build.mjs)
  const [bundled, setBundled] = useState(null);
  // the license text on show: Havi Hub's own (GPL-3.0) or the third-party ones
  const [shown, setShown] = useState(null); // { which: 'havi' | 'third', text }
  useEffect(() => {
    let alive = true;
    fetch('licenses.json')
      .then((r) => r.json())
      .then((list) => alive && setBundled(Array.isArray(list) ? list : []))
      .catch(() => alive && setBundled([]));
    return () => {
      alive = false;
    };
  }, []);
  const show = (which) => {
    if (shown && shown.which === which) return setShown(null);
    fetch(which === 'havi' ? 'LICENSE.txt' : 'THIRD-PARTY-NOTICES.txt')
      .then((r) => r.text())
      .then((text) => setShown({ which, text }))
      .catch(() => setShown({ which, text: t('No se pudieron leer los textos.') }));
  };
  const rows = [
    ['Electron (Chromium, Node.js)', 'MIT', ''],
    ...(bundled || []).map((x) => [x.name, x.license, x.version]),
    [t('Motor de juego: basado en Prism Launcher (de sus colaboradores), con el nombre y el ícono de Havi Hub'), 'GPL-3.0', ''],
  ];
  return (
    <Modal
      title={t('Licencias de código abierto')}
      icon="file"
      onClose={() => onResolve(null)}
      width={600}
      footer={
        <Button variant="primary" onClick={() => onResolve(null)}>
          {t('Cerrar')}
        </Button>
      }
    >
      <div className="stack">
        <div className="own-license">
          <strong>Havi Hub © 2026 Havikun</strong>
          <p>{t('Havi Hub es software libre: puedes usarlo, estudiarlo, compartirlo y modificarlo según la Licencia Pública General de GNU, versión 3 (GPL-3.0). Se entrega sin ninguna garantía; los detalles están en la licencia.')}</p>
          <div>
            <Button variant="secondary" size="sm" icon="file" onClick={() => show('havi')}>
              {shown && shown.which === 'havi' ? t('Ocultar la licencia') : t('Ver la licencia de Havi Hub')}
            </Button>
          </div>
          {shown && shown.which === 'havi' ? <pre className="license-texts">{shown.text}</pre> : null}
        </div>
        <p className="muted">{t('Havi Hub se hace con estos programas de código abierto. Sus licencias piden nombrar a sus autores, así que aquí están.')}</p>
        <div className="licenses">
          {rows.map(([name, license, version]) => (
            <div key={name} className="license-row">
              <span>
                {name}
                {version ? <span className="muted"> {version}</span> : null}
              </span>
              <span className="muted">{license}</span>
            </div>
          ))}
        </div>
        <div>
          <Button variant="secondary" size="sm" icon="file" onClick={() => show('third')}>
            {shown && shown.which === 'third' ? t('Ocultar los textos completos') : t('Ver los textos completos de las licencias')}
          </Button>
        </div>
        {shown && shown.which === 'third' ? <pre className="license-texts">{shown.text}</pre> : null}
        <p className="muted">
          {t('El código del motor de juego:')}{' '}
          <button className="link-btn" onClick={() => call('app.openExternal', 'https://github.com/PrismLauncher/PrismLauncher')}>
            github.com/PrismLauncher/PrismLauncher
          </button>
          {'. '}
          {t('Havi Hub no es Prism Launcher ni está respaldado por ese proyecto.')}
        </p>
        <p className="muted">{t('Los logos de CurseForge, Modrinth y de las redes sociales son marcas de sus dueños. Minecraft es una marca de Mojang AB. Havi Hub no está afiliado a ninguno de ellos.')}</p>
        <p className="muted">{t('NO ES UN PRODUCTO OFICIAL DE MINECRAFT. NO ESTÁ APROBADO POR MOJANG NI MICROSOFT, NI ASOCIADO CON ELLOS.')}</p>
      </div>
    </Modal>
  );
}

function Section({ title, children, desc }) {
  return (
    <section className="set-section">
      {title ? <h3>{title}</h3> : null}
      {desc ? <p className="muted set-desc">{desc}</p> : null}
      {children}
    </section>
  );
}

// "Interface size": changing the zoom while the thumb is being dragged moves
// the slider under the pointer, so the new size is applied when it is let go.
function ScaleSlider({ value, onCommit }) {
  const [draft, setDraft] = useState(null);
  const shown = draft === null ? Number(value) || 100 : draft;
  return (
    <div className="scale-slider">
      <Slider
        value={shown}
        min={75}
        max={150}
        step={5}
        format={(v) => `${v}%`}
        onChange={setDraft}
        onCommit={(v) => {
          setDraft(null);
          if (v !== (Number(value) || 100)) onCommit(v);
        }}
      />
      {draft !== null && draft !== (Number(value) || 100) ? <span className="muted small scale-hint">{t('Se aplica al soltar')}</span> : null}
    </div>
  );
}

// One key binding: click, then press a key or a mouse button (Esc = none),
// like Minecraft's Controls screen.
function KeyCapture({ value, def, conflict, onChange }) {
  const [listening, setListening] = useState(false);
  const ref = useRef(null);
  const effective = value || def;
  useEffect(() => {
    if (!listening) return undefined;
    beginCapture();
    const stop = () => setListening(false);
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') onChange(UNBOUND);
      else {
        const k = keyFromEvent(e);
        if (!k) return;
        onChange(k);
      }
      stop();
    };
    const onMouse = (e) => {
      if (!ref.current || !ref.current.contains(e.target)) return stop();
      e.preventDefault();
      e.stopPropagation();
      onChange(keyFromMouse(e.button));
      stop();
    };
    // the release of the button that was just assigned (back/forward
    // buttons included) must not reach the page navigation
    const swallow = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const noMenu = (e) => e.preventDefault();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onMouse, true);
    window.addEventListener('mouseup', swallow, true);
    window.addEventListener('auxclick', swallow, true);
    window.addEventListener('contextmenu', noMenu, true);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onMouse, true);
      window.removeEventListener('contextmenu', noMenu, true);
      window.removeEventListener('blur', stop);
      endCapture();
      // keep swallowing until that button comes back up
      setTimeout(() => {
        window.removeEventListener('mouseup', swallow, true);
        window.removeEventListener('auxclick', swallow, true);
      }, 450);
    };
  }, [listening, onChange]);
  return (
    <button
      ref={ref}
      type="button"
      className={`keycap-btn ${listening ? 'listening' : ''} ${conflict ? 'conflict' : ''} ${value ? 'custom' : ''}`}
      onClick={() => setListening(true)}
      data-tip={conflict && !listening ? t('Esta tecla también la usa: {list}', { list: conflict }) : undefined}
    >
      {listening ? `> ${t('Presiona una tecla o un botón del mouse…')} <` : effective ? keyLabel(effective) : t('Predeterminada')}
      {conflict && !listening ? <Icon name="alert" size={18} className="keycap-warn" /> : null}
    </button>
  );
}

// Every Minecraft control. Only the keys you change are written to options.txt
function KeyBindings({ keys, onSet }) {
  const lang = getLanguage() === 'en' ? 'en' : 'es';
  const eff = (b) => keys[b.id] || b.def;
  const byKey = new Map();
  for (const b of BINDS) {
    const k = eff(b);
    if (!k || k === UNBOUND || b.cat === 'debug') continue;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(b);
  }
  return CATEGORIES.map((cat) => (
    <div key={cat.id} className="keys-cat">
      <h5 className="keys-cat-title">{cat[lang]}</h5>
      {BINDS.filter((b) => b.cat === cat.id).map((b) => {
        const others = b.cat === 'debug' ? [] : (byKey.get(eff(b)) || []).filter((o) => o !== b);
        return (
          <Field
            key={b.id}
            className="key-field"
            label={
              <>
                {b[lang]}
                {b.since ? <span className="key-since">{b.since}+</span> : null}
              </>
            }
          >
            <KeyCapture value={keys[b.id] || ''} def={b.def} conflict={others.map((o) => o[lang]).join(', ')} onChange={(v) => onSet(b.id, v)} />
            <button className="icon-btn" data-tip={t('Volver a la tecla predeterminada')} aria-label={t('Restablecer')} disabled={!keys[b.id]} onClick={() => onSet(b.id, '')}>
              <Icon name="history" size={22} />
            </button>
          </Field>
        );
      })}
    </div>
  ));
}

// What Havi Hub does when a game starts: one choice (stays, minimizes, hides
// in the tray until the game closes, or closes)
function LaunchBehavior({ config, cset }) {
  const mode = config.closeOnLaunch ? 'close' : config.trayOnLaunch ? 'tray' : config.minimizeOnLaunch ? 'minimize' : 'none';
  return (
    <Field label={t('Havi Hub')} hint={mode === 'tray' ? t('Havi Hub se esconde junto al reloj de Windows y no aparece en Alt+Tab ni en la barra de tareas. Vuelve solo cuando cierras el juego, o con un clic en su ícono.') : undefined}>
      <Select
        value={mode}
        onChange={(v) => cset({ minimizeOnLaunch: v === 'minimize', trayOnLaunch: v === 'tray', closeOnLaunch: v === 'close' })}
        options={[
          { value: 'none', label: t('Sigue abierto') },
          { value: 'minimize', label: t('Se minimiza') },
          { value: 'tray', label: t('Se esconde en la bandeja hasta que cierres el juego') },
          { value: 'close', label: t('Se cierra') },
        ]}
      />
    </Field>
  );
}

export default function Settings() {
  const app = useApp();
  const { route, config, appState } = app;
  const section = route.section || 'launcher';
  const [prism, setPrism] = useState(null);
  const [javas, setJavas] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    call('prism.getSettings').then(setPrism).catch(() => setPrism({}));
  }, [appState && appState.prism.dataDir]);
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [section]);

  const pget = (k, def = '') => (prism && k in prism && prism[k] !== null ? prism[k] : def);
  const pbool = (k, def = false) => (prism && k in prism ? truthy(prism[k]) : def);
  const pset = async (k, v) => {
    setPrism((p) => ({ ...p, [k]: v }));
    try {
      await call('prism.setSettings', { [k]: v });
    } catch (e) {
      app.showError(e);
    }
  };
  const psetMany = async (patch) => {
    setPrism((p) => ({ ...p, ...patch }));
    try {
      await call('prism.setSettings', patch);
    } catch (e) {
      app.showError(e);
    }
  };
  const cset = (patch) => app.updateConfig(patch).catch(app.showError);
  const igd = (config && config.inGameDefaults) || {};
  const setIgd = (patch) => cset({ inGameDefaults: patch });

  const maxMem = Math.max(2048, Math.floor(((appState && appState.totalMemoryMb) || 8192) / 256) * 256);

  const close = () => {
    const prev = app.history.stack.slice(0, app.history.index).reverse().find((r) => r.page !== 'settings');
    app.navigate(prev || { page: 'library' });
  };

  return (
    <div className="settings">
      <nav className="settings-nav">
        <h2>{t('Ajustes')}</h2>
        {NAV.map((n, i) =>
          n.group ? (
            <div key={`g${i}`} className="settings-group">
              {n.group()}
            </div>
          ) : (
            <button key={n.id} className={`settings-item ${section === n.id ? 'active' : ''}`} onClick={() => app.patchRoute({ section: n.id })}>
              <Icon name={n.icon} size={22} />
              {n.label()}
            </button>
          ),
        )}
        <span className="spacer" />
        <div className="settings-version muted">
          v. {appState ? appState.version : ''}
          {appState && appState.installKind === 'installed' ? ` · ${t('instalada')}` : ''}
          {appState && appState.installKind === 'portable' ? ` · ${t('portable')}` : ''}
          <button className="link-btn settings-licenses" onClick={() => app.openDialog(LicensesDialog)}>
            {t('Licencias')}
          </button>
        </div>
      </nav>
      <div className="settings-content" ref={contentRef}>
        <button className="settings-close icon-btn" onClick={close} title={t('Cerrar')}>
          <Icon name="x" size={24} />
        </button>
        <div className="settings-inner">
          {section === 'launcher' ? <LauncherSection app={app} pget={pget} pbool={pbool} pset={pset} cset={cset} /> : null}

          {section === 'addons' ? (
            <>
              <h1>{t('Addons')}</h1>
              <Section title={t('Dónde buscar')} desc={t('Fuente por defecto para Descubrir y Explorar. Con "Ambos", si un mod está en CurseForge y en Modrinth se muestra una sola vez: el que se actualizó más recientemente.')}>
                <Pills
                  value={config.discoverSource}
                  onChange={(v) => cset({ discoverSource: v })}
                  options={[
                    { value: 'both', label: t('Ambos') },
                    { value: 'modrinth', label: 'Modrinth', logo: 'modrinth' },
                    { value: 'curseforge', label: 'CurseForge', logo: 'curseforge' },
                  ]}
                />
              </Section>
              <Section
                title={t('API key de CurseForge')}
                desc={
                  appState.cfBuiltin
                    ? t('Havi Hub ya trae su propia API key de CurseForge para buscar y descargar. Si tienes una key tuya, pégala aquí y se usará en su lugar.')
                    : t('CurseForge exige una API key propia para que otras apps puedan buscar y descargar. Es gratis: entra a console.curseforge.com con tu cuenta, crea una organización y genera una key. Pégala aquí.')
                }
              >
                <ApiKeyInput value={config.curseforgeApiKey} onSave={(v) => cset({ curseforgeApiKey: v.trim() })} />
                <div className="row">
                  <Button variant="secondary" icon="external" onClick={() => call('app.openExternal', 'https://console.curseforge.com/')}>
                    {t('Abrir consola de CurseForge')}
                  </Button>
                  {appState.cfKeySource ? (
                    <span className="ok-text">
                      <Icon name="checkCircle" size={18} />{' '}
                      {appState.cfKeySource === 'prism' ? t('Usando la key personalizada configurada en el motor') : appState.cfKeySource === 'builtin' ? t('Usando la key incluida en Havi Hub') : t('Key configurada')}
                    </span>
                  ) : (
                    <span className="warn-text">
                      <Icon name="alert" size={18} /> {t('Sin key: solo se usará Modrinth')}
                    </span>
                  )}
                </div>
              </Section>
              <Section title={t('Token de Modrinth (opcional)')} desc={t('Solo hace falta para ver proyectos privados o no publicados.')}>
                <ApiKeyInput value={pget('ModrinthToken', '')} onSave={(v) => pset('ModrinthToken', v.trim())} placeholder="mrp_…" />
              </Section>
              <Section title={t('Descargas')}>
                <Field label={t('Versión preferida')} hint={t('Qué tipo de versiones instalar y sugerir como actualización')}>
                  <Select
                    value={config.preferredRelease}
                    onChange={(v) => cset({ preferredRelease: v })}
                    options={[
                      { value: 'release', label: t('Estable (recomendado)') },
                      { value: 'beta', label: t('Beta') },
                      { value: 'alpha', label: t('Alfa') },
                    ]}
                  />
                </Field>
                <Field label={t('Instalar dependencias automáticamente')}>
                  <Toggle checked={config.autoInstallDependencies} onChange={(v) => (cset({ autoInstallDependencies: v }), pset('ModDependenciesDisabled', !v))} />
                </Field>
                <Field label={t('Guardar metadatos de los mods (.pw.toml)')} hint={t('Permite reconocer y actualizar después lo que instales')}>
                  <Toggle checked={config.writePrismMetadata} onChange={(v) => (cset({ writePrismMetadata: v }), pset('ModMetadataDisabled', !v))} />
                </Field>
                <Field label={t('Buscar actualizaciones al abrir un perfil')}>
                  <Toggle checked={config.checkUpdatesOnOpen} onChange={(v) => cset({ checkUpdatesOnOpen: v })} />
                </Field>
                <Field label={t('Usar Modrinth cuando un mod de CurseForge no permite descargas')}>
                  <Toggle checked={pbool('FallbackMRBlockedMods', true)} onChange={(v) => pset('FallbackMRBlockedMods', v)} />
                </Field>
                <Field label={t('Mover mods descargados manualmente desde la carpeta Descargas')}>
                  <Toggle checked={pbool('MoveModsFromDownloadsDir')} onChange={(v) => pset('MoveModsFromDownloadsDir', v)} />
                </Field>
              </Section>
            </>
          ) : null}

          {section === 'languages' ? (
            <>
              <h1>{t('Idiomas')}</h1>
              <Section title={t('Idioma de Havi Hub')}>
                <div className="lang-list">
                  {LANGUAGES.map((l) => (
                    <button key={l.id || 'auto'} className={`lang-item ${config.language === l.id ? 'active' : ''}`} onClick={() => cset({ language: l.id })}>
                      <span className="radio" />
                      {l.id === '' ? t('Automático (sistema)') : l.name}
                    </button>
                  ))}
                </div>
              </Section>
              <Section title={t('Idioma del juego para perfiles nuevos')}>
                <Select
                  value={igd.lang || ''}
                  onChange={(v) => setIgd({ lang: v })}
                  options={[
                    { value: '', label: t('El que elija Minecraft') },
                    { value: 'es_cl', label: 'Español (Chile)' },
                    { value: 'es_es', label: 'Español (España)' },
                    { value: 'es_mx', label: 'Español (México)' },
                    { value: 'es_ar', label: 'Español (Argentina)' },
                    { value: 'en_us', label: 'English (US)' },
                    { value: 'pt_br', label: 'Português (Brasil)' },
                  ]}
                />
              </Section>
            </>
          ) : null}

          {section === 'themes' ? <ThemeSection app={app} config={config} cset={cset} /> : null}

          {section === 'privacy' ? (
            <>
              <h1>{t('Privacidad')}</h1>
              <Section desc={t('Havi Hub no envía estadísticas ni datos de uso, y no tiene servidores propios: tus cuentas, perfiles y ajustes quedan en tu PC. Se conecta solo a: Microsoft y Mojang (cuentas, skins y archivos del juego), Modrinth y CurseForge (buscar y descargar), GitHub y Prism Launcher (versiones del motor), los servidores de Minecraft que agregas o abres, y las redes de Havikun que se muestran en Inicio.')}>
                <button className="link-btn" onClick={() => call('app.openExternal', 'https://havihub.github.io/privacy/')}>
                  {t('Ver la política de privacidad')}
                </button>
              </Section>
              {/* Havikun's channels: loading them is on by default; turned off, they
                  stay on the Home page and load only when one is opened */}
              <Section title={t('Redes de Havikun en Inicio')} desc={t('Apenas abres Havi Hub, muestran los últimos videos de Havikun en YouTube, si está en vivo en Twitch y sus links de Linktree. Es una forma de apoyarlo sin pagar nada.')}>
                <Field label={t('Cargarlas automáticamente')} hint={t('Para mostrarlas, Havi Hub se conecta a YouTube, Twitch y Linktree (y a X, Instagram y TikTok cuando abres esas), que reciben tu dirección IP como cualquier página que visitas.')}>
                  <Toggle checked={config.privacy.socialAutoload !== false} onChange={(v) => cset({ privacy: { socialAutoload: v, socialAsked: true } })} />
                </Field>
                <p className="muted small">{t('Si lo desactivas, solo dejan de cargarse solas: siguen en Inicio y se cargan cuando abres una.')}</p>
              </Section>
              <Section title={t('Modo streamer')}>
                <Field label={t('Ocultar las direcciones IP de los servidores')} hint={t('En el menú Jugar se muestra 2*.***.**.151 en vez de la IP completa')}>
                  <Toggle checked={config.privacy.maskServerIps !== false} onChange={(v) => cset({ privacy: { maskServerIps: v } })} />
                </Field>
                <Field label={t('Ocultar el nombre de la cuenta')}>
                  <Toggle checked={Boolean(config.privacy.streamerMode)} onChange={(v) => cset({ privacy: { streamerMode: v } })} />
                </Field>
              </Section>
              <Section title={t('Tiempo de juego')}>
                <Field label={t('Registrar el tiempo jugado')}>
                  <Toggle checked={pbool('RecordGameTime', true)} onChange={(v) => pset('RecordGameTime', v)} />
                </Field>
                <Field label={t('Mostrar el tiempo jugado')}>
                  <Toggle checked={pbool('ShowGameTime', true)} onChange={(v) => pset('ShowGameTime', v)} />
                </Field>
              </Section>
              <Section title={t('Servicio para subir logs')} desc={t('Los logs se suben a mclo.gs. Solo se sube cuando presionas el botón.')} />
            </>
          ) : null}

          {section === 'advanced' ? <AdvancedSection app={app} pget={pget} pbool={pbool} pset={pset} /> : null}

          {section === 'minecraft' ? (
            <>
              <h1>Minecraft</h1>
              <Section title={t('Ajustes del juego por defecto')} desc={t('Se escriben en el options.txt de cada perfil nuevo que crees o instales.')}>
                <Field label={t('Personalizar los ajustes del juego')} hint={t('Si está desactivado, los perfiles nuevos usan los ajustes por defecto de Minecraft')}>
                  <Toggle checked={igd.enabled} onChange={(v) => setIgd({ enabled: v })} />
                </Field>
                <div className={igd.enabled ? '' : 'disabled-block'}>
                  <h4 className="set-sub">{t('Video')}</h4>
                  <Field label={t('Pantalla completa')}>
                    <Toggle checked={igd.fullscreen} onChange={(v) => setIgd({ fullscreen: v })} />
                  </Field>
                  <Field label={t('Movimiento de cámara al caminar')}>
                    <Toggle checked={igd.bobView} onChange={(v) => setIgd({ bobView: v })} />
                  </Field>
                  <Field label={t('Escala de la interfaz')}>
                    <Slider value={igd.guiScale} min={0} max={6} format={(v) => (v === 0 ? t('Auto') : v)} onChange={(v) => setIgd({ guiScale: v })} />
                  </Field>
                  <Field label={t('Brillo')}>
                    <Slider value={Math.round(igd.gamma * 100)} min={0} max={100} format={(v) => (v === 0 ? t('Oscuro') : v === 100 ? t('Brillante') : `${v}%`)} onChange={(v) => setIgd({ gamma: v / 100 })} />
                  </Field>
                  <Field
                    label={
                      <>
                        {t('Distancia de renderizado')}
                        {igd.renderDistance > 12 ? <Icon name="alert" size={18} className="warn-icon" title={t('Una distancia alta puede bajar mucho los FPS')} /> : null}
                      </>
                    }
                  >
                    <Slider value={igd.renderDistance} min={2} max={32} onChange={(v) => setIgd({ renderDistance: v })} />
                  </Field>
                  <Field label={t('Campo de visión (FOV)')}>
                    <Slider value={igd.fov} min={30} max={110} format={(v) => (v === 70 ? t('Normal') : v === 110 ? 'Quake Pro' : v)} onChange={(v) => setIgd({ fov: v })} />
                  </Field>
                  <h4 className="set-sub">{t('Controles')}</h4>
                  <Field label={t('Salto automático')}>
                    <Toggle checked={igd.autoJump} onChange={(v) => setIgd({ autoJump: v })} />
                  </Field>
                  <Field label={t('Invertir mouse')}>
                    <Toggle checked={igd.invertYMouse} onChange={(v) => setIgd({ invertYMouse: v })} />
                  </Field>
                  <Field label={t('Sensibilidad del mouse')}>
                    <Slider value={igd.mouseSensitivity} min={0} max={100} onChange={(v) => setIgd({ mouseSensitivity: v })} />
                  </Field>
                  <h4 className="set-sub">{t('Sonido')}</h4>
                  {[
                    ['master', t('Volumen general')],
                    ['music', t('Música')],
                    ['record', t('Tocadiscos / bloques musicales')],
                    ['weather', t('Clima')],
                    ['block', t('Bloques')],
                    ['hostile', t('Criaturas hostiles')],
                    ['neutral', t('Criaturas amistosas')],
                    ['player', t('Jugadores')],
                    ['ambient', t('Ambiente')],
                    ['voice', t('Voz')],
                  ].map(([k, l]) => (
                    <Field key={k} label={l}>
                      <Slider value={(igd.sound || {})[k] ?? 100} min={0} max={100} onChange={(v) => setIgd({ sound: { [k]: v } })} />
                    </Field>
                  ))}
                  <h4 className="set-sub">{t('Teclas')}</h4>
                  <p className="muted small keys-intro">{t('Haz clic en una tecla y presiona la nueva (también sirven los botones del mouse; Esc la deja sin asignar). Solo se guardan las que cambies; las demás quedan como en Minecraft.')}</p>
                  <KeyBindings keys={igd.keys || {}} onSet={(id, v) => setIgd({ keys: { [id]: v } })} />
                  <div className="row keys-apply">
                    <Button
                      variant="secondary"
                      icon="update"
                      onClick={async () => {
                        const ok = await app.confirm({ title: t('Aplicar las teclas a todos los perfiles'), message: t('Se cambiarán las teclas que personalizaste en el options.txt de todos tus perfiles (el resto de sus ajustes no se toca). Cierra el juego antes.'), confirmLabel: t('Aplicar') });
                        if (!ok) return;
                        try {
                          const r = await call('instances.applyKeys');
                          app.toast(t('Teclas aplicadas en {n} perfiles', { n: r.count }), { type: 'success' });
                        } catch (e) {
                          app.showError(e);
                        }
                      }}
                    >
                      {t('Aplicar las teclas a todos los perfiles')}
                    </Button>
                  </div>
                  <div className="row end">
                    <Button
                      variant="outline"
                      onClick={() => app.setConfigKey('inGameDefaults', { enabled: true, fullscreen: false, bobView: true, guiScale: 0, gamma: 0.5, renderDistance: 12, fov: 70, autoJump: false, invertYMouse: false, mouseSensitivity: 50, sound: { master: 100, music: 100, record: 100, weather: 100, block: 100, hostile: 100, neutral: 100, player: 100, ambient: 100, voice: 100 }, keys: { 'key.sneak': 'key.keyboard.left.control', 'key.sprint': 'key.keyboard.left.shift' }, lang: igd.lang || '' })}
                    >
                      {t('Restablecer valores')}
                    </Button>
                  </div>
                </div>
              </Section>
              <Section title={t('Resolución del juego')}>
                <div className={`radio-row ${pbool('LaunchMaximized') ? 'active' : ''}`} onClick={() => pset('LaunchMaximized', true)}>
                  <span className="radio" />
                  {t('Usar la resolución del escritorio (ventana maximizada)')}
                </div>
                <div className={`radio-row ${!pbool('LaunchMaximized') ? 'active' : ''}`} onClick={() => pset('LaunchMaximized', false)}>
                  <span className="radio" />
                  {t('Usar una resolución personalizada')}
                </div>
                <div className="row res-row">
                  <div className="stack grow">
                    <span className="label">{t('Ancho')}</span>
                    <Input type="number" disabled={pbool('LaunchMaximized')} value={pget('MinecraftWinWidth', 854)} onChange={(e) => setPrism((p) => ({ ...p, MinecraftWinWidth: e.target.value }))} onBlur={(e) => pset('MinecraftWinWidth', Number(e.target.value) || 854)} />
                  </div>
                  <div className="stack grow">
                    <span className="label">{t('Alto')}</span>
                    <Input type="number" disabled={pbool('LaunchMaximized')} value={pget('MinecraftWinHeight', 480)} onChange={(e) => setPrism((p) => ({ ...p, MinecraftWinHeight: e.target.value }))} onBlur={(e) => pset('MinecraftWinHeight', Number(e.target.value) || 480)} />
                  </div>
                </div>
              </Section>
              <Section title={t('Consola del juego')}>
                <Field label={t('Abrir la consola al iniciar el juego')} hint={t('Ventana del motor con el log en vivo, para ver errores mientras juegas')}>
                  <Toggle checked={pbool('ShowConsole')} onChange={(v) => pset('ShowConsole', v)} />
                </Field>
                <Field label={t('Cerrar la consola al terminar de jugar')}>
                  <Toggle checked={pbool('AutoCloseConsole')} onChange={(v) => pset('AutoCloseConsole', v)} />
                </Field>
              </Section>
            </>
          ) : null}

          {section === 'java' ? (
            <>
              <h1>{t('Java y memoria')}</h1>
              <Section title={t('Memoria asignada')} desc={t('Memoria por defecto para todos los perfiles (cada perfil puede cambiarla en Opciones del perfil).')}>
                <MemoryFields
                  max={Number(pget('MaxMemAlloc', 4096))}
                  min={Number(pget('MinMemAlloc', 512))}
                  limit={maxMem}
                  onChange={(m) => setPrism((p) => ({ ...p, MaxMemAlloc: m.max, MinMemAlloc: m.min }))}
                  onCommit={(m) => psetMany({ MaxMemAlloc: m.max, MinMemAlloc: m.min })}
                />
                {Number(pget('MaxMemAlloc', 4096)) > maxMem * 0.75 ? (
                  <p className="warn-text">
                    <Icon name="alert" size={16} /> {t('Asignar casi toda la RAM del equipo puede hacer que Windows y el juego vayan lentos.')}
                  </p>
                ) : null}
                <Field label={t('Avisar si la memoria es muy baja')}>
                  <Toggle checked={pbool('LowMemWarning', true)} onChange={(v) => pset('LowMemWarning', v)} />
                </Field>
              </Section>
              <Section title={t('Versiones de Java')}>
                <Field label={t('Cambiar de Java automáticamente según la versión de Minecraft')} hint={t('Recomendado: cada versión del juego necesita una versión distinta de Java')}>
                  <Toggle checked={pbool('AutomaticJavaSwitch', true)} onChange={(v) => pset('AutomaticJavaSwitch', v)} />
                </Field>
                <Field label={t('Descargar Java automáticamente si falta')}>
                  <Toggle checked={pbool('AutomaticJavaDownload', true)} onChange={(v) => pset('AutomaticJavaDownload', v)} />
                </Field>
                <Field label={t('Ignorar comprobación de compatibilidad de Java')}>
                  <Toggle checked={pbool('IgnoreJavaCompatibility')} onChange={(v) => pset('IgnoreJavaCompatibility', v)} />
                </Field>
                <span className="label">{t('Java por defecto')}</span>
                <div className="row">
                  <CommitInput className="grow" mono value={pget('JavaPath', '')} placeholder={t('Automático')} onCommit={(v) => pset('JavaPath', v)} />
                  <Button variant="outline" icon="search" onClick={async () => setJavas(await call('prism.findJava'))}>
                    {t('Detectar')}
                  </Button>
                  <Button
                    variant="outline"
                    icon="folderOpen"
                    onClick={async () => {
                      const f = await call('app.pickFiles', { filters: platform === 'win32' ? [{ name: 'Java', extensions: ['exe'] }] : undefined });
                      if (f[0]) pset('JavaPath', f[0]);
                    }}
                  />
                </div>
                {javas ? (
                  <div className="java-list">
                    {javas.length === 0 ? <p className="muted">{t('No se encontraron instalaciones de Java. Havi Hub puede descargarlas automáticamente.')}</p> : null}
                    {javas.map((j) => (
                      <button key={j.path} className={`java-item ${pget('JavaPath') === j.path ? 'active' : ''}`} onClick={() => pset('JavaPath', j.path)}>
                        <span className="java-major">Java {j.major || '?'}</span>
                        <span className="grow">
                          <strong>{j.vendor || t('Desconocido')}</strong> <span className="muted">{j.version}</span>
                          <small className="muted mono">{j.path}</small>
                        </span>
                        {pget('JavaPath') === j.path ? <Icon name="check" size={18} /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </Section>
              <Section title={t('Argumentos adicionales por defecto')} desc={t('Argumentos de la JVM para todos los perfiles.')}>
                <CommitInput mono area value={pget('JvmArgs', '')} placeholder={t('Ejemplo: -XX:+UseG1GC')} onCommit={(v) => pset('JvmArgs', v)} />
              </Section>
              <Section title={t('Comandos personalizados')} desc={t('Variables disponibles: $INST_NAME, $INST_ID, $INST_DIR, $INST_MC_DIR, $INST_JAVA, $INST_JAVA_ARGS')}>
                <span className="label">{t('Antes de iniciar')}</span>
                <CommitInput mono value={pget('PreLaunchCommand')} onCommit={(v) => pset('PreLaunchCommand', v)} />
                <span className="label">{t('Comando envoltorio (wrapper)')}</span>
                <CommitInput mono value={pget('WrapperCommand')} onCommit={(v) => pset('WrapperCommand', v)} />
                <span className="label">{t('Después de cerrar')}</span>
                <CommitInput mono value={pget('PostExitCommand')} onCommit={(v) => pset('PostExitCommand', v)} />
              </Section>
              <Section title={t('Variables de entorno')} desc={t('Se pasan al juego en todos los perfiles. Cada perfil puede tener las suyas en sus opciones.')}>
                <EnvVarsEditor lazy value={pget('Env', '{}')} onChange={(text) => pset('Env', text)} />
              </Section>
              <Section title={t('Librerías nativas')}>
                <Field label={t('Usar GLFW del sistema')}>
                  <Toggle checked={pbool('UseNativeGLFW')} onChange={(v) => pset('UseNativeGLFW', v)} />
                </Field>
                <LibraryPath label={t('Ruta de GLFW')} value={pget('CustomGLFWPath', '')} disabled={!pbool('UseNativeGLFW')} onChange={(v) => pset('CustomGLFWPath', v)} />
                <Field label={t('Usar OpenAL del sistema')}>
                  <Toggle checked={pbool('UseNativeOpenAL')} onChange={(v) => pset('UseNativeOpenAL', v)} />
                </Field>
                <LibraryPath label={t('Ruta de OpenAL')} value={pget('CustomOpenALPath', '')} disabled={!pbool('UseNativeOpenAL')} onChange={(v) => pset('CustomOpenALPath', v)} />
              </Section>
              <Section title={t('Versiones antiguas')}>
                <Field label={t('Arreglos para versiones antiguas (skins y sonidos en versiones viejas)')}>
                  <Toggle checked={pbool('OnlineFixes')} onChange={(v) => pset('OnlineFixes', v)} />
                </Field>
              </Section>
              {platform === 'linux' ? (
                <Section title={t('Rendimiento (Linux)')}>
                  <Field label="Feral GameMode">
                    <Toggle checked={pbool('EnableFeralGamemode')} onChange={(v) => pset('EnableFeralGamemode', v)} />
                  </Field>
                  <Field label="MangoHud">
                    <Toggle checked={pbool('EnableMangoHud')} onChange={(v) => pset('EnableMangoHud', v)} />
                  </Field>
                  <Field label={t('Usar GPU dedicada')}>
                    <Toggle checked={pbool('UseDiscreteGpu')} onChange={(v) => pset('UseDiscreteGpu', v)} />
                  </Field>
                  <Field label="Zink (OpenGL → Vulkan)">
                    <Toggle checked={pbool('UseZink')} onChange={(v) => pset('UseZink', v)} />
                  </Field>
                </Section>
              ) : null}
            </>
          ) : null}

          {section === 'accounts' ? <AccountsSection app={app} /> : null}
        </div>
      </div>
    </div>
  );
}

function CommitInput({ value, onCommit, mono, area, className = '', placeholder }) {
  const [v, setV] = useState(value || '');
  useEffect(() => setV(value || ''), [value]);
  if (area) return <TextArea className={`${mono ? 'mono' : ''} ${className}`} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => v !== (value || '') && onCommit(v)} />;
  return <Input className={`${mono ? 'mono' : ''} ${className}`} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => v !== (value || '') && onCommit(v)} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />;
}

function ApiKeyInput({ value, onSave, placeholder }) {
  const [v, setV] = useState(value || '');
  const [show, setShow] = useState(false);
  useEffect(() => setV(value || ''), [value]);
  return (
    <div className="row">
      <Input className="grow mono" type={show ? 'text' : 'password'} value={v} placeholder={placeholder || '$2a$10$…'} onChange={(e) => setV(e.target.value)} right={<button className="icon-btn" onClick={() => setShow((s) => !s)}><Icon name={show ? 'eyeOff' : 'eye'} size={18} /></button>} />
      <Button variant="primary" disabled={v === (value || '')} onClick={() => onSave(v)}>
        {t('Guardar')}
      </Button>
    </div>
  );
}

function EngineStatus({ app }) {
  const st = app.engineStatus || (app.appState && app.appState.engine) || {};
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    try {
      const r = await call('engine.check');
      if (r && r.error) app.toast(t('No se pudo buscar actualizaciones: {e}', { e: r.error }), { type: 'error' });
      else app.toast(r && r.version && r.latest && r.version === r.latest ? t('El motor está al día (versión {v})', { v: r.version }) : t('Buscando y descargando la versión nueva…'), { type: 'success' });
    } catch (e) {
      app.showError(e);
    } finally {
      setChecking(false);
    }
  };
  let line;
  if (st.custom) line = t('Usando un motor personalizado: {p}', { p: st.custom });
  else if (st.installing) line = t('Descargando el motor de juego {v}…', { v: st.latest || '' });
  else if (st.pending) line = t('El motor {v} se activará cuando cierres el juego', { v: st.pending });
  else if (st.version) line = st.latest && st.latest !== st.version ? t('Motor {v} (hay una versión nueva: {n})', { v: st.version, n: st.latest }) : t('Motor {v} · al día', { v: st.version });
  else line = st.supported === false ? t('Este sistema no tiene un motor descargable; elige uno en Avanzado.') : t('Se descargará la primera vez que juegues.');
  return (
    <div className="engine-card">
      <Icon name="engine" size={30} />
      <div className="engine-main">
        <strong>{t('Motor de juego')}</strong>
        <span>{line}</span>
        <small>
          {st.lastCheck ? t('Última revisión: {when}', { when: timeAgo(st.lastCheck) }) : t('Havi Hub revisa si hay una versión nueva cada vez que se abre.')}
          {st.error ? ` · ${t('Error: {e}', { e: st.error })}` : ''}
        </small>
        {st.installing ? <Progress value={st.progress} indeterminate={!st.progress} className="engine-progress" /> : null}
      </div>
      {!st.custom ? (
        <Button variant="secondary" icon="refresh" loading={checking || st.checking} disabled={st.installing} onClick={check}>
          {t('Buscar actualización')}
        </Button>
      ) : null}
    </div>
  );
}

// Synced profiles (Prism Launcher, CurseForge and Modrinth): a short list and
// the one button that manages all of them
function SyncSummary({ app }) {
  const groups = ((app.config && app.config.sync) || {}).groups || [];
  const share = app.appState && app.appState.sharing;
  return (
    <>
      {groups.length || (share && share.enabled) ? (
        <div className="sync-summary">
          {share && share.enabled ? (
            <div className={`sync-summary-row ${share.missing ? 'warn' : ''}`}>
              <Icon name={share.missing ? 'alert' : 'link'} size={18} />
              <strong>{t('Todos los perfiles')}</strong>
              <span className="muted">{share.missing ? t('No se encuentra la carpeta de Prism Launcher ({dir}); Havi Hub usa su propia carpeta mientras tanto.', { dir: share.prismDir }) : 'Prism Launcher'}</span>
            </div>
          ) : null}
          {groups.map((g) => (
            <div key={g.id} className="sync-summary-row">
              <Icon name="link" size={18} />
              <strong>{g.name}</strong>
              <span className="muted">{g.members.map((m) => m.label).join(', ')}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="row">
        <Button variant="secondary" icon="link" onClick={() => app.openDialog(SyncProfilesDialog, {}).then(() => app.refreshState())}>
          {t('Sincronizar perfiles…')}
        </Button>
      </div>
    </>
  );
}

function LauncherSection({ app, pget, pbool, pset, cset }) {
  const { appState, config } = app;
  return (
    <>
      <h1>{t('Launcher')}</h1>
      <Section title={t('Havi Hub')} desc={t('Havi Hub es un launcher completo: tiene su propia carpeta de perfiles y su propio motor de juego, que se actualiza solo en segundo plano. No necesitas instalar nada más.')}>
        <EngineStatus app={app} />
        <span className="label">{t('Carpeta de datos de Havi Hub')}</span>
        <div className="row">
          <Input className="grow" value={appState.prism.dataDir || ''} readOnly />
          <Button variant="outline" onClick={() => call('app.openDataDir')}>
            {t('Abrir')}
          </Button>
        </div>
        <div className="row">
          <Button variant="secondary" icon="import" onClick={() => app.openDialog(ImportLaunchersDialog, {})}>
            {t('Importar desde otro launcher…')}
          </Button>
        </div>
      </Section>
      <Section title={t('Sincronizar perfiles')} desc={t('Usa los mismos perfiles en Havi Hub, Prism Launcher, CurseForge y la app de Modrinth: los mundos, mods y ajustes son los mismos donde juegues. Cada launcher conserva sus cuentas y su configuración.')}>
        <SyncSummary app={app} />
      </Section>
      <Section title={t('Comportamiento')}>
        <h4 className="set-sub">{t('Al cerrar la ventana')}</h4>
        <Field label={t('Al cerrar con la X, dejar Havi Hub en la bandeja')} hint={t('La ventana se esconde junto al reloj de Windows y Havi Hub sigue abierto. Para salir del todo: clic derecho en su ícono → Salir de Havi Hub.')}>
          <Toggle checked={config.closeToTray === true} onChange={(v) => cset({ closeToTray: v })} />
        </Field>
        <Field label={t('Liberar memoria mientras está en la bandeja')} hint={t('Tras un minuto escondido en la bandeja, Havi Hub guarda su ventana y le deja esa memoria al juego. Al volver abre en la misma página; las descargas y el juego siguen igual.')}>
          <Toggle checked={config.sleepInTray !== false} onChange={(v) => cset({ sleepInTray: v })} />
        </Field>
        <h4 className="set-sub">{t('Al iniciar el juego')}</h4>
        <LaunchBehavior config={config} cset={cset} />
        <h4 className="set-sub">{t('Perfiles')}</h4>
        <Field label={t('Al renombrar un perfil, renombrar también su carpeta')}>
          <Select
            value={pget('InstRenamingMode', 'AskEverytime')}
            onChange={(v) => pset('InstRenamingMode', v)}
            options={[
              { value: 'AskEverytime', label: t('Preguntar') },
              { value: 'PhysicalDir', label: t('Siempre') },
              { value: 'MetadataOnly', label: t('Nunca') },
            ]}
          />
        </Field>
      </Section>
      {platform === 'linux' ? <LinuxMenuSection app={app} /> : null}
    </>
  );
}

// Linux: Havi Hub in the application menu, for this user
// (~/.local/share/applications) or for every user (/usr/share/applications)
function LinuxMenuSection({ app }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    call('linux.menuState').then(setSt).catch(() => setSt(null));
  }, []);
  if (!st || !st.supported) return null;
  const run = async (key, method) => {
    setBusy(key);
    try {
      setSt(await call(method));
      if (method === 'linux.menuInstallSystem') app.toast(t('Havi Hub ya aparece en el menú de todos los usuarios.'), { type: 'success' });
    } catch (e) {
      app.showError(e);
    } finally {
      setBusy('');
    }
  };
  return (
    <Section title={t('Menú de aplicaciones')} desc={t('Para abrir Havi Hub desde el lanzador de tu escritorio, como cualquier otra aplicación.')}>
      <Field label={t('Mostrar Havi Hub en mi menú de aplicaciones')} hint={st.userFile}>
        <Toggle checked={st.user} disabled={Boolean(busy)} onChange={(v) => run('user', v ? 'linux.menuInstall' : 'linux.menuRemove')} />
      </Field>
      <Field label={t('Para todos los usuarios del equipo')} hint={st.system ? t('Instalado en {p}', { p: st.systemFile }) : t('Copia Havi Hub a /opt/havihub y lo agrega a /usr/share/applications. Pide la contraseña de administrador.')}>
        {st.system ? (
          <span className="muted">{t('Listo')}</span>
        ) : (
          <Button variant="secondary" loading={busy === 'system'} disabled={!st.appImage || Boolean(busy)} onClick={() => run('system', 'linux.menuInstallSystem')}>
            {t('Instalar para todos')}
          </Button>
        )}
      </Field>
    </Section>
  );
}

function ThemeSection({ app, config, cset }) {
  const palette = resolvePalette(config.themePreset, config.palette);
  const fileRef = useRef(null);
  const groups = useMemo(() => {
    const g = {};
    for (const tk of TOKENS) (g[tk.group] = g[tk.group] || []).push(tk.key);
    return g;
  }, []);
  const labels = TOKEN_LABEL();
  const glabels = GROUP_LABEL();
  return (
    <>
      <h1>{t('Temas')}</h1>
      <Section title={t('Diseño')} desc={t('Cómo se ordena la app. Los dos tienen las mismas funciones; al cambiar, se usa el tema original de ese diseño (después puedes elegir otro).')}>
        <LayoutChoice value={config.layout || 'curseforge'} onChange={(v) => v !== (config.layout || 'curseforge') && app.setLayout(v)} />
      </Section>
      <Section title={t('Temas predefinidos')} desc={t('Elige una base y cambia cualquier color abajo: todos los colores de la app son personalizables.')}>
        <div className="preset-grid">
          {PRESET_ORDER.filter((key) => PRESETS[key]).map((key) => [key, PRESETS[key]]).map(([key, p]) => (
            <button key={key} className={`preset ${config.themePreset === key ? 'active' : ''}`} onClick={() => app.setConfigKey('palette', {}).then(() => cset({ themePreset: key }))}>
              <span className="preset-preview" style={{ background: p.colors.bg }}>
                <span style={{ background: p.colors.sidebar }} className="pp-side" />
                <span style={{ background: p.colors.surface }} className="pp-card" />
                <span style={{ background: p.colors.accent }} className="pp-accent" />
                <span style={{ background: p.colors.text, opacity: 0.8 }} className="pp-text" />
              </span>
              <span className="preset-name">{t(p.name)}</span>
            </button>
          ))}
        </div>
      </Section>
      <SeasonsSection app={app} config={config} cset={cset} />
      <Section title={t('Paleta de colores')}>
        <div className="row">
          <Button variant="secondary" icon="history" onClick={() => app.setConfigKey('palette', {})}>
            {t('Restablecer al tema base')}
          </Button>
          <Button
            variant="secondary"
            icon="download"
            onClick={() => {
              const blob = new Blob([JSON.stringify({ preset: config.themePreset, colors: palette }, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'havihub-tema.json';
              a.click();
            }}
          >
            {t('Exportar')}
          </Button>
          <Button variant="secondary" icon="import" onClick={() => fileRef.current.click()}>
            {t('Importar')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden-input"
            onChange={async (e) => {
              const f = e.target.files[0];
              e.target.value = '';
              if (!f) return;
              try {
                const j = JSON.parse(await f.text());
                const colors = j.colors || j;
                await app.setConfigKey('palette', colors);
                if (j.preset && PRESETS[j.preset]) cset({ themePreset: j.preset });
                app.toast(t('Tema importado'), { type: 'success' });
              } catch {
                app.toast(t('El archivo no es un tema válido'), { type: 'error' });
              }
            }}
          />
        </div>
        {Object.entries(groups).map(([g, keys]) => (
          <div key={g} className="palette-group">
            <h4 className="set-sub">{glabels[g]}</h4>
            <div className="palette-grid">
              {keys.map((k) => (
                <div key={k} className="palette-item">
                  <span>{labels[k]}</span>
                  <ColorInput value={palette[k]} onChange={(v) => cset({ palette: { [k]: v } })} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>
      <Section title={t('Interfaz')}>
        <Field label={t('Tamaño de la interfaz')} hint={t('100 % = el mismo tamaño que CurseForge')}>
          <ScaleSlider value={config.uiScale} onCommit={(v) => cset({ uiScale: v })} />
        </Field>
        <Field label={t('Ajustar el tamaño al de la ventana')} hint={t('Con la ventana más chica, todo se dibuja un poco más chico para que quepa más, sin bajar de un tamaño cómodo de leer.')}>
          <Toggle checked={config.autoScale !== false} onChange={(v) => cset({ autoScale: v })} />
        </Field>
        <Field label={t('Reducir animaciones')}>
          <Toggle checked={config.reduceMotion} onChange={(v) => cset({ reduceMotion: v })} />
        </Field>
      </Section>
    </>
  );
}

// Seasonal themes: on by themselves during their week; each can be turned
// off or previewed here.
function SeasonsSection({ app, config, cset }) {
  const ref = useRef(null);
  const seasons = config.seasons || {};
  useEffect(() => {
    if (app.route.focus === 'seasons' && ref.current) ref.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [app.route.focus]);
  const rows = [
    { id: 'halloween', name: t('Halloween'), when: t('Del 25 de octubre al 1 de noviembre, con calabazas y murciélagos') },
    { id: 'christmas', name: t('Navidad'), when: t('Del 19 al 26 de diciembre, con luces y nieve') },
    { id: 'newyear', name: t('Año Nuevo'), when: t('Del 27 de diciembre al 2 de enero, con fuegos artificiales a medianoche') },
  ];
  const set = (patch) => cset({ seasons: patch });
  return (
    <div ref={ref}>
      <Section title={t('Temas de temporada')} desc={t('Cada uno se pone solo durante su semana y después vuelve tu tema. Puedes apagarlos aquí.')}>
        <div className="season-list">
          {rows.map((r) => {
            const on = seasons[r.id] !== false;
            return (
              <div key={r.id} className={`season-row ${app.season === r.id ? 'current' : ''}`}>
                <SeasonIcon season={r.id} size={44} />
                <div className="season-text">
                  <strong>{r.name}</strong>
                  <span className="muted">{r.when}</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="eye"
                  onClick={() => {
                    app.setSeasonPreview(r.id);
                    if (r.id === 'newyear') setTimeout(() => playFireworks(16000), 300);
                  }}
                >
                  {t('Vista previa')}
                </Button>
                <Toggle checked={on} title={on ? t('Apagar') : t('Encender')} onChange={(v) => set({ [r.id]: v })} />
                {r.id === 'halloween' ? (
                  <div className="season-sub">
                    <div className="season-text">
                      <strong>{t('Sustos ocultos')}</strong>
                      <span className="muted">{t('Muy de vez en cuando, al abrir Havi Hub o al hacer clic, algo aparece. Solo durante Halloween y nunca con “Reducir animaciones”.')}</span>
                    </div>
                    <Button size="sm" variant="secondary" onClick={triggerScare}>
                      {t('Probar')}
                    </Button>
                    <Toggle checked={seasons.scares !== false} disabled={!on} onChange={(v) => set({ scares: v })} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function AdvancedSection({ app, pget, pbool, pset }) {
  const [dirs, setDirs] = useState(null);
  useEffect(() => {
    setDirs({ InstanceDir: pget('InstanceDir', 'instances'), CentralModsDir: pget('CentralModsDir', 'mods'), IconsDir: pget('IconsDir', 'icons'), SkinsDir: pget('SkinsDir', 'skins'), JavaDir: pget('JavaDir', 'java'), DownloadsDir: pget('DownloadsDir', '') });
  }, []);
  return (
    <>
      <h1>{t('Avanzado')}</h1>
      <Section title={t('Carpeta de datos de Havi Hub')} desc={t('Dónde se guardan tus perfiles, cuentas y skins. Cambiarla no mueve los archivos: Havi Hub empezará a usar la carpeta elegida.')}>
        <div className="row">
          <Input className="grow" value={app.appState.prism.dataDir || ''} readOnly />
          <Button
            variant="outline"
            onClick={async () => {
              const d = await call('app.pickFolder', { title: t('Carpeta de datos de Havi Hub'), defaultPath: app.appState.prism.dataDir || undefined });
              if (!d) return;
              try {
                await call('app.setDataDir', d);
                await app.refreshState();
                await app.refreshInstances();
                await app.refreshAccounts();
              } catch (e) {
                app.showError(e);
              }
            }}
          >
            {t('Cambiar')}
          </Button>
          {app.appState.prism.dataDir !== app.appState.prism.defaultDataDir ? (
            <Button
              variant="ghost"
              onClick={async () => {
                await call('app.setDataDir', '');
                await app.refreshState();
                await app.refreshInstances();
                await app.refreshAccounts();
              }}
            >
              {t('Usar la carpeta por defecto')}
            </Button>
          ) : null}
        </div>
      </Section>
      <Section title={t('Motor personalizado')} desc={t('Para usuarios avanzados: usar otro motor compatible en vez del que Havi Hub descarga y actualiza solo.')}>
        <div className="row">
          <Input className="grow" value={(app.config && app.config.engineExe) || ''} readOnly placeholder={t('Automático (recomendado)')} />
          <Button
            variant="outline"
            onClick={async () => {
              const f = await call('app.pickFiles', { title: 'prismlauncher', filters: platform === 'win32' ? [{ name: 'Prism Launcher', extensions: ['exe'] }] : undefined });
              if (!f[0]) return;
              try {
                await call('app.setEngineExe', f[0]);
                await app.refreshState();
              } catch (e) {
                app.showError(e);
              }
            }}
          >
            {t('Elegir…')}
          </Button>
          {app.config && app.config.engineExe ? (
            <Button
              variant="ghost"
              onClick={async () => {
                await call('app.setEngineExe', '');
                await app.refreshState();
              }}
            >
              {t('Volver al automático')}
            </Button>
          ) : null}
        </div>
      </Section>
      <MicrosoftAppSection />
      <Section title={t('Carpetas')} desc={t('Rutas relativas a la carpeta de datos de Havi Hub, o absolutas. Cambiarlas no mueve tus archivos.')}>
        {dirs
          ? [
              ['InstanceDir', t('Perfiles (instancias)')],
              ['IconsDir', t('Imágenes de perfiles')],
              ['SkinsDir', t('Skins')],
              ['CentralModsDir', t('Mods compartidos')],
              ['JavaDir', t('Java descargado')],
              ['DownloadsDir', t('Carpeta de descargas (mods bloqueados)')],
            ].map(([k, l]) => (
              <Field key={k} label={l}>
                <CommitInput value={dirs[k]} onCommit={(v) => pset(k, v)} />
              </Field>
            ))
          : null}
      </Section>
      <Section title={t('Red')}>
        <Field label={t('Proxy')}>
          <Select
            value={pget('ProxyType', 'None')}
            onChange={(v) => pset('ProxyType', v)}
            options={[
              { value: 'None', label: t('Sin proxy') },
              { value: 'Default', label: t('Proxy del sistema') },
              { value: 'SOCKS5', label: 'SOCKS5' },
              { value: 'HTTP', label: 'HTTP' },
            ]}
          />
        </Field>
        {['SOCKS5', 'HTTP'].includes(pget('ProxyType', 'None')) ? (
          <>
            <Field label={t('Dirección')}>
              <CommitInput value={pget('ProxyAddr', '127.0.0.1')} onCommit={(v) => pset('ProxyAddr', v)} />
            </Field>
            <Field label={t('Puerto')}>
              <CommitInput value={String(pget('ProxyPort', 8080))} onCommit={(v) => pset('ProxyPort', Number(v) || 8080)} />
            </Field>
            <Field label={t('Usuario')}>
              <CommitInput value={pget('ProxyUser', '')} onCommit={(v) => pset('ProxyUser', v)} />
            </Field>
          </>
        ) : null}
        <Field label={t('Descargas simultáneas')}>
          <Slider value={Number(pget('NumberOfConcurrentDownloads', 6))} min={1} max={20} onChange={(v) => pset('NumberOfConcurrentDownloads', v)} />
        </Field>
        <Field label={t('Tiempo de espera de red (segundos)')}>
          <Slider value={Number(pget('RequestTimeout', 15))} min={5} max={120} step={5} onChange={(v) => pset('RequestTimeout', v)} />
        </Field>
      </Section>
      <Section title={t('Servidores alternativos')} desc={t('Déjalos vacíos para usar los oficiales.')}>
        <Field label={t('Servidor de versiones (meta)')}>
          <CommitInput value={pget('MetaURLOverride', '')} placeholder="https://meta.prismlauncher.org/v1/" onCommit={(v) => pset('MetaURLOverride', v)} />
        </Field>
        <Field label={t('Servidor de recursos del juego')}>
          <CommitInput value={pget('ResourceURLOverride', '')} placeholder="https://resources.download.minecraft.net/" onCommit={(v) => pset('ResourceURLOverride', v)} />
        </Field>
      </Section>
      <Section title={t('Consola del motor')}>
        <Field label={t('Máximo de líneas en la consola')}>
          <CommitInput value={String(pget('ConsoleMaxLines', 100000))} onCommit={(v) => pset('ConsoleMaxLines', Number(v) || 100000)} />
        </Field>
        <Field label={t('Detener el log al llegar al máximo')}>
          <Toggle checked={pbool('ConsoleOverflowStop', true)} onChange={(v) => pset('ConsoleOverflowStop', v)} />
        </Field>
      </Section>
    </>
  );
}

function AccountsSection({ app }) {
  const { accounts } = app;
  return (
    <>
      <h1>{t('Cuentas')}</h1>
      <Section desc={t('Para agregar una cuenta de Microsoft se abre un momento la ventana de inicio de sesión de Havi Hub. Las cuentas que traigas de Prism Launcher tienen que iniciar sesión una vez en Havi Hub.')}>
        <div className="account-list">
          {accounts.length === 0 ? <p className="muted">{t('Todavía no hay cuentas.')}</p> : null}
          {accounts.map((a) => (
            <div key={a.id} className={`account-item ${a.active ? 'active' : ''}`}>
              <AccountAvatar account={a} size={40} />
              <div className="grow">
                <strong>{a.name}</strong>
                <small className="muted">
                  {a.type === 'Offline' ? t('Cuenta offline') : t('Cuenta de Microsoft')} · {a.needsLogin ? t('tiene que iniciar sesión de nuevo') : a.tokenValid ? t('sesión activa') : t('sesión expirada (se renueva al jugar)')}
                </small>
              </div>
              {a.needsLogin ? (
                <Button size="sm" variant="primary" icon="microsoft" onClick={() => app.openDialog(AddAccountDialog, { relogin: a.name })}>
                  {t('Iniciar sesión')}
                </Button>
              ) : null}
              {a.active ? (
                <span className="chip">{t('Predeterminada')}</span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => call('accounts.setActive', a.id).then(app.refreshAccounts).catch(app.showError)}>
                  {t('Usar por defecto')}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                icon="trash"
                onClick={async () => {
                  const ok = await app.confirm({ title: t('Quitar cuenta'), message: t('¿Quitar {name} de Havi Hub?', { name: a.name }), confirmLabel: t('Quitar'), danger: true });
                  if (ok) call('accounts.remove', a.id).then(app.refreshAccounts).catch(app.showError);
                }}
              />
            </div>
          ))}
        </div>
        <div className="row">
          <Button variant="primary" icon="microsoft" onClick={() => app.openDialog(AddAccountDialog, {})}>
            {t('Agregar cuenta de Microsoft')}
          </Button>
          <OfflineAccountButton className="inline-tip" />
          <Button variant="secondary" icon="import" onClick={() => app.openDialog(ImportLaunchersDialog, { only: ['prism'] })}>
            {t('Importar desde Prism Launcher…')}
          </Button>
        </div>
      </Section>
    </>
  );
}
