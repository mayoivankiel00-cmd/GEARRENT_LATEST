import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatPeso, categories, calculateSecurityDeposit } from '../mockData';
import { useCart } from '../CartContext';
import { useProviderCatalog } from '../ProviderContext';
import ProductCard from '../components/ProductCard';
import './ProductDetail.css';

const DAYS_IN_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { catalogProducts } = useProviderCatalog();
  const product = catalogProducts.find((p) => p.id === id);

  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [added, setAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
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

  if (!product) {
    return (
      <div className="container product-not-found">
        <h2>Item not found</h2>
        <Link to="/catalog" className="btn btn-outline">
          Back to Catalog
        </Link>
      </div>
    );
  }

  const formatDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  };
  const formatDisplayDate = (dateValue) => new Date(`${dateValue}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const todayValue = formatDate(new Date());
  const days = pickup && dropoff
    ? Math.max(1, Math.ceil((new Date(`${dropoff}T00:00:00`) - new Date(`${pickup}T00:00:00`)) / 86400000))
    : 0;
  const subtotal = days * product.price;
  const deposit = calculateSecurityDeposit(product.price);
  const category = categories.find((c) => c.id === product.category);
  const similar = catalogProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const handleDayClick = (day) => {
    if (!day) return;
    const selectedDate = formatDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    if (selectedDate < todayValue) return;
    if (!pickup || dropoff) {
      setPickup(selectedDate);
      setDropoff(null);
    } else if (selectedDate >= pickup) {
      setDropoff(selectedDate);
    } else {
      setPickup(selectedDate);
    }
  };

  const handleRentNow = () => {
    if (!pickup || !dropoff) return;
    addItem(product, days);
    setAdded(true);
  };

  return (
    <div className="container product-detail">
      <div className="breadcrumb mono">
        <Link to="/catalog">Catalog</Link>
        {category && (
          <>
            {' '}
            &gt; <Link to={`/catalog?category=${category.id}`}>{category.name}</Link>
          </>
        )}{' '}
        &gt; <span>{product.name}</span>
      </div>

      <div className="product-detail-grid">
        <div className="product-media-col">
          <div className="product-hero-media">
            <img src={product.images[selectedImage]} alt={product.name} />
            {product.status === 'available' && <span className="pro-badge mono">PRO SERIES</span>}
          </div>
          <div className="product-thumb-row">
            {product.images.map((image, index) => (
              <button
                type="button"
                className={`product-thumb ${index === selectedImage ? 'selected' : ''}`}
                key={image}
                onClick={() => setSelectedImage(index)}
                aria-label={`View photo ${index + 1} of ${product.name}`}
              >
                <img src={image} alt="" loading="lazy" />
              </button>
            ))}
          </div>

          <h1 className="product-title">{product.name}</h1>
          <p className="product-description">{product.description}</p>

          <div className="spec-grid">
            {Object.entries(product.specs).map(([label, value]) => (
              <div className="spec-box" key={label}>
                <div className="mono spec-label">{label}</div>
                <div className="spec-value">{value}</div>
              </div>
            ))}
          </div>

          <h3 className="features-heading">Key Features</h3>
          <ul className="features-list">
            {product.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>

        <aside className="booking-card card">
          <div className="booking-price">
            {formatPeso(product.price)} <span className="unit">/ Day</span>
            <span className={`booking-status ${product.status === 'available' ? 'ok' : 'busy'}`}>
              {product.status === 'available' ? '✓ Available' : 'Booked'}
            </span>
          </div>

          <div className="calendar">
            <div className="calendar-header">
              <button
                type="button"
                aria-label="Previous month"
                disabled={calendarMonth.getFullYear() === new Date().getFullYear() && calendarMonth.getMonth() === new Date().getMonth()}
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
            <div className="calendar-grid mono">
              {DAYS_IN_WEEK.map((d, i) => (
                <div className="calendar-dow" key={i}>
                  {d}
                </div>
              ))}
              {calendarCells.map((day, i) => {
                const date = day ? formatDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)) : '';
                const isPast = date && date < todayValue;
                const isSelected = date && (date === pickup || date === dropoff);
                const inRange = date && pickup && dropoff && date > pickup && date < dropoff;
                return (
                  <button
                    type="button"
                    key={`${date || 'empty'}-${i}`}
                    disabled={!day || isPast}
                    className={`calendar-cell ${isSelected ? 'selected' : ''} ${inRange ? 'in-range' : ''}`}
                    onClick={() => handleDayClick(day)}
                  >
                    {day || ''}
                  </button>
                );
              })}
            </div>
            <p className="calendar-hint mono">Select a pickup date, then a return date.</p>
          </div>

          <div className="date-fields">
            <div>
              <div className="mono date-label">Pickup Date</div>
              <div className="date-box">{pickup ? formatDisplayDate(pickup) : 'Select date'}</div>
            </div>
            <div>
              <div className="mono date-label">Return Date</div>
              <div className="date-box">{dropoff ? formatDisplayDate(dropoff) : 'Select date'}</div>
            </div>
          </div>

          <div className="booking-totals">
            <div className="booking-line">
              <span>
                {formatPeso(product.price)} × {days} Days
              </span>
              <span>{formatPeso(subtotal)}</span>
            </div>
            <div className="booking-line">
              <span>Security Deposit</span>
              <span>{formatPeso(days ? deposit : 0)}</span>
            </div>
            <div className="booking-line total">
              <span>Total due today</span>
              <span>{formatPeso(days ? subtotal + deposit : 0)}</span>
            </div>
          </div>

          <button
            className="btn btn-primary btn-block"
            disabled={product.status !== 'available' || !pickup || !dropoff}
            onClick={handleRentNow}
          >
            {added ? 'Added to Cart ✓' : pickup && dropoff ? 'Rent Now' : 'Select Rental Dates'}
          </button>
          {added && (
            <button className="btn btn-outline btn-block" onClick={() => navigate('/cart')}>
              Go to Cart
            </button>
          )}
          <p className="deposit-note mono">Held by Gear Rent and returned to your account balance after the gear is returned.</p>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="similar-section">
          <div className="similar-header">
            <div>
              <h2>Similar Pro Gear</h2>
              <p className="text-muted">Complete your setup with these essentials.</p>
            </div>
            <Link to={`/catalog?category=${product.category}`} className="mono view-all">
              View All {category?.name}
            </Link>
          </div>
          <div className="similar-grid">
            {similar.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
