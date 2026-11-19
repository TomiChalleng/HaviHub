// Dragging a profile (hold the mouse button on its card) to another group or
// out of its group: any part of the app can show drop targets while a drag
// is in progress.
import { useEffect, useState } from 'react';

const TYPE = 'text/havihub-instance';
let current = null;

function announce(v) {
  current = v;
  window.dispatchEvent(new CustomEvent('havihub:instance-drag', { detail: v }));
}

export function startInstanceDrag(e, inst) {
  e.dataTransfer.setData(TYPE, inst.id);
  e.dataTransfer.effectAllowed = 'move';
  // announce after the browser took its drag picture
  setTimeout(() => announce({ id: inst.id, group: inst.group || '', name: inst.name }), 0);
}

export function endInstanceDrag() {
  if (current) announce(null);
}

export function useInstanceDrag() {
  const [drag, setDrag] = useState(current);
  useEffect(() => {
    const on = (e) => setDrag(e.detail);
    window.addEventListener('havihub:instance-drag', on);
    return () => window.removeEventListener('havihub:instance-drag', on);
  }, []);
  return drag;
}

// Props for an element that accepts a dragged profile, and whether one is over it
export function useDropTarget(onDrop) {
  const [over, setOver] = useState(false);
  const props = {
    onDragOver: (e) => {
      if (!e.dataTransfer.types.includes(TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!over) setOver(true);
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setOver(false);
    },
    onDrop: (e) => {
      setOver(false);
      const id = e.dataTransfer.getData(TYPE);
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      endInstanceDrag();
      onDrop(id);
    },
  };
  return [props, over];
}
