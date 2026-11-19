// "Profile Options": every per-instance setting Prism Launcher supports
// (instance.cfg), grouped like the settings page.
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal.jsx';
import { Button, Input, TextArea, Toggle, Select, Spinner, Field } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { LoaderIcon } from '../components/InstanceImage.jsx';
import { call, platform } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { useApp } from '../lib/store.jsx';
import { LIMITS } from '../../shared/limits.js';
import BrandLogo from '../components/BrandLogo.jsx';
import EnvVarsEditor from '../components/EnvVarsEditor.jsx';
import MemoryFields from '../components/MemoryFields.jsx';
import LibraryPath from '../components/LibraryPath.jsx';

const truthy = (v) => v === true || v === 'true';

const SECTIONS = [
  { id: 'general', icon: 'listOptions', label: () => t('General') },
  { id: 'version', icon: 'cube', label: () => t('Versión y cargador') },
  { id: 'java', icon: 'java', label: () => t('Java y memoria') },
  { id: 'window', icon: 'window', label: () => t('Ventana del juego') },
  { id: 'launch', icon: 'play', label: () => t('Al iniciar') },
  { id: 'console', icon: 'terminal', label: () => t('Consola') },
  { id: 'advanced', icon: 'sliders', label: () => t('Avanzado') },
];

function OverrideBlock({ title, enabled, onToggle, children, hint }) {
  return (
    <div className={`override ${enabled ? 'on' : ''}`}>
      <div className="override-head">
        <div>
          <h4>{title}</h4>
          {hint ? <p className="muted small">{hint}</p> : null}
        </div>
        <label className="override-toggle">
          <span>{enabled ? t('Personalizado') : t('Usar ajustes globales')}</span>
          <Toggle checked={enabled} onChange={onToggle} />
        </label>
      </div>
      <div className="override-body">{children}</div>
    </div>
  );
}

export default function ProfileOptionsDialog({ instance, onResolve, initialSection = 'general' }) {
  const app = useApp();
  const [section, setSection] = useState(initialSection);
  const [orig, setOrig] = useState(null);
  const [patch, setPatch] = useState({});
  const [global, setGlobal] = useState({});
  const [busy, setBusy] = useState(false);
  const [javas, setJavas] = useState(null);
  // version section
  const [mc, setMc] = useState(instance.mcVersion);
  const [loader, setLoader] = useState(instance.loader ? instance.loader.id : 'vanilla');
  const [loaderVersion, setLoaderVersion] = useState(instance.loader ? instance.loader.version : '');
  const [versions, setVersions] = useState([]);
  const [loaderVersions, setLoaderVersions] = useState([]);

  useEffect(() => {
    call('instances.getSettings', instance.id).then(setOrig).catch(app.showError);
    call('prism.getSettings').then(setGlobal).catch(() => {});
  }, [instance.id]);

  useEffect(() => {
    if (section !== 'version' || versions.length) return;
    call('meta.minecraft').then((v) => setVersions(v.filter((x) => x.type === 'release' || x.version === instance.mcVersion))).catch(() => {});
  }, [section]);

  useEffect(() => {
    if (section !== 'version' || loader === 'vanilla') return;
    call('meta.loaderVersions', loader, mc)
      .then((list) => {
        setLoaderVersions(list);
        if (!list.some((v) => v.version === loaderVersion)) {
          const rec = list.find((v) => v.recommended) || list[0];
          setLoaderVersion(rec ? rec.version : '');
        }
      })
      .catch(() => setLoaderVersions([]));
  }, [section, loader, mc]);

  const val = (k, def = '') => (k in patch ? patch[k] : orig && k in orig ? orig[k] : def);
  const gval = (k, def = '') => (k in global ? global[k] : def);
  const set = (k, v) => setPatch((p) => ({ ...p, [k]: v }));
  const bool = (k, def = false) => (val(k, def) === '' ? def : truthy(val(k, def)));

  const versionChanged = mc !== instance.mcVersion || loader !== (instance.loader ? instance.loader.id : 'vanilla') || (loader !== 'vanilla' && loaderVersion !== (instance.loader ? instance.loader.version : ''));
  const dirty = Object.keys(patch).length > 0 || versionChanged;

  const save = async () => {
    setBusy(true);
    try {
      if (Object.keys(patch).length) await call('instances.setSettings', instance.id, patch);
      if (versionChanged) await call('instances.setVersion', instance.id, { mcVersion: mc, loader, loaderVersion });
      app.toast(t('Opciones guardadas'), { type: 'success' });
      onResolve(true);
    } catch (e) {
      app.showError(e);
      setBusy(false);
    }
  };

  const maxMem = Math.max(1024, Math.floor((app.appState ? app.appState.totalMemoryMb : 8192) / 512) * 512);
  const javaOptions = useMemo(() => [{ value: '', label: t('Elegir automáticamente') }, ...(javas || []).map((j) => ({ value: j.path, label: `Java ${j.major || '?'} — ${j.vendor || j.home}`, hint: j.path }))], [javas]);

  return (
    <Modal
      title={t('Opciones del perfil')}
      icon="listOptions"
      onClose={() => onResolve(false)}
      width={980}
      className="profile-options"
      footer={
        <>
          <span className="muted small grow">{t('Estos ajustes se guardan en el instance.cfg del perfil.')}</span>
          <Button variant="ghost" onClick={() => onResolve(false)}>
            {t('Cancelar')}
          </Button>
          <Button variant="primary" disabled={!dirty} loading={busy} onClick={save}>
            {t('Guardar')}
          </Button>
        </>
      }
    >
      {!orig ? (
        <div className="center-spinner">
          <Spinner />
        </div>
      ) : (
        <div className="options-layout">
          <div className="options-nav">
            {SECTIONS.map((s) => (
              <button key={s.id} className={`options-nav-item ${section === s.id ? 'active' : ''}`} onClick={() => setSection(s.id)}>
                <Icon name={s.icon} size={20} />
                {s.label()}
              </button>
            ))}
          </div>
          <div className="options-content">
            {section === 'general' ? (
              <>
                <label className="label">{t('Nombre')}</label>
                <Input value={val('name')} maxLength={LIMITS.instanceName} counter onChange={(e) => set('name', e.target.value)} />
                <label className="label">{t('Notas')}</label>
                <TextArea value={val('notes')} onChange={(e) => set('notes', e.target.value)} placeholder={t('Escribe lo que quieras recordar de este perfil…')} />
                <Field label={t('Registrar tiempo de juego')} hint={t('Havi Hub cuenta las horas jugadas en este perfil')}>
                  <Toggle checked={bool('OverrideGameTime') ? bool('RecordGameTime', true) : truthy(gval('RecordGameTime', 'true'))} onChange={(v) => (set('OverrideGameTime', true), set('RecordGameTime', v))} />
                </Field>
                {instance.managed ? (
                  <div className="info-box">
                    <BrandLogo brand={instance.managed.type === 'flame' ? 'curseforge' : 'modrinth'} size={20} />
                    <span>
                      {t('Modpack gestionado')}: <strong>{instance.managed.name}</strong> ({instance.managed.type === 'flame' ? 'CurseForge' : 'Modrinth'}) — {t('versión')} {instance.managed.versionName || '?'}
                    </span>
                  </div>
                ) : null}
              </>
            ) : null}

            {section === 'version' ? (
              <>
                <p className="muted">{t('Cambiar la versión puede romper mods o mundos. Haz un respaldo antes si no estás seguro.')}</p>
                <Field label={t('Versión de Minecraft')}>
                  <Select value={mc} options={(versions.length ? versions : [{ version: mc }]).map((v) => ({ value: v.version, label: v.version }))} onChange={setMc} maxHeight={360} />
                </Field>
                <Field label={t('Cargador de mods')}>
                  <div className="loader-picker small">
                    {['vanilla', 'fabric', 'quilt', 'forge', 'neoforge'].map((l) => (
                      <button key={l} className={`loader-opt ${loader === l ? 'active' : ''}`} onClick={() => setLoader(l)}>
                        <LoaderIcon loader={l} size={18} />
                        {l === 'vanilla' ? 'Vanilla' : l === 'neoforge' ? 'NeoForge' : l[0].toUpperCase() + l.slice(1)}
                      </button>
                    ))}
                  </div>
                </Field>
                {loader !== 'vanilla' ? (
                  <Field label={t('Versión del cargador')}>
                    <Select value={loaderVersion} options={loaderVersions.slice(0, 200).map((v) => ({ value: v.version, label: v.version, hint: v.recommended ? t('Recomendada') : undefined }))} onChange={setLoaderVersion} />
                  </Field>
                ) : null}
              </>
            ) : null}

            {section === 'java' ? (
              <>
                <OverrideBlock title={t('Memoria')} enabled={bool('OverrideMemory')} onToggle={(v) => set('OverrideMemory', v)} hint={t('Global: {min} MB – {max} MB', { min: gval('MinMemAlloc', '512'), max: gval('MaxMemAlloc', '4096') })}>
                  <MemoryFields
                    max={Number(val('MaxMemAlloc', gval('MaxMemAlloc', '4096')))}
                    min={Number(val('MinMemAlloc', gval('MinMemAlloc', '512')))}
                    limit={maxMem}
                    disabled={!bool('OverrideMemory')}
                    onCommit={(m) => setPatch((p) => ({ ...p, MaxMemAlloc: m.max, MinMemAlloc: m.min }))}
                  />
                </OverrideBlock>
                <OverrideBlock title={t('Instalación de Java')} enabled={bool('OverrideJavaLocation')} onToggle={(v) => set('OverrideJavaLocation', v)}>
                  <Field label={t('Elegir Java automáticamente')} hint={t('Havi Hub elige (y descarga si hace falta) la versión de Java correcta para cada versión de Minecraft')}>
                    <Toggle checked={bool('AutomaticJava')} onChange={(v) => set('AutomaticJava', v)} disabled={!bool('OverrideJavaLocation')} />
                  </Field>
                  <div className="row">
                    <Input className="grow mono" maxLength={LIMITS.path} value={val('JavaPath', '')} placeholder={t('Ruta a java / javaw.exe')} onChange={(e) => set('JavaPath', e.target.value)} disabled={!bool('OverrideJavaLocation') || bool('AutomaticJava')} />
                    <Button icon="search" disabled={!bool('OverrideJavaLocation')} onClick={async () => setJavas(await call('prism.findJava'))}>
                      {t('Detectar')}
                    </Button>
                    <Button
                      icon="folderOpen"
                      disabled={!bool('OverrideJavaLocation')}
                      onClick={async () => {
                        const f = await call('app.pickFiles', { filters: platform === 'win32' ? [{ name: 'Java', extensions: ['exe'] }] : undefined });
                        if (f[0]) set('JavaPath', f[0]);
                      }}
                    />
                  </div>
                  {javas ? <Select value={val('JavaPath', '')} options={javaOptions} onChange={(v) => set('JavaPath', v)} /> : null}
                  <Field label={t('Ignorar comprobación de compatibilidad de Java')}>
                    <Toggle checked={bool('IgnoreJavaCompatibility')} onChange={(v) => set('IgnoreJavaCompatibility', v)} disabled={!bool('OverrideJavaLocation')} />
                  </Field>
                </OverrideBlock>
                <OverrideBlock title={t('Argumentos de la JVM')} enabled={bool('OverrideJavaArgs')} onToggle={(v) => set('OverrideJavaArgs', v)}>
                  <TextArea className="mono" maxLength={LIMITS.javaArgs} value={val('JvmArgs', gval('JvmArgs', ''))} onChange={(e) => set('JvmArgs', e.target.value)} disabled={!bool('OverrideJavaArgs')} placeholder="-XX:+UseG1GC" />
                </OverrideBlock>
              </>
            ) : null}

            {section === 'window' ? (
              <OverrideBlock title={t('Tamaño de la ventana')} enabled={bool('OverrideWindow')} onToggle={(v) => set('OverrideWindow', v)}>
                <Field label={t('Iniciar maximizada')}>
                  <Toggle checked={bool('LaunchMaximized')} onChange={(v) => set('LaunchMaximized', v)} disabled={!bool('OverrideWindow')} />
                </Field>
                <div className="row">
                  <label className="label">{t('Ancho')}</label>
                  <Input type="number" value={val('MinecraftWinWidth', gval('MinecraftWinWidth', '854'))} onChange={(e) => set('MinecraftWinWidth', Number(e.target.value))} disabled={!bool('OverrideWindow') || bool('LaunchMaximized')} />
                  <label className="label">{t('Alto')}</label>
                  <Input type="number" value={val('MinecraftWinHeight', gval('MinecraftWinHeight', '480'))} onChange={(e) => set('MinecraftWinHeight', Number(e.target.value))} disabled={!bool('OverrideWindow') || bool('LaunchMaximized')} />
                </div>
              </OverrideBlock>
            ) : null}

            {section === 'launch' ? (
              <>
                <div className="override on">
                  <div className="override-head">
                    <h4>{t('Entrar directo a un servidor')}</h4>
                    <Toggle checked={bool('JoinServerOnLaunch')} onChange={(v) => set('JoinServerOnLaunch', v)} />
                  </div>
                  <div className="override-body">
                    <Input value={val('JoinServerOnLaunchAddress')} maxLength={LIMITS.serverAddress} placeholder="play.ejemplo.net" disabled={!bool('JoinServerOnLaunch')} onChange={(e) => set('JoinServerOnLaunchAddress', e.target.value)} />
                  </div>
                </div>
                <div className="override on">
                  <div className="override-head">
                    <h4>{t('Usar una cuenta específica para este perfil')}</h4>
                    <Toggle checked={bool('UseAccountForInstance')} onChange={(v) => set('UseAccountForInstance', v)} />
                  </div>
                  <div className="override-body">
                    <Select value={val('InstanceAccountId')} disabled={!bool('UseAccountForInstance')} onChange={(v) => set('InstanceAccountId', v)} options={app.accounts.map((a) => ({ value: a.id, label: a.name }))} />
                  </div>
                </div>
                <OverrideBlock title={t('Comandos personalizados')} enabled={bool('OverrideCommands')} onToggle={(v) => set('OverrideCommands', v)} hint={t('Variables: $INST_NAME, $INST_ID, $INST_DIR, $INST_MC_DIR, $INST_JAVA, $INST_JAVA_ARGS')}>
                  <label className="label">{t('Antes de iniciar')}</label>
                  <Input className="mono" maxLength={LIMITS.path} value={val('PreLaunchCommand', gval('PreLaunchCommand'))} onChange={(e) => set('PreLaunchCommand', e.target.value)} disabled={!bool('OverrideCommands')} />
                  <label className="label">{t('Comando envoltorio (wrapper)')}</label>
                  <Input className="mono" maxLength={LIMITS.path} value={val('WrapperCommand', gval('WrapperCommand'))} onChange={(e) => set('WrapperCommand', e.target.value)} disabled={!bool('OverrideCommands')} />
                  <label className="label">{t('Después de cerrar')}</label>
                  <Input className="mono" maxLength={LIMITS.path} value={val('PostExitCommand', gval('PostExitCommand'))} onChange={(e) => set('PostExitCommand', e.target.value)} disabled={!bool('OverrideCommands')} />
                </OverrideBlock>
                <OverrideBlock
                  title={t('Variables de entorno')}
                  enabled={bool('OverrideEnv')}
                  onToggle={(v) => set('OverrideEnv', v)}
                  hint={t('Se pasan al juego al iniciar este perfil. Con "Personalizado", el perfil usa las de aquí en lugar de las globales.')}
                >
                  <EnvVarsEditor value={val('Env', gval('Env', '{}'))} onChange={(text) => set('Env', text)} disabled={!bool('OverrideEnv')} />
                </OverrideBlock>
              </>
            ) : null}

            {section === 'console' ? (
              <OverrideBlock title={t('Consola del juego')} enabled={bool('OverrideConsole')} onToggle={(v) => set('OverrideConsole', v)}>
                <Field label={t('Mostrar la consola al iniciar el juego')}>
                  <Toggle checked={bool('ShowConsole')} onChange={(v) => set('ShowConsole', v)} disabled={!bool('OverrideConsole')} />
                </Field>
                <Field label={t('Cerrar la consola cuando el juego termine')}>
                  <Toggle checked={bool('AutoCloseConsole')} onChange={(v) => set('AutoCloseConsole', v)} disabled={!bool('OverrideConsole')} />
                </Field>
              </OverrideBlock>
            ) : null}

            {section === 'advanced' ? (
              <>
                <OverrideBlock title={t('Librerías nativas')} enabled={bool('OverrideNativeWorkarounds')} onToggle={(v) => set('OverrideNativeWorkarounds', v)}>
                  <Field label={t('Usar GLFW del sistema')}>
                    <Toggle checked={bool('UseNativeGLFW')} onChange={(v) => set('UseNativeGLFW', v)} disabled={!bool('OverrideNativeWorkarounds')} />
                  </Field>
                  <LibraryPath label={t('Ruta de GLFW')} value={val('CustomGLFWPath', gval('CustomGLFWPath', ''))} disabled={!bool('OverrideNativeWorkarounds') || !bool('UseNativeGLFW')} onChange={(v) => set('CustomGLFWPath', v)} />
                  <Field label={t('Usar OpenAL del sistema')}>
                    <Toggle checked={bool('UseNativeOpenAL')} onChange={(v) => set('UseNativeOpenAL', v)} disabled={!bool('OverrideNativeWorkarounds')} />
                  </Field>
                  <LibraryPath label={t('Ruta de OpenAL')} value={val('CustomOpenALPath', gval('CustomOpenALPath', ''))} disabled={!bool('OverrideNativeWorkarounds') || !bool('UseNativeOpenAL')} onChange={(v) => set('CustomOpenALPath', v)} />
                </OverrideBlock>
                {platform === 'linux' ? (
                  <OverrideBlock title={t('Rendimiento (Linux)')} enabled={bool('OverridePerformance')} onToggle={(v) => set('OverridePerformance', v)}>
                    <Field label="Feral GameMode">
                      <Toggle checked={bool('EnableFeralGamemode')} onChange={(v) => set('EnableFeralGamemode', v)} disabled={!bool('OverridePerformance')} />
                    </Field>
                    <Field label="MangoHud">
                      <Toggle checked={bool('EnableMangoHud')} onChange={(v) => set('EnableMangoHud', v)} disabled={!bool('OverridePerformance')} />
                    </Field>
                    <Field label={t('Usar GPU dedicada')}>
                      <Toggle checked={bool('UseDiscreteGpu')} onChange={(v) => set('UseDiscreteGpu', v)} disabled={!bool('OverridePerformance')} />
                    </Field>
                    <Field label="Zink (OpenGL → Vulkan)">
                      <Toggle checked={bool('UseZink')} onChange={(v) => set('UseZink', v)} disabled={!bool('OverridePerformance')} />
                    </Field>
                  </OverrideBlock>
                ) : null}
                <div className="override on">
                  <div className="override-head">
                    <div>
                      <h4>{t('Data packs globales')}</h4>
                      <p className="muted small">{t('Carpeta de data packs que se aplica a todos los mundos (requiere un mod como Global Packs o Paxi)')}</p>
                    </div>
                    <Toggle checked={bool('GlobalDataPacksEnabled')} onChange={(v) => set('GlobalDataPacksEnabled', v)} />
                  </div>
                  <div className="override-body">
                    <Input value={val('GlobalDataPacksPath')} placeholder="datapacks" disabled={!bool('GlobalDataPacksEnabled')} onChange={(e) => set('GlobalDataPacksPath', e.target.value)} />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
