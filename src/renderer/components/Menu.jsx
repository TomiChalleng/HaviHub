// Popover menus (anchored to an element or to the mouse position).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

// side='right': opens beside the anchor (bottom-aligned), for the left bar
export function Popover({ anchor, point, open, onClose, align = 'left', side = 'bottom', children, className = '', offset = 6, matchWidth = false, maxHeight }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999, minWidth: 0 });

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const el = ref.current;
    let w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left;
    let top;
    let minWidth = 0;
    if (point) {
      left = point.x;
      top = point.y;
    } else if (anchor && anchor.current) {
      const r = anchor.current.getBoundingClientRect();
      // the min-width is applied after this measure: place it with its final width
      if (matchWidth) w = Math.max(w, r.width);
      if (side === 'right') {
        left = r.right + offset + 4;
        top = r.bottom - h;
      } else {
        left = align === 'right' ? r.right - w : r.left;
        top = r.bottom + offset;
        if (top + h > vh - 8 && r.top - h - offset > 8) top = r.top - h - offset;
      }
      if (matchWidth) minWidth = r.width;
    } else return;
    left = Math.max(8, Math.min(left, vw - w - 8));
    top = Math.max(8, Math.min(top, vh - h - 8));
    setPos({ left, top, minWidth });
  }, [open, anchor, point, align, side, offset, matchWidth, children]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (anchor && anchor.current && anchor.current.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const onBlur = () => onClose();
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onBlur);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onBlur);
    };
  }, [open, onClose, anchor]);

  if (!open) return null;
  return createPortal(
    <div ref={ref} className={`popover ${className}`} style={{ left: pos.left, top: pos.top, minWidth: pos.minWidth || undefined, maxHeight }} onContextMenu={(e) => e.preventDefault()}>
      {children}
    </div>,
    document.body,
  );
}

export function MenuItem({ icon, label, onClick, danger, disabled, right, external, checked, hint }) {
  return (
    <button className={`menu-item${danger ? ' danger' : ''}`} disabled={disabled} onClick={onClick}>
      {icon !== undefined ? <span className="menu-icon">{icon ? <Icon name={icon} size={20} /> : null}</span> : null}
      <span className="menu-label">
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      {checked ? <Icon name="check" size={16} className="menu-check" /> : null}
      {right}
      {external ? <Icon name="external" size={18} className="menu-ext" /> : null}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="menu-sep" />;
}

export function MenuHeader({ children }) {
  return <div className="menu-header">{children}</div>;
}

// Hook for a simple anchored menu
export function useMenu() {
  const anchor = useRef(null);
  const [open, setOpen] = useState(false);
  return { anchor, open, setOpen, toggle: () => setOpen((o) => !o), close: () => setOpen(false) };
}

// Hook for context menus at mouse position
export function useContextMenu() {
  const [state, setState] = useState(null);
  return {
    point: state ? state.point : null,
    data: state ? state.data : null,
    open: Boolean(state),
    show: (e, data) => {
      e.preventDefault();
      e.stopPropagation();
      setState({ point: { x: e.clientX, y: e.clientY }, data });
    },
    close: () => setState(null),
  };
}
