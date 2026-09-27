import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { products } from '../mockData';
import { useCart } from '../CartContext';
import { formatRentalTimeRemaining, getRentalHistoryId } from '../rentalUtils';
import AccountSidebar from '../components/AccountSidebar';
import './Account.css';

export default function History() {
  const { rentedItems, rentalHistory, deletedRentalHistoryIds, removeRentalHistory } = useCart();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeHistory = rentedItems.map((rental, index) => ({
    ...rental,
    id: `active-${rental.product.id}-${index}`,
    product: rental.product,
    status: 'current',
    statusLabel: 'Current possession',
    finishedAt: rental.returnAt,
    rentalDetails: `${Number(rental.days) > 0 ? Number(rental.days) : 3} day rental`,
  }));
  const completedHistory = rentalHistory
    .map((rental, index) => {
    const finishedAt = rental.finishedAt || rental.dates?.split(' - ').pop();
    const product = rental.product || products.find((productRecord) => productRecord.id === rental.productId);
    return {
      ...rental,
      id: getRentalHistoryId({ ...rental, product, finishedAt }, index),
      product,
      status: rental.statusLabel === 'Returned' ? 'returned' : 'finished',
      statusLabel: rental.statusLabel || 'Finished renting',
      finishedAt,
      rentalDetails: rental.rentalDetails || (rental.days ? `${rental.days} day rental` : undefined),
    };
    })
    .filter((rental) => !deletedRentalHistoryIds.includes(rental.id));
  const currentHistory = activeHistory.filter((rental) => rental.product);
  const pastHistory = completedHistory.filter((rental) => rental.product);

  const getTimestamp = (value) => {
    const timestamp = Number(value);
    if (Number.isFinite(timestamp) && timestamp > 0) return timestamp;
    const parsedDate = Date.parse(value || '');
    return Number.isFinite(parsedDate) ? parsedDate : 0;
  };

  currentHistory.sort((left, right) => getTimestamp(right.rentedAt) - getTimestamp(left.rentedAt));
  pastHistory.sort((left, right) => getTimestamp(right.finishedAt) - getTimestamp(left.finishedAt));

  const formatFinishedDate = (date) => {
    if (!date) return 'Date unavailable';
    if (typeof date === 'number') {
      return new Date(date).toLocaleDateString('en-US', { dateStyle: 'medium' });
    }
    return date;
  };

  const renderRental = (rental, variant) => (
    <article className={`card rental-history-row rental-history-${variant}-row`} key={rental.id}>
      <img src={rental.product.images[0]} alt={rental.product.name} />
      <div className="rental-history-details">
        <h2>{rental.product.name}</h2>
        <span className="mono">{rental.rentalDetails || rental.dates}</span>
        <div className="rental-history-footer">
          <span className={`rental-history-status rental-history-status-${rental.status}`}>
            {rental.statusLabel}
          </span>
          <span className="mono">
            {variant === 'active'
              ? `Time remaining: ${formatRentalTimeRemaining(rental, now)}`
              : `Finished renting: ${formatFinishedDate(rental.finishedAt)}`}
          </span>
          {variant === 'past' && (
            <button
              type="button"
              className="rental-history-delete"
              aria-label={`Delete ${rental.product.name} from rental history`}
              title="Delete from rental history"
              onClick={() => removeRentalHistory(rental.id)}
            >
              <span aria-hidden="true">🗑</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );

  return (
    <div className="container account-page">
      <AccountSidebar />

      <div className="account-main">
        <div className="breadcrumb mono">
          <Link to="/profile">My Profile</Link> &gt; <span>My History</span>
        </div>
        <h1>My History</h1>
        {currentHistory.length === 0 && pastHistory.length === 0 ? (
          <p className="empty-state">You have no rental history.</p>
        ) : (
          <div className="rental-history-sections">
            {currentHistory.length > 0 && (
              <section className="rental-history-section" aria-labelledby="active-rentals-heading">
                <div className="rental-history-section-heading">
                  <div>
                    <span className="eyebrow">Current possession</span>
                    <h2 id="active-rentals-heading">Active gear</h2>
                  </div>
                  <span className="rental-history-count mono">{String(currentHistory.length).padStart(2, '0')}</span>
                </div>
                <div className="rental-history-list">
                  {currentHistory.map((rental) => renderRental(rental, 'active'))}
                </div>
              </section>
            )}

            {pastHistory.length > 0 && (
              <section className="rental-history-section" aria-labelledby="past-rentals-heading">
                <div className="rental-history-section-heading">
                  <div>
                    <span className="eyebrow">Rental archive</span>
                    <h2 id="past-rentals-heading">Past rentals</h2>
                  </div>
                  <span className="rental-history-count mono">{String(pastHistory.length).padStart(2, '0')}</span>
                </div>
                <div className="rental-history-list">
                  {pastHistory.map((rental) => renderRental(rental, 'past'))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <aside className="account-overview card">
        <h2>Account History Overview</h2>
        <div className="overview-line">
          <span>Active Rentals</span>
          <span>{String(currentHistory.length).padStart(2, '0')}</span>
        </div>
        <div className="overview-line">
          <span>Total Rentals</span>
          <span>{String(currentHistory.length + pastHistory.length).padStart(2, '0')}</span>
        </div>
        <Link to="/profile" className="btn btn-primary btn-block">Account Settings</Link>
      </aside>
    </div>
  );
}
