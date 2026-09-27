import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { useAdminData } from './adminData';
import './AdminRenters.css';

export default function AdminRenters() {
  const navigate = useNavigate();
  const { renters } = useAdminData();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRenters = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return renters;
    return renters.filter((renter) => `${renter.name} ${renter.email}`.toLowerCase().includes(query));
  }, [renters, searchTerm]);

  return (
    <AdminLayout>
      <div className="admin-renters-heading">
        <div>
          <h1 className="admin-title">Gear <span className="accent">Renters</span></h1>
          <p className="admin-renters-subtitle">Manage accounts using the Gear Renter membership.</p>
        </div>
        <div className="admin-renters-count mono">{renters.length} renter{renters.length === 1 ? '' : 's'}</div>
      </div>

      <div className="card admin-renters-toolbar">
        <label className="admin-renters-search">
          <span className="mono">Search renters</span>
          <input
            type="search"
            placeholder="Name or email"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
      </div>

      <div className="card admin-renters-table-card">
        <div className="admin-renters-table-wrap">
          <table className="admin-renters-table">
            <thead>
              <tr>
                <th className="mono">Renter</th>
                <th className="mono">Membership</th>
                <th className="mono">Joined</th>
                <th className="mono">Rentals</th>
                <th className="mono">Active</th>
                <th className="mono">Account Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredRenters.map((renter) => (
                <tr
                  key={renter.id}
                  className="admin-renter-row"
                  tabIndex="0"
                  role="link"
                  onClick={() => navigate(`/admin/renters/${encodeURIComponent(renter.email)}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/admin/renters/${encodeURIComponent(renter.email)}`);
                    }
                  }}
                >
                  <td>
                    <strong>{renter.name}</strong>
                    <span className="admin-renter-email">{renter.email}</span>
                  </td>
                  <td><span className="admin-renter-badge">{renter.tier}</span></td>
                  <td className="mono">{renter.joined}</td>
                  <td>{renter.rentalCount}</td>
                  <td>{renter.activeRentals}</td>
                  <td className="admin-renter-balance">{renter.balance}</td>
                </tr>
              ))}
              {filteredRenters.length === 0 && (
                <tr><td colSpan={6} className="admin-renters-empty">No renter accounts match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="admin-renters-footer mono">Showing {filteredRenters.length} of {renters.length} renter accounts</div>
      </div>
    </AdminLayout>
  );
}