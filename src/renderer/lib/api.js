// Renderer side of the bridge: call('instances.list') -> value or throws.
const bridge = typeof window !== 'undefined' ? window.havihub : null;

export class ApiError extends Error {
  constructor(err) {
    super(err.message);
    this.code = err.code;
    this.data = err.data;
  }
}

// Changes that are saved the moment they are made (a name, a setting, an
// icon…): when one goes through, the window says so with a small "Saved" mark
// (components/SavedMark.jsx), so nobody is left wondering.
const SAVES = new Set([
  'instances.rename', 'instances.setGroup', 'instances.renameGroup', 'instances.setImage', 'instances.resetImage', 'instances.setSettings', 'instances.setVersion',
  'instances.applyKeys', 'prism.setSettings', 'app.setConfigKey', 'app.setDataDir', 'app.setEngineExe', 'accounts.setActive', 'accounts.setCape', 'skins.update',
  'servers.add', 'content.setEnabled',
]);
export function saved() {
  window.dispatchEvent(new Event('havihub:saved'));
}

export async function call(method, ...args) {
  if (!bridge) throw new ApiError({ message: 'Havi Hub debe ejecutarse dentro de la app de escritorio', code: 'NO_BRIDGE' });
  const res = await bridge.call(method, ...args);
  if (!res.ok) throw new ApiError(res.error);
  if (SAVES.has(method)) saved();
  return res.value;
}

export function on(channel, fn) {
  if (!bridge) return () => {};
  return bridge.on(channel, fn);
}

export const platform = bridge ? bridge.platform : 'web';

export function pathForFile(file) {
  return bridge && bridge.pathForFile ? bridge.pathForFile(file) : '';
}
