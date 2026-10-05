import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatPeso } from '../lib/pricing';
import '../admin/AdminModeration.css';

const REFRESH_INTERVAL_MS = 30 * 1000;

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

// <input type="datetime-local"> works in local time without a zone.
function toLocalInput(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function describeError(error, fallback) {
  if (!error) return fallback;
  if (['P0001', 'P0002', '22023', '42501'].includes(error.code)) return error.message;
  return fallback;
}

// Returns waiting for inspection: rentals whose renter pressed "Return gear",
// plus overdue rentals the renter never marked (gear may be back already).
// The database decides what the caller may see (admins: all, providers:
// their own gear) and settles the deposit in confirm_rental_return().
function usePendingReturns() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('list_pending_returns');
    if (rpcError) {
      console.error('list_pending_returns failed', rpcError);
      setError(describeError(rpcError, 'Could not load returns.'));
    } else {
      setReturns(data || []);
      setError('');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { returns, loading, error, refresh };
}

function ReturnCard({ item, onConfirmed }) {
  const [damaging, setDamaging] = useState(false);
  const [damage, setDamage] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // When the owner actually got the gear back; decides the late fee and the
  // unused-day refund. Defaults to now; the row's quote is for now too.
  const [handedAt, setHandedAt] = useState(() => toLocalInput(Date.now()));
  const [quote, setQuote] = useState(item);
  const deposit = Number(item.security_deposit) || 0;
  const lateFee = Math.min(deposit, Number(quote.late_fee) || 0);
  const image = Array.isArray(item.images) ? item.images[0] : null;

  const changeHandedAt = async (value) => {
    setHandedAt(value);
    const when = new Date(value);
    if (!value || Number.isNaN(when.getTime())) return;
    const { data, error: rpcError } = await supabase.rpc('gearrent_return_quote', {
      p_rented_at: item.rented_at,
      p_return_at: item.return_at,
      p_days: item.days,
      p_rate: item.daily_rate,
      p_handed_at: when.toISOString(),
    });
    if (rpcError) {
      console.error('gearrent_return_quote failed', rpcError);
      return;
    }
    if (data?.[0]) setQuote(data[0]);
  };

  const confirm = async () => {
    const handed = new Date(handedAt);
    if (!handedAt || Number.isNaN(handed.getTime())) {
      setError('Enter when you got the gear back.');
      return;
    }
    const damageAmount = damaging ? Number(damage) || 0 : 0;
    if (damageAmount < 0) {
      setError('The damage charge cannot be negative.');
      return;
    }
    if (damageAmount > 0 && !note.trim()) {
      setError('Describe the damage so the renter knows why part of the deposit was kept.');
      return;
    }
    setBusy(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('confirm_rental_return', {
      p_rental_id: String(item.rental_id),
      p_damage_charge: damageAmount,
      p_note: note.trim() || null,
      p_handed_at: handed.toISOString(),
    });
    setBusy(false);
    if (rpcError) {
      console.error('confirm_rental_return failed', rpcError);
      setError(describeError(rpcError, 'The return could not be confirmed. Please try again.'));
      return;
    }
    onConfirmed(item, data);
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
          <strong>{formatPeso(deposit)} <small>deposit</small></strong>
        </div>
        <h2>{item.product_name}</h2>
        <p className="review-meta mono">
          {item.renter_name}{item.renter_email ? ` · ${item.renter_email}` : ''} · {item.days} day rental
        </p>
        <div className="review-specs">
          <span><b>Due</b>{formatDateTime(item.return_at)}</span>
          {item.not_requested
            ? <span><b>Renter</b>Hasn&apos;t pressed Return gear (overdue)</span>
            : <span><b>Renter says returned</b>{formatDateTime(item.return_requested_at)}</span>}
          {quote.late_days > 0
            ? <span><b>Late</b>{quote.late_days} day{quote.late_days === 1 ? '' : 's'} · {formatPeso(lateFee)} fee</span>
            : <span><b>Late</b>On time</span>}
          {quote.unused_days > 0 && <span><b>Early</b>{quote.unused_days} unused day{quote.unused_days === 1 ? '' : 's'} refunded</span>}
        </div>

        <div className="moderation-grid">
          <label className="moderation-field">When did you get the gear back?
            <input
              type="datetime-local"
              value={handedAt}
              min={item.rented_at ? toLocalInput(item.rented_at) : undefined}
              max={toLocalInput(Date.now())}
              onChange={(event) => changeHandedAt(event.target.value)}
            />
          </label>
          {!item.not_requested && (
            <div className="moderation-field">
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => changeHandedAt(toLocalInput(item.return_requested_at))}>
                Same time the renter says
              </button>
            </div>
          )}
        </div>

        {damaging && (
          <div className="moderation-grid">
            <label className="moderation-field">Damage charge (from the deposit)
              <input type="number" min="0" step="1" max={deposit - lateFee} value={damage} onChange={(event) => setDamage(event.target.value)} placeholder="0" />
            </label>
            <label className="moderation-field">What is damaged? (sent to the renter)
              <textarea rows="2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Cracked lens hood, missing battery charger." maxLength={500} />
            </label>
          </div>
        )}
        {error && <p className="moderation-status error" role="alert">{error}</p>}

        <div className="moderation-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={confirm}>
            {busy ? 'Saving…' : damaging ? 'Confirm return with damage' : 'Gear is fine, confirm return'}
          </button>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => { setDamaging((value) => !value); setError(''); }}>
            {damaging ? 'No damage' : 'Report damage…'}
          </button>
        </div>
      </div>
    </article>
  );
}

// List of returns to inspect, with a confirmation flash. `hideWhenEmpty`
// keeps the provider page clean when nothing is waiting.
export default function ReturnInspections({ hideWhenEmpty = false, title = 'Returns to inspect' }) {
  const { returns, loading, error, refresh } = usePendingReturns();
  const [flash, setFlash] = useState('');

  const handleConfirmed = (item, result) => {
    const kept = (Number(result?.late_fee) || 0) + (Number(result?.damage_charge) || 0);
    const uncovered = Number(result?.damage_uncovered) || 0;
    setFlash(`${item.product_name} return confirmed. ${formatPeso(result?.deposit_refund)} of the deposit went back to the renter`
      + `${kept > 0 ? `, ${formatPeso(kept)} was kept` : ''}.`
      + `${uncovered > 0 ? ` ${formatPeso(uncovered)} of the damage was more than the deposit and could not be collected.` : ''}`);
    refresh();
  };

  if (hideWhenEmpty && !loading && returns.length === 0 && !flash && !error) return null;

  return (
    <section className="return-inspections" aria-label={title}>
      <div className="review-toolbar">
        <span className="mono">{title} · {returns.length} waiting</span>
        <button type="button" className="btn btn-outline moderation-refresh" onClick={refresh}>Refresh</button>
      </div>
      {flash && <p className="moderation-status success moderation-flash" role="status">{flash}</p>}
      {error && <p className="moderation-status error moderation-flash" role="alert">{error}</p>}
      {loading && returns.length === 0 ? (
        <div className="card review-empty"><span>Loading…</span></div>
      ) : returns.length === 0 ? (
        <div className="card review-empty">
          <strong>Nothing to inspect.</strong>
          <span>Rentals appear here when the renter hands the gear back or the rental is overdue.</span>
        </div>
      ) : (
        <div className="review-list">
          {returns.map((item) => <ReturnCard key={item.rental_id} item={item} onConfirmed={handleConfirmed} />)}
        </div>
      )}
    </section>
  );
}
