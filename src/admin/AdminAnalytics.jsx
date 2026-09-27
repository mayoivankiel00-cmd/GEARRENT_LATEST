import AdminLayout from './AdminLayout';
import BarChart from './BarChart';
import { useAdminData } from './adminData';
import './AdminAnalytics.css';

const distColors = ['var(--accent)', '#4a4a4a', '#2a2a2a'];

export default function AdminAnalytics() {
  const { topRenters, totalUsers, userDistribution, userRentalVolume } = useAdminData();

  return (
    <AdminLayout>
      <h1 className="admin-title">
        Analytics <span className="accent">&amp; User Insights</span>
      </h1>

      <div className="analytics-top">
        <div className="card analytics-card">
          <div className="analytics-card-header">
            <span className="mono">User Rental Volume (6 Months)</span>
            <button className="btn btn-outline export-btn">Export CSV</button>
          </div>
          <BarChart data={userRentalVolume} height={240} />
        </div>

        <div className="card distribution-card">
          <div className="mono analytics-card-header">User Distribution</div>
          <div className="distribution-total">
            <div className="distribution-total-value">{totalUsers}</div>
            <div className="mono distribution-total-label">Total Users</div>
          </div>
          <div className="distribution-legend">
            {userDistribution.map((d, i) => (
              <div className="distribution-row" key={d.label}>
                <span className="distribution-dot" style={{ background: distColors[i] }} />
                <span className="distribution-name">{d.label}</span>
                <span className="mono distribution-pct">{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card top-renters-card">
        <div className="top-renters-header">
          <span className="mono">Top Renters</span>
          <a href="#" className="mono view-all-link">
            View All
          </a>
        </div>
        <table className="top-renters-table">
          <thead>
            <tr>
              <th className="mono">Rank</th>
              <th className="mono">User</th>
              <th className="mono">Category</th>
              <th className="mono">Items Rented</th>
              <th className="mono">Total Spend</th>
            </tr>
          </thead>
          <tbody>
            {topRenters.map((r) => (
              <tr key={r.rank}>
                <td className="rank-cell">#{r.rank}</td>
                <td className="name-cell">{r.name}</td>
                <td className="text-muted">{r.category}</td>
                <td>{r.items}</td>
                <td className="spend-cell">{r.spend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
