// Skin helpers for the renderer: avatar faces, procedural placeholder textures.
import { paintSkin, paintCape } from '../../shared/skinpaint.js';

function canvasFromRgba(c) {
  const cv = document.createElement('canvas');
  cv.width = c.w;
  cv.height = c.h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const img = ctx.createImageData(c.w, c.h);
  img.data.set(c.data);
  ctx.putImageData(img, 0, 0);
  return cv;
}

let defaultSkin = null;
export function defaultSkinUrl() {
  if (!defaultSkin) defaultSkin = canvasFromRgba(paintSkin({ skin: '#d9b08c', hair: '#4a3426', shirt: '#4f8fd9', pants: '#30384d', eyes: '#2a4f8f' })).toDataURL('image/png');
  return defaultSkin;
}

let defaultCape = null;
export function defaultCapeUrl() {
  if (!defaultCape) defaultCape = canvasFromRgba(paintCape({ main: '#6b6f7a', accent: '#c9ccd4' })).toDataURL('image/png');
  return defaultCape;
}

const faceCache = new Map();
// Render the 8x8 face (+ hat layer) of a skin as a crisp avatar data URL.
export function skinFace(src, size = 32) {
  const key = `${src}|${size}`;
  if (faceCache.has(key)) return Promise.resolve(faceCache.get(key));
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = size;
      cv.height = size;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, size, size);
      ctx.drawImage(img, 40, 8, 8, 8, 0, 0, size, size);
      const url = cv.toDataURL('image/png');
      faceCache.set(key, url);
      resolve(url);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Detect slim (Alex-style) arms: pixel (54, 20) is transparent on slim skins
export function detectSlim(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (img.height !== 64) return resolve(false);
      const cv = document.createElement('canvas');
      cv.width = 64;
      cv.height = 64;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const a = ctx.getImageData(54, 20, 1, 1).data[3];
      resolve(a === 0);
    };
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function dataUrlToBytes(url) {
  const b64 = url.split(',')[1];
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
