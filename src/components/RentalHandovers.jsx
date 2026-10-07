import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatPeso } from '../lib/pricing';
import ConfirmDialog from './ConfirmDialog';
import '../admin/AdminModeration.css';

const REFRESH_INTERVAL_MS = 30 * 1000;

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function describeError(error, fallback) {
  if (!error) return fallback;
  if (/list_pending_handovers|start_rental|PGRST202/i.test(`${error.message || ''} ${error.code || ''}`)) {
    return 'The database is missing the handover functions. Run supabase/gearrent_handover_update.sql in Supabase.';
  }
  if (['P0001', 'P0002', '22023', '42501'].includes(error.code)) return error.message;
  return error.message || fallback;
}

// Paid rentals whose gear hasn't been handed over yet. The renter's time
// only starts when the owner presses Start rental (start_rental). The
// database decides what the caller may see: admins all, providers their own.
function usePendingHandovers() {
  const [handovers, setHandovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('list_pending_handovers');
    if (rpcError) {
      console.error('list_pending_handovers failed', rpcError);
      setError(describeError(rpcError, 'Could not load handovers.'));
    } else {
      setHandovers(data || []);
      setError('');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { handovers, loading, error, refresh };
}

function HandoverCard({ item, onStarted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const image = Array.isArray(item.images) ? item.images[0] : null;

  const start = async () => {
    setConfirming(false);
    if (busy) return;
    setBusy(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('start_rental', { p_rental_id: String(item.rental_id) });
    setBusy(false);
    if (rpcError) {
      console.error('start_rental failed', rpcError);
      setError(describeError(rpcError, 'The rental could not be started. Please try again.'));
      return;
    }
    onStarted(item, data);
  };

  return (
    <article className="card review-card">
      <div className="review-media">
        <div className="review-media-main">
          {image ? <img src={image} alt={item.product_name} /> : <span>No photo</span>}
        </div>
      </div>

      <div className="review-body">
        <div className="review-top">
          <span className="eyebrow">Owner: {item.owner_name}</span>
          <strong>{formatPeso(item.security_deposit)} <small>deposit</small></strong>
        </div>
        <h2>{item.product_name}</h2>
        <p className="review-meta mono">
          {item.renter_name}{item.renter_email ? ` · ${item.renter_email}` : ''}{item.renter_phone ? ` · ${item.renter_phone}` : ''}
        </p>
        <div className="review-specs">
          <span><b>Paid</b>{formatDateTime(item.paid_at)}</span>
          <span><b>Rental length</b>{item.days} day{Number(item.days) === 1 ? '' : 's'}</span>
          <span><b>Clock</b>Starts when you press Start rental</span>
        </div>
        {error && <p className="moderation-status error" role="alert">{error}</p>}
        <div className="moderation-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setConfirming(true)}>
            {busy ? 'Starting…' : 'Gear handed over, start rental'}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Start this rental?"
        message={`${item.renter_name}'s ${item.days}-day rental of ${item.product_name} starts now. Only do this once they have the gear in hand.`}
        confirmLabel="Start Rental"
        cancelLabel="Not Yet"
        onConfirm={start}
        onCancel={() => setConfirming(false)}
      />
    </article>
  );
}

// `hideWhenEmpty` keeps the provider page clean when nothing is waiting.
export default function RentalHandovers({ hideWhenEmpty = false, title = 'Waiting for handover' }) {
  const { handovers, loading, error, refresh } = usePendingHandovers();
  const [flash, setFlash] = useState('');

  const handleStarted = (item, result) => {
    setFlash(`${item.product_name} rental started for ${item.renter_name}. It is due back ${formatDateTime(result?.return_at)}.`);
    refresh();
  };

  if (hideWhenEmpty && !loading && handovers.length === 0 && !flash && !error) return null;

  return (
    <section className="return-inspections" aria-label={title}>
      <div className="review-toolbar">
        <span className="mono">{title} · {handovers.length} waiting</span>
        <button type="button" className="btn btn-outline moderation-refresh" onClick={refresh}>Refresh</button>
      </div>
      {flash && <p className="moderation-status success moderation-flash" role="status">{flash}</p>}
      {error && <p className="moderation-status error moderation-flash" role="alert">{error}</p>}
      {loading && handovers.length === 0 ? (
        <div className="card review-empty"><span>Loading…</span></div>
      ) : handovers.length === 0 ? (
        <div className="card review-empty">
          <strong>Nothing to hand over.</strong>
          <span>Paid rentals appear here until the gear is handed over. The renter&apos;s time starts when you press Start rental.</span>
        </div>
      ) : (
        <div className="review-list">
          {handovers.map((item) => <HandoverCard key={item.rental_id} item={item} onStarted={handleStarted} />)}
        </div>
      )}
    </section>
  );
}
