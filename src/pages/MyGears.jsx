import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../CartContext';
import { useNotifications } from '../NotificationContext';
import { formatPeso } from '../mockData';
import { formatRentalTimeRemaining, getRentalEndTime, getRentalTimeRemaining } from '../rentalUtils';
import AccountSidebar from '../components/AccountSidebar';
import './Account.css';

export default function MyGears() {
  const { rentedItems, returnRental, finishRental } = useCart();
  const { refreshNotifications } = useNotifications();
  const [busyRentalId, setBusyRentalId] = useState(null);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });
  const [now, setNow] = useState(() => Date.now());
  const [selectedRental, setSelectedRental] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formatPaidDate = (timestamp) => timestamp
    ? new Date(timestamp).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    : 'Payment date unavailable';

  const openRentalDetails = (rental, index) => {
    setSelectedRental({ ...rental, rentalIndex: index });
    setSelectedImage(0);
  };

  // Refunds are calculated and credited by the database (return_rental /
  // finish_rental); the page only reports the result.
  const handleReturnRental = async (rentalIndex) => {
    const rental = rentedItems[rentalIndex];
    if (!rental || busyRentalId) return;
    setBusyRentalId(rental.id);
    const result = await returnRental(rentalIndex);
    setBusyRentalId(null);
    setSelectedRental(null);
    if (!result.ok) {
      setActionMessage({ type: 'error', text: result.error });
      return;
    }
    const { refundableAmount, refundedSecurityDeposit, product } = result.rental;
    setActionMessage({
      type: 'success',
      text: `${product.name} was returned. ${formatPeso(refundableAmount)} was added to your account balance, including your ${formatPeso(refundedSecurityDeposit)} security deposit.`,
    });
    refreshNotifications({ silent: true });
  };

  const handleFinishRental = async (rentalIndex) => {
    const rental = rentedItems[rentalIndex];
    if (!rental || busyRentalId) return;
    setBusyRentalId(rental.id);
    const result = await finishRental(rentalIndex);
    setBusyRentalId(null);
    setSelectedRental(null);
    if (!result.ok) {
      setActionMessage({ type: 'error', text: result.error });
      return;
    }
    setActionMessage({
      type: 'success',
      text: `${rental.product.name} was moved to rental history. Your ${formatPeso(result.rental.refundedSecurityDeposit)} security deposit was returned to your balance.`,
    });
    refreshNotifications({ silent: true });
  };

  return (
    <div className="container account-page">
      <AccountSidebar />

      <main className="account-main my-gears-page">
        <div className="breadcrumb mono">
          <Link to="/catalog">Home</Link> &gt; <span>My Gears</span>
        </div>
        <h1>My Gears</h1>
        {actionMessage.text && (
          <p className={`my-gears-message ${actionMessage.type}`} role={actionMessage.type === 'error' ? 'alert' : 'status'}>{actionMessage.text}</p>
        )}
        {rentedItems.length === 0 ? (
          <p className="empty-state">You have no rented gear.</p>
        ) : (
          <section className="rented-gears-list" aria-label="Rented gear">
            {rentedItems.map((rental, index) => {
              const { product, days, rentedAt } = rental;
              const endTime = getRentalEndTime(rental, now);
              const startTime = rentedAt || now;
              const remaining = getRentalTimeRemaining(rental, now);
              const progress = Math.min(100, Math.max(0, (remaining / (endTime - startTime)) * 100));
              const urgency = remaining === 0 ? 'ended' : progress <= 10 ? 'critical' : progress <= 25 ? 'warning' : 'normal';

              return (
              <article
                className="card rented-gear-row"
                key={`${product.id}-${index}`}
                role="button"
                tabIndex="0"
                onClick={() => openRentalDetails(rental, index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openRentalDetails(rental, index);
                  }
                }}
              >
                <button type="button" className="rented-gear-image-link" onClick={() => openRentalDetails(rental, index)} aria-label={`View ${product.name}`}>
                  <img src={product.images[0]} alt={product.name} />
                </button>
                <div>
                  <h2><button type="button" className="rented-gear-name" onClick={() => openRentalDetails(rental, index)}>{product.name}</button></h2>
                  <p>{product.description}</p>
                  <span className="mono">{days} day rental</span>
                  <span className="mono rented-gear-paid-date">Paid {formatPaidDate(rental.paidAt || rental.rentedAt)}</span>
                </div>
                <strong className="rented-gear-status">Paid</strong>
                <div className="rented-gear-progress">
                  <div className="rented-gear-progress-label">
                    <span>Rental time remaining</span>
                    <strong className={`rented-gear-time-${urgency}`}>{formatRentalTimeRemaining(rental, now)}</strong>
                  </div>
                  <div className="rented-gear-progress-track">
                    <div className={`rented-gear-progress-fill rented-gear-progress-${urgency}`} style={{ width: `${progress}%` }} />
                  </div>
                  <div className="rented-gear-actions">
                    <button
                      type="button"
                      className="btn btn-outline rented-gear-return"
                      disabled={Boolean(busyRentalId)}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleReturnRental(index);
                      }}
                    >
                      Return / Refund
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline rented-gear-finish"
                      disabled={Boolean(busyRentalId)}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleFinishRental(index);
                      }}
                    >
                      Finished renting
                    </button>
                  </div>
                </div>
              </article>
              );
            })}
          </section>
        )}
      </main>

      {selectedRental && (
        <div className="rented-gear-modal-backdrop" role="presentation" onMouseDown={() => setSelectedRental(null)}>
          <section
            className="card rented-gear-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rented-gear-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="rented-gear-modal-close" aria-label="Close product details" onClick={() => setSelectedRental(null)}>×</button>
            <div className="rented-gear-modal-gallery">
              <div className="rented-gear-modal-hero">
                <img src={selectedRental.product.images[selectedImage]} alt={selectedRental.product.name} />
              </div>
              <div className="rented-gear-modal-thumbnails" aria-label="Product photos">
                {selectedRental.product.images.map((image, index) => (
                  <button type="button" className={index === selectedImage ? 'selected' : ''} key={image} onClick={() => setSelectedImage(index)} aria-label={`View photo ${index + 1}`}>
                    <img src={image} alt="" />
                  </button>
                ))}
              </div>
              <div className="rented-gear-modal-timer">
                <div className="eyebrow">Time remaining</div>
                {(() => {
                  const endTime = getRentalEndTime(selectedRental, now);
                  const startTime = selectedRental.rentedAt || now;
                  const remaining = getRentalTimeRemaining(selectedRental, now);
                  const progress = Math.min(100, Math.max(0, (remaining / (endTime - startTime)) * 100));
                  const urgency = remaining === 0 ? 'ended' : progress <= 10 ? 'critical' : progress <= 25 ? 'warning' : 'normal';
                  return (
                    <>
                      <strong className={`rented-gear-modal-countdown rented-gear-time-${urgency}`}>{formatRentalTimeRemaining(selectedRental, now)}</strong>
                      <div className="rented-gear-progress-track"><div className={`rented-gear-progress-fill rented-gear-progress-${urgency}`} style={{ width: `${progress}%` }} /></div>
                    </>
                  );
                })()}
              </div>
              <button type="button" className="btn btn-outline btn-block rented-gear-modal-return" disabled={Boolean(busyRentalId)} onClick={() => handleReturnRental(selectedRental.rentalIndex)}>
                {busyRentalId === selectedRental.id ? 'Processing…' : <>Return Product &amp; Request Refund</>}
              </button>
            </div>
            <div className="rented-gear-modal-copy">
              <div className="eyebrow">Rented product</div>
              <h2 id="rented-gear-modal-title">{selectedRental.product.name}</h2>
              <p>{selectedRental.product.description}</p>
              <div className="rented-gear-paid-date-modal mono">
                Paid {formatPaidDate(selectedRental.paidAt || selectedRental.rentedAt)}
              </div>
              <div className="rented-gear-paid-date-modal mono">
                Security deposit held by Gear Rent: {formatPeso(Number(selectedRental.securityDeposit) || 0)}
              </div>
              <div className="rented-gear-modal-specs">
                {Object.entries(selectedRental.product.specs).map(([label, value]) => (
                  <div key={label}><span className="mono">{label}</span><strong>{value}</strong></div>
                ))}
              </div>
              <h3>Key Features</h3>
              <ul className="rented-gear-modal-features">
                {selectedRental.product.features.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
