// Formatting helpers (dates, durations, sizes, numbers)
import { t, getLanguage } from './i18n.js';

const loc = () => (getLanguage() === 'es' ? 'es-CL' : 'en-US');

export function formatDate(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString(loc(), { month: '2-digit', day: '2-digit', year: 'numeric' });
}

export function formatDateTime(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString(loc(), { dateStyle: 'medium', timeStyle: 'short' });
}

export function timeAgo(input) {
  const ms = typeof input === 'number' ? input : Date.parse(input);
  if (!ms) return '—';
  const diff = Date.now() - ms;
  const min = 60000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < hour) return t('Hace {n} min', { n: Math.max(1, Math.round(diff / min)) });
  if (diff < day) return t('Hace {n} h', { n: Math.round(diff / hour) });
  if (diff < 30 * day) return Math.round(diff / day) === 1 ? t('Ayer') : t('Hace {n} días', { n: Math.round(diff / day) });
  if (diff < 365 * day) return Math.round(diff / (30 * day)) === 1 ? t('Hace 1 mes') : t('Hace {n} meses', { n: Math.round(diff / (30 * day)) });
  return Math.round(diff / (365 * day)) === 1 ? t('Hace 1 año') : t('Hace {n} años', { n: Math.round(diff / (365 * day)) });
}

export function formatPlaytime(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 1) return `${h}h${m && h < 10 ? ` ${m}m` : ''}`;
  return `${Math.max(1, m)}m`;
}

export function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatCount(n) {
  if (!n) return '0';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function maskIp(ip) {
  if (!ip) return '';
  const [host, port] = ip.split(':');
  const parts = host.split('.');
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    return `${parts[0][0]}${'*'.repeat(Math.max(0, parts[0].length - 1))}.${'*'.repeat(parts[1].length)}.${'*'.repeat(parts[2].length)}.${parts[3]}${port ? ':' + port : ''}`;
  }
  return host.replace(/^([^.]{0,2})[^.]*/, (m, keep) => keep + '*'.repeat(Math.max(1, m.length - keep.length))) + (port ? ':' + port : '');
}

export function compareVersions(a, b) {
  const pa = String(a).split(/[.\-+]/);
  const pb = String(b).split(/[.\-+]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || '0';
    const y = pb[i] || '0';
    const nx = Number(x);
    const ny = Number(y);
    if (Number.isFinite(nx) && Number.isFinite(ny)) {
      if (nx !== ny) return nx - ny;
    } else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}
