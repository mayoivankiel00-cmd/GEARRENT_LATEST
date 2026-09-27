import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { useNotifications } from '../NotificationContext';
import { currentUser as defaultUser, formatPeso } from '../mockData';
import AccountSidebar from '../components/AccountSidebar';
import './Account.css';

export default function Profile() {
  const { user, updateUser, requestWithdrawal } = useAuth();
  const { rentedItems, rentalHistory } = useCart();
  const { refreshNotifications } = useNotifications();
  const [transferring, setTransferring] = useState(false);
  const profileUser = user && typeof user === 'object'
    ? { ...defaultUser, ...user }
    : { ...defaultUser, name: 'New Member', email: '', tier: 'Gear Renter' };
  const [isEditing, setIsEditing] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferMessage, setTransferMessage] = useState('');
  const displayName = typeof profileUser.name === 'string' && profileUser.name.trim()
    ? profileUser.name.trim()
    : defaultUser.name;
  const displayEmail = typeof profileUser.email === 'string' && profileUser.email.trim()
    ? profileUser.email.trim()
    : defaultUser.email;
  const memberSince = profileUser.createdAt
    ? new Date(profileUser.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })
    : 'Not available';
  const activeRentals = rentedItems.length;
  const totalRentals = activeRentals + rentalHistory.length;
  const accountBalance = Number(profileUser.balance) || 0;

  const closeTransfer = () => {
    setIsTransferOpen(false);
    setTransferAmount('');
    setTransferError('');
  };

  const handleTransfer = async (event) => {
    event.preventDefault();
    if (transferring) return;
    const amount = Number(transferAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setTransferError('Enter an amount greater than zero.');
      return;
    }
    if (amount > accountBalance) {
      setTransferError('The transfer cannot be greater than your account balance.');
      return;
    }

    // The database checks the balance and records the withdrawal.
    setTransferring(true);
    const result = await requestWithdrawal(Math.round(amount * 100) / 100);
    setTransferring(false);
    if (!result.ok) {
      setTransferError(result.error);
      return;
    }
    setTransferMessage(`${formatPeso(result.amount)} transfer requested for your linked bank account.`);
    refreshNotifications({ silent: true });
    closeTransfer();
  };

  const handleCalculatorInput = (value) => {
    setTransferError('');
    setTransferAmount((current) => {
      if (value === 'clear') return '';
      if (value === 'backspace') return current.slice(0, -1);
      if (value === '.' && current.includes('.')) return current;
      if (current === '0' && value !== '.') return value;
      if (current.includes('.') && current.split('.')[1].length >= 2) return current;
      return `${current}${value}`;
    });
  };

  const setTransferPercentage = (percentage) => {
    setTransferError('');
    setTransferAmount((accountBalance * percentage / 100).toFixed(2));
  };

  const handleProfileSave = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateUser({
      name: formData.get('name').trim(),
      email: formData.get('email').trim(),
      phone: formData.get('phone').trim(),
      address: formData.get('address').trim(),
      city: formData.get('city').trim(),
      province: formData.get('province').trim(),
      postalCode: formData.get('postalCode').trim(),
    });
    setIsEditing(false);
  };

  return (
    <div className="container account-page">
      <AccountSidebar />
      <div className="account-main">
        <div className="breadcrumb mono">
          <Link to="/catalog">Home</Link> &gt; <span>My Profile</span>
        </div>
        <h1>My Profile</h1>

        <div className="card profile-card">
          <div className="profile-avatar" aria-hidden="true">
            {displayName.split(' ').map((namePart) => namePart[0]).join('')}
          </div>
          <div className="profile-info">
            <h2>{displayName}</h2>
            <p className="mono">{displayEmail}</p>
          </div>
          <span className="tier-badge">{profileUser.tier}</span>
          <button type="button" className="btn btn-outline" onClick={() => setIsEditing((editing) => !editing)}>
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        <section className="profile-balance-panel" aria-label="Account balance">
          <div>
            <span className="eyebrow">Available funds</span>
            <strong>Account balance</strong>
          </div>
          <div className="profile-balance-actions">
            <span className="profile-balance-value">{formatPeso(accountBalance)}</span>
            <button
              type="button"
              className="btn btn-outline profile-transfer-button"
              onClick={() => setIsTransferOpen(true)}
              disabled={accountBalance <= 0}
            >
              <span aria-hidden="true">↗</span> Transfer to bank
            </button>
          </div>
        </section>
        {transferMessage && <p className="refund-message" role="status">{transferMessage}</p>}

        <section className="profile-rental-snapshot" aria-labelledby="profile-rental-snapshot-heading">
          <div className="profile-rental-heading">
            <div>
              <span className="eyebrow">Rental activity</span>
              <h2 id="profile-rental-snapshot-heading">Your gear at a glance</h2>
            </div>
            <Link className="btn btn-outline" to="/history">View History</Link>
          </div>
          <div className="profile-stat-grid">
            <div className="profile-stat">
              <span className="mono">Currently rented</span>
              <strong>{String(activeRentals).padStart(2, '0')}</strong>
              <Link to="/my-gears">Open My Gears</Link>
            </div>
            <div className="profile-stat">
              <span className="mono">Completed rentals</span>
              <strong>{String(rentalHistory.length).padStart(2, '0')}</strong>
              <span>Keep building your kit history</span>
            </div>
          </div>
        </section>

        {isEditing && (
          <div className="profile-modal-backdrop" role="presentation" onMouseDown={() => setIsEditing(false)}>
            <form className="card profile-edit-form" onSubmit={handleProfileSave} onMouseDown={(event) => event.stopPropagation()}>
            <div className="profile-edit-heading">
              <div>
                <div className="eyebrow">Account details</div>
                <h3>Edit Profile</h3>
                <p>Keep your contact and delivery details up to date.</p>
              </div>
              <button type="button" className="profile-modal-close" onClick={() => setIsEditing(false)}>Close</button>
            </div>
            <div className="profile-edit-grid">
              <label className="field">Full Name<input name="name" type="text" defaultValue={displayName} required /></label>
              <label className="field">Email Address<input name="email" type="email" defaultValue={displayEmail} required /></label>
              <label className="field">Phone Number<input name="phone" type="tel" defaultValue={profileUser.phone || ''} placeholder="0917 123 4567" /></label>
              <label className="field profile-edit-wide">Address<input name="address" type="text" defaultValue={profileUser.address || ''} placeholder="House number and street" /></label>
              <label className="field">City<input name="city" type="text" defaultValue={profileUser.city || ''} placeholder="City or municipality" /></label>
              <label className="field">Province<input name="province" type="text" defaultValue={profileUser.province || ''} placeholder="Province" /></label>
              <label className="field">Postal Code<input name="postalCode" type="text" defaultValue={profileUser.postalCode || ''} placeholder="Postal code" /></label>
            </div>
            <div className="profile-edit-actions">
              <button type="button" className="btn btn-outline" onClick={() => setIsEditing(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Profile</button>
            </div>
            </form>
          </div>
        )}

        {isTransferOpen && (
          <div className="profile-modal-backdrop" role="presentation" onMouseDown={closeTransfer}>
            <form className="card profile-transfer-form" onSubmit={handleTransfer} onMouseDown={(event) => event.stopPropagation()}>
              <div className="profile-edit-heading">
                <div>
                  <div className="eyebrow">Move available funds</div>
                  <h3>Transfer to bank</h3>
                  <p>Choose how much you want to transfer from your account balance.</p>
                </div>
                <button type="button" className="profile-modal-close" onClick={closeTransfer}>Close</button>
              </div>
              <div className="profile-transfer-body">
                <div className="profile-transfer-calculator">
                  <div className="profile-transfer-display" aria-live="polite">
                    <span className="mono">Transfer amount</span>
                    <strong>{formatPeso(Number(transferAmount) || 0)}</strong>
                  </div>
                  <div className="profile-transfer-shortcuts" aria-label="Transfer amount shortcuts">
                    {[25, 50, 100].map((percentage) => (
                      <button type="button" key={percentage} onClick={() => setTransferPercentage(percentage)}>
                        {percentage === 100 ? 'MAX' : `${percentage}%`}
                      </button>
                    ))}
                  </div>
                  <div className="profile-transfer-keypad" aria-label="Transfer amount calculator">
                    {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'backspace'].map((key) => (
                      <button type="button" key={key} onClick={() => handleCalculatorInput(key)} aria-label={key === 'backspace' ? 'Backspace' : key}>
                        {key === 'backspace' ? '⌫' : key}
                      </button>
                    ))}
                    <button type="button" className="profile-transfer-clear" onClick={() => handleCalculatorInput('clear')}>Clear</button>
                  </div>
                </div>
                <span className="mono profile-transfer-available">Available: {formatPeso(accountBalance)}</span>
                {transferError && <p className="profile-transfer-error" role="alert">{transferError}</p>}
              </div>
              <div className="profile-edit-actions">
                <button type="button" className="btn btn-outline" onClick={closeTransfer}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={transferring}>{transferring ? 'Processing…' : 'Confirm Transfer'}</button>
              </div>
            </form>
          </div>
        )}

      </div>

      <aside className="account-overview card">
        <h2>Account Overview</h2>
        <div className="overview-line"><span>Membership</span><span className="highlight">{profileUser.tier}</span></div>
        <div className="overview-line"><span>Active Rentals</span><span>{String(activeRentals).padStart(2, '0')}</span></div>
        <div className="overview-line"><span>Total Rentals</span><span>{String(totalRentals).padStart(2, '0')}</span></div>
        <div className="overview-line"><span>Member Since</span><span>{memberSince}</span></div>
        <div className="overview-line"><span>Phone</span><span>{profileUser.phone || 'Not added'}</span></div>
        <div className="overview-line overview-address">
          <span>Address</span>
          <span>{[profileUser.address, profileUser.city, profileUser.province, profileUser.postalCode].filter(Boolean).join(', ') || 'Not added'}</span>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={() => setIsEditing(true)}>
          Account Settings
        </button>
      </aside>
    </div>
  );
}
