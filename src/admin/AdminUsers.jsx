import AdminLayout from './AdminLayout';
import { useAdminData } from './adminData';
import './AdminMetricPages.css';

export default function AdminUsers() {
  const { stats, dashboardDetails } = useAdminData();
  return (
    <AdminLayout>
      <div className="metric-page-heading"><div><span className="mono metric-page-kicker">Account growth</span><h1 className="admin-title">New <span className="accent">Users</span></h1><p>Accounts created during the last 30 days.</p></div><strong className="metric-page-total">{stats.newUsers.value}</strong></div>
      <section className="card metric-page-table"><div className="metric-page-section-heading"><div><span className="mono">New accounts</span><h2>Recent registrations</h2></div><span className="metric-page-note">{stats.newUsers.change}</span></div><div className="metric-ledger">{dashboardDetails.recentUsers.length ? dashboardDetails.recentUsers.map((user) => <div className="metric-ledger-row" key={user.email}><div><strong>{user.name}</strong><span className="mono">{user.email}</span></div><span className="metric-user-tier">{user.tier}</span><span className="mono metric-user-date">Joined {user.joined}</span></div>) : <p className="metric-page-empty">No accounts joined in the last 30 days.</p>}</div></section>
    </AdminLayout>
  );
}