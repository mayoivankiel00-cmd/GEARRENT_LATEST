import AdminLayout from './AdminLayout';
import BarChart from './BarChart';
import { formatPeso } from '../mockData';
import { useAdminData } from './adminData';
import './AdminMetricPages.css';

const statusLabels = { active: 'Active', overdue: 'Overdue', completed: 'Completed' };

export default function AdminRevenue() {
  const { stats, revenueTrend, dashboardDetails } = useAdminData();
  return (
    <AdminLayout>
      <div className="metric-page-heading"><div><span className="mono metric-page-kicker">Financial overview</span><h1 className="admin-title">Total <span className="accent">Revenue</span></h1><p>Rental income generated from completed and active bookings.</p></div><strong className="metric-page-total">{stats.totalRevenue.value}</strong></div>
      <section className="card metric-page-chart"><div className="metric-page-section-heading"><div><span className="mono">Revenue trend</span><h2>Rental income over the last 10 weeks</h2></div><span className="metric-page-note">{stats.totalRevenue.change}</span></div><BarChart data={revenueTrend} height={300} /></section>
      <section className="card metric-page-table"><div className="metric-page-section-heading"><div><span className="mono">Revenue ledger</span><h2>Recent transactions</h2></div></div><div className="metric-ledger">{dashboardDetails.revenueTransactions.length ? dashboardDetails.revenueTransactions.map((transaction) => <div className="metric-ledger-row" key={transaction.id}><div><strong>{transaction.item}</strong><span className="mono">{transaction.account} · {transaction.id}</span></div><span className={`metric-status ${transaction.status}`}>{statusLabels[transaction.status] || transaction.status}</span><strong>{transaction.amount}</strong></div>) : <p className="metric-page-empty">No rental revenue recorded yet.</p>}</div></section>
    </AdminLayout>
  );
}