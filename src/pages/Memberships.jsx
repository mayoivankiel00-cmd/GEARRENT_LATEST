import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatPeso, getMembershipPrice, membershipTiers, TIER_GUEST } from '../lib/pricing';
import { getTierLevel } from '../lib/providerAccess';
import { cardLast4, validateCard } from '../lib/cardValidation';
import CardFields from '../components/CardFields';
import './Memberships.css';
import './Payment.css';

const CURRENT_PLAN_MESSAGES = [
  'You are browsing as a Gear Rent Guest. Become a Gear Rent Renter to rent gear.',
  'Your Gear Rent Renter membership is active. You can rent gear.',
  'Your Gear Rent Provider membership is active. You can rent and list gear.',
];

export default function Memberships() {
  const navigate = useNavigate();
  const {
    isAuthenticated, user, pendingSignup, createAccount, clearPendingSignup, purchaseMembership,
  } = useAuth();
  const [checkoutTier, setCheckoutTier] = useState(null);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // While a signup is pending (user hasn't picked a tier yet), don't treat
  // them as having an active account.
  const currentUser = pendingSignup ? null : (isAuthenticated ? user : null);
  const currentLevel = currentUser ? getTierLevel(currentUser) : 0;
  const currentTier = membershipTiers.find((tier) => tier.level === currentLevel) || membershipTiers[0];
  const checkoutPrice = checkoutTier ? getMembershipPrice(checkoutTier, currentLevel) : 0;

  const chooseMembership = async (tier) => {
    if (currentUser) {
      // Members can only move up (by paying). Lower tiers are already part of
      // their plan, and only an administrator can change a tier otherwise.
      if (tier.level <= currentLevel) return;
      setPaymentError('');
      setCheckoutTier(tier);
      return;
    }

    // Signed out: everyone starts on the free Guest tier.
    if (tier.level !== 0) return;

    if (!pendingSignup || typeof pendingSignup.name !== 'string' || typeof pendingSignup.email !== 'string') {
      clearPendingSignup();
      navigate('/signup');
      return;
    }

    const result = await createAccount({ ...pendingSignup, tier: TIER_GUEST });
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

  // The card form is still a simulation (see purchase_membership).
  const handlePayment = async (event) => {
    event.preventDefault();
    if (paying || !checkoutTier) return;
    const formData = new FormData(event.currentTarget);
    const cardError = validateCard(formData);
    if (cardError) {
      setPaymentError(cardError);
      return;
    }
    setPaying(true);
    setPaymentError('');
    const result = await purchaseMembership(checkoutTier.id, cardLast4(formData));
    setPaying(false);
    if (!result.ok) {
      setPaymentError(result.error);
      return;
    }
    const boughtProvider = checkoutTier.id === 'provider';
    setCheckoutTier(null);
    navigate(boughtProvider ? '/provider-gear' : '/catalog');
  };

  const tierAction = (tier) => {
    if (!currentUser) {
      if (tier.level > 0) return { label: 'Sign in to unlock', disabled: true };
      return { label: pendingSignup ? 'Create Guest Account' : tier.cta, disabled: false };
    }
    if (tier.level === currentLevel) return { label: 'Current Plan', disabled: true };
    if (tier.level < currentLevel) return { label: 'Included in your plan', disabled: true };
    return { label: `${tier.cta} · ${formatPeso(getMembershipPrice(tier, currentLevel))}`, disabled: false };
  };

  const renderPrice = (tier) => {
    if (tier.price === 0) return <div className="tier-price">Free</div>;
    const price = currentUser ? getMembershipPrice(tier, currentLevel) : tier.price;
    const discounted = price > 0 && price < tier.price;
    return (
      <>
        <div className="tier-price">
          {discounted && <span className="was-price">{formatPeso(tier.price)}</span>}
          {formatPeso(discounted ? price : tier.price)} <span className="unit">/ mo</span>
        </div>
        {discounted && <p className="tier-price-note mono">Upgrade price for Gear Rent Renter members</p>}
        {!currentUser && tier.upgradePrice != null && (
          <p className="tier-price-note mono">Only {formatPeso(tier.upgradePrice)} if you are already a Renter</p>
        )}
      </>
    );
  };

  return (
    <div className="container memberships-page">
      <div className="memberships-heading">
        <h1>Memberships</h1>
        <p>Choose how you want to use the Gear Rent community.</p>
      </div>

      {currentUser && (
        <div className={`current-membership ${currentLevel === 0 ? 'free-account' : 'provider-account'}`}>
          <div>
            <div className="eyebrow">Your account</div>
            <strong>{currentUser.name || currentUser.email}</strong>
            <p className="membership-success">{CURRENT_PLAN_MESSAGES[currentLevel]}</p>
          </div>
          <div className="current-membership-tier">
            <span className="mono">CURRENT PLAN</span>
            <strong>{currentTier.name}</strong>
            <span className="membership-status">ACTIVE PLAN</span>
          </div>
        </div>
      )}

      <div className="tiers-grid">
        {membershipTiers.map((tier) => {
          const isCurrent = currentUser ? tier.level === currentLevel : tier.level === 0;
          const action = tierAction(tier);
          return (
            <div
              className={`card tier-card ${tier.featured ? 'featured' : ''} ${isCurrent ? 'selected' : ''}`}
              key={tier.id}
            >
              <div className="eyebrow">{tier.name}</div>
              {renderPrice(tier)}
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
                className={`btn ${isCurrent ? 'btn-primary' : 'btn-outline'} btn-block`}
                onClick={() => chooseMembership(tier)}
                aria-pressed={isCurrent}
                disabled={action.disabled}
              >
                {action.label}
              </button>
            </div>
          );
        })}
      </div>

      {checkoutTier && (
        <form className="card membership-payment" onSubmit={handlePayment} noValidate>
          <div className="payment-section">
            <div className="eyebrow">Upgrade to {checkoutTier.name}</div>
            <h2>{formatPeso(checkoutPrice)} / month</h2>
            {checkoutPrice < checkoutTier.price && (
              <p className="membership-payment-note">
                Renter upgrade price (normally {formatPeso(checkoutTier.price)}). You keep everything in Gear Rent Renter.
              </p>
            )}
            <CardFields />
          </div>
          {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
          <div className="membership-payment-actions">
            <button type="button" className="btn btn-outline" onClick={() => setCheckoutTier(null)} disabled={paying}>Cancel</button>
            <button type="submit" className="btn btn-primary payment-submit" disabled={paying}>
              {paying ? 'Processing payment…' : `Pay ${formatPeso(checkoutPrice)}`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
