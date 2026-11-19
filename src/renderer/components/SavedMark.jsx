import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { t } from '../lib/i18n.js';

// A small mark at the bottom of the window, for a second, whenever a change
// was saved. It takes no room, steals no click and needs no answer.
export default function SavedMark() {
  const [n, setN] = useState(0);
  const [show, setShow] = useState(false);
  useEffect(() => {
    let timer = 0;
    const on = () => {
      if (document.querySelector('.welcome')) return; // the first-start welcome's answers need no mark
      setN((x) => x + 1);
      setShow(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShow(false), 1500);
    };
    window.addEventListener('havihub:saved', on);
    return () => {
      window.removeEventListener('havihub:saved', on);
      clearTimeout(timer);
    };
  }, []);
  if (!show) return null;
  return (
    <div key={n} className="saved-mark" role="status" aria-live="polite">
      <Icon name="check" size={16} stroke={3} />
      {t('Guardado')}
    </div>
  );
}
