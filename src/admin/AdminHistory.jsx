import { useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import { useAdminData } from './adminData';
import './AdminHistory.css';

const statusMeta = {
  active: { text: 'Active', cls: 'active' },
  overdue: { text: 'Overdue', cls: 'overdue' },
  completed: { text: 'Completed', cls: 'completed' },
};

export default function AdminHistory() {
  const { rentalLog } = useAdminData();
  const [accountFilter, setAccountFilter] = useState('');
  const [orderFilter, setOrderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
        <button className="btn btn-outline apply-btn">Apply Filters</button>
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
                  <button className="btn btn-outline view-details-btn">View Details</button>
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
    </AdminLayout>
  );
}
