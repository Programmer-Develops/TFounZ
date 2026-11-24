import React, { useEffect } from 'react';
import { AlertCircle, Inbox, Loader2, X } from 'lucide-react';

export function Button({
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
  className = '',
  children,
  ...props
}) {
  const classes = [
    'btn',
    variant ? `btn-${variant}` : '',
    size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '',
    iconOnly ? 'btn-icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}

export function Badge({ tone = 'neutral', className = '', children }) {
  const toneClass =
    tone === 'accent'
      ? 'badge-accent'
      : tone === 'positive'
        ? 'badge-positive'
        : tone === 'live'
          ? 'badge-live'
          : tone === 'warn'
            ? 'badge-warn'
            : '';

  return (
    <span className={`badge ${toneClass} ${className}`.trim()}>
      {children}
    </span>
  );
}

export function Field({ label, htmlFor, hint, children }) {
  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function LoadingState({ label = 'Loading studio data...' }) {
  return (
    <div className="state-box">
      <Loader2 size={20} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '0.86rem' }}>{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action = null }) {
  return (
    <div className="state-box">
      <Icon size={24} color="var(--text-muted)" strokeWidth={1.6} />
      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.94rem' }}>{title}</div>
      {description && (
        <p style={{ maxWidth: 380, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onDismiss = null }) {
  if (!message) return null;
  return (
    <div className="banner-error" role="alert">
      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          style={{ width: 22, height: 22 }}
          onClick={onDismiss}
          aria-label="Close alert"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle = '', children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.02rem' }}>{title}</h3>
            {subtitle && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
