// Log viewer: colored levels, line numbers, wrap, search, level filter,
// recent logs picker, live tail of latest.log, upload to mclo.gs.
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { IconButton, Spinner, Checkbox, Button } from '../../components/ui.jsx';
import { Popover, MenuItem, MenuHeader, useMenu } from '../../components/Menu.jsx';
import { useApp } from '../../lib/store.jsx';
import { call, on } from '../../lib/api.js';
import { t } from '../../lib/i18n.js';
import { formatSize, timeAgo } from '../../lib/format.js';

const LINE_RE = /^(\[[^\]]*\])\s*(\[[^\]]*?\/(INFO|WARN|WARNING|ERROR|FATAL|DEBUG|TRACE)\])(:?)(.*)$/;
const CHUNK = 250;

function parse(text) {
  const out = [];
  let level = 'INFO';
  const lines = text.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  for (const raw of lines) {
    const m = LINE_RE.exec(raw);
    if (m) {
      level = m[3] === 'WARNING' ? 'WARN' : m[3] === 'FATAL' ? 'ERROR' : m[3];
      out.push({ raw, time: m[1], thread: m[2], sep: m[4], msg: m[5], level });
    } else {
      const lvl = /exception|error|caused by/i.test(raw) && level === 'INFO' ? 'INFO' : level;
      out.push({ raw, msg: raw, level: lvl, cont: true });
    }
  }
  return out;
}

function highlight(text, q) {
  if (!q) return text;
  const parts = [];
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  let i = 0;
  let idx;
  while ((idx = lower.indexOf(ql, i)) !== -1) {
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(<mark key={idx}>{text.slice(idx, idx + q.length)}</mark>);
    i = idx + q.length;
  }
  parts.push(text.slice(i));
  return parts;
}

// file: the log to show first (a crash report after a crash)
export default function LogsTab({ instance, file }) {
  const app = useApp();
  const [files, setFiles] = useState([]);
  const [current, setCurrent] = useState(file || 'logs/latest.log');
  useEffect(() => {
    if (file) setCurrent(file);
  }, [file]);
  const [text, setText] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const [numbers, setNumbers] = useState(true);
  const [wrap, setWrap] = useState(false);
  const [query, setQuery] = useState('');
  const [levels, setLevels] = useState({ INFO: true, WARN: true, ERROR: true, DEBUG: true, TRACE: true });
  const [follow, setFollow] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [matchIdx, setMatchIdx] = useState(0);
  const recent = useMenu();
  const filterMenu = useMenu();
  const areaRef = useRef(null);

  useEffect(() => {
    call('logs.list', instance.id).then(setFiles).catch(() => setFiles([]));
  }, [instance.id, file]);

  useEffect(() => {
    let alive = true;
    setText(null);
    call('logs.read', instance.id, current)
      .then((r) => {
        if (!alive) return;
        setText(r.text);
        setTruncated(r.truncated);
      })
      .catch((e) => alive && setText(`${t('No se pudo leer el log')}: ${e.message}`));
    let offA;
    let offR;
    if (current === 'logs/latest.log') {
      call('logs.watch', instance.id).catch(() => {});
      offA = on('logs:append', ({ id, text: chunk }) => id === instance.id && setText((tx) => (tx || '') + chunk));
      offR = on('logs:reset', ({ id }) => id === instance.id && setText(''));
    }
    return () => {
      alive = false;
      if (offA) offA();
      if (offR) offR();
      call('logs.unwatch', instance.id).catch(() => {});
    };
  }, [instance.id, current]);

  const lines = useMemo(() => (text ? parse(text) : []), [text]);
  const shown = useMemo(() => lines.map((l, i) => ({ ...l, n: i + 1 })).filter((l) => levels[l.level] !== false), [lines, levels]);
  const matches = useMemo(() => (query ? shown.filter((l) => l.raw.toLowerCase().includes(query.toLowerCase())).map((l) => l.n) : []), [shown, query]);

  // auto-scroll to the bottom when following
  useEffect(() => {
    const el = areaRef.current;
    if (el && follow && !query) el.scrollTop = el.scrollHeight;
  }, [shown.length, follow, query]);

  useEffect(() => setMatchIdx(0), [query]);
  useEffect(() => {
    if (!matches.length) return;
    const n = matches[Math.min(matchIdx, matches.length - 1)];
    const el = areaRef.current && areaRef.current.querySelector(`[data-n="${n}"]`);
    if (el) el.scrollIntoView({ block: 'center' });
  }, [matchIdx, matches]);

  const chunks = [];
  for (let i = 0; i < shown.length; i += CHUNK) chunks.push(shown.slice(i, i + CHUNK));
  const currentFile = files.find((f) => f.rel === current);

  return (
    <div className="logs-tab">
      <div className="logs-toolbar">
        <IconButton icon="lineNumbers" size={24} active={numbers} title={t('Números de línea')} onClick={() => setNumbers((v) => !v)} />
        <IconButton icon="wrap" size={24} active={wrap} title={t('Ajustar líneas')} onClick={() => setWrap((v) => !v)} />
        <IconButton icon="copy" size={22} title={t('Copiar todo')} onClick={() => call('app.copyText', text || '').then(() => app.toast(t('Log copiado'), { type: 'success' }))} />
        <IconButton
          icon="upload"
          size={22}
          title={t('Subir a mclo.gs y copiar el enlace')}
          disabled={uploading || !text}
          onClick={async () => {
            setUploading(true);
            try {
              const url = await call('logs.upload', text);
              await call('app.copyText', url);
              app.toast(t('Log subido. Enlace copiado: {url}', { url }), { type: 'success', duration: 9000, action: { label: t('Abrir'), onClick: () => call('app.openExternal', url) } });
            } catch (e) {
              app.showError(e);
            } finally {
              setUploading(false);
            }
          }}
        />
        <IconButton icon="folder" size={22} title={t('Abrir carpeta de logs')} onClick={() => call('instances.openFolder', instance.id, 'logs')} />
        {uploading ? <Spinner size={18} /> : null}
        <span className="spacer" />
        <div className="log-search">
          <Icon name="search" size={20} />
          <input value={query} maxLength={200} placeholder={t('Buscar en el log')} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && matches.length && setMatchIdx((i) => (e.shiftKey ? (i - 1 + matches.length) % matches.length : (i + 1) % matches.length))} />
          {query ? (
            <>
              <span className="muted small">{matches.length ? `${Math.min(matchIdx + 1, matches.length)}/${matches.length}` : '0'}</span>
              <IconButton icon="chevronUp" size={16} onClick={() => setMatchIdx((i) => (i - 1 + matches.length) % Math.max(1, matches.length))} />
              <IconButton icon="chevronDown" size={16} onClick={() => setMatchIdx((i) => (i + 1) % Math.max(1, matches.length))} />
            </>
          ) : null}
        </div>
        <IconButton
          icon="sort"
          size={22}
          title={follow ? t('Ir al inicio') : t('Ir al final (seguir el log)')}
          onClick={() => {
            const el = areaRef.current;
            if (!el) return;
            if (follow) {
              setFollow(false);
              el.scrollTop = 0;
            } else {
              setFollow(true);
              el.scrollTop = el.scrollHeight;
            }
          }}
        />
        <button ref={filterMenu.anchor} className={`icon-btn ${Object.values(levels).some((v) => !v) ? 'active' : ''}`} title={t('Filtrar niveles')} onClick={filterMenu.toggle}>
          <Icon name="filter" size={22} />
        </button>
        <Popover anchor={filterMenu.anchor} open={filterMenu.open} onClose={filterMenu.close} align="right" className="menu filter-menu">
          <MenuHeader>{t('Niveles')}</MenuHeader>
          {['INFO', 'WARN', 'ERROR', 'DEBUG'].map((l) => (
            <div key={l} className="menu-check-row">
              <Checkbox checked={levels[l]} onChange={(v) => setLevels((s) => ({ ...s, [l]: v, ...(l === 'DEBUG' ? { TRACE: v } : {}) }))} label={l} />
            </div>
          ))}
        </Popover>
      </div>
      <div
        ref={areaRef}
        className={`log-area selectable ${wrap ? 'wrap' : ''} ${numbers ? 'numbers' : ''}`}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
          if (atBottom !== follow) setFollow(atBottom);
        }}
      >
        {text === null ? (
          <div className="center-spinner">
            <Spinner />
          </div>
        ) : !text ? (
          <div className="log-empty muted">{t('El log está vacío. Inicia el juego para ver su registro aquí en tiempo real.')}</div>
        ) : (
          <>
            {truncated ? <div className="log-note">{t('Mostrando solo el final del archivo (es muy grande).')}</div> : null}
            {chunks.map((chunk, ci) => (
              <div key={ci} className="log-chunk" style={{ containIntrinsicSize: `auto ${chunk.length * 22}px` }}>
                {chunk.map((l) => (
                  <div key={l.n} data-n={l.n} className={`log-line lvl-${l.level} ${matches.length && matches[matchIdx] === l.n ? 'current-match' : ''}`}>
                    {numbers ? <span className="ln">{l.n}</span> : null}
                    <span className="lt">
                      {l.time ? (
                        <>
                          <span className="lg-time">{l.time} </span>
                          <span className="lg-thread">{l.thread}</span>
                          {l.sep}
                          <span className="lg-msg">{highlight(l.msg, query)}</span>
                        </>
                      ) : (
                        <span className="lg-msg">{highlight(l.msg, query)}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
      <button ref={recent.anchor} className="recent-logs" onClick={recent.toggle}>
        {currentFile && currentFile.name !== 'latest.log' ? currentFile.name : t('Ver logs recientes')}
        <Icon name={recent.open ? 'chevronUp' : 'chevronDown'} size={18} />
      </button>
      <Popover anchor={recent.anchor} open={recent.open} onClose={recent.close} className="menu recent-menu" maxHeight={420}>
        {files.length === 0 ? <div className="menu-header">{t('No hay logs')}</div> : null}
        {files.map((f) => (
          <MenuItem key={f.rel} icon={f.kind === 'crash' ? 'alert' : 'logs'} label={f.name} hint={`${timeAgo(f.mtime)} · ${formatSize(f.size)}`} checked={f.rel === current} onClick={() => (recent.close(), setCurrent(f.rel), setFollow(f.name === 'latest.log'))} />
        ))}
      </Popover>
      {current !== 'logs/latest.log' ? (
        <Button className="back-latest" size="sm" variant="secondary" icon="arrowLeft" onClick={() => setCurrent('logs/latest.log')}>
          latest.log
        </Button>
      ) : null}
    </div>
  );
}
