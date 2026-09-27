import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { formatPeso, membershipTiers } from '../mockData';
import './Memberships.css';
import './Payment.css';

export default function Memberships() {
  const navigate = useNavigate();
  const {
    isAuthenticated, user, pendingSignup, createAccount, updateUser, clearPendingSignup, purchaseProviderMembership,
  } = useAuth();
  const [checkoutTier, setCheckoutTier] = useState(null);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');

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

    if (isAuthenticated && currentUser) {
      if (tier.name === currentTier) return;
      if (tier.id === 'provider') {
        // Paid tier: the database only grants it after payment.
        setPaymentError('');
        setCheckoutTier(tier);
        return;
      }
      setCheckoutTier(null);
      setSelectedTier(tier.id);
      await updateUser({ tier: tier.name });
      navigate('/catalog');
      return;
    }

    setSelectedTier(tier.id);

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

  // The card form is still a simulation (see purchase_provider_membership).
  const handleProviderPayment = async (event) => {
    event.preventDefault();
    if (paying) return;
    const digits = String(new FormData(event.currentTarget).get('cardNumber') || '').replace(/\D/g, '');
    if (digits.length < 12) {
      setPaymentError('Enter a valid card number.');
      return;
    }
    setPaying(true);
    setPaymentError('');
    const result = await purchaseProviderMembership(digits.slice(-4));
    setPaying(false);
    if (!result.ok) {
      setPaymentError(result.error);
      return;
    }
    setCheckoutTier(null);
    setSelectedTier('provider');
    navigate('/provider-gear');
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

      {checkoutTier && (
        <form className="card membership-payment" onSubmit={handleProviderPayment}>
          <div className="payment-section">
            <div className="eyebrow">Upgrade to {checkoutTier.name}</div>
            <h2>{formatPeso(checkoutTier.price)} / month</h2>
            <label>Cardholder name<input type="text" name="cardholder" placeholder="Full name" autoComplete="cc-name" required /></label>
            <label>Card number<input type="text" name="cardNumber" inputMode="numeric" placeholder="0000 0000 0000 0000" autoComplete="cc-number" minLength="12" required /></label>
            <div className="payment-fields-row">
              <label>Expiry date<input type="text" name="expiry" placeholder="MM / YY" autoComplete="cc-exp" required /></label>
              <label>Security code<input type="text" name="cvv" inputMode="numeric" placeholder="CVV" autoComplete="cc-csc" minLength="3" required /></label>
            </div>
          </div>
          {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
          <div className="membership-payment-actions">
            <button type="button" className="btn btn-outline" onClick={() => setCheckoutTier(null)} disabled={paying}>Cancel</button>
            <button type="submit" className="btn btn-primary payment-submit" disabled={paying}>
              {paying ? 'Processing payment…' : `Pay ${formatPeso(checkoutTier.price)}`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
