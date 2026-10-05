import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';
import { formatPeso } from '../lib/pricing';
import Icon from '../components/Icon';
import './Payment.css';

export default function Payment() {
  const { items, total, securityDeposit, checkout } = useCart();
  const { refreshNotifications, refreshAdminNotifications } = useNotifications();
  const [receipt, setReceipt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const paid = Boolean(receipt);

  // The card form is still a simulation. What is charged, what providers
  // earn and what deposit is held are all decided by the database
  // (checkout_cart); the totals shown before paying are a preview.
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage('');
    const result = await checkout();
    setSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }
    setReceipt(result.receipt);
    refreshNotifications?.({ silent: true });
    refreshAdminNotifications?.({ silent: true });
  };

  if (paid) {
    return (
      <div className="container payment-page payment-confirmed">
        <div className="payment-icon"><Icon name="check" strokeWidth={2.4} /></div>
        <div className="eyebrow">Payment complete</div>
        <h1>Rental Confirmed</h1>
        <p>Your payment of <strong>{formatPeso(receipt.total)}</strong> was processed successfully. The following gear is now rented to you:</p>
        <div className="payment-rented-notice" aria-label="Rented products">
          {receipt.items.map((item) => (
            <div key={item.rentalId || item.productId}>
              <strong>{item.name}</strong>
              <span className="mono">{item.days} day rental · {formatPeso(item.amount)}</span>
            </div>
          ))}
        </div>
        <p className="payment-note">
          Includes {formatPeso(receipt.securityDeposit)} security deposit (held by Gear Rent and returned after the gear is back)
          and a {formatPeso(receipt.serviceFee)} service fee.
        </p>
        <Link to="/my-gears" className="btn btn-primary">View My Gears</Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container payment-page payment-confirmed">
        <div className="eyebrow">Payment</div>
        <h1>Your cart is empty</h1>
        <p>Add a rental before continuing to payment.</p>
        <Link to="/catalog" className="btn btn-primary">Browse the Catalog</Link>
      </div>
    );
  }

  return (
    <div className="container payment-page">
      <div className="breadcrumb mono"><Link to="/cart">Your Cart</Link> &gt; <span>Payment</span></div>
      <div className="payment-layout">
        <main className="payment-form-panel">
          <div className="eyebrow">Secure checkout</div>
          <h1>Payment</h1>
          <p className="payment-intro">Complete your payment to reserve your rental.</p>
          <form onSubmit={handleSubmit}>
            <div className="payment-section">
              <h2>Payment details</h2>
              <label>Cardholder name<input type="text" name="cardholder" placeholder="Full name" required /></label>
              <label>Card number<input type="text" name="cardNumber" inputMode="numeric" placeholder="0000 0000 0000 0000" minLength="12" required /></label>
              <div className="payment-fields-row">
                <label>Expiry date<input type="text" name="expiry" placeholder="MM / YY" required /></label>
                <label>Security code<input type="text" name="cvv" inputMode="numeric" placeholder="CVV" minLength="3" required /></label>
              </div>
            </div>
            {errorMessage && <p className="payment-error" role="alert">{errorMessage}</p>}
            <button type="submit" className="btn btn-primary payment-submit" disabled={submitting}>
              {submitting ? 'Processing payment…' : `Pay ${formatPeso(total)}`}
            </button>
          </form>
        </main>
        <aside className="card payment-summary">
          <div className="eyebrow">Order summary</div>
          <h2>Rental total</h2>
          {items.map(({ product, days }) => (
            <div className="payment-item" key={product.id}>
              <span>{product.name}<small>{days} day rental</small></span>
              <strong>{formatPeso(product.price * days)}</strong>
            </div>
          ))}
          <div className="payment-total"><span>Total due today</span><strong>{formatPeso(total)}</strong></div>
          <p className="payment-note">{formatPeso(securityDeposit)} is held by Gear Rent, not paid to the provider, and returned to your account balance after the gear is returned.</p>
        </aside>
      </div>
    </div>
  );
}
