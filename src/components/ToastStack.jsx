import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import './ToastStack.css';

const TOAST_META = {
  review: { icon: '⚑', title: 'Listing awaiting review', action: 'Review now', duration: 12000 },
  due: { icon: '⏰', title: 'Rental due soon', action: 'View rental', duration: 12000 },
  overdue: { icon: '!', title: 'Rental overdue', action: 'View rental', duration: 15000 },
  warning: { icon: '!', title: 'Needs attention', action: 'View', duration: 10000 },
  success: { icon: '✓', title: 'Done', action: 'View', duration: 7000 },
  info: { icon: 'i', title: 'Update', action: 'View', duration: 7000 },
};

function Toast({ toast, onDismiss }) {
  const navigate = useNavigate();
  const meta = TOAST_META[toast.type] || TOAST_META.info;
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(meta.duration);
  const startedRef = useRef(Date.now());

  // Auto-dismiss, pausing while hovered or focused.
  useEffect(() => {
    if (paused) return undefined;
    startedRef.current = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(1500, remainingRef.current - (Date.now() - startedRef.current));
    };
  }, [paused, toast.id, onDismiss]);

  const open = () => {
    onDismiss(toast.id);
    if (toast.link) navigate(toast.link);
  };

  return (
    <div
      className={`toast toast-${toast.type || 'info'}`}
      role={toast.type === 'overdue' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="toast-icon" aria-hidden="true">{meta.icon}</span>
      <div className="toast-body">
        <strong>{toast.audience === 'admin' ? `Admin · ${meta.title}` : meta.title}</strong>
        <p>{toast.message}</p>
        {toast.link && (
          <button type="button" className="toast-action" onClick={open}>{meta.action} →</button>
        )}
      </div>
      <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>×</button>
      {!paused && <span className="toast-timer" style={{ animationDuration: `${remainingRef.current}ms` }} aria-hidden="true" />}
    </div>
  );
}

// Pop-up notifications for new events: listings awaiting review (admins),
// rentals due soon or overdue (renter and provider), approvals, payouts…
// Everything shown here also stays in the bell panel.
export default function ToastStack() {
  const { toasts, dismissToast } = useNotifications();
  if (!toasts.length) return null;

  return (
    <div className="toast-stack" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />)}
    </div>
  );
}
