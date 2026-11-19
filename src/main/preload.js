// Preload: exposes a minimal, typed bridge to the renderer.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const listeners = new Map();
ipcRenderer.on('event', (_e, channel, payload) => {
  const set = listeners.get(channel);
  if (set) for (const fn of set) fn(payload);
});

contextBridge.exposeInMainWorld('havihub', {
  call: (method, ...args) => ipcRenderer.invoke('api', method, args),
  on: (channel, fn) => {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel).add(fn);
    return () => listeners.get(channel).delete(fn);
  },
  platform: process.platform,
  // absolute path of a dropped file (File.path no longer exists in Electron)
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },
});
