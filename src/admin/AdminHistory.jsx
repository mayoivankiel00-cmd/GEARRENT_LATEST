import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import Icon from '../components/Icon';
import { formatPeso } from '../lib/pricing';
import { useAdminData } from './adminData';
import './AdminHistory.css';

const statusMeta = {
  active: { text: 'Active', cls: 'active' },
  overdue: { text: 'Overdue', cls: 'overdue' },
  completed: { text: 'Completed', cls: 'completed' },
};

const depositLabels = {
  held: 'Held by Gear Rent',
  refunded: 'Refunded in full',
  partially_kept: 'Partly kept',
  kept: 'Kept',
};

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : null;
}

// Everything the dashboard snapshot knows about one rental.
function RentalDetails({ rental, onClose }) {
  const d = rental.details;

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = [
    ['Renter', <>{rental.account}<span className="history-detail-sub">{d.accountEmail} · {rental.accountType}</span></>],
    ['Gear', rental.items.join(', ')],
    ['Owner', d.owner],
    ['Rental length', `${d.days} day${d.days === 1 ? '' : 's'}`],
    ['Paid', formatDateTime(d.paidAt) || 'Not recorded'],
    ['Handed over (clock started)', formatDateTime(d.rentedAt) || 'Waiting for handover'],
    ['Due back', formatDateTime(d.returnAt) || 'Set when the rental starts'],
    ['Returned', formatDateTime(d.finishedAt) || (rental.status === 'completed' ? 'Not recorded' : 'Not yet')],
    ['Rental fee', formatPeso(d.amount)],
    ['Service fee', d.serviceFee ? formatPeso(d.serviceFee) : 'Charged on another item in this checkout'],
    ['Security deposit', `${formatPeso(d.securityDeposit)} · ${depositLabels[d.depositStatus] || d.depositStatus || 'Unknown'}`],
  ];

  return (
    <div className="history-detail-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="card history-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="history-detail-head">
          <div>
            <span className="mono history-detail-id">#{rental.id}</span>
            <h2 id="history-detail-title">{rental.items.join(', ')}</h2>
          </div>
          <span className={`status-pill ${statusMeta[rental.status].cls}`}>{statusMeta[rental.status].text}</span>
          <button type="button" className="history-detail-close" onClick={onClose} aria-label="Close details">
            <Icon name="close" />
          </button>
        </div>
        <dl className="history-detail-list">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="mono">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="history-detail-actions">
          {d.accountEmail && (
            <Link className="btn btn-outline" to={`/admin/renters/${encodeURIComponent(d.accountEmail)}`}>View member</Link>
          )}
          {d.productId && <Link className="btn btn-outline" to={`/product/${d.productId}`}>View gear</Link>}
          <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminHistory() {
  const { rentalLog } = useAdminData();
  const [accountFilter, setAccountFilter] = useState('');
  const [orderFilter, setOrderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRental, setSelectedRental] = useState(null);

  const filtered = useMemo(() => {
    return rentalLog.filter((r) => {
      if (accountFilter && !r.account.toLowerCase().includes(accountFilter.toLowerCase())) return false;
      if (orderFilter && !r.id.toLowerCase().includes(orderFilter.toLowerCase())) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [accountFilter, orderFilter, statusFilter, rentalLog]);

  return (
    <AdminLayout>
      <h1 className="admin-title" style={{ marginBottom: '0.4rem' }}>
        Rental History <span className="accent">&amp; Account Activity</span>
      </h1>
      <p className="history-subtitle">
        Comprehensive log of all equipment dispatches, returns, and ongoing rentals.
      </p>

      <div className="card history-filters">
        <div className="filter-field">
          <label className="mono">Account Name</label>
          <input
            type="text"
            placeholder="Search account name"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          />
        </div>
        <div className="filter-field">
          <label className="mono">Order ID</label>
          <input
            type="text"
            placeholder="Search order ID"
            value={orderFilter}
            onChange={(e) => setOrderFilter(e.target.value)}
          />
        </div>
        <div className="filter-field">
          <label className="mono">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="overdue">Overdue</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="card history-table-card">
        <table className="history-table">
          <thead>
            <tr>
              <th className="mono">Rank/ID</th>
              <th className="mono">Account</th>
              <th className="mono">Gear Items</th>
              <th className="mono">Rental Period</th>
              <th className="mono">Status</th>
              <th className="mono">Revenue</th>
              <th className="mono">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={r.status === 'active' ? 'row-flagged' : ''}>
                <td className="mono order-id">#{r.id}</td>
                <td>
                  <div className="account-name">{r.account}</div>
                  <div className="mono account-type">{r.accountType}</div>
                </td>
                <td className="gear-items">
                  {r.items.map((it) => (
                    <div key={it}>{it}</div>
                  ))}
                </td>
                <td className="mono period-cell">{r.period}</td>
                <td>
                  <span className={`status-pill ${statusMeta[r.status].cls}`}>
                    {statusMeta[r.status].text}
                  </span>
                </td>
                <td className="revenue-cell">{r.revenue}</td>
                <td>
                  <button type="button" className="btn btn-outline view-details-btn" onClick={() => setSelectedRental(r)}>View Details</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">
                  No rentals match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="history-pagination">
          <span className="mono">Showing 1-{filtered.length} of {rentalLog.length} records</span>
        </div>
      </div>
      {selectedRental && <RentalDetails rental={selectedRental} onClose={() => setSelectedRental(null)} />}
    </AdminLayout>
  );
}
