import AdminLayout from './AdminLayout';
import { useAdminData } from './adminData';
import './AdminMetricPages.css';

export default function AdminUtilization() {
  const { stats, dashboardDetails } = useAdminData();
  return (
    <AdminLayout>
      <div className="metric-page-heading"><div><span className="mono metric-page-kicker">Inventory performance</span><h1 className="admin-title">Gear <span className="accent">Utilization</span></h1><p>How much of the catalog is currently active in rentals.</p></div><strong className="metric-page-total">{stats.gearUtilization.value}</strong></div>
      <div className="utilization-summary"><div className="card metric-summary-card"><span className="mono">Active gear</span><strong>{dashboardDetails.activeGearCount}</strong><small>Currently rented or overdue</small></div><div className="card metric-summary-card"><span className="mono">Catalog size</span><strong>{dashboardDetails.catalogSize}</strong><small>Total catalog products</small></div><div className="card metric-summary-card"><span className="mono">Available gear</span><strong>{stats.activeRentals.value}</strong><small>Ready to rent now</small></div></div>
      <section className="card metric-page-table"><div className="metric-page-section-heading"><div><span className="mono">Category performance</span><h2>Active gear by category</h2></div></div><div className="utilization-list">{dashboardDetails.utilizationByCategory.length ? dashboardDetails.utilizationByCategory.map((category) => <div className="utilization-detail-row" key={category.label}><div className="utilization-detail-label"><strong>{category.label}</strong><span className="mono">{category.active} active of {category.total} total</span></div><div className="utilization-detail-track"><div style={{ width: `${Math.min(100, category.pct)}%` }} /></div><strong>{category.pct}%</strong></div>) : <p className="metric-page-empty">No catalog data available.</p>}</div></section>
    </AdminLayout>
  );
}