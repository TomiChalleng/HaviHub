// CurseForge-style tooltips. Any element with data-tip="text" shows one while
// hovered (data-tip-pos: top | bottom | right | left, default top).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const GAP = 10;

function place(rect, pos, w, h) {
  let x;
  let y;
  if (pos === 'right') {
    x = rect.right + GAP;
    y = rect.top + rect.height / 2 - h / 2;
  } else if (pos === 'left') {
    x = rect.left - GAP - w;
    y = rect.top + rect.height / 2 - h / 2;
  } else if (pos === 'bottom') {
    x = rect.left + rect.width / 2 - w / 2;
    y = rect.bottom + GAP;
  } else {
    x = rect.left + rect.width / 2 - w / 2;
    y = rect.top - GAP - h;
  }
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const cx = Math.max(6, Math.min(vw - w - 6, x));
  const cy = Math.max(6, Math.min(vh - h - 6, y));
  // keep the arrow pointing at the element when the box had to move
  const arrow = pos === 'top' || pos === 'bottom' ? rect.left + rect.width / 2 - cx : rect.top + rect.height / 2 - cy;
  return { x: cx, y: cy, arrow };
}

export default function TooltipLayer() {
  const [tip, setTip] = useState(null);
  const [geo, setGeo] = useState(null);
  const box = useRef(null);

  useEffect(() => {
    let timer = null;
    let current = null;
    const hide = () => {
      clearTimeout(timer);
      current = null;
      setTip(null);
    };
    const over = (e) => {
      const el = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
      if (el === current) return;
      clearTimeout(timer);
      current = el;
      setTip(null);
      if (!el || !el.getAttribute('data-tip')) return;
      timer = setTimeout(() => {
        if (!el.isConnected) return;
        setTip({ text: el.getAttribute('data-tip'), pos: el.getAttribute('data-tip-pos') || 'top', rect: el.getBoundingClientRect(), id: Date.now() });
      }, 380);
    };
    const leaveWindow = (e) => {
      if (!e.relatedTarget) hide();
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('mouseout', leaveWindow);
    document.addEventListener('mousedown', hide, true);
    document.addEventListener('keydown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mouseout', leaveWindow);
      document.removeEventListener('mousedown', hide, true);
      document.removeEventListener('keydown', hide, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  useLayoutEffect(() => {
    if (!tip || !box.current) return setGeo(null);
    const r = box.current.getBoundingClientRect();
    setGeo(place(tip.rect, tip.pos, r.width, r.height));
    return undefined;
  }, [tip]);

  if (!tip) return null;
  return (
    <div
      ref={box}
      key={tip.id}
      className={`tip tip-${tip.pos} ${geo ? 'show' : ''}`}
      role="tooltip"
      style={geo ? { left: geo.x, top: geo.y, '--arrow': `${geo.arrow}px` } : { left: -9999, top: -9999 }}
    >
      {tip.text}
    </div>
  );
}
