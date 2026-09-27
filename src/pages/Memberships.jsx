import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { formatPeso, membershipTiers } from '../mockData';
import './Memberships.css';

export default function Memberships() {
  const navigate = useNavigate();
  const { isAuthenticated, user, pendingSignup, createAccount, updateUser, clearPendingSignup } = useAuth();

  // While a signup is pending (user hasn't picked a tier yet), don't treat
  // them as having an active account.
  const currentUser = pendingSignup ? null : (isAuthenticated ? user : null);
  const currentTier = currentUser?.tier || 'Gear Renter';
  const canAccessProvider = Boolean(isAuthenticated && currentUser);
  const [selectedTier, setSelectedTier] = useState(
    () => currentUser
      ? membershipTiers.find((tier) => tier.name === currentTier)?.id || null
      : 'basic'
  );

  const chooseMembership = async (tier) => {
    if (tier.id === 'provider' && !canAccessProvider) return;

    setSelectedTier(tier.id);

    if (isAuthenticated && currentUser) {
      await updateUser({ tier: tier.name });
      navigate('/catalog');
      return;
    }

    if (!pendingSignup || typeof pendingSignup.name !== 'string' || typeof pendingSignup.email !== 'string') {
      clearPendingSignup();
      navigate('/signup');
      return;
    }

    const result = await createAccount({ ...pendingSignup, tier: tier.name });
    if (!result.success) {
      clearPendingSignup();
      navigate('/signin');
      return;
    }
    clearPendingSignup();
    if (result.needsEmailConfirmation) {
      navigate('/signin');
      return;
    }
    navigate('/catalog');
  };

  return (
    <div className="container memberships-page">
      <div className="memberships-heading">
        <h1>Memberships</h1>
        <p>Choose how you want to use the Gear Rent community.</p>
      </div>

      {currentUser && (
        <div className={`current-membership ${currentTier === 'Gear Renter' ? 'free-account' : 'provider-account'}`}>
          <div>
            <div className="eyebrow">Your account</div>
            <strong>{currentUser.name || currentUser.email}</strong>
            <p className="membership-success">
              {currentTier === 'Gear Provider'
                ? 'Thanks for upgrading. Your provider benefits are active.'
                : 'Your free Gear Renter plan is active.'}
            </p>
          </div>
          <div className="current-membership-tier">
            <span className="mono">CURRENT PLAN</span>
            <strong>{currentTier}</strong>
            <span className="membership-status">ACTIVE PLAN</span>
          </div>
        </div>
      )}

      <div className="tiers-grid">
        {membershipTiers.map((tier) => (
          <div
            className={`card tier-card ${tier.featured ? 'featured' : ''} ${selectedTier === tier.id ? 'selected' : ''}`}
            key={tier.id}
          >
            <div className="eyebrow">{tier.name}</div>
            <div className="tier-price">
              {formatPeso(tier.price)} <span className="unit">/ mo</span>
            </div>
            <p className="tier-desc">{tier.description}</p>
            <ul className="tier-perks">
              {tier.perks.map((p) => (
                <li key={p}>
                  <span className="check">✓</span> {p}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={`btn ${selectedTier === tier.id ? 'btn-primary' : 'btn-outline'} btn-block`}
              onClick={() => chooseMembership(tier)}
              aria-pressed={selectedTier === tier.id}
              disabled={tier.id === 'provider' && !canAccessProvider}
            >
              {tier.id === 'provider' && !canAccessProvider
                ? 'Currently Locked'
                : selectedTier === tier.id
                  ? 'Selected'
                  : tier.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
