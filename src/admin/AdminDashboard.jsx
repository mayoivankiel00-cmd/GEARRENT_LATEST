import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import BarChart from './BarChart';
import { useAdminData } from './adminData';
import './AdminDashboard.css';

const statMeta = [
  { key: 'totalRevenue', label: 'Total Revenue', icon: '↗' },
  { key: 'activeRentals', label: 'Available Gear', icon: '🗂' },
  { key: 'newUsers', label: 'New Users', icon: '👤' },
  { key: 'gearUtilization', label: 'Gear Util. %', icon: '◔' },
];

const statusLabels = {
  overdue: { text: 'Overdue', cls: 'overdue' },
  'on-set': { text: 'On Set', cls: 'on-set' },
  returned: { text: 'Returned', cls: 'returned' },
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { stats, recentTransactions, revenueTrend, dashboardDetails } = useAdminData();
  const [selectedMetric, setSelectedMetric] = useState(null);
  const selectedStat = statMeta.find((stat) => stat.key === selectedMetric);

  const renderMetricDetails = () => {
    if (selectedMetric === 'totalRevenue') {
      return dashboardDetails.revenueTransactions.length > 0 ? dashboardDetails.revenueTransactions.map((transaction) => (
        <div className="metric-detail-row" key={transaction.id}>
          <div><strong>{transaction.item}</strong><span className="mono">{transaction.account} · {transaction.id}</span></div>
          <strong>{transaction.amount}</strong>
        </div>
      )) : <p className="metric-detail-empty">No rental revenue recorded yet.</p>;
    }
    if (selectedMetric === 'activeRentals') {
      return dashboardDetails.availableGear.length > 0 ? dashboardDetails.availableGear.map((gear) => (
        <div className="metric-detail-row" key={gear.name}>
          <div><strong>{gear.name}</strong><span className="mono">{gear.category}</span></div>
          <strong>{gear.price}<small> / day</small></strong>
        </div>
      )) : <p className="metric-detail-empty">No gear is currently marked available.</p>;
    }
    if (selectedMetric === 'newUsers') {
      return dashboardDetails.recentUsers.length > 0 ? dashboardDetails.recentUsers.map((user) => (
        <div className="metric-detail-row" key={user.email}>
          <div><strong>{user.name}</strong><span className="mono">{user.email}</span></div>
          <span className="metric-detail-tag">{user.tier} · {user.joined}</span>
        </div>
      )) : <p className="metric-detail-empty">No accounts joined in the last 30 days.</p>;
    }
    return dashboardDetails.utilizationByCategory.length > 0 ? dashboardDetails.utilizationByCategory.map((category) => (
      <div className="metric-utilization-row" key={category.label}>
        <div className="metric-utilization-label"><strong>{category.label}</strong><span className="mono">{category.active} active / {category.total} total</span></div>
        <div className="metric-utilization-track"><div style={{ width: `${Math.min(100, category.pct)}%` }} /></div>
        <strong>{category.pct}%</strong>
      </div>
    )) : <p className="metric-detail-empty">No catalog gear is available for utilization analysis.</p>;
  };

  return (
    <AdminLayout>
      <h1 className="admin-title">
        Welcome, <span className="accent">Administrator</span>
      </h1>

      <div className="stat-grid">
        {statMeta.map((s) => {
          const stat = stats[s.key];
          return (
            <button
              type="button"
              className="card stat-card stat-card-button"
              key={s.key}
              onClick={() => {
                const routes = {
                  totalRevenue: '/admin/revenue',
                  activeRentals: '/admin/gear',
                  newUsers: '/admin/users',
                  gearUtilization: '/admin/utilization',
                };
                navigate(routes[s.key]);
              }}
            >
              <div className="stat-card-top">
                <span className="mono stat-label">{s.label}</span>
                <span className="stat-icon">{s.icon}</span>
              </div>
              <div className="stat-value">{stat.value}</div>
              <div className={`stat-change ${stat.trend}`}>
                {stat.trend === 'up' && '↑ '}
                {stat.trend === 'warn' && '⚠ '}
                {stat.change}
              </div>
              {s.key === 'gearUtilization' && (
                <div className="stat-progress">
                  <div className="stat-progress-fill" style={{ width: stat.value }} />
                </div>
              )}
              <span className="stat-card-action">View details →</span>
            </button>
          );
        })}
      </div>

      <div className="dashboard-lower">
        <div className="card revenue-card">
          <div className="revenue-card-header">
            <span className="mono">Revenue Trends (30 Days)</span>
            <button className="btn btn-outline export-btn">Export CSV</button>
          </div>
          <BarChart data={revenueTrend} />
        </div>

        <div className="card transactions-card">
          <div className="mono transactions-header">Recent Transactions</div>
          <div className="transactions-list">
            {recentTransactions.map((t) => (
              <div className="transaction-row" key={t.id}>
                <div className="transaction-accent" data-status={t.status} />
                <div className="transaction-info">
                  <div className="transaction-item">{t.item}</div>
                  <div className="mono transaction-meta">
                    {t.account} • {t.id}
                  </div>
                </div>
                <div className="transaction-right">
                  <span className={`status-pill ${statusLabels[t.status].cls}`}>
                    {statusLabels[t.status].text}
                  </span>
                  <div className="transaction-amount">{t.amount}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedMetric && (
        <div className="metric-modal-backdrop" role="presentation" onMouseDown={() => setSelectedMetric(null)}>
          <section className="card metric-modal" role="dialog" aria-modal="true" aria-labelledby="metric-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="metric-modal-header">
              <div><span className="eyebrow">Dashboard metric</span><h2 id="metric-modal-title">{selectedStat.label}</h2></div>
              <button type="button" className="metric-modal-close" aria-label="Close metric details" onClick={() => setSelectedMetric(null)}>×</button>
            </div>
            <div className="metric-modal-summary"><strong>{stats[selectedMetric].value}</strong><span>{stats[selectedMetric].change}</span></div>
            <div className="metric-detail-list">{renderMetricDetails()}</div>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
