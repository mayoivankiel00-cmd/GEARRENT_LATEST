import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import BarChart from './BarChart';
import { useAdminData } from './adminData';
import { formatPeso } from '../mockData';
import './AdminRenterDetails.css';

const statusLabels = {
  active: 'Active',
  overdue: 'Overdue',
  completed: 'Completed',
};

export default function AdminRenterDetails() {
  const { email } = useParams();
  const navigate = useNavigate();
  const { accountDetails } = useAdminData();
  const account = accountDetails[decodeURIComponent(email || '')?.trim().toLowerCase()];

  if (!account) {
    return (
      <AdminLayout>
        <Link className="mono admin-detail-back" to="/admin/renters">← Back to Gear Renters</Link>
        <div className="card admin-detail-not-found">
          <h1>Account not found</h1>
          <p>This renter account may have been removed.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <button type="button" className="mono admin-detail-back admin-detail-back-button" onClick={() => navigate('/admin/renters')}>
        ← Back to Gear Renters
      </button>
      <div className="admin-detail-heading">
        <div>
          <h1 className="admin-title">{account.name}</h1>
          <p className="admin-detail-email">{account.email}</p>
        </div>
        <span className="admin-renter-badge">{account.tier}</span>
      </div>

      <div className="admin-detail-stats">
        <div className="card admin-detail-stat"><span className="mono">Account balance</span><strong>{formatPeso(account.balance)}</strong></div>
        <div className="card admin-detail-stat"><span className="mono">Total spent</span><strong>{formatPeso(account.totalSpend)}</strong></div>
        <div className="card admin-detail-stat"><span className="mono">Active rentals</span><strong>{account.activeRentals}</strong></div>
        <div className="card admin-detail-stat"><span className="mono">Deposits held</span><strong>{formatPeso(account.depositsHeld)}</strong></div>
      </div>

      <div className="admin-detail-grid">
        <section className="card admin-detail-chart-card">
          <div className="admin-detail-card-heading">
            <div><span className="mono">Rental activity</span><h2>Six-month spend</h2></div>
            <span className="admin-detail-muted mono">Joined {account.joined}</span>
          </div>
          <BarChart data={account.monthlySpend} height={230} />
        </section>

        <section className="card admin-detail-inventory-card">
          <div className="admin-detail-card-heading"><div><span className="mono">Provider activity</span><h2>Uploaded gear</h2></div></div>
          {account.uploadedGears.length === 0 ? (
            <p className="admin-detail-empty">No gear uploaded by this account.</p>
          ) : (
            <div className="admin-detail-gear-list">
              {account.uploadedGears.map((gear) => <div className="admin-detail-gear-row" key={gear.name}><strong>{gear.name}</strong><span>{gear.price} / day</span><em>{gear.status}</em></div>)}
            </div>
          )}
        </section>
      </div>

      <section className="card admin-detail-rentals-card">
        <div className="admin-detail-card-heading"><div><span className="mono">Account activity</span><h2>Rental history</h2></div><span className="admin-detail-muted mono">{account.completedRentals} completed</span></div>
        {account.rentals.length === 0 ? <p className="admin-detail-empty">No rental transactions yet.</p> : (
          <div className="admin-detail-rental-list">
            {account.rentals.map((rental) => <div className="admin-detail-rental-row" key={rental.id}><div><strong>{rental.item}</strong><span className="mono">{rental.id} · {rental.period}</span></div><span className={`admin-detail-status ${rental.status}`}>{statusLabels[rental.status] || rental.status}</span><strong>{formatPeso(rental.amount)}</strong></div>)}
          </div>
        )}
      </section>
    </AdminLayout>
  );
}