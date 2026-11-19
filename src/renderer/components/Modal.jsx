// Modal dialogs plus imperative confirm/prompt helpers.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { Button, Input } from './ui.jsx';
import { t } from '../lib/i18n.js';

export function Modal({ title, onClose, children, footer, width = 520, className = '', icon, closeOnBackdrop = true }) {
  const backdrop = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || !onClose) return;
      // with one dialog over another, Escape closes only the one on top
      const open = document.querySelectorAll('.modal-backdrop');
      if (open.length && open[open.length - 1] !== backdrop.current) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div
      ref={backdrop}
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && closeOnBackdrop && onClose) onClose();
      }}
    >
      <div className={`modal ${className}`} style={{ width }} role="dialog" aria-modal="true">
        {title ? (
          <div className="modal-head">
            {icon ? <Icon name={icon} size={22} className="modal-icon" /> : null}
            <h2>{title}</h2>
            {onClose ? (
              <button className="icon-btn modal-close" onClick={onClose} aria-label={t('Cerrar')}>
                <Icon name="x" size={20} />
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, danger, onResolve, icon }) {
  return (
    <Modal
      title={title}
      icon={icon || (danger ? 'alert' : undefined)}
      onClose={() => onResolve(false)}
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={() => onResolve(false)}>
            {cancelLabel || t('Cancelar')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} autoFocus onClick={() => onResolve(true)}>
            {confirmLabel || t('Aceptar')}
          </Button>
        </>
      }
    >
      <div className="confirm-message">{message}</div>
    </Modal>
  );
}

export function PromptDialog({ title, label, value = '', placeholder, confirmLabel, onResolve, validate, maxLength }) {
  const [v, setV] = useState(value);
  const [err, setErr] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    setTimeout(() => ref.current && ref.current.querySelector('input') && ref.current.querySelector('input').select(), 30);
  }, []);
  const submit = () => {
    const msg = validate ? validate(v) : '';
    if (msg) return setErr(msg);
    onResolve(v.trim());
  };
  return (
    <Modal
      title={title}
      onClose={() => onResolve(null)}
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={() => onResolve(null)}>
            {t('Cancelar')}
          </Button>
          <Button variant="primary" disabled={!v.trim()} onClick={submit}>
            {confirmLabel || t('Aceptar')}
          </Button>
        </>
      }
    >
      <div ref={ref} className="stack">
        {label ? <label className="label">{label}</label> : null}
        <Input
          value={v}
          maxLength={maxLength}
          counter={Boolean(maxLength)}
          placeholder={placeholder}
          autoFocus
          onChange={(e) => {
            setV(e.target.value);
            setErr('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && v.trim() && submit()}
        />
        {err ? <div className="form-error">{err}</div> : null}
      </div>
    </Modal>
  );
}
