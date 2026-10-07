import { useEffect, useId, useRef } from 'react';
import { formatPeso } from '../lib/pricing';
import CardFields from './CardFields';
import Icon from './Icon';
import './MembershipCheckout.css';

// Membership payment as a pop-up over the Memberships page: card details on
// the left, order summary on the right (like the gear Payment page). Built
// on the native <dialog>, which handles focus, Escape and the backdrop.
export default function MembershipCheckout({ tier, price, paying, error, onPay, onClose }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const open = Boolean(tier);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => {
    if (!paying) onClose();
  };

  const discounted = tier && price < tier.price;

  return (
    <dialog
      ref={dialogRef}
      className="membership-checkout"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onMouseDown={(event) => {
        if (event.target === dialogRef.current) close();
      }}
    >
      {tier && (
        <form className="membership-checkout-layout" onSubmit={onPay} noValidate>
          <button type="button" className="membership-checkout-close" onClick={close} disabled={paying} aria-label="Close payment">
            <Icon name="close" />
          </button>

          <div className="membership-checkout-form">
            <div className="eyebrow">Secure checkout</div>
            <h2 id={titleId}>Upgrade to {tier.name}</h2>
            <p className="membership-checkout-intro">Complete your payment to activate your membership straight away.</p>

            <div className="payment-section">
              <h3>Payment details</h3>
              <CardFields />
            </div>

            {error && <p className="payment-error" role="alert">{error}</p>}

            <div className="membership-checkout-actions">
              <button type="button" className="btn btn-outline" onClick={close} disabled={paying}>Cancel</button>
              <button type="submit" className="btn btn-primary payment-submit" disabled={paying}>
                {paying ? 'Processing payment…' : `Pay ${formatPeso(price)}`}
              </button>
            </div>
          </div>

          <aside className="membership-checkout-summary" aria-label="Order summary">
            <div className="eyebrow">Order summary</div>
            <h3>{tier.name}</h3>
            <ul className="membership-checkout-perks">
              {tier.perks.map((perk) => (
                <li key={perk}><Icon name="check" strokeWidth={2.4} /> {perk}</li>
              ))}
            </ul>
            <div className="payment-item">
              <span>Monthly membership<small>{discounted ? 'Renter upgrade price' : 'Billed every month'}</small></span>
              <strong>
                {discounted && <s className="membership-checkout-was">{formatPeso(tier.price)}</s>}
                {formatPeso(price)}
              </strong>
            </div>
            <div className="payment-total"><span>Total due today</span><strong>{formatPeso(price)}</strong></div>
            {discounted && (
              <p className="payment-note">You keep everything in Gear Rent Renter.</p>
            )}
            <p className="payment-note">We only keep the last four digits of your card.</p>
          </aside>
        </form>
      )}
    </dialog>
  );
}
