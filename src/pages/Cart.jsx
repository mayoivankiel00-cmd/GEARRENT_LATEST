import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatPeso } from '../mockData';
import { useCart } from '../CartContext';
import AccountSidebar from '../components/AccountSidebar';
import './Cart.css';

const DAYS_IN_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function Cart() {
  const { items, removeItem, updateItemDays, subtotal, securityDeposit, serviceFee, total } = useCart();
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const { monthLabel, calendarCells } = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = new Date(year, month, 1).getDay();

    return {
      monthLabel: calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      calendarCells: [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)],
    };
  }, [calendarMonth]);

  const formatDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  };

  const openProductDetails = (product, days) => {
    const pickup = new Date();
    const returnDay = new Date(pickup);
    returnDay.setDate(returnDay.getDate() + days);
    setSelectedProduct(product);
    setSelectedImage(0);
    setPickupDate(formatDate(pickup));
    setReturnDate(formatDate(returnDay));
    setCalendarMonth(new Date(pickup.getFullYear(), pickup.getMonth(), 1));
  };

  const handleCalendarDayClick = (day) => {
    if (!day) return;
    const selectedDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    const dateValue = formatDate(selectedDate);
    if (!pickupDate || (pickupDate && returnDate)) {
      setPickupDate(dateValue);
      setReturnDate('');
    } else if (dateValue >= pickupDate) {
      setReturnDate(dateValue);
    } else {
      setPickupDate(dateValue);
    }
  };

  const updateRentalDates = () => {
    const pickup = new Date(`${pickupDate}T00:00:00`);
    const returnDay = new Date(`${returnDate}T00:00:00`);
    const days = Math.max(1, Math.ceil((returnDay - pickup) / 86400000));
    updateItemDays(selectedProduct.id, days);
    setSelectedProduct(null);
  };

  return (
    <div className="container cart-page">
      <AccountSidebar />

      <div className="cart-main">
        <div className="breadcrumb mono">
          <Link to="/catalog">Catalog</Link> &gt; <span>Your Cart</span>
        </div>
        <h1>Your Cart</h1>

        {items.length === 0 ? (
          <div className="card cart-empty">
            <p>Your cart is empty.</p>
            <Link to="/catalog" className="btn btn-primary">
              Browse the Catalog
            </Link>
          </div>
        ) : (
          <div className="cart-items">
            {items.map(({ product, days }) => (
              <div className="cart-item card" key={product.id}>
                <button type="button" className="cart-item-product" onClick={() => openProductDetails(product, days)}>
                  <div className="cart-item-media">
                    <img src={product.images[0]} alt={product.name} />
                  </div>
                  <div className="cart-item-info">
                    <h3>{product.name}</h3>
                    <p className="mono cart-item-dates">{days} Day rental</p>
                  </div>
                </button>
                <div className="cart-item-price">
                  <div>
                    {formatPeso(product.price)} <span className="unit">/ day</span>
                  </div>
                  <div className="cart-item-total">{formatPeso(product.price * days)}</div>
                </div>
                <button
                  className="cart-item-remove"
                  aria-label={`Remove ${product.name}`}
                  onClick={() => removeItem(product.id)}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <aside className="order-summary card">
          <h2>Order Summary</h2>
          <div className="summary-line">
            <span>Subtotal</span>
            <span>{formatPeso(subtotal)}</span>
          </div>
          <div className="summary-line">
            <span>Security Deposit</span>
            <span>{formatPeso(securityDeposit)}</span>
          </div>
          <div className="summary-line">
            <span>Service Fee</span>
            <span>{formatPeso(serviceFee)}</span>
          </div>
          <div className="summary-line total">
            <span>Total due today</span>
            <span>{formatPeso(total)}</span>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/payment')}>
            Proceed to Rent
          </button>
          <p className="deposit-note mono">Security deposit is held by Gear Rent, not the provider, and returned to your account balance after return.</p>
        </aside>
      )}

      {selectedProduct && (
        <div className="cart-product-modal-backdrop" role="presentation" onMouseDown={() => setSelectedProduct(null)}>
          <section
            className="card cart-product-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-product-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="cart-product-modal-close"
              aria-label="Close product details"
              onClick={() => setSelectedProduct(null)}
            >
              ×
            </button>
            <div className="cart-product-modal-left">
              <div className="cart-product-modal-gallery">
                <div className="cart-product-modal-hero">
                  <img src={selectedProduct.images[selectedImage]} alt={selectedProduct.name} />
                </div>
                <div className="cart-product-modal-thumbnails" aria-label="Product photos">
                  {selectedProduct.images.map((image, index) => (
                    <button
                      type="button"
                      className={index === selectedImage ? 'selected' : ''}
                      key={image}
                      onClick={() => setSelectedImage(index)}
                      aria-label={`View photo ${index + 1}`}
                    >
                      <img src={image} alt="" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="cart-product-modal-copy">
                <div className="eyebrow">Product details</div>
                <h2 id="cart-product-modal-title">{selectedProduct.name}</h2>
                <div className="cart-product-modal-price-row">
                  <strong>{formatPeso(selectedProduct.price)} <span>/ day</span></strong>
                  <span className={`cart-product-modal-status ${selectedProduct.status}`}>
                    {selectedProduct.status === 'available' ? 'Available' : 'Currently booked'}
                  </span>
                </div>
                <p>{selectedProduct.description}</p>
                <div className="cart-product-modal-specs">
                  {['Capacity', 'Weight', 'Sensor', 'Rating'].map((label) => (
                    <div key={label}>
                      <span className="mono">{label}</span>
                      <strong>{selectedProduct.specs[label] || 'Not listed'}</strong>
                    </div>
                  ))}
                </div>
                <h3>Key Features</h3>
                <ul className="cart-product-modal-features">
                  {selectedProduct.features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
              </div>
            </div>
            <aside className="cart-rental-editor">
              <div className="eyebrow">Rental calendar</div>
              <h3>Choose your dates</h3>
              <p className="cart-rental-help">Set the pickup and return dates for this rental.</p>
              <div className="cart-calendar">
                <div className="cart-calendar-header">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                  >
                    ‹
                  </button>
                  <span className="mono">{monthLabel}</span>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                  >
                    ›
                  </button>
                </div>
                <div className="cart-calendar-grid mono">
                  {DAYS_IN_WEEK.map((day, index) => <div className="cart-calendar-dow" key={`${day}-${index}`}>{day}</div>)}
                  {calendarCells.map((day, index) => {
                    const date = day ? formatDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)) : '';
                    const isSelected = date === pickupDate || date === returnDate;
                    const inRange = pickupDate && returnDate && date > pickupDate && date < returnDate;
                    return (
                      <button
                        type="button"
                        key={`${date || 'empty'}-${index}`}
                        disabled={!day}
                        className={`cart-calendar-cell ${isSelected ? 'selected' : ''} ${inRange ? 'in-range' : ''}`}
                        onClick={() => handleCalendarDayClick(day)}
                      >
                        {day || ''}
                      </button>
                    );
                  })}
                </div>
                <p className="mono cart-calendar-hint">Select pickup, then return date.</p>
              </div>
              <div className="cart-rental-fields">
                <label>
                  Pickup date
                  <input type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} />
                </label>
                <label>
                  Return date
                  <input
                    type="date"
                    min={pickupDate}
                    value={returnDate}
                    onChange={(event) => setReturnDate(event.target.value)}
                  />
                </label>
              </div>
              <button type="button" className="btn btn-primary btn-block" onClick={updateRentalDates}>
                Update Rental
              </button>
            </aside>
          </section>
        </div>
      )}
    </div>
  );
}
