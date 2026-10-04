import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import AdminLayout from './AdminLayout';
import { MIN_ADMIN_PASSWORD_LENGTH, createAdminAccount, isDefaultAdmin, listAdmins, setUserRole } from './adminAccounts';
import './AdminMetricPages.css';
import './AdminModeration.css';

const emptyCreateForm = { name: '', email: '', password: '', confirmPassword: '' };

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' });
}

// Only reachable through <AdminRoute>, and every action is re-checked by the
// database (admin_set_user_role / admin_list_admins), so there is no way to
// create an administrator from outside the Admin Dashboard.
export default function AdminAdmins() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [listError, setListError] = useState('');

  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createStatus, setCreateStatus] = useState({ type: '', text: '' });
  const [creating, setCreating] = useState(false);

  const [grantEmail, setGrantEmail] = useState('');
  const [grantStatus, setGrantStatus] = useState({ type: '', text: '' });
  const [granting, setGranting] = useState(false);

  const [confirmRevoke, setConfirmRevoke] = useState(null);
  const [revokeStatus, setRevokeStatus] = useState({ type: '', text: '' });

  const refresh = useCallback(async () => {
    setLoadingAdmins(true);
    const { admins: rows, error } = await listAdmins();
    setAdmins(rows);
    setListError(error || '');
    setLoadingAdmins(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateCreateField = (event) => {
    setCreateForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (creating) return;
    if (createForm.password !== createForm.confirmPassword) {
      setCreateStatus({ type: 'error', text: 'The passwords do not match.' });
      return;
    }
    setCreating(true);
    setCreateStatus({ type: '', text: '' });
    const result = await createAdminAccount(createForm);
    setCreating(false);
    if (!result.ok) {
      setCreateStatus({ type: 'error', text: result.error });
      if (result.alreadyExists) setGrantEmail(createForm.email.trim().toLowerCase());
      return;
    }
    setCreateStatus({
      type: 'success',
      text: result.needsEmailConfirmation
        ? `Administrator account created for ${createForm.email}. They must confirm their email before signing in.`
        : `Administrator account created for ${createForm.email}. Share the temporary password securely and ask them to change it.`,
    });
    setCreateForm(emptyCreateForm);
    refresh();
  };

  const handleGrant = async (event) => {
    event.preventDefault();
    if (granting) return;
    setGranting(true);
    setGrantStatus({ type: '', text: '' });
    const result = await setUserRole(grantEmail, 'admin');
    setGranting(false);
    if (!result.ok) {
      setGrantStatus({ type: 'error', text: result.error });
      return;
    }
    setGrantStatus({ type: 'success', text: `${grantEmail} is now an administrator.` });
    setGrantEmail('');
    refresh();
  };

  const handleRevoke = async (admin) => {
    if (confirmRevoke !== admin.id) {
      setConfirmRevoke(admin.id);
      return;
    }
    setConfirmRevoke(null);
    const result = await setUserRole(admin.email, 'customer');
    setRevokeStatus(result.ok
      ? { type: 'success', text: `${admin.email} no longer has administrator access.` }
      : { type: 'error', text: result.error });
    refresh();
  };

  return (
    <AdminLayout>
      <div className="metric-page-heading">
        <div>
          <span className="mono metric-page-kicker">Access control</span>
          <h1 className="admin-title">Admin <span className="accent">Accounts</span></h1>
          <p>Only administrators can create or promote other administrators.</p>
        </div>
        <strong className="metric-page-total">{admins.length}</strong>
      </div>

      <div className="moderation-grid">
        <form className="card moderation-panel" onSubmit={handleCreate}>
          <div className="moderation-panel-heading">
            <span className="mono">01 / New account</span>
            <h2>Create administrator</h2>
            <p>Creates a new login with full admin access. You stay signed in as yourself.</p>
          </div>
          <label className="moderation-field">Full name
            <input name="name" value={createForm.name} onChange={updateCreateField} placeholder="Alex Cruz" required autoComplete="off" />
          </label>
          <label className="moderation-field">Email
            <input name="email" type="email" value={createForm.email} onChange={updateCreateField} placeholder="alex@gearrent.ph" required autoComplete="off" />
          </label>
          <label className="moderation-field">Temporary password
            <input name="password" type="password" value={createForm.password} onChange={updateCreateField} minLength={MIN_ADMIN_PASSWORD_LENGTH} placeholder={`At least ${MIN_ADMIN_PASSWORD_LENGTH} characters`} required autoComplete="new-password" />
          </label>
          <label className="moderation-field">Confirm password
            <input name="confirmPassword" type="password" value={createForm.confirmPassword} onChange={updateCreateField} minLength={MIN_ADMIN_PASSWORD_LENGTH} required autoComplete="new-password" />
          </label>
          <div className="moderation-actions">
            <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating…' : 'Create admin account'}</button>
          </div>
          {createStatus.text && <p className={`moderation-status ${createStatus.type}`} role="status">{createStatus.text}</p>}
        </form>

        <form className="card moderation-panel" onSubmit={handleGrant}>
          <div className="moderation-panel-heading">
            <span className="mono">02 / Existing account</span>
            <h2>Grant admin access</h2>
            <p>Promote someone who already has a GearRent account.</p>
          </div>
          <label className="moderation-field">Account email
            <input type="email" value={grantEmail} onChange={(event) => setGrantEmail(event.target.value)} placeholder="member@studio.com" required autoComplete="off" />
          </label>
          <div className="moderation-actions">
            <button type="submit" className="btn btn-primary" disabled={granting}>{granting ? 'Granting…' : 'Grant admin access'}</button>
          </div>
          {grantStatus.text && <p className={`moderation-status ${grantStatus.type}`} role="status">{grantStatus.text}</p>}
        </form>
      </div>

      <section className="card metric-page-table">
        <div className="metric-page-section-heading">
          <div><span className="mono">Current administrators</span><h2>Who can access this dashboard</h2></div>
          <button type="button" className="btn btn-outline moderation-refresh" onClick={refresh} disabled={loadingAdmins}>Refresh</button>
        </div>
        {revokeStatus.text && <p className={`moderation-status ${revokeStatus.type}`} role="status">{revokeStatus.text}</p>}
        {listError && <p className="moderation-status error" role="alert">{listError}</p>}
        <div className="metric-ledger">
          {loadingAdmins && admins.length === 0 ? <p className="metric-page-empty">Loading…</p> : admins.map((admin) => {
            const isSelf = admin.id === user?.id;
            const isDefault = isDefaultAdmin(admin.email);
            return (
              <div className="metric-ledger-row" key={admin.id}>
                <div><strong>{admin.name || admin.email}{isSelf && <span className="moderation-you"> (you)</span>}</strong><span className="mono">{admin.email}</span></div>
                <span className="mono metric-user-date">Since {formatDate(admin.created_at)}</span>
                {isDefault ? <span className="metric-user-tier">Default admin</span> : isSelf ? <span className="metric-user-tier">Admin</span> : (
                  <button
                    type="button"
                    className={`moderation-link-btn ${confirmRevoke === admin.id ? 'danger' : ''}`}
                    onClick={() => handleRevoke(admin)}
                    onBlur={() => setConfirmRevoke((current) => (current === admin.id ? null : current))}
                  >
                    {confirmRevoke === admin.id ? 'Click again to revoke' : 'Revoke access'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </AdminLayout>
  );
}
